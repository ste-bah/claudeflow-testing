#!/usr/bin/env python3
"""
Phase 16 Week 3: Remediation Engine

Auto-fixes common provenance issues:
- Remove broken references
- Prune orphan chunks
- Connect orphan KUs
- Update stale metadata

Usage:
    python scripts/audit/cli/remediation.py --dry-run
    python scripts/audit/cli/remediation.py --type orphan_chunks
    python scripts/audit/cli/remediation.py --all
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum
import shutil

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from audit.core.missing_link_detector import MissingLinkDetector
from audit.core.orphan_identifier import OrphanIdentifier
from audit.core.gap_reporter import GapReporter


class FixType(Enum):
    """Types of fixes available."""
    BROKEN_LINKS = "broken_links"
    ORPHAN_CHUNKS = "orphan_chunks"
    ORPHAN_KUS = "orphan_kus"
    STALE_METADATA = "stale_metadata"
    ISOLATED_CLUSTERS = "isolated_clusters"


class FixStatus(Enum):
    """Status of a fix attempt."""
    APPLIED = "applied"
    SKIPPED = "skipped"
    FAILED = "failed"
    DRY_RUN = "dry_run"


@dataclass
class Fix:
    """Represents a single fix action."""
    fix_type: FixType
    entity_id: str
    description: str
    action: str
    status: FixStatus = FixStatus.DRY_RUN
    applied: bool = False
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fix_type": self.fix_type.value,
            "entity_id": self.entity_id,
            "description": self.description,
            "action": self.action,
            "status": self.status.value,
            "applied": self.applied,
            "error": self.error,
            "metadata": self.metadata
        }


@dataclass
class RemediationReport:
    """Report of all remediation actions."""
    total_fixes: int
    applied: int
    skipped: int
    failed: int
    fixes: List[Fix] = field(default_factory=list)
    dry_run: bool = True
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_fixes": self.total_fixes,
            "applied": self.applied,
            "skipped": self.skipped,
            "failed": self.failed,
            "fixes": [f.to_dict() for f in self.fixes],
            "dry_run": self.dry_run,
            "timestamp": self.timestamp
        }


class RemediationEngine:
    """
    Engine for auto-fixing provenance issues.

    Supports:
    - Dry-run mode for previewing changes
    - Selective fixing by type
    - Backup creation before changes
    - Rollback capability
    """

    def __init__(self, dry_run: bool = True, verbose: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose

        # Initialize detectors
        self.link_detector = MissingLinkDetector(verbose=verbose)
        self.orphan_identifier = OrphanIdentifier(verbose=verbose)

        # Paths
        self.knowledge_path = PROJECT_ROOT / "god-learn" / "knowledge.jsonl"
        self.reasoning_path = PROJECT_ROOT / "god-learn" / "reasoning.jsonl"
        self.backup_dir = PROJECT_ROOT / ".audit-backups"

    def _log(self, message: str):
        """Log message if verbose."""
        if self.verbose:
            print(f"[REMEDIATION] {message}", file=sys.stderr)

    def _create_backup(self, path: Path) -> Optional[Path]:
        """Create backup of a file before modification."""
        if not path.exists():
            return None

        self.backup_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = self.backup_dir / f"{path.name}.{timestamp}.bak"

        shutil.copy2(path, backup_path)
        self._log(f"Created backup: {backup_path}")
        return backup_path

    def fix_broken_links(self) -> List[Fix]:
        """
        Fix broken links by removing invalid references.

        Actions:
        - Remove KU sources with missing chunks
        - Remove RU references to missing KUs
        """
        fixes = []
        summary = self.link_detector.detect_all()

        if summary.total_broken_links == 0:
            self._log("No broken links found")
            return fixes

        # Get detailed broken links
        broken_chains = self.link_detector.get_broken_chains()

        for item in broken_chains:
            entity_type = item["entity_type"]
            entity_id = item["entity_id"]

            for missing in item.get("missing", []):
                fix = Fix(
                    fix_type=FixType.BROKEN_LINKS,
                    entity_id=entity_id,
                    description=f"Remove reference to missing {missing['target_type']}: {missing['target_id']}",
                    action=f"Update {entity_type} to remove broken reference",
                    metadata={
                        "target_id": missing["target_id"],
                        "target_type": missing["target_type"],
                        "link_type": missing["link_type"]
                    }
                )

                if self.dry_run:
                    fix.status = FixStatus.DRY_RUN
                else:
                    # Apply fix
                    try:
                        if entity_type == "knowledge_unit":
                            self._remove_ku_source(entity_id, missing["target_id"])
                        elif entity_type == "reasoning_unit":
                            self._remove_ru_reference(entity_id, missing["target_id"])
                        fix.status = FixStatus.APPLIED
                        fix.applied = True
                    except Exception as e:
                        fix.status = FixStatus.FAILED
                        fix.error = str(e)

                fixes.append(fix)

        return fixes

    def fix_orphan_chunks(self) -> List[Fix]:
        """
        Handle orphan chunks.

        Actions:
        - Log orphan chunks for review
        - Optionally mark for deletion (not implemented - too destructive)
        """
        fixes = []
        report = self.orphan_identifier.find_orphan_chunks()

        if report.orphan_count == 0:
            self._log("No orphan chunks found")
            return fixes

        # Don't auto-delete chunks - too risky
        # Instead, create a report of chunks to review
        for orphan in report.orphans[:50]:  # Limit to 50
            fix = Fix(
                fix_type=FixType.ORPHAN_CHUNKS,
                entity_id=orphan.entity_id,
                description=f"Orphan chunk from {orphan.entity_path or 'unknown'}",
                action="Review for KU creation or manual deletion",
                status=FixStatus.SKIPPED,
                applied=False,
                metadata={
                    "path": orphan.entity_path,
                    "recommendation": orphan.recommendation
                }
            )
            fixes.append(fix)

        return fixes

    def fix_orphan_kus(self) -> List[Fix]:
        """
        Handle orphan KUs (not connected to reasoning).

        Actions:
        - Create placeholder reasoning units
        - Or flag for manual review
        """
        fixes = []
        report = self.orphan_identifier.find_orphan_kus()

        if report.orphan_count == 0:
            self._log("No orphan KUs found")
            return fixes

        for orphan in report.orphans:
            fix = Fix(
                fix_type=FixType.ORPHAN_KUS,
                entity_id=orphan.entity_id,
                description=f"KU not connected to reasoning",
                action="Create placeholder RU or connect to existing",
                metadata={
                    "claim_preview": orphan.metadata.get("claim_preview", ""),
                    "source_count": orphan.metadata.get("source_count", 0)
                }
            )

            if self.dry_run:
                fix.status = FixStatus.DRY_RUN
            else:
                # Create placeholder RU
                try:
                    self._create_placeholder_ru(orphan.entity_id)
                    fix.status = FixStatus.APPLIED
                    fix.applied = True
                    fix.action = "Created placeholder reasoning unit"
                except Exception as e:
                    fix.status = FixStatus.FAILED
                    fix.error = str(e)

            fixes.append(fix)

        return fixes

    def fix_isolated_clusters(self) -> List[Fix]:
        """
        Handle isolated knowledge clusters.

        Actions:
        - Flag for manual review
        - Suggest connection points
        """
        fixes = []
        report = self.orphan_identifier.find_isolated_clusters()

        if report.orphan_count == 0:
            self._log("No isolated clusters found")
            return fixes

        for orphan in report.orphans:
            fix = Fix(
                fix_type=FixType.ISOLATED_CLUSTERS,
                entity_id=orphan.entity_id,
                description=f"Isolated cluster with {orphan.metadata.get('size', 0)} KUs",
                action="Review and connect to main knowledge graph",
                status=FixStatus.SKIPPED,  # Manual action required
                applied=False,
                metadata={
                    "size": orphan.metadata.get("size", 0),
                    "topics": orphan.metadata.get("topics", []),
                    "ku_ids": orphan.metadata.get("ku_ids", [])[:5]
                }
            )
            fixes.append(fix)

        return fixes

    def fix_by_type(self, fix_type: str) -> Dict[str, Any]:
        """Fix specific type of issue."""
        fixes = []

        if fix_type == FixType.BROKEN_LINKS.value:
            fixes = self.fix_broken_links()
        elif fix_type == FixType.ORPHAN_CHUNKS.value:
            fixes = self.fix_orphan_chunks()
        elif fix_type == FixType.ORPHAN_KUS.value:
            fixes = self.fix_orphan_kus()
        elif fix_type == FixType.ISOLATED_CLUSTERS.value:
            fixes = self.fix_isolated_clusters()
        else:
            return {"error": f"Unknown fix type: {fix_type}"}

        report = self._create_report(fixes)
        return report.to_dict()

    def fix_all(self) -> Dict[str, Any]:
        """Run all available fixes."""
        all_fixes = []

        self._log("Checking broken links...")
        all_fixes.extend(self.fix_broken_links())

        self._log("Checking orphan chunks...")
        all_fixes.extend(self.fix_orphan_chunks())

        self._log("Checking orphan KUs...")
        all_fixes.extend(self.fix_orphan_kus())

        self._log("Checking isolated clusters...")
        all_fixes.extend(self.fix_isolated_clusters())

        report = self._create_report(all_fixes)
        return report.to_dict()

    def _create_report(self, fixes: List[Fix]) -> RemediationReport:
        """Create remediation report from fixes."""
        applied = sum(1 for f in fixes if f.applied)
        skipped = sum(1 for f in fixes if f.status == FixStatus.SKIPPED)
        failed = sum(1 for f in fixes if f.status == FixStatus.FAILED)

        return RemediationReport(
            total_fixes=len(fixes),
            applied=applied,
            skipped=skipped,
            failed=failed,
            fixes=fixes,
            dry_run=self.dry_run
        )

    def _remove_ku_source(self, ku_id: str, chunk_id: str):
        """Remove a source from a KU that references a missing chunk."""
        if not self.knowledge_path.exists():
            raise FileNotFoundError(f"Knowledge file not found: {self.knowledge_path}")

        # Create backup
        self._create_backup(self.knowledge_path)

        # Read and update
        lines = []
        with open(self.knowledge_path, 'r') as f:
            for line in f:
                if line.strip():
                    ku = json.loads(line)
                    if ku.get("id") == ku_id:
                        # Remove the source with matching chunk_id
                        ku["sources"] = [
                            s for s in ku.get("sources", [])
                            if s.get("chunk_id") != chunk_id
                        ]
                    lines.append(json.dumps(ku))

        # Write back
        with open(self.knowledge_path, 'w') as f:
            f.write('\n'.join(lines) + '\n')

        self._log(f"Removed source {chunk_id} from KU {ku_id}")

    def _remove_ru_reference(self, ru_id: str, ku_id: str):
        """Remove a KU reference from an RU."""
        if not self.reasoning_path.exists():
            raise FileNotFoundError(f"Reasoning file not found: {self.reasoning_path}")

        # Create backup
        self._create_backup(self.reasoning_path)

        # Read and update
        lines = []
        with open(self.reasoning_path, 'r') as f:
            for line in f:
                if line.strip():
                    ru = json.loads(line)
                    if ru.get("reason_id") == ru_id:
                        # Remove the KU reference
                        ru["knowledge_ids"] = [
                            kid for kid in ru.get("knowledge_ids", [])
                            if kid != ku_id
                        ]
                    lines.append(json.dumps(ru))

        # Write back
        with open(self.reasoning_path, 'w') as f:
            f.write('\n'.join(lines) + '\n')

        self._log(f"Removed KU {ku_id} from RU {ru_id}")

    def _create_placeholder_ru(self, ku_id: str):
        """Create a placeholder reasoning unit for an orphan KU."""
        if not self.reasoning_path.exists():
            raise FileNotFoundError(f"Reasoning file not found: {self.reasoning_path}")

        # Create backup
        self._create_backup(self.reasoning_path)

        # Get KU info for context
        ku_info = self.link_detector.kus.get(ku_id)

        # Generate new RU
        ru_id = f"ru_auto_{ku_id}"
        new_ru = {
            "reason_id": ru_id,
            "relation": "supports",
            "topic": ku_info.tags[0] if ku_info and ku_info.tags else "general",
            "knowledge_ids": [ku_id],
            "evidence": [{"type": "auto_generated", "source": "remediation_engine"}],
            "score": 0.5,
            "_auto_generated": True,
            "_generated_at": datetime.now().isoformat()
        }

        # Append to file
        with open(self.reasoning_path, 'a') as f:
            f.write(json.dumps(new_ru) + '\n')

        self._log(f"Created placeholder RU {ru_id} for KU {ku_id}")


def main():
    parser = argparse.ArgumentParser(description="Auto-fix provenance issues")
    parser.add_argument("--dry-run", action="store_true", help="Preview fixes without applying")
    parser.add_argument("--type", dest="fix_type", choices=[t.value for t in FixType],
                        help="Fix specific type of issue")
    parser.add_argument("--all", action="store_true", help="Run all fixes")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Default to dry-run if neither --dry-run nor explicit apply
    dry_run = args.dry_run or not (args.fix_type or args.all)

    engine = RemediationEngine(dry_run=dry_run, verbose=args.verbose)

    if args.fix_type:
        result = engine.fix_by_type(args.fix_type)
    elif args.all:
        result = engine.fix_all()
    else:
        # Default: show all potential fixes in dry-run mode
        result = engine.fix_all()

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\nRemediation Report")
        print("=" * 50)
        print(f"Mode: {'DRY RUN' if result.get('dry_run') else 'APPLIED'}")
        print(f"Total Fixes: {result.get('total_fixes', 0)}")
        print(f"Applied: {result.get('applied', 0)}")
        print(f"Skipped: {result.get('skipped', 0)}")
        print(f"Failed: {result.get('failed', 0)}")

        if result.get('fixes'):
            print(f"\nFixes ({len(result['fixes'])}):")
            for fix in result['fixes'][:20]:
                status_icon = {
                    'applied': '✓',
                    'skipped': '○',
                    'failed': '✗',
                    'dry_run': '?'
                }.get(fix['status'], '?')
                print(f"  {status_icon} [{fix['fix_type']}] {fix['entity_id']}")
                print(f"      {fix['description'][:60]}")
                print(f"      Action: {fix['action'][:50]}")


if __name__ == "__main__":
    main()
