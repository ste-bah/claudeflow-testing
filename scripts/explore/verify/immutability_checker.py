#!/usr/bin/env python3
"""
Phase 11 Immutability Verification

Ensures that Phase 11 operations maintain architectural invariants:
1. Phase 1-9 artifacts are never mutated
2. All operations are read-only or additive
3. Provenance chains remain intact
4. No silent failures

Usage:
    python immutability_checker.py --baseline
    python immutability_checker.py --verify
    python immutability_checker.py --watch
"""

import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
import argparse


@dataclass
class FileSnapshot:
    """Snapshot of a file's state for immutability checking."""
    path: str
    sha256: str
    size: int
    modified_time: float
    line_count: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            'path': self.path,
            'sha256': self.sha256,
            'size': self.size,
            'modified_time': self.modified_time,
            'line_count': self.line_count
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'FileSnapshot':
        return cls(**data)


@dataclass
class ImmutabilityReport:
    """Report of immutability verification results."""
    timestamp: str
    status: str  # 'pass', 'fail', 'warning'
    violations: List[dict] = field(default_factory=list)
    warnings: List[dict] = field(default_factory=list)
    checked_files: int = 0
    immutable_files: int = 0

    def add_violation(self, file_path: str, reason: str, details: dict):
        """Add an immutability violation."""
        self.violations.append({
            'file': file_path,
            'reason': reason,
            'details': details
        })
        self.status = 'fail'

    def add_warning(self, file_path: str, reason: str, details: dict):
        """Add a warning (non-critical issue)."""
        self.warnings.append({
            'file': file_path,
            'reason': reason,
            'details': details
        })
        if self.status == 'pass':
            self.status = 'warning'

    def to_dict(self) -> dict:
        return {
            'timestamp': self.timestamp,
            'status': self.status,
            'checked_files': self.checked_files,
            'immutable_files': self.immutable_files,
            'violations': self.violations,
            'warnings': self.warnings
        }


class ImmutabilityChecker:
    """
    Verify that Phase 1-9 artifacts remain immutable.

    Protected Artifacts:
    - god-learn/knowledge.jsonl
    - god-learn/index.json
    - god-reason/reasoning.jsonl
    - god-reason/index.json
    - vector_db_* (vector database)
    - corpus/ (PDF files and metadata)
    - scripts/ingest/manifest.jsonl
    """

    def __init__(self, project_root: Optional[Path] = None):
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)
        self.baseline_path = self.project_root / ".god-verify" / "immutability_baseline.json"

        # Define protected paths (relative to project root)
        self.protected_paths = [
            "god-learn/knowledge.jsonl",
            "god-learn/index.json",
            "god-reason/reasoning.jsonl",
            "god-reason/index.json",
            "scripts/ingest/manifest.jsonl",
        ]

        # Protected directories (check all files within)
        self.protected_dirs = [
            "corpus/rhetorical_ontology",
        ]

        # Excluded patterns (files that can change)
        self.excluded_patterns = [
            "*.log",
            "*.tmp",
            "*~",
            ".DS_Store",
            "__pycache__",
            "*.pyc"
        ]

    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()

        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)

        return sha256.hexdigest()

    def _count_lines(self, file_path: Path) -> Optional[int]:
        """Count lines in a text file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return sum(1 for _ in f)
        except (UnicodeDecodeError, PermissionError):
            # Binary file or no permission
            return None

    def _create_snapshot(self, file_path: Path) -> FileSnapshot:
        """Create a snapshot of a file's current state."""
        stat = file_path.stat()

        return FileSnapshot(
            path=str(file_path.relative_to(self.project_root)),
            sha256=self._compute_file_hash(file_path),
            size=stat.st_size,
            modified_time=stat.st_mtime,
            line_count=self._count_lines(file_path)
        )

    def _get_protected_files(self) -> List[Path]:
        """Get list of all protected files."""
        files = []

        # Add explicitly protected files
        for rel_path in self.protected_paths:
            abs_path = self.project_root / rel_path
            if abs_path.exists():
                files.append(abs_path)

        # Add files from protected directories
        for rel_dir in self.protected_dirs:
            abs_dir = self.project_root / rel_dir
            if abs_dir.exists() and abs_dir.is_dir():
                for file_path in abs_dir.rglob('*'):
                    if file_path.is_file():
                        # Check if excluded
                        if not self._is_excluded(file_path):
                            files.append(file_path)

        return files

    def _is_excluded(self, file_path: Path) -> bool:
        """Check if a file matches any excluded pattern."""
        name = file_path.name
        for pattern in self.excluded_patterns:
            if pattern.startswith('*'):
                if name.endswith(pattern[1:]):
                    return True
            elif pattern.endswith('*'):
                if name.startswith(pattern[:-1]):
                    return True
            else:
                if name == pattern:
                    return True
        return False

    def create_baseline(self) -> Dict[str, FileSnapshot]:
        """Create baseline snapshots of all protected files."""
        print("Creating immutability baseline...")

        files = self._get_protected_files()
        snapshots = {}

        for file_path in files:
            try:
                snapshot = self._create_snapshot(file_path)
                snapshots[snapshot.path] = snapshot
                print(f"  ✓ {snapshot.path}")
            except Exception as e:
                print(f"  ✗ {file_path}: {e}")

        # Save baseline
        self.baseline_path.parent.mkdir(parents=True, exist_ok=True)

        baseline_data = {
            'timestamp': datetime.now().isoformat(),
            'files': {path: snap.to_dict() for path, snap in snapshots.items()}
        }

        with open(self.baseline_path, 'w') as f:
            json.dump(baseline_data, f, indent=2)

        print(f"\n✓ Baseline created: {len(snapshots)} files")
        print(f"  Saved to: {self.baseline_path}")

        return snapshots

    def load_baseline(self) -> Optional[Dict[str, FileSnapshot]]:
        """Load baseline snapshots from disk."""
        if not self.baseline_path.exists():
            return None

        with open(self.baseline_path, 'r') as f:
            baseline_data = json.load(f)

        snapshots = {}
        for path, data in baseline_data['files'].items():
            snapshots[path] = FileSnapshot.from_dict(data)

        return snapshots

    def verify_immutability(self) -> ImmutabilityReport:
        """Verify that protected files have not been mutated."""
        report = ImmutabilityReport(
            timestamp=datetime.now().isoformat(),
            status='pass'
        )

        # Load baseline
        baseline = self.load_baseline()
        if baseline is None:
            report.add_warning(
                'baseline',
                'No baseline found',
                {'message': 'Run with --baseline to create initial baseline'}
            )
            return report

        # Get current files
        current_files = self._get_protected_files()
        current_paths = {str(f.relative_to(self.project_root)) for f in current_files}
        baseline_paths = set(baseline.keys())

        report.checked_files = len(current_paths)

        # Check for deleted files
        deleted_files = baseline_paths - current_paths
        for path in deleted_files:
            report.add_violation(
                path,
                'File deleted',
                {
                    'baseline_hash': baseline[path].sha256,
                    'baseline_size': baseline[path].size
                }
            )

        # Check for new files (warning, not violation)
        new_files = current_paths - baseline_paths
        for path in new_files:
            report.add_warning(
                path,
                'New file added',
                {'message': 'File not in baseline - may be legitimate addition'}
            )

        # Check existing files for mutations
        for file_path in current_files:
            rel_path = str(file_path.relative_to(self.project_root))

            if rel_path not in baseline:
                continue  # Already reported as new file

            try:
                current = self._create_snapshot(file_path)
                baseline_snap = baseline[rel_path]

                # Compare hashes
                if current.sha256 != baseline_snap.sha256:
                    report.add_violation(
                        rel_path,
                        'File content modified',
                        {
                            'baseline_hash': baseline_snap.sha256,
                            'current_hash': current.sha256,
                            'baseline_size': baseline_snap.size,
                            'current_size': current.size,
                            'baseline_lines': baseline_snap.line_count,
                            'current_lines': current.line_count
                        }
                    )
                else:
                    report.immutable_files += 1

            except Exception as e:
                report.add_violation(
                    rel_path,
                    'Error checking file',
                    {'error': str(e)}
                )

        return report

    def watch_mode(self, interval: int = 5):
        """Continuously monitor for mutations (for development)."""
        import time

        print(f"Watching for mutations (checking every {interval}s)...")
        print("Press Ctrl+C to stop\n")

        try:
            while True:
                report = self.verify_immutability()

                if report.status == 'fail':
                    print(f"\n⚠️  IMMUTABILITY VIOLATION at {report.timestamp}")
                    for violation in report.violations:
                        print(f"  ✗ {violation['file']}: {violation['reason']}")
                elif report.status == 'warning':
                    print(f"\n⚠️  Warnings at {report.timestamp}")
                    for warning in report.warnings:
                        print(f"  ! {warning['file']}: {warning['reason']}")
                else:
                    print(f"✓ {report.timestamp} - All {report.immutable_files} files immutable")

                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n\nStopped watching.")


def main():
    parser = argparse.ArgumentParser(
        description="Phase 11 Immutability Verification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--baseline',
        action='store_true',
        help='Create baseline snapshot of protected files'
    )

    parser.add_argument(
        '--verify',
        action='store_true',
        help='Verify files against baseline'
    )

    parser.add_argument(
        '--watch',
        action='store_true',
        help='Watch for mutations in real-time'
    )

    parser.add_argument(
        '--interval',
        type=int,
        default=5,
        help='Watch mode check interval in seconds (default: 5)'
    )

    parser.add_argument(
        '--json',
        action='store_true',
        help='Output report as JSON'
    )

    args = parser.parse_args()

    checker = ImmutabilityChecker()

    if args.baseline:
        checker.create_baseline()

    elif args.verify:
        report = checker.verify_immutability()

        if args.json:
            print(json.dumps(report.to_dict(), indent=2))
        else:
            print(f"\n{'='*60}")
            print(f"Immutability Verification Report")
            print(f"{'='*60}")
            print(f"Timestamp: {report.timestamp}")
            print(f"Status: {report.status.upper()}")
            print(f"Checked Files: {report.checked_files}")
            print(f"Immutable Files: {report.immutable_files}")

            if report.violations:
                print(f"\n⚠️  VIOLATIONS ({len(report.violations)}):")
                for violation in report.violations:
                    print(f"\n  ✗ {violation['file']}")
                    print(f"    Reason: {violation['reason']}")
                    for key, value in violation['details'].items():
                        print(f"    {key}: {value}")

            if report.warnings:
                print(f"\n⚠️  WARNINGS ({len(report.warnings)}):")
                for warning in report.warnings:
                    print(f"\n  ! {warning['file']}")
                    print(f"    Reason: {warning['reason']}")

            if report.status == 'pass':
                print(f"\n✓ All files are immutable!")
            elif report.status == 'fail':
                print(f"\n✗ IMMUTABILITY VIOLATIONS DETECTED")
                return 1

    elif args.watch:
        checker.watch_mode(interval=args.interval)

    else:
        parser.print_help()
        return 1

    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
