#!/usr/bin/env python3
"""
Phase 17 Week 1-2: Corpus Version Manager

Manages corpus versions with:
- Semantic versioning (major.minor.patch)
- Point-in-time snapshots
- Rollback capability
- Version metadata tracking

Usage:
    python scripts/growth/core/corpus_version_manager.py --status
    python scripts/growth/core/corpus_version_manager.py --snapshot "Adding Stoic texts"
    python scripts/growth/core/corpus_version_manager.py --rollback v1.2.0
"""

import json
import sys
import argparse
import shutil
import hashlib
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from enum import Enum

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))


class VersionBump(Enum):
    """Version increment types."""
    MAJOR = "major"  # Breaking changes, corpus restructure
    MINOR = "minor"  # New documents added
    PATCH = "patch"  # Bug fixes, metadata corrections


@dataclass
class CorpusVersion:
    """Represents a corpus version."""
    major: int
    minor: int
    patch: int
    tag: Optional[str] = None

    def __str__(self) -> str:
        version = f"v{self.major}.{self.minor}.{self.patch}"
        if self.tag:
            version += f"-{self.tag}"
        return version

    @classmethod
    def parse(cls, version_str: str) -> "CorpusVersion":
        """Parse version string like 'v1.2.3' or 'v1.2.3-beta'."""
        if version_str.startswith("v"):
            version_str = version_str[1:]

        tag = None
        if "-" in version_str:
            version_str, tag = version_str.split("-", 1)

        parts = version_str.split(".")
        if len(parts) != 3:
            raise ValueError(f"Invalid version format: {version_str}")

        return cls(
            major=int(parts[0]),
            minor=int(parts[1]),
            patch=int(parts[2]),
            tag=tag
        )

    def bump(self, bump_type: VersionBump) -> "CorpusVersion":
        """Create a new version with the specified bump."""
        if bump_type == VersionBump.MAJOR:
            return CorpusVersion(self.major + 1, 0, 0)
        elif bump_type == VersionBump.MINOR:
            return CorpusVersion(self.major, self.minor + 1, 0)
        else:
            return CorpusVersion(self.major, self.minor, self.patch + 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "major": self.major,
            "minor": self.minor,
            "patch": self.patch,
            "tag": self.tag,
            "string": str(self)
        }


@dataclass
class CorpusStats:
    """Statistics about corpus state."""
    document_count: int = 0
    chunk_count: int = 0
    ku_count: int = 0
    ru_count: int = 0
    total_pages: int = 0
    corpus_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CorpusSnapshot:
    """Point-in-time snapshot of corpus state."""
    snapshot_id: str
    version: CorpusVersion
    created_at: str
    description: str
    stats: CorpusStats
    document_hashes: Dict[str, str] = field(default_factory=dict)
    manifest_hash: str = ""
    snapshot_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_id": self.snapshot_id,
            "version": self.version.to_dict(),
            "created_at": self.created_at,
            "description": self.description,
            "stats": self.stats.to_dict(),
            "document_hashes": self.document_hashes,
            "manifest_hash": self.manifest_hash,
            "snapshot_path": self.snapshot_path
        }


class CorpusVersionManager:
    """
    Manages corpus versions with snapshots and rollback capability.

    Features:
    - Semantic versioning
    - Point-in-time snapshots
    - Rollback to any version
    - Metadata tracking
    - Integrity verification
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        verbose: bool = False
    ):
        """
        Initialize version manager.

        Args:
            project_root: Project root directory
            verbose: Enable verbose logging
        """
        if project_root is None:
            project_root = PROJECT_ROOT

        self.project_root = Path(project_root)
        self.verbose = verbose

        # Key paths
        self.corpus_path = self.project_root / "corpus"
        self.godlearn_path = self.project_root / "god-learn"
        self.godreason_path = self.project_root / "god-reason"
        self.vector_db_path = self.project_root / "vector_db_1536"

        # Version storage
        self.versions_dir = self.project_root / ".corpus-versions"
        self.versions_dir.mkdir(exist_ok=True)

        self.version_file = self.versions_dir / "current_version.json"
        self.snapshots_dir = self.versions_dir / "snapshots"
        self.snapshots_dir.mkdir(exist_ok=True)

        # Load current version
        self.current_version = self._load_current_version()

    def _log(self, message: str):
        """Log message if verbose."""
        if self.verbose:
            print(f"[VERSION] {message}", file=sys.stderr)

    def _load_current_version(self) -> CorpusVersion:
        """Load current version from file or create initial."""
        if self.version_file.exists():
            with open(self.version_file, 'r') as f:
                data = json.load(f)
                return CorpusVersion(
                    major=data.get("major", 1),
                    minor=data.get("minor", 0),
                    patch=data.get("patch", 0),
                    tag=data.get("tag")
                )
        else:
            # Initial version
            return CorpusVersion(1, 0, 0)

    def _save_current_version(self):
        """Save current version to file."""
        with open(self.version_file, 'w') as f:
            json.dump(self.current_version.to_dict(), f, indent=2)

    def _compute_file_hash(self, path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        if not path.exists():
            return ""

        sha256 = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _compute_corpus_hash(self) -> str:
        """Compute combined hash of all corpus documents."""
        hashes = []

        if self.corpus_path.exists():
            for pdf in sorted(self.corpus_path.rglob("*.pdf")):
                hashes.append(self._compute_file_hash(pdf))

        combined = hashlib.sha256("".join(hashes).encode()).hexdigest()
        return combined[:16]

    def _get_corpus_stats(self) -> CorpusStats:
        """Gather current corpus statistics."""
        stats = CorpusStats()

        # Count documents
        if self.corpus_path.exists():
            stats.document_count = len(list(self.corpus_path.rglob("*.pdf")))

        # Count chunks (from ChromaDB)
        try:
            import chromadb
            if self.vector_db_path.exists():
                client = chromadb.PersistentClient(path=str(self.vector_db_path))
                collection = client.get_collection("chunks")
                stats.chunk_count = collection.count()
        except Exception:
            stats.chunk_count = 0

        # Count KUs
        ku_file = self.godlearn_path / "knowledge.jsonl"
        if ku_file.exists():
            with open(ku_file, 'r') as f:
                stats.ku_count = sum(1 for line in f if line.strip())

        # Count RUs
        ru_file = self.godlearn_path / "reasoning.jsonl"
        if ru_file.exists():
            with open(ru_file, 'r') as f:
                stats.ru_count = sum(1 for line in f if line.strip())

        # Compute corpus hash
        stats.corpus_hash = self._compute_corpus_hash()

        return stats

    def _get_document_hashes(self) -> Dict[str, str]:
        """Get hashes of all corpus documents."""
        hashes = {}

        if self.corpus_path.exists():
            for pdf in self.corpus_path.rglob("*.pdf"):
                rel_path = str(pdf.relative_to(self.corpus_path))
                hashes[rel_path] = self._compute_file_hash(pdf)

        return hashes

    def get_status(self) -> Dict[str, Any]:
        """Get current corpus version status."""
        stats = self._get_corpus_stats()

        # List snapshots
        snapshots = []
        for snapshot_file in sorted(self.snapshots_dir.glob("*.json")):
            with open(snapshot_file, 'r') as f:
                data = json.load(f)
                snapshots.append({
                    "snapshot_id": data.get("snapshot_id"),
                    "version": data.get("version", {}).get("string"),
                    "created_at": data.get("created_at"),
                    "description": data.get("description", "")[:50]
                })

        return {
            "current_version": str(self.current_version),
            "version_details": self.current_version.to_dict(),
            "stats": stats.to_dict(),
            "snapshot_count": len(snapshots),
            "snapshots": snapshots[-5:],  # Last 5
            "versions_dir": str(self.versions_dir)
        }

    def create_snapshot(
        self,
        description: str,
        bump_type: VersionBump = VersionBump.MINOR,
        include_artifacts: bool = False
    ) -> CorpusSnapshot:
        """
        Create a point-in-time snapshot of the corpus.

        Args:
            description: Description of what changed
            bump_type: How to increment version
            include_artifacts: Whether to backup artifact files

        Returns:
            Created snapshot
        """
        self._log(f"Creating snapshot: {description}")

        # Bump version
        new_version = self.current_version.bump(bump_type)

        # Generate snapshot ID
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        snapshot_id = f"snapshot-{str(new_version)}-{timestamp}"

        # Gather stats and hashes
        stats = self._get_corpus_stats()
        doc_hashes = self._get_document_hashes()

        # Create snapshot
        snapshot = CorpusSnapshot(
            snapshot_id=snapshot_id,
            version=new_version,
            created_at=datetime.now().isoformat(),
            description=description,
            stats=stats,
            document_hashes=doc_hashes,
            manifest_hash=self._compute_corpus_hash()
        )

        # Optionally backup artifacts
        if include_artifacts:
            snapshot_path = self.snapshots_dir / snapshot_id
            snapshot_path.mkdir(exist_ok=True)

            # Copy key files
            files_to_backup = [
                self.godlearn_path / "knowledge.jsonl",
                self.godlearn_path / "reasoning.jsonl",
                self.godlearn_path / "index.json"
            ]

            for src in files_to_backup:
                if src.exists():
                    dst = snapshot_path / src.name
                    shutil.copy2(src, dst)
                    self._log(f"Backed up: {src.name}")

            snapshot.snapshot_path = str(snapshot_path)

        # Save snapshot metadata
        snapshot_file = self.snapshots_dir / f"{snapshot_id}.json"
        with open(snapshot_file, 'w') as f:
            json.dump(snapshot.to_dict(), f, indent=2)

        # Update current version
        self.current_version = new_version
        self._save_current_version()

        self._log(f"Created snapshot: {snapshot_id}")
        return snapshot

    def get_snapshot(self, version_or_id: str) -> Optional[CorpusSnapshot]:
        """
        Get a specific snapshot by version or ID.

        Args:
            version_or_id: Version string (v1.2.3) or snapshot ID

        Returns:
            Snapshot if found, None otherwise
        """
        for snapshot_file in self.snapshots_dir.glob("*.json"):
            with open(snapshot_file, 'r') as f:
                data = json.load(f)

                # Match by ID or version
                if (data.get("snapshot_id") == version_or_id or
                    data.get("version", {}).get("string") == version_or_id):

                    return CorpusSnapshot(
                        snapshot_id=data["snapshot_id"],
                        version=CorpusVersion.parse(data["version"]["string"]),
                        created_at=data["created_at"],
                        description=data["description"],
                        stats=CorpusStats(**data.get("stats", {})),
                        document_hashes=data.get("document_hashes", {}),
                        manifest_hash=data.get("manifest_hash", ""),
                        snapshot_path=data.get("snapshot_path")
                    )

        return None

    def list_snapshots(self) -> List[CorpusSnapshot]:
        """List all available snapshots."""
        snapshots = []

        for snapshot_file in sorted(self.snapshots_dir.glob("*.json")):
            with open(snapshot_file, 'r') as f:
                data = json.load(f)
                snapshots.append(CorpusSnapshot(
                    snapshot_id=data["snapshot_id"],
                    version=CorpusVersion.parse(data["version"]["string"]),
                    created_at=data["created_at"],
                    description=data["description"],
                    stats=CorpusStats(**data.get("stats", {})),
                    document_hashes=data.get("document_hashes", {}),
                    manifest_hash=data.get("manifest_hash", ""),
                    snapshot_path=data.get("snapshot_path")
                ))

        return snapshots

    def verify_integrity(self, snapshot: Optional[CorpusSnapshot] = None) -> Dict[str, Any]:
        """
        Verify corpus integrity against a snapshot.

        Args:
            snapshot: Snapshot to verify against (current if None)

        Returns:
            Verification result with any discrepancies
        """
        if snapshot is None:
            # Use latest snapshot
            snapshots = self.list_snapshots()
            if not snapshots:
                return {
                    "verified": False,
                    "error": "No snapshots available for verification"
                }
            snapshot = snapshots[-1]

        current_hashes = self._get_document_hashes()
        snapshot_hashes = snapshot.document_hashes

        # Find differences
        added = set(current_hashes.keys()) - set(snapshot_hashes.keys())
        removed = set(snapshot_hashes.keys()) - set(current_hashes.keys())
        modified = []

        for doc in set(current_hashes.keys()) & set(snapshot_hashes.keys()):
            if current_hashes[doc] != snapshot_hashes[doc]:
                modified.append(doc)

        is_clean = len(added) == 0 and len(removed) == 0 and len(modified) == 0

        return {
            "verified": is_clean,
            "snapshot_version": str(snapshot.version),
            "snapshot_id": snapshot.snapshot_id,
            "current_corpus_hash": self._compute_corpus_hash(),
            "snapshot_corpus_hash": snapshot.manifest_hash,
            "changes": {
                "added": list(added),
                "removed": list(removed),
                "modified": modified
            },
            "document_count": {
                "current": len(current_hashes),
                "snapshot": len(snapshot_hashes)
            }
        }

    def can_rollback(self, version_or_id: str) -> Tuple[bool, str]:
        """
        Check if rollback to a version is possible.

        Args:
            version_or_id: Target version or snapshot ID

        Returns:
            (can_rollback, reason)
        """
        snapshot = self.get_snapshot(version_or_id)

        if snapshot is None:
            return False, f"Snapshot not found: {version_or_id}"

        if not snapshot.snapshot_path:
            return False, "Snapshot does not include artifact backup"

        snapshot_path = Path(snapshot.snapshot_path)
        if not snapshot_path.exists():
            return False, f"Snapshot artifacts not found: {snapshot_path}"

        # Check required files
        required = ["knowledge.jsonl", "reasoning.jsonl"]
        missing = [f for f in required if not (snapshot_path / f).exists()]

        if missing:
            return False, f"Missing snapshot files: {missing}"

        return True, "Rollback is possible"

    def rollback(
        self,
        version_or_id: str,
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """
        Rollback corpus to a previous version.

        Args:
            version_or_id: Target version or snapshot ID
            dry_run: Preview without applying

        Returns:
            Rollback result
        """
        can_roll, reason = self.can_rollback(version_or_id)

        if not can_roll:
            return {
                "success": False,
                "error": reason,
                "dry_run": dry_run
            }

        snapshot = self.get_snapshot(version_or_id)
        snapshot_path = Path(snapshot.snapshot_path)

        # What would be restored
        restore_plan = {
            "target_version": str(snapshot.version),
            "snapshot_id": snapshot.snapshot_id,
            "files_to_restore": [],
            "current_version": str(self.current_version)
        }

        files_to_restore = ["knowledge.jsonl", "reasoning.jsonl", "index.json"]
        for filename in files_to_restore:
            src = snapshot_path / filename
            dst = self.godlearn_path / filename
            if src.exists():
                restore_plan["files_to_restore"].append({
                    "file": filename,
                    "source": str(src),
                    "destination": str(dst),
                    "exists": dst.exists()
                })

        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "plan": restore_plan
            }

        # Create backup of current state before rollback
        backup_snapshot = self.create_snapshot(
            description=f"Pre-rollback backup (rolling back to {version_or_id})",
            bump_type=VersionBump.PATCH,
            include_artifacts=True
        )

        # Perform rollback
        restored = []
        for item in restore_plan["files_to_restore"]:
            src = Path(item["source"])
            dst = Path(item["destination"])
            shutil.copy2(src, dst)
            restored.append(item["file"])
            self._log(f"Restored: {item['file']}")

        # Update version
        self.current_version = snapshot.version
        self._save_current_version()

        return {
            "success": True,
            "dry_run": False,
            "restored_to": str(snapshot.version),
            "backup_snapshot": backup_snapshot.snapshot_id,
            "files_restored": restored
        }

    def diff_versions(
        self,
        version1: str,
        version2: str
    ) -> Dict[str, Any]:
        """
        Compare two versions/snapshots.

        Args:
            version1: First version or snapshot ID
            version2: Second version or snapshot ID

        Returns:
            Diff between versions
        """
        snap1 = self.get_snapshot(version1)
        snap2 = self.get_snapshot(version2)

        if not snap1:
            return {"error": f"Version not found: {version1}"}
        if not snap2:
            return {"error": f"Version not found: {version2}"}

        # Compare stats
        stats_diff = {}
        for key in ["document_count", "chunk_count", "ku_count", "ru_count"]:
            val1 = getattr(snap1.stats, key)
            val2 = getattr(snap2.stats, key)
            stats_diff[key] = {
                "v1": val1,
                "v2": val2,
                "delta": val2 - val1
            }

        # Compare documents
        docs1 = set(snap1.document_hashes.keys())
        docs2 = set(snap2.document_hashes.keys())

        added = docs2 - docs1
        removed = docs1 - docs2
        common = docs1 & docs2
        modified = [d for d in common if snap1.document_hashes[d] != snap2.document_hashes[d]]

        return {
            "version1": str(snap1.version),
            "version2": str(snap2.version),
            "stats_diff": stats_diff,
            "documents": {
                "added": list(added),
                "removed": list(removed),
                "modified": modified,
                "unchanged": len(common) - len(modified)
            }
        }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Corpus Version Manager")
    parser.add_argument("--status", action="store_true", help="Show current status")
    parser.add_argument("--snapshot", metavar="DESC", help="Create snapshot with description")
    parser.add_argument("--bump", choices=["major", "minor", "patch"], default="minor",
                        help="Version bump type (default: minor)")
    parser.add_argument("--include-artifacts", action="store_true",
                        help="Include artifact files in snapshot")
    parser.add_argument("--list", action="store_true", help="List all snapshots")
    parser.add_argument("--verify", metavar="VERSION", nargs="?", const="latest",
                        help="Verify integrity against snapshot")
    parser.add_argument("--rollback", metavar="VERSION", help="Rollback to version")
    parser.add_argument("--dry-run", action="store_true", help="Preview without applying")
    parser.add_argument("--diff", nargs=2, metavar=("V1", "V2"), help="Compare versions")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    manager = CorpusVersionManager(verbose=args.verbose)

    if args.status:
        result = manager.get_status()
    elif args.snapshot:
        bump_type = VersionBump(args.bump)
        snapshot = manager.create_snapshot(
            description=args.snapshot,
            bump_type=bump_type,
            include_artifacts=args.include_artifacts
        )
        result = snapshot.to_dict()
    elif args.list:
        snapshots = manager.list_snapshots()
        result = {
            "snapshot_count": len(snapshots),
            "snapshots": [s.to_dict() for s in snapshots]
        }
    elif args.verify:
        snapshot = None
        if args.verify != "latest":
            snapshot = manager.get_snapshot(args.verify)
        result = manager.verify_integrity(snapshot)
    elif args.rollback:
        result = manager.rollback(args.rollback, dry_run=args.dry_run)
    elif args.diff:
        result = manager.diff_versions(args.diff[0], args.diff[1])
    else:
        result = manager.get_status()

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        # Pretty print
        print("\nCorpus Version Manager")
        print("=" * 50)

        if "current_version" in result:
            print(f"Version: {result['current_version']}")
            if "stats" in result:
                stats = result["stats"]
                print(f"Documents: {stats.get('document_count', 0)}")
                print(f"Chunks: {stats.get('chunk_count', 0)}")
                print(f"KUs: {stats.get('ku_count', 0)}")
                print(f"RUs: {stats.get('ru_count', 0)}")
            if "snapshots" in result:
                print(f"\nRecent Snapshots ({result.get('snapshot_count', 0)} total):")
                for snap in result.get("snapshots", []):
                    print(f"  {snap['version']} - {snap['description']}")

        elif "verified" in result:
            status = "✓ CLEAN" if result["verified"] else "✗ MODIFIED"
            print(f"Integrity: {status}")
            if not result["verified"]:
                changes = result.get("changes", {})
                if changes.get("added"):
                    print(f"  Added: {len(changes['added'])} documents")
                if changes.get("removed"):
                    print(f"  Removed: {len(changes['removed'])} documents")
                if changes.get("modified"):
                    print(f"  Modified: {len(changes['modified'])} documents")

        elif "success" in result:
            if result["success"]:
                if result.get("dry_run"):
                    print("DRY RUN - No changes made")
                    if "plan" in result:
                        print(f"Would restore to: {result['plan']['target_version']}")
                else:
                    print(f"Rolled back to: {result.get('restored_to')}")
            else:
                print(f"Failed: {result.get('error')}")

        elif "version1" in result:
            print(f"Comparing {result['version1']} → {result['version2']}")
            for key, val in result.get("stats_diff", {}).items():
                print(f"  {key}: {val['v1']} → {val['v2']} ({val['delta']:+d})")

        print()


if __name__ == "__main__":
    main()
