#!/usr/bin/env python3
"""
Establish QA Baselines - Create baseline snapshots of current corpus

This tool creates baseline files for regression detection by capturing
the current state of the corpus:
- Coverage baselines (query results)
- Reasoning baselines (RU relations)
- Metrics baselines (corpus statistics)
"""

import argparse
import sys
from pathlib import Path

# Add parent directories to path
scripts_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(scripts_dir))

from qa.core.baseline_manager import (
    BaselineManager,
    CoverageBaseline,
    CoverageQueryBaseline,
    ReasoningBaseline,
    ReasoningUnitBaseline,
    MetricsBaseline
)
from explore.core.artifact_loader import ArtifactLoader


def establish_coverage_baseline(
    loader: ArtifactLoader,
    manager: BaselineManager,
    queries: list[str],
    min_ku_threshold: float = 0.80
) -> CoverageBaseline:
    """
    Create coverage baseline from current corpus.

    Args:
        loader: Artifact loader
        manager: Baseline manager
        queries: List of queries to track
        min_ku_threshold: Minimum acceptable KU count as fraction of current (default: 0.80 = 80%)

    Returns:
        Created coverage baseline
    """
    print("Establishing coverage baseline...")

    query_baselines = []

    for query in queries:
        print(f"  Processing query: {query}")

        # Get current KUs for this query
        kus = loader.get_kus_by_query(query)

        if not kus:
            print(f"    ⚠️  Warning: No KUs found for query '{query}'")
            continue

        # Extract documents and authors
        documents = list({ku.sources[0].title for ku in kus})
        authors = list({ku.sources[0].author for ku in kus})
        ku_ids = [ku.id for ku in kus]

        # Set minimum acceptable count (allow 20% drop by default)
        expected_count = len(kus)
        min_count = int(expected_count * min_ku_threshold)

        query_baseline = CoverageQueryBaseline(
            query=query,
            expected_ku_count=expected_count,
            expected_min_ku_count=min_count,
            expected_documents=documents,
            expected_authors=authors,
            ku_ids_snapshot=ku_ids
        )

        query_baselines.append(query_baseline)

        print(f"    ✓ {expected_count} KUs, {len(documents)} documents, {len(authors)} authors")

    baseline = CoverageBaseline(queries=query_baselines)
    manager.save_coverage_baseline(baseline)

    print(f"\n✅ Coverage baseline saved: {manager.coverage_file}")
    print(f"   Tracking {len(query_baselines)} queries")

    return baseline


def establish_reasoning_baseline(
    loader: ArtifactLoader,
    manager: BaselineManager
) -> ReasoningBaseline:
    """
    Create reasoning baseline from current corpus.

    Args:
        loader: Artifact loader
        manager: Baseline manager

    Returns:
        Created reasoning baseline
    """
    print("\nEstablishing reasoning baseline...")

    # Load all reasoning units
    rus = loader.get_all_rus()

    print(f"  Processing {len(rus)} reasoning units...")

    # Create baseline snapshots
    reasoning_units = {}
    relation_counts = {}

    for ru_id, ru in rus.items():
        reasoning_units[ru_id] = ReasoningUnitBaseline(
            relation=ru.relation,
            topic=ru.topic,
            knowledge_ids=ru.knowledge_ids,
            score=ru.score
        )

        # Count relations
        relation_counts[ru.relation] = relation_counts.get(ru.relation, 0) + 1

    # Create stats
    stats = {
        "total_rus": len(rus),
        "relation_distribution": relation_counts
    }

    baseline = ReasoningBaseline(
        reasoning_units=reasoning_units,
        stats=stats
    )

    manager.save_reasoning_baseline(baseline)

    print(f"\n✅ Reasoning baseline saved: {manager.reasoning_file}")
    print(f"   Tracking {len(rus)} reasoning units")
    print(f"   Relations: {relation_counts}")

    return baseline


def establish_metrics_baseline(
    loader: ArtifactLoader,
    manager: BaselineManager
) -> MetricsBaseline:
    """
    Create metrics baseline from current corpus.

    Args:
        loader: Artifact loader
        manager: Baseline manager

    Returns:
        Created metrics baseline
    """
    print("\nEstablishing metrics baseline...")

    # Get statistics
    stats = loader.get_stats()
    rus = loader.get_all_rus()

    # Count unique documents and queries
    kus = loader.get_all_kus()
    unique_documents = len({ku.sources[0].path_rel for ku in kus.values()})
    unique_queries = len({ku.created_from_query for ku in kus.values()})

    # Count relation distribution
    relation_distribution = {}
    for ru in rus.values():
        relation_distribution[ru.relation] = relation_distribution.get(ru.relation, 0) + 1

    baseline = MetricsBaseline(
        knowledge_units_count=stats["knowledge_units"],
        reasoning_units_count=stats["reasoning_units"],
        unique_documents=unique_documents,
        unique_queries=unique_queries,
        relation_distribution=relation_distribution
    )

    manager.save_metrics_baseline(baseline)

    print(f"\n✅ Metrics baseline saved: {manager.metrics_file}")
    print(f"   KUs: {stats['knowledge_units']}")
    print(f"   RUs: {stats['reasoning_units']}")
    print(f"   Documents: {unique_documents}")
    print(f"   Queries: {unique_queries}")

    return baseline


def main():
    parser = argparse.ArgumentParser(
        description="Establish QA baselines from current corpus state",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Establish all baselines with 4 standard queries
  python3 establish_baselines.py \\
    --queries "phantasia and action,phantasia and perception,phantasia and time,aristotle's views on soul"

  # Establish only coverage baseline
  python3 establish_baselines.py --type coverage --queries "phantasia and action"

  # Establish all baselines with custom output directory
  python3 establish_baselines.py \\
    --queries "query1,query2" \\
    --output /path/to/baselines/
        """
    )

    parser.add_argument(
        "--queries",
        type=str,
        required=False,
        help="Comma-separated list of queries to track (required for coverage baseline)"
    )

    parser.add_argument(
        "--type",
        choices=["all", "coverage", "reasoning", "metrics"],
        default="all",
        help="Type of baseline to establish (default: all)"
    )

    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for baselines (default: qa/baselines/)"
    )

    parser.add_argument(
        "--min-ku-threshold",
        type=float,
        default=0.80,
        help="Minimum acceptable KU count as fraction of current (default: 0.80 = allow 20%% drop)"
    )

    parser.add_argument(
        "--project-root",
        type=str,
        default=None,
        help="Project root directory (default: auto-detect)"
    )

    args = parser.parse_args()

    # Validate arguments
    if args.type in ["all", "coverage"] and not args.queries:
        parser.error("--queries is required when establishing coverage baseline")

    # Initialize components
    project_root = Path(args.project_root) if args.project_root else None
    loader = ArtifactLoader(project_root)

    output_dir = Path(args.output) if args.output else None
    manager = BaselineManager(output_dir)

    # Parse queries
    queries = [q.strip() for q in args.queries.split(",")] if args.queries else []

    print("=" * 60)
    print("Establish QA Baselines")
    print("=" * 60)

    try:
        # Establish baselines based on type
        if args.type in ["all", "coverage"]:
            establish_coverage_baseline(loader, manager, queries, args.min_ku_threshold)

        if args.type in ["all", "reasoning"]:
            establish_reasoning_baseline(loader, manager)

        if args.type in ["all", "metrics"]:
            establish_metrics_baseline(loader, manager)

        print("\n" + "=" * 60)
        print("✅ Baseline establishment complete!")
        print("=" * 60)

        return 0

    except Exception as e:
        print(f"\n❌ Error establishing baselines: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
