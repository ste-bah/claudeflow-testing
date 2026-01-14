#!/usr/bin/env python3
"""
Corpus Diff Visualizer

Shows changes between corpus snapshots: added/removed/modified documents,
KU changes, and statistical differences.

Usage:
  god grow diff <snapshot1> <snapshot2>
  god grow diff current <snapshot_id>
  god grow diff --list  # List available snapshots
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

VERSIONS_DIR = Path(".corpus-versions")
SNAPSHOTS_DIR = VERSIONS_DIR / "snapshots"
CURRENT_VERSION_FILE = VERSIONS_DIR / "current_version.json"


@dataclass
class SnapshotInfo:
    """Snapshot metadata."""
    id: str
    version: str
    created_at: str
    description: str
    document_count: int
    chunk_count: int
    ku_count: int
    document_hashes: Dict[str, str]


@dataclass
class DiffResult:
    """Result of comparing two snapshots."""
    snapshot1_id: str
    snapshot2_id: str
    added_docs: List[str]
    removed_docs: List[str]
    modified_docs: List[str]
    unchanged_docs: List[str]
    stats_diff: Dict[str, Tuple[int, int, int]]  # metric -> (old, new, delta)


def list_snapshots() -> List[Dict[str, Any]]:
    """List all available snapshots."""
    if not SNAPSHOTS_DIR.exists():
        return []

    snapshots = []
    for p in SNAPSHOTS_DIR.glob("*.json"):
        try:
            data = json.loads(p.read_text())
            snapshots.append({
                "id": data.get("snapshot_id", p.stem),
                "version": data.get("version", {}).get("string", "?"),
                "created_at": data.get("created_at", "?"),
                "description": data.get("description", ""),
                "docs": data.get("stats", {}).get("document_count", 0),
                "kus": data.get("stats", {}).get("ku_count", 0),
            })
        except Exception:
            continue

    # Sort by creation date descending
    snapshots.sort(key=lambda x: x["created_at"], reverse=True)
    return snapshots


def load_snapshot(snapshot_id: str) -> Optional[SnapshotInfo]:
    """Load a snapshot by ID."""
    # Handle "current" keyword
    if snapshot_id.lower() == "current":
        return load_current_state()

    # Find the snapshot file
    snapshot_file = SNAPSHOTS_DIR / f"{snapshot_id}.json"
    if not snapshot_file.exists():
        # Try without extension
        for p in SNAPSHOTS_DIR.glob("*.json"):
            if p.stem == snapshot_id or snapshot_id in p.stem:
                snapshot_file = p
                break

    if not snapshot_file.exists():
        return None

    try:
        data = json.loads(snapshot_file.read_text())
        stats = data.get("stats", {})
        return SnapshotInfo(
            id=data.get("snapshot_id", snapshot_file.stem),
            version=data.get("version", {}).get("string", "?"),
            created_at=data.get("created_at", "?"),
            description=data.get("description", ""),
            document_count=stats.get("document_count", 0),
            chunk_count=stats.get("chunk_count", 0),
            ku_count=stats.get("ku_count", 0),
            document_hashes=data.get("document_hashes", {})
        )
    except Exception as e:
        print(f"Error loading snapshot: {e}", file=sys.stderr)
        return None


def load_current_state() -> SnapshotInfo:
    """Load current corpus state (not a saved snapshot)."""
    # Read current manifest
    manifest_file = Path("scripts/ingest/manifest.jsonl")
    doc_hashes = {}

    if manifest_file.exists():
        seen = {}
        with manifest_file.open("r") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                    path_rel = rec.get("path_rel", "")
                    sha = rec.get("sha256", "")
                    if path_rel and sha:
                        seen[path_rel] = sha
                except Exception:
                    continue
        doc_hashes = seen

    # Count KUs
    ku_count = 0
    index_file = Path("god-learn/index.json")
    if index_file.exists():
        try:
            index = json.loads(index_file.read_text())
            ku_count = len(index)
        except Exception:
            pass

    return SnapshotInfo(
        id="current",
        version="current",
        created_at=datetime.now().isoformat(),
        description="Current corpus state",
        document_count=len(doc_hashes),
        chunk_count=0,  # Not easily available
        ku_count=ku_count,
        document_hashes=doc_hashes
    )


def compute_diff(snap1: SnapshotInfo, snap2: SnapshotInfo) -> DiffResult:
    """Compute differences between two snapshots."""
    docs1 = set(snap1.document_hashes.keys())
    docs2 = set(snap2.document_hashes.keys())

    added = sorted(docs2 - docs1)
    removed = sorted(docs1 - docs2)

    # Check for modifications (same path, different hash)
    common = docs1 & docs2
    modified = []
    unchanged = []

    for doc in sorted(common):
        if snap1.document_hashes[doc] != snap2.document_hashes[doc]:
            modified.append(doc)
        else:
            unchanged.append(doc)

    # Stats diff
    stats_diff = {
        "documents": (snap1.document_count, snap2.document_count,
                      snap2.document_count - snap1.document_count),
        "chunks": (snap1.chunk_count, snap2.chunk_count,
                   snap2.chunk_count - snap1.chunk_count),
        "knowledge_units": (snap1.ku_count, snap2.ku_count,
                            snap2.ku_count - snap1.ku_count),
    }

    return DiffResult(
        snapshot1_id=snap1.id,
        snapshot2_id=snap2.id,
        added_docs=added,
        removed_docs=removed,
        modified_docs=modified,
        unchanged_docs=unchanged,
        stats_diff=stats_diff
    )


def format_diff_text(diff: DiffResult, verbose: bool = False) -> str:
    """Format diff as human-readable text."""
    lines = []

    lines.append("=" * 60)
    lines.append("Corpus Diff")
    lines.append("=" * 60)
    lines.append(f"  From: {diff.snapshot1_id}")
    lines.append(f"  To:   {diff.snapshot2_id}")
    lines.append("")

    # Stats summary
    lines.append("Statistics:")
    for metric, (old, new, delta) in diff.stats_diff.items():
        sign = "+" if delta > 0 else ""
        lines.append(f"  {metric:20} {old:5} -> {new:5}  ({sign}{delta})")
    lines.append("")

    # Document changes summary
    lines.append("Document Changes:")
    lines.append(f"  Added:     {len(diff.added_docs)}")
    lines.append(f"  Removed:   {len(diff.removed_docs)}")
    lines.append(f"  Modified:  {len(diff.modified_docs)}")
    lines.append(f"  Unchanged: {len(diff.unchanged_docs)}")
    lines.append("")

    # Details
    if diff.added_docs:
        lines.append("Added Documents:")
        for doc in diff.added_docs[:10]:  # Limit to 10
            lines.append(f"  + {doc}")
        if len(diff.added_docs) > 10:
            lines.append(f"  ... and {len(diff.added_docs) - 10} more")
        lines.append("")

    if diff.removed_docs:
        lines.append("Removed Documents:")
        for doc in diff.removed_docs[:10]:
            lines.append(f"  - {doc}")
        if len(diff.removed_docs) > 10:
            lines.append(f"  ... and {len(diff.removed_docs) - 10} more")
        lines.append("")

    if diff.modified_docs:
        lines.append("Modified Documents:")
        for doc in diff.modified_docs[:10]:
            lines.append(f"  ~ {doc}")
        if len(diff.modified_docs) > 10:
            lines.append(f"  ... and {len(diff.modified_docs) - 10} more")
        lines.append("")

    if verbose and diff.unchanged_docs:
        lines.append("Unchanged Documents:")
        for doc in diff.unchanged_docs[:5]:
            lines.append(f"    {doc}")
        if len(diff.unchanged_docs) > 5:
            lines.append(f"  ... and {len(diff.unchanged_docs) - 5} more")
        lines.append("")

    return "\n".join(lines)


def format_diff_json(diff: DiffResult) -> str:
    """Format diff as JSON."""
    data = {
        "snapshot1": diff.snapshot1_id,
        "snapshot2": diff.snapshot2_id,
        "stats_diff": {
            k: {"old": v[0], "new": v[1], "delta": v[2]}
            for k, v in diff.stats_diff.items()
        },
        "added_docs": diff.added_docs,
        "removed_docs": diff.removed_docs,
        "modified_docs": diff.modified_docs,
        "unchanged_count": len(diff.unchanged_docs),
        "summary": {
            "added": len(diff.added_docs),
            "removed": len(diff.removed_docs),
            "modified": len(diff.modified_docs),
            "unchanged": len(diff.unchanged_docs),
        }
    }
    return json.dumps(data, indent=2)


def cmd_list(args) -> int:
    """List available snapshots."""
    snapshots = list_snapshots()

    if not snapshots:
        print("No snapshots available.")
        print("Create one with: god grow snapshot -d 'description'")
        return 0

    print("Available Snapshots:")
    print("-" * 70)
    print(f"{'ID':<40} {'Version':<10} {'Docs':<6} {'KUs':<6}")
    print("-" * 70)

    for snap in snapshots:
        snap_id = snap["id"][:38] if len(snap["id"]) > 38 else snap["id"]
        print(f"{snap_id:<40} {snap['version']:<10} {snap['docs']:<6} {snap['kus']:<6}")

    print()
    print("Use 'god grow diff <snap1> <snap2>' to compare")
    print("Use 'current' to compare against current state")
    return 0


def cmd_diff(args) -> int:
    """Compare two snapshots."""
    if not args.snapshot1 or not args.snapshot2:
        print("Error: Two snapshots required")
        print("Usage: god grow diff <snapshot1> <snapshot2>")
        print("       god grow diff current <snapshot_id>")
        return 1

    snap1 = load_snapshot(args.snapshot1)
    if snap1 is None:
        print(f"Snapshot not found: {args.snapshot1}")
        return 1

    snap2 = load_snapshot(args.snapshot2)
    if snap2 is None:
        print(f"Snapshot not found: {args.snapshot2}")
        return 1

    diff = compute_diff(snap1, snap2)

    if args.json:
        print(format_diff_json(diff))
    else:
        print(format_diff_text(diff, verbose=args.verbose))

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Corpus diff visualization")
    ap.add_argument("--list", action="store_true", help="List available snapshots")
    ap.add_argument("snapshot1", nargs="?", help="First snapshot ID (or 'current')")
    ap.add_argument("snapshot2", nargs="?", help="Second snapshot ID (or 'current')")
    ap.add_argument("--json", action="store_true", help="Output as JSON")
    ap.add_argument("--verbose", "-v", action="store_true", help="Show all documents")
    args = ap.parse_args()

    if args.list:
        return cmd_list(args)

    if args.snapshot1 and args.snapshot2:
        return cmd_diff(args)

    # Default to list if no args
    if not args.snapshot1:
        return cmd_list(args)

    print("Error: Two snapshots required for diff")
    print("Usage: god grow diff <snapshot1> <snapshot2>")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
