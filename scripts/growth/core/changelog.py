#!/usr/bin/env python3
"""
Phase 17 Week 1-2: Corpus Changelog

Tracks all changes to the corpus with:
- Change entries with timestamps
- Change categorization (add, remove, modify, reprocess)
- Human-readable changelog generation
- Machine-readable change log export

Usage:
    python scripts/growth/core/changelog.py --show
    python scripts/growth/core/changelog.py --add "document" "corpus/new.pdf" "Added new source"
    python scripts/growth/core/changelog.py --export changelog.md
"""

import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))


class ChangeType(Enum):
    """Types of corpus changes."""
    ADD_DOCUMENT = "add_document"
    REMOVE_DOCUMENT = "remove_document"
    MODIFY_DOCUMENT = "modify_document"
    ADD_KU = "add_ku"
    REMOVE_KU = "remove_ku"
    ADD_RU = "add_ru"
    REMOVE_RU = "remove_ru"
    REPROCESS = "reprocess"
    REBALANCE = "rebalance"
    ROLLBACK = "rollback"
    SNAPSHOT = "snapshot"
    CALIBRATION = "calibration"


class ChangeImpact(Enum):
    """Impact level of a change."""
    LOW = "low"       # Metadata only
    MEDIUM = "medium" # New content, no breaking changes
    HIGH = "high"     # Affects existing reasoning
    CRITICAL = "critical"  # May require reprocessing


@dataclass
class ChangeEntry:
    """Single change entry in the changelog."""
    change_id: str
    change_type: ChangeType
    timestamp: str
    version: str
    entity_type: str  # document, ku, ru, etc.
    entity_id: str
    description: str
    impact: ChangeImpact = ChangeImpact.MEDIUM
    metadata: Dict[str, Any] = field(default_factory=dict)
    user: str = "system"
    reversible: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "change_id": self.change_id,
            "change_type": self.change_type.value,
            "timestamp": self.timestamp,
            "version": self.version,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "description": self.description,
            "impact": self.impact.value,
            "metadata": self.metadata,
            "user": self.user,
            "reversible": self.reversible
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChangeEntry":
        return cls(
            change_id=data["change_id"],
            change_type=ChangeType(data["change_type"]),
            timestamp=data["timestamp"],
            version=data["version"],
            entity_type=data["entity_type"],
            entity_id=data["entity_id"],
            description=data["description"],
            impact=ChangeImpact(data.get("impact", "medium")),
            metadata=data.get("metadata", {}),
            user=data.get("user", "system"),
            reversible=data.get("reversible", True)
        )


class CorpusChangelog:
    """
    Manages corpus change history.

    Features:
    - Persistent change log storage
    - Change categorization and filtering
    - Markdown export for documentation
    - JSON export for automation
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        verbose: bool = False
    ):
        """
        Initialize changelog.

        Args:
            project_root: Project root directory
            verbose: Enable verbose logging
        """
        if project_root is None:
            project_root = PROJECT_ROOT

        self.project_root = Path(project_root)
        self.verbose = verbose

        # Changelog storage
        self.changelog_dir = self.project_root / ".corpus-versions"
        self.changelog_dir.mkdir(exist_ok=True)
        self.changelog_file = self.changelog_dir / "changelog.jsonl"

        # In-memory cache
        self._entries: Optional[List[ChangeEntry]] = None
        self._change_counter = 0

    def _log(self, message: str):
        """Log message if verbose."""
        if self.verbose:
            print(f"[CHANGELOG] {message}", file=sys.stderr)

    def _generate_change_id(self) -> str:
        """Generate unique change ID."""
        self._change_counter += 1
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"CHG-{timestamp}-{self._change_counter:04d}"

    def _load_entries(self) -> List[ChangeEntry]:
        """Load all changelog entries from file."""
        if self._entries is not None:
            return self._entries

        self._entries = []

        if self.changelog_file.exists():
            with open(self.changelog_file, 'r') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        self._entries.append(ChangeEntry.from_dict(data))
                        # Track counter for ID generation
                        self._change_counter = max(
                            self._change_counter,
                            len(self._entries)
                        )

        return self._entries

    def _save_entry(self, entry: ChangeEntry):
        """Append entry to changelog file."""
        with open(self.changelog_file, 'a') as f:
            f.write(json.dumps(entry.to_dict()) + "\n")

        # Update cache
        if self._entries is not None:
            self._entries.append(entry)

    def add_entry(
        self,
        change_type: ChangeType,
        entity_type: str,
        entity_id: str,
        description: str,
        version: str = "current",
        impact: ChangeImpact = ChangeImpact.MEDIUM,
        metadata: Optional[Dict[str, Any]] = None,
        user: str = "system"
    ) -> ChangeEntry:
        """
        Add a new change entry.

        Args:
            change_type: Type of change
            entity_type: What was changed (document, ku, ru, etc.)
            entity_id: ID or path of changed entity
            description: Human-readable description
            version: Corpus version
            impact: Impact level
            metadata: Additional metadata
            user: Who made the change

        Returns:
            Created change entry
        """
        entry = ChangeEntry(
            change_id=self._generate_change_id(),
            change_type=change_type,
            timestamp=datetime.now().isoformat(),
            version=version,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            impact=impact,
            metadata=metadata or {},
            user=user
        )

        self._save_entry(entry)
        self._log(f"Added: {entry.change_id} - {description}")

        return entry

    def get_entries(
        self,
        change_type: Optional[ChangeType] = None,
        entity_type: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 100
    ) -> List[ChangeEntry]:
        """
        Get filtered changelog entries.

        Args:
            change_type: Filter by change type
            entity_type: Filter by entity type
            since: ISO timestamp to start from
            until: ISO timestamp to end at
            limit: Maximum entries to return

        Returns:
            Filtered list of entries
        """
        entries = self._load_entries()

        # Apply filters
        filtered = []
        for entry in entries:
            if change_type and entry.change_type != change_type:
                continue
            if entity_type and entry.entity_type != entity_type:
                continue
            if since and entry.timestamp < since:
                continue
            if until and entry.timestamp > until:
                continue
            filtered.append(entry)

        # Return most recent first, limited
        if limit:
            return list(reversed(filtered[-limit:]))
        return list(reversed(filtered))

    def get_recent(self, count: int = 10) -> List[ChangeEntry]:
        """Get most recent entries."""
        entries = self._load_entries()
        return list(reversed(entries[-count:]))

    def get_by_version(self, version: str) -> List[ChangeEntry]:
        """Get all entries for a specific version."""
        entries = self._load_entries()
        return [e for e in entries if e.version == version]

    def get_summary(
        self,
        since: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get changelog summary.

        Args:
            since: Only include entries after this timestamp

        Returns:
            Summary statistics
        """
        entries = self.get_entries(since=since, limit=10000)

        by_type = {}
        by_impact = {}
        by_entity = {}

        for entry in entries:
            # Count by type
            type_name = entry.change_type.value
            by_type[type_name] = by_type.get(type_name, 0) + 1

            # Count by impact
            impact_name = entry.impact.value
            by_impact[impact_name] = by_impact.get(impact_name, 0) + 1

            # Count by entity type
            by_entity[entry.entity_type] = by_entity.get(entry.entity_type, 0) + 1

        return {
            "total_entries": len(entries),
            "by_change_type": by_type,
            "by_impact": by_impact,
            "by_entity_type": by_entity,
            "first_entry": entries[-1].timestamp if entries else None,
            "last_entry": entries[0].timestamp if entries else None
        }

    def export_markdown(
        self,
        output_path: Optional[Path] = None,
        since: Optional[str] = None,
        group_by_version: bool = True
    ) -> str:
        """
        Export changelog as Markdown.

        Args:
            output_path: Optional path to write file
            since: Only include entries after this timestamp
            group_by_version: Group entries by version

        Returns:
            Markdown content
        """
        entries = self.get_entries(since=since, limit=10000)

        lines = [
            "# Corpus Changelog",
            "",
            f"Generated: {datetime.now().isoformat()}",
            "",
        ]

        if group_by_version:
            # Group by version
            by_version = {}
            for entry in entries:
                if entry.version not in by_version:
                    by_version[entry.version] = []
                by_version[entry.version].append(entry)

            for version, version_entries in sorted(by_version.items(), reverse=True):
                lines.append(f"## {version}")
                lines.append("")

                for entry in version_entries:
                    icon = self._get_change_icon(entry.change_type)
                    date = entry.timestamp[:10]
                    lines.append(f"- {icon} **{entry.change_type.value}**: {entry.description}")
                    lines.append(f"  - Entity: `{entry.entity_type}:{entry.entity_id}`")
                    lines.append(f"  - Date: {date}")
                    if entry.impact != ChangeImpact.MEDIUM:
                        lines.append(f"  - Impact: {entry.impact.value}")
                    lines.append("")

        else:
            lines.append("## Changes")
            lines.append("")

            for entry in entries:
                icon = self._get_change_icon(entry.change_type)
                date = entry.timestamp[:10]
                lines.append(f"### {entry.change_id}")
                lines.append(f"- **Type**: {icon} {entry.change_type.value}")
                lines.append(f"- **Description**: {entry.description}")
                lines.append(f"- **Entity**: `{entry.entity_type}:{entry.entity_id}`")
                lines.append(f"- **Version**: {entry.version}")
                lines.append(f"- **Date**: {date}")
                lines.append(f"- **Impact**: {entry.impact.value}")
                lines.append("")

        content = "\n".join(lines)

        if output_path:
            output_path = Path(output_path)
            output_path.write_text(content)
            self._log(f"Exported to: {output_path}")

        return content

    def export_json(
        self,
        output_path: Optional[Path] = None,
        since: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export changelog as JSON.

        Args:
            output_path: Optional path to write file
            since: Only include entries after this timestamp

        Returns:
            JSON-compatible dict
        """
        entries = self.get_entries(since=since, limit=10000)
        summary = self.get_summary(since=since)

        data = {
            "generated": datetime.now().isoformat(),
            "summary": summary,
            "entries": [e.to_dict() for e in entries]
        }

        if output_path:
            output_path = Path(output_path)
            output_path.write_text(json.dumps(data, indent=2))
            self._log(f"Exported to: {output_path}")

        return data

    def _get_change_icon(self, change_type: ChangeType) -> str:
        """Get emoji icon for change type."""
        icons = {
            ChangeType.ADD_DOCUMENT: "📄",
            ChangeType.REMOVE_DOCUMENT: "🗑️",
            ChangeType.MODIFY_DOCUMENT: "✏️",
            ChangeType.ADD_KU: "📚",
            ChangeType.REMOVE_KU: "❌",
            ChangeType.ADD_RU: "🔗",
            ChangeType.REMOVE_RU: "💔",
            ChangeType.REPROCESS: "🔄",
            ChangeType.REBALANCE: "⚖️",
            ChangeType.ROLLBACK: "⏪",
            ChangeType.SNAPSHOT: "📸",
            ChangeType.CALIBRATION: "🎯"
        }
        return icons.get(change_type, "•")

    def record_document_add(
        self,
        path: str,
        description: str = "",
        version: str = "current",
        user: str = "system"
    ) -> ChangeEntry:
        """Convenience method to record document addition."""
        return self.add_entry(
            change_type=ChangeType.ADD_DOCUMENT,
            entity_type="document",
            entity_id=path,
            description=description or f"Added document: {Path(path).name}",
            version=version,
            impact=ChangeImpact.MEDIUM,
            user=user
        )

    def record_document_remove(
        self,
        path: str,
        description: str = "",
        version: str = "current",
        user: str = "system"
    ) -> ChangeEntry:
        """Convenience method to record document removal."""
        return self.add_entry(
            change_type=ChangeType.REMOVE_DOCUMENT,
            entity_type="document",
            entity_id=path,
            description=description or f"Removed document: {Path(path).name}",
            version=version,
            impact=ChangeImpact.HIGH,
            user=user
        )

    def record_reprocess(
        self,
        phase: str,
        documents: List[str],
        version: str = "current",
        user: str = "system"
    ) -> ChangeEntry:
        """Convenience method to record reprocessing."""
        return self.add_entry(
            change_type=ChangeType.REPROCESS,
            entity_type="phase",
            entity_id=phase,
            description=f"Reprocessed {len(documents)} documents through {phase}",
            version=version,
            impact=ChangeImpact.HIGH,
            metadata={"documents": documents[:10]},  # Limit metadata size
            user=user
        )

    def record_snapshot(
        self,
        snapshot_id: str,
        version: str,
        description: str = "",
        user: str = "system"
    ) -> ChangeEntry:
        """Convenience method to record snapshot."""
        return self.add_entry(
            change_type=ChangeType.SNAPSHOT,
            entity_type="corpus",
            entity_id=snapshot_id,
            description=description or f"Created snapshot: {snapshot_id}",
            version=version,
            impact=ChangeImpact.LOW,
            user=user
        )

    def record_rollback(
        self,
        from_version: str,
        to_version: str,
        user: str = "system"
    ) -> ChangeEntry:
        """Convenience method to record rollback."""
        return self.add_entry(
            change_type=ChangeType.ROLLBACK,
            entity_type="corpus",
            entity_id=to_version,
            description=f"Rolled back from {from_version} to {to_version}",
            version=to_version,
            impact=ChangeImpact.CRITICAL,
            metadata={"from_version": from_version},
            user=user,
            reversible=False
        )


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Corpus Changelog Manager")
    parser.add_argument("--show", action="store_true", help="Show recent changes")
    parser.add_argument("--count", type=int, default=10, help="Number of entries to show")
    parser.add_argument("--add", nargs=3, metavar=("TYPE", "ID", "DESC"),
                        help="Add change entry")
    parser.add_argument("--summary", action="store_true", help="Show summary")
    parser.add_argument("--export", metavar="FILE", help="Export to file")
    parser.add_argument("--format", choices=["md", "json"], default="md",
                        help="Export format")
    parser.add_argument("--since", metavar="DATE", help="Filter by date (ISO format)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    changelog = CorpusChangelog(verbose=args.verbose)

    if args.add:
        entity_type, entity_id, description = args.add
        # Map common entity types to change types
        type_map = {
            "document": ChangeType.ADD_DOCUMENT,
            "ku": ChangeType.ADD_KU,
            "ru": ChangeType.ADD_RU
        }
        change_type = type_map.get(entity_type, ChangeType.ADD_DOCUMENT)

        entry = changelog.add_entry(
            change_type=change_type,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description
        )
        result = entry.to_dict()

    elif args.summary:
        result = changelog.get_summary(since=args.since)

    elif args.export:
        if args.format == "json":
            result = changelog.export_json(Path(args.export), since=args.since)
        else:
            content = changelog.export_markdown(Path(args.export), since=args.since)
            result = {"exported": args.export, "lines": len(content.split("\n"))}

    else:
        entries = changelog.get_recent(args.count)
        result = {
            "recent_count": len(entries),
            "entries": [e.to_dict() for e in entries]
        }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("\nCorpus Changelog")
        print("=" * 50)

        if "entries" in result:
            for entry in result.get("entries", []):
                icon = changelog._get_change_icon(ChangeType(entry["change_type"]))
                print(f"{icon} [{entry['timestamp'][:10]}] {entry['description']}")
                print(f"   Type: {entry['change_type']} | Entity: {entry['entity_id']}")
            if not result.get("entries"):
                print("No changes recorded yet.")

        elif "total_entries" in result:
            print(f"Total entries: {result['total_entries']}")
            print(f"\nBy change type:")
            for ct, count in result.get("by_change_type", {}).items():
                print(f"  {ct}: {count}")
            print(f"\nBy impact:")
            for imp, count in result.get("by_impact", {}).items():
                print(f"  {imp}: {count}")

        elif "change_id" in result:
            print(f"Added: {result['change_id']}")
            print(f"  {result['description']}")

        print()


if __name__ == "__main__":
    main()
