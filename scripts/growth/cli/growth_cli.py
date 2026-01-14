"""
Phase 17 CLI - god-grow command for corpus growth management.

Usage:
    python -m scripts.growth.cli.growth_cli <command> [options]

Commands:
    status     - Show current corpus version and statistics
    snapshot   - Create a new versioned snapshot
    list       - List all available snapshots
    verify     - Verify corpus integrity
    rollback   - Rollback to a previous version
    diff       - Compare two versions
    add        - Add new documents to corpus
    process    - Process newly added documents
    rebalance  - Rebalance reasoning density
    changelog  - View or export changelog
"""

import argparse
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.growth.core import (
    CorpusVersionManager,
    CorpusSnapshot,
    CorpusChangelog,
    ChangeType
)


class GrowthCLI:
    """Unified CLI for corpus growth operations."""

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize CLI with optional custom base path."""
        self.base_path = base_path or PROJECT_ROOT
        self.version_manager = CorpusVersionManager(self.base_path)
        self.changelog = CorpusChangelog(self.base_path)

    # =========================================================================
    # Status Command
    # =========================================================================

    def cmd_status(self, args: argparse.Namespace) -> int:
        """Show current corpus version and statistics."""
        print("\n" + "=" * 60)
        print("CORPUS STATUS")
        print("=" * 60)

        # Current version
        version = self.version_manager.current_version
        print(f"\nCurrent Version: v{version.major}.{version.minor}.{version.patch}")

        # Latest snapshot
        snapshots = self.version_manager.list_snapshots()
        if snapshots:
            latest = snapshots[-1]
            print(f"Latest Snapshot: {latest.snapshot_id}")
            print(f"  Created: {latest.created_at}")
            print(f"  Description: {latest.description}")
        else:
            print("Latest Snapshot: None")

        # Document counts
        corpus_dir = self.base_path / "corpus"
        if corpus_dir.exists():
            pdf_count = len(list(corpus_dir.rglob("*.pdf")))
            print(f"\nCorpus Documents: {pdf_count} PDFs")

        # Knowledge artifacts
        god_learn_dir = self.base_path / "god-learn"
        if god_learn_dir.exists():
            knowledge_file = god_learn_dir / "knowledge.jsonl"
            if knowledge_file.exists():
                with open(knowledge_file) as f:
                    ku_count = sum(1 for _ in f)
                print(f"Knowledge Units: {ku_count}")

        # Changelog stats
        entries = self.changelog.get_entries()
        print(f"\nChangelog Entries: {len(entries)} total")

        # Recent activity
        recent = self.changelog.get_entries(limit=5)
        if recent:
            print("\nRecent Activity:")
            for entry in recent:
                print(f"  [{entry.timestamp[:10]}] {entry.change_type.value}: {entry.description[:50]}")

        print("\n" + "=" * 60)
        return 0

    # =========================================================================
    # Snapshot Command
    # =========================================================================

    def cmd_snapshot(self, args: argparse.Namespace) -> int:
        """Create a new versioned snapshot."""
        description = args.description or f"Manual snapshot at {datetime.now().isoformat()}"
        bump_type = args.bump or "patch"

        print(f"\nCreating {bump_type} snapshot...")
        print(f"Description: {description}")

        try:
            snapshot = self.version_manager.create_snapshot(
                description=description,
                bump_type=bump_type,
                include_artifacts=not args.no_artifacts
            )

            print(f"\nSnapshot created successfully!")
            print(f"  ID: {snapshot.snapshot_id}")
            print(f"  Version: v{snapshot.version.major}.{snapshot.version.minor}.{snapshot.version.patch}")
            print(f"  Path: {snapshot.snapshot_path}")

            # Show document count
            print(f"  Documents: {len(snapshot.document_hashes)}")

            return 0

        except Exception as e:
            print(f"\nError creating snapshot: {e}", file=sys.stderr)
            return 1

    # =========================================================================
    # List Command
    # =========================================================================

    def cmd_list(self, args: argparse.Namespace) -> int:
        """List all available snapshots."""
        snapshots = self.version_manager.list_snapshots()

        if not snapshots:
            print("\nNo snapshots found.")
            return 0

        print("\n" + "=" * 80)
        print("AVAILABLE SNAPSHOTS")
        print("=" * 80)

        # Table header
        print(f"\n{'ID':<40} {'Version':<12} {'Created':<20} {'Docs':<6}")
        print("-" * 80)

        for snap in snapshots:
            version_str = f"v{snap.version.major}.{snap.version.minor}.{snap.version.patch}"
            created = snap.created_at[:19] if len(snap.created_at) > 19 else snap.created_at
            doc_count = len(snap.document_hashes)

            print(f"{snap.snapshot_id:<40} {version_str:<12} {created:<20} {doc_count:<6}")

            if args.verbose:
                print(f"    Description: {snap.description}")
                print(f"    Path: {snap.snapshot_path}")

        print("-" * 80)
        print(f"Total: {len(snapshots)} snapshots")

        return 0

    # =========================================================================
    # Verify Command
    # =========================================================================

    def cmd_verify(self, args: argparse.Namespace) -> int:
        """Verify corpus integrity against a snapshot."""
        # Get snapshot to verify
        if args.snapshot:
            snapshot = self.version_manager.get_snapshot(args.snapshot)
            if not snapshot:
                print(f"\nSnapshot not found: {args.snapshot}", file=sys.stderr)
                return 1
        else:
            snapshots = self.version_manager.list_snapshots()
            if not snapshots:
                print("\nNo snapshots available for verification.", file=sys.stderr)
                return 1
            snapshot = snapshots[-1]

        print(f"\nVerifying against snapshot: {snapshot.snapshot_id}")
        print(f"Version: v{snapshot.version.major}.{snapshot.version.minor}.{snapshot.version.patch}")

        result = self.version_manager.verify_integrity(snapshot)

        # Display results
        print("\n" + "-" * 40)
        print("VERIFICATION RESULTS")
        print("-" * 40)

        status = "PASSED" if result["verified"] else "FAILED"
        print(f"\nStatus: {status}")

        # Document counts
        doc_count = result.get("document_count", {})
        print(f"Documents: {doc_count.get('current', 0)} current, {doc_count.get('snapshot', 0)} in snapshot")

        # Changes
        changes = result.get("changes", {})

        if changes.get("removed"):
            print(f"\nMissing Documents ({len(changes['removed'])}):")
            for doc in changes["removed"][:10]:
                print(f"  - {doc}")
            if len(changes["removed"]) > 10:
                print(f"  ... and {len(changes['removed']) - 10} more")

        if changes.get("modified"):
            print(f"\nModified Documents ({len(changes['modified'])}):")
            for doc in changes["modified"][:10]:
                print(f"  ~ {doc}")
            if len(changes["modified"]) > 10:
                print(f"  ... and {len(changes['modified']) - 10} more")

        if changes.get("added"):
            print(f"\nNew Documents ({len(changes['added'])}):")
            for doc in changes["added"][:10]:
                print(f"  + {doc}")
            if len(changes["added"]) > 10:
                print(f"  ... and {len(changes['added']) - 10} more")

        return 0 if result["verified"] else 1

    # =========================================================================
    # Rollback Command
    # =========================================================================

    def cmd_rollback(self, args: argparse.Namespace) -> int:
        """Rollback to a previous version."""
        if not args.snapshot:
            print("\nError: Please specify a snapshot to rollback to.", file=sys.stderr)
            print("Use 'god-grow list' to see available snapshots.")
            return 1

        snapshot = self.version_manager.get_snapshot(args.snapshot)
        if not snapshot:
            print(f"\nSnapshot not found: {args.snapshot}", file=sys.stderr)
            return 1

        print(f"\nRollback target: {snapshot.snapshot_id}")
        print(f"Version: v{snapshot.version.major}.{snapshot.version.minor}.{snapshot.version.patch}")

        if args.dry_run:
            print("\n[DRY RUN] Would perform the following:")

        result = self.version_manager.rollback(
            args.snapshot,
            dry_run=args.dry_run
        )

        if args.dry_run:
            print(f"\n  Actions that would be taken:")
            if result.get("actions"):
                for action in result["actions"][:20]:
                    print(f"    - {action}")
            print(f"\n  Total documents affected: {result.get('documents_affected', 0)}")
        else:
            if result.get("success"):
                print(f"\nRollback completed successfully!")
                print(f"  Documents restored: {result.get('documents_restored', 0)}")
                print(f"  Current version: v{result['new_version'].major}.{result['new_version'].minor}.{result['new_version'].patch}")
            else:
                print(f"\nRollback failed: {result.get('error', 'Unknown error')}", file=sys.stderr)
                return 1

        return 0

    # =========================================================================
    # Diff Command
    # =========================================================================

    def cmd_diff(self, args: argparse.Namespace) -> int:
        """Compare two versions."""
        if not args.version1 or not args.version2:
            print("\nError: Please specify two versions to compare.", file=sys.stderr)
            print("Usage: god-grow diff <version1> <version2>")
            return 1

        result = self.version_manager.diff_versions(args.version1, args.version2)

        if "error" in result:
            print(f"\nError: {result['error']}", file=sys.stderr)
            return 1

        print("\n" + "=" * 60)
        print(f"VERSION DIFF: {args.version1} → {args.version2}")
        print("=" * 60)

        # Added documents
        if result.get("added"):
            print(f"\nAdded Documents ({len(result['added'])}):")
            for doc in result["added"][:20]:
                print(f"  + {doc}")
            if len(result["added"]) > 20:
                print(f"  ... and {len(result['added']) - 20} more")

        # Removed documents
        if result.get("removed"):
            print(f"\nRemoved Documents ({len(result['removed'])}):")
            for doc in result["removed"][:20]:
                print(f"  - {doc}")
            if len(result["removed"]) > 20:
                print(f"  ... and {len(result['removed']) - 20} more")

        # Modified documents
        if result.get("modified"):
            print(f"\nModified Documents ({len(result['modified'])}):")
            for doc in result["modified"][:20]:
                print(f"  ~ {doc}")
            if len(result["modified"]) > 20:
                print(f"  ... and {len(result['modified']) - 20} more")

        # Summary
        print("\n" + "-" * 40)
        print(f"Summary: +{len(result.get('added', []))} -{len(result.get('removed', []))} ~{len(result.get('modified', []))}")

        return 0

    # =========================================================================
    # Add Command
    # =========================================================================

    def cmd_add(self, args: argparse.Namespace) -> int:
        """Add new documents to corpus."""
        if not args.paths:
            print("\nError: Please specify document paths to add.", file=sys.stderr)
            return 1

        # Validate paths
        valid_paths = []
        for path_str in args.paths:
            path = Path(path_str)
            if not path.exists():
                print(f"Warning: Path not found: {path}", file=sys.stderr)
                continue
            if path.is_file() and path.suffix.lower() != ".pdf":
                print(f"Warning: Not a PDF file: {path}", file=sys.stderr)
                continue
            valid_paths.append(path)

        if not valid_paths:
            print("\nNo valid paths to add.", file=sys.stderr)
            return 1

        print(f"\nAdding {len(valid_paths)} document(s) to corpus...")

        # Collect all PDF files
        pdf_files = []
        for path in valid_paths:
            if path.is_file():
                pdf_files.append(path)
            else:
                pdf_files.extend(path.rglob("*.pdf"))

        if not pdf_files:
            print("\nNo PDF files found.", file=sys.stderr)
            return 1

        print(f"Found {len(pdf_files)} PDF file(s)")

        # Copy to corpus directory
        corpus_dir = self.base_path / "corpus"
        subdomain = args.domain or "general"
        target_dir = corpus_dir / subdomain
        target_dir.mkdir(parents=True, exist_ok=True)

        import shutil
        added = 0
        for pdf in pdf_files:
            target = target_dir / pdf.name
            if target.exists() and not args.force:
                print(f"  Skipping (exists): {pdf.name}")
                continue

            shutil.copy2(pdf, target)
            print(f"  Added: {pdf.name}")
            added += 1

            # Record in changelog
            self.changelog.record_document_add(
                str(target.relative_to(self.base_path)),
                f"Added via CLI: {pdf.name}",
                metadata={"source": str(pdf), "domain": subdomain}
            )

        print(f"\nSuccessfully added {added} document(s)")

        if added > 0 and not args.no_process:
            print("\nTip: Run 'god-grow process' to process the new documents.")

        return 0

    # =========================================================================
    # Process Command
    # =========================================================================

    def cmd_process(self, args: argparse.Namespace) -> int:
        """Process newly added documents."""
        from scripts.growth.core import IncrementalProcessor, ProcessingMode

        print("\n" + "=" * 60)
        print("INCREMENTAL DOCUMENT PROCESSING")
        print("=" * 60)

        processor = IncrementalProcessor(self.base_path)

        # Determine processing mode
        if args.force:
            mode = ProcessingMode.FORCE_ALL
        elif hasattr(args, 'new_only') and args.new_only:
            mode = ProcessingMode.NEW_ONLY
        else:
            mode = ProcessingMode.ALL_CHANGED

        if args.dry_run:
            print("\n[DRY RUN] Preview of documents to process:")
            result = processor.dry_run(mode=mode)

            print(f"\n  Mode: {result['mode']}")
            print(f"  Documents to process: {result['would_process']}")
            print(f"  Estimated time: {result['estimated_time']}")

            if result['documents']:
                print("\n  Documents:")
                for doc in result['documents'][:10]:
                    print(f"    [{doc['status']}] {doc['path']}")
                if len(result['documents']) > 10:
                    print(f"    ... and {len(result['documents']) - 10} more")
            else:
                print("\n  No documents require processing.")

            return 0

        # Actual processing
        def progress_callback(current: int, total: int, path: str):
            print(f"  [{current}/{total}] Processing: {Path(path).name}")

        print(f"\nProcessing mode: {mode.value}")
        result = processor.process_batch(
            mode=mode,
            progress_callback=progress_callback
        )

        # Results summary
        print("\n" + "-" * 40)
        print("PROCESSING RESULTS")
        print("-" * 40)
        print(f"  Total documents: {result.total_documents}")
        print(f"  Successful: {result.successful}")
        print(f"  Failed: {result.failed}")
        print(f"  Skipped: {result.skipped}")
        print(f"  Duration: {result.duration_seconds:.2f} seconds")

        if result.failed > 0:
            print("\n  Failed documents:")
            for r in result.results:
                if not r.success:
                    print(f"    - {r.path}: {r.error_message}")

        # Write log
        if result.total_documents > 0:
            log_path = processor.write_processing_log(result)
            print(f"\n  Log written to: {log_path}")

        return 0 if result.failed == 0 else 1

    # =========================================================================
    # Rebalance Command
    # =========================================================================

    def cmd_rebalance(self, args: argparse.Namespace) -> int:
        """Rebalance reasoning density across domains."""
        from scripts.growth.core import (
            DensityAnalyzer, SkewDetector, CalibrationTools
        )

        analyzer = DensityAnalyzer(self.base_path)
        detector = SkewDetector(self.base_path)
        calibration = CalibrationTools(self.base_path)

        if args.analyze:
            print("\n" + "=" * 60)
            print("DENSITY ANALYSIS")
            print("=" * 60)

            report = analyzer.analyze()

            print(f"\nSummary:")
            print(f"  Total KUs: {report.total_kus}")
            print(f"  Total Sources: {report.total_sources}")
            print(f"  Average Density: {report.avg_density:.3f} KUs/page")
            print(f"  Average Quality: {report.avg_quality:.3f}")

            print(f"\nDomain Distribution:")
            for m in report.domains:
                pct = (m.ku_count / report.total_kus * 100) if report.total_kus > 0 else 0
                bar = "█" * int(pct / 5)
                print(f"  {m.domain:<20} {m.ku_count:>5} ({pct:>5.1f}%) {bar}")
                print(f"    Density: {m.density_score:.3f}, Quality: {m.quality_score:.3f}, Sources: {m.source_count}")

            if report.imbalances:
                print(f"\nImbalances Detected ({len(report.imbalances)}):")
                for imb in report.imbalances:
                    print(f"  [{imb['severity'].upper()}] {imb['type']}")
                    print(f"    {imb['recommendation']}")

            return 0

        if hasattr(args, 'detect') and args.detect:
            print("\n" + "=" * 60)
            print("SKEW DETECTION")
            print("=" * 60)

            skew_report = detector.detect_all()

            print(f"\nCorpus Health Score: {skew_report.health_score:.1f}/100")
            print(f"Total Alerts: {skew_report.total_alerts}")

            if skew_report.critical_count > 0:
                print(f"  Critical: {skew_report.critical_count}")
            if skew_report.high_count > 0:
                print(f"  High: {skew_report.high_count}")
            if skew_report.medium_count > 0:
                print(f"  Medium: {skew_report.medium_count}")
            if skew_report.low_count > 0:
                print(f"  Low: {skew_report.low_count}")

            if skew_report.alerts:
                print("\nAlerts:")
                for alert in skew_report.alerts:
                    severity_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(alert.severity.value, "•")
                    print(f"\n  {severity_icon} [{alert.severity.value.upper()}] {alert.skew_type.value}")
                    print(f"     {alert.message}")
                    for rec in alert.recommendations[:2]:
                        if rec:
                            print(f"     → {rec}")

            detector.save_alerts(skew_report)
            return 0

        if hasattr(args, 'calibrate') and args.calibrate:
            print("\n" + "=" * 60)
            print("AUTO-CALIBRATION")
            print("=" * 60)

            plan = calibration.generate_plan()

            print(f"\nGenerated calibration plan with {len(plan.rules)} rules")

            if plan.skew_report:
                print(f"Based on skew report: {plan.skew_report.total_alerts} alerts detected")

            if plan.rules:
                print("\nProposed Rules:")
                for i, rule in enumerate(plan.rules):
                    print(f"  [{i}] {rule.action.value}: {rule.target}")
                    print(f"      Weight: {rule.weight}, Reason: {rule.reason[:50]}")

                if args.dry_run:
                    print("\n[DRY RUN] Would apply above rules")
                    result = calibration.execute_plan(plan, dry_run=True)
                    print(f"  Would execute: {len(result['executed'])} rules")
                else:
                    print("\nApplying calibration rules...")
                    result = calibration.execute_plan(plan)
                    print(f"  Executed: {len(result['executed'])} rules")
                    print(f"  Errors: {len(result['errors'])} rules")
            else:
                print("\nNo calibration rules needed - corpus is balanced")

            return 0

        # Default: show status
        print("\n" + "=" * 60)
        print("REBALANCE STATUS")
        print("=" * 60)

        status = calibration.get_status()
        print(f"\nCorpus Health: {status['corpus_health']:.1f}/100")
        print(f"Needs Attention: {'Yes' if status['needs_attention'] else 'No'}")
        print(f"Active Domain Weights: {len(status['domain_weights'])}")
        print(f"Prioritized Sources: {status['prioritized_sources']}")
        print(f"Recent Actions: {status['recent_actions']}")

        if status['domain_weights']:
            print("\nDomain Weights:")
            for domain, weight in status['domain_weights'].items():
                print(f"  {domain}: {weight}")

        print("\nCommands:")
        print("  god-grow rebalance --analyze     Full density analysis")
        print("  god-grow rebalance --detect      Detect skew issues")
        print("  god-grow rebalance --calibrate   Auto-calibrate")

        return 0

    # =========================================================================
    # Merge Command
    # =========================================================================

    def cmd_merge(self, args: argparse.Namespace) -> int:
        """Manage knowledge merging and conflicts."""
        from scripts.growth.core import MergeStrategy, MergeMode

        strategy = MergeStrategy(self.base_path)

        if args.status:
            print("\n" + "=" * 60)
            print("MERGE STATUS")
            print("=" * 60)

            stats = strategy.get_merge_stats()
            print(f"\nTotal Knowledge Units: {stats['total_kus']}")
            print(f"Unique Sources: {stats['unique_sources']}")
            print(f"Pending Conflicts: {stats['pending_conflicts']}")

            if stats['domains']:
                print("\nDomain Distribution:")
                total = stats['total_kus']
                for domain, count in sorted(stats['domains'].items(), key=lambda x: -x[1]):
                    pct = (count / total * 100) if total > 0 else 0
                    bar = "█" * int(pct / 5)
                    print(f"  {domain:<20} {count:>5} ({pct:>5.1f}%) {bar}")

            return 0

        if args.conflicts:
            conflicts = strategy.load_conflicts()
            if not conflicts:
                print("\nNo pending merge conflicts.")
                return 0

            print("\n" + "=" * 60)
            print(f"PENDING CONFLICTS ({len(conflicts)})")
            print("=" * 60)

            for i, conflict in enumerate(conflicts):
                print(f"\n[{i}] {conflict.conflict_type.value} (similarity: {conflict.similarity_score:.2f})")
                print(f"    Existing: {conflict.existing_ku.ku_id}")
                print(f"      Content: {conflict.existing_ku.content[:100]}...")
                print(f"    New: {conflict.new_ku.ku_id}")
                print(f"      Content: {conflict.new_ku.content[:100]}...")

            return 0

        if args.resolve is not None:
            index = args.resolve
            keep_existing = not args.use_new if hasattr(args, 'use_new') else True
            resolution = args.reason or "Manual resolution"

            if strategy.resolve_conflict(index, resolution, keep_existing):
                action = "kept existing" if keep_existing else "used new"
                print(f"\nConflict {index} resolved: {action}")
                return 0
            else:
                print(f"\nFailed to resolve conflict {index}")
                return 1

        # Default: show help
        print("\nMerge commands:")
        print("  god-grow merge --status      Show merge statistics")
        print("  god-grow merge --conflicts   List pending conflicts")
        print("  god-grow merge --resolve N   Resolve conflict at index N")

        return 0

    # =========================================================================
    # Changelog Command
    # =========================================================================

    def cmd_changelog(self, args: argparse.Namespace) -> int:
        """View or export changelog."""
        entries = self.changelog.get_entries(limit=args.limit if hasattr(args, 'limit') else None)

        if args.export_md:
            output = self.changelog.export_markdown(args.export_md)
            print(f"\nChangelog exported to: {output}")
            return 0

        if args.export_json:
            output = self.changelog.export_json(args.export_json)
            print(f"\nChangelog exported to: {output}")
            return 0

        # Display changelog
        print("\n" + "=" * 80)
        print("CORPUS CHANGELOG")
        print("=" * 80)

        if not entries:
            print("\nNo changelog entries found.")
            return 0

        # Group by date
        current_date = None
        for entry in entries:
            entry_date = entry.timestamp[:10]
            if entry_date != current_date:
                current_date = entry_date
                print(f"\n{current_date}")
                print("-" * 40)

            change_icon = {
                ChangeType.ADD_DOCUMENT: "+",
                ChangeType.REMOVE_DOCUMENT: "-",
                ChangeType.MODIFY_DOCUMENT: "~",
                ChangeType.REPROCESS: "⟳",
                ChangeType.SNAPSHOT: "📸",
                ChangeType.ROLLBACK: "↩",
                ChangeType.VERSION_BUMP: "⬆",
                ChangeType.CALIBRATION: "⚖"
            }.get(entry.change_type, "•")

            time_str = entry.timestamp[11:19]
            print(f"  {time_str} [{change_icon}] {entry.description}")

            if args.verbose and entry.metadata:
                for key, value in entry.metadata.items():
                    print(f"           {key}: {value}")

        print("\n" + "-" * 80)
        print(f"Total: {len(entries)} entries")

        return 0


def main():
    """Main entry point for god-grow CLI."""
    parser = argparse.ArgumentParser(
        prog="god-grow",
        description="Corpus Growth CLI - Manage corpus versioning and growth"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show corpus version and stats")

    # Snapshot command
    snapshot_parser = subparsers.add_parser("snapshot", help="Create versioned snapshot")
    snapshot_parser.add_argument("-d", "--description", help="Snapshot description")
    snapshot_parser.add_argument("-b", "--bump", choices=["major", "minor", "patch"],
                                 default="patch", help="Version bump type")
    snapshot_parser.add_argument("--no-artifacts", action="store_true",
                                 help="Don't include knowledge artifacts")

    # List command
    list_parser = subparsers.add_parser("list", help="List all snapshots")
    list_parser.add_argument("-v", "--verbose", action="store_true",
                            help="Show detailed information")

    # Verify command
    verify_parser = subparsers.add_parser("verify", help="Verify corpus integrity")
    verify_parser.add_argument("-s", "--snapshot", help="Snapshot to verify against")

    # Rollback command
    rollback_parser = subparsers.add_parser("rollback", help="Rollback to previous version")
    rollback_parser.add_argument("snapshot", nargs="?", help="Snapshot ID or version")
    rollback_parser.add_argument("--dry-run", action="store_true",
                                 help="Show what would be done")

    # Diff command
    diff_parser = subparsers.add_parser("diff", help="Compare versions")
    diff_parser.add_argument("version1", nargs="?", help="First version")
    diff_parser.add_argument("version2", nargs="?", help="Second version")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add new documents")
    add_parser.add_argument("paths", nargs="*", help="Document paths to add")
    add_parser.add_argument("-d", "--domain", help="Target domain subdirectory")
    add_parser.add_argument("-f", "--force", action="store_true",
                           help="Overwrite existing files")
    add_parser.add_argument("--no-process", action="store_true",
                           help="Don't suggest processing")

    # Process command
    process_parser = subparsers.add_parser("process", help="Process new documents")
    process_parser.add_argument("--dry-run", action="store_true",
                               help="Show what would be processed")
    process_parser.add_argument("--force", action="store_true",
                               help="Force reprocessing of all documents")

    # Rebalance command
    rebalance_parser = subparsers.add_parser("rebalance", help="Rebalance reasoning density")
    rebalance_parser.add_argument("-a", "--analyze", action="store_true",
                                  help="Analyze current density distribution")
    rebalance_parser.add_argument("-d", "--detect", action="store_true",
                                  help="Detect skew issues")
    rebalance_parser.add_argument("-c", "--calibrate", action="store_true",
                                  help="Auto-calibrate based on detected issues")
    rebalance_parser.add_argument("--dry-run", action="store_true",
                                  help="Show what would be done without applying")

    # Merge command
    merge_parser = subparsers.add_parser("merge", help="Manage knowledge merging")
    merge_parser.add_argument("--status", action="store_true",
                             help="Show merge statistics")
    merge_parser.add_argument("--conflicts", action="store_true",
                             help="List pending conflicts")
    merge_parser.add_argument("--resolve", type=int, metavar="N",
                             help="Resolve conflict at index N")
    merge_parser.add_argument("--use-new", action="store_true",
                             help="Use new KU instead of existing (with --resolve)")
    merge_parser.add_argument("--reason", help="Resolution reason (with --resolve)")

    # Changelog command
    changelog_parser = subparsers.add_parser("changelog", help="View/export changelog")
    changelog_parser.add_argument("-n", "--limit", type=int, help="Limit entries")
    changelog_parser.add_argument("-v", "--verbose", action="store_true",
                                  help="Show detailed information")
    changelog_parser.add_argument("--export-md", metavar="PATH",
                                  help="Export as markdown")
    changelog_parser.add_argument("--export-json", metavar="PATH",
                                  help="Export as JSON")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    # Initialize CLI
    cli = GrowthCLI()

    # Dispatch command
    commands = {
        "status": cli.cmd_status,
        "snapshot": cli.cmd_snapshot,
        "list": cli.cmd_list,
        "verify": cli.cmd_verify,
        "rollback": cli.cmd_rollback,
        "diff": cli.cmd_diff,
        "add": cli.cmd_add,
        "process": cli.cmd_process,
        "rebalance": cli.cmd_rebalance,
        "merge": cli.cmd_merge,
        "changelog": cli.cmd_changelog
    }

    handler = commands.get(args.command)
    if handler:
        return handler(args)
    else:
        print(f"Unknown command: {args.command}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
