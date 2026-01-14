#!/usr/bin/env python3
"""
god-explore: Phase 11 Introspection Layer CLI

Commands:
  list kus         - List knowledge units with optional filters
  list rus         - List reasoning units with optional filters
  show ku <id>     - Show detailed KU information
  show ru <id>     - Show detailed RU information
  trace ku <id>    - Trace provenance chain for a KU
  graph            - Generate graph visualization
  coverage         - Analyze query × document coverage
  export           - Export graph to various formats
  stats            - Show artifact statistics

Examples:
  god-explore list kus --query "phantasia"
  god-explore show ku ku_00ddb2542e3d3dfa
  god-explore trace ku ku_00ddb2542e3d3dfa
  god-explore graph --query "phantasia and action" --format dot --output graph.dot
  god-explore export --format cytoscape --output graph.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.artifact_loader import ArtifactLoader
from core.graph_builder import GraphBuilder
from core.coverage_analyzer import CoverageAnalyzer
from visualization.exporters import export_graph


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'


def print_header(text: str):
    """Print a colored header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print("=" * len(text))


def print_ku(ku, detailed: bool = False):
    """Print a knowledge unit."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}[{ku.id}]{Colors.END}")
    print(f"{Colors.BOLD}Query:{Colors.END} {ku.created_from_query}")
    print(f"{Colors.BOLD}Confidence:{Colors.END} {ku.confidence}")
    print(f"{Colors.BOLD}Claim:{Colors.END}")
    print(f"  {ku.claim}")

    if detailed or len(ku.sources) <= 3:
        print(f"\n{Colors.BOLD}Sources ({len(ku.sources)}):{Colors.END}")
        for i, source in enumerate(ku.sources, 1):
            print(f"  {i}. {source.author} - {source.title}")
            print(f"     Pages: {source.pages}, Chunk: {source.chunk_id}")
    else:
        print(f"\n{Colors.BOLD}Sources:{Colors.END} {len(ku.sources)} sources (use --detailed to see all)")


def print_ru(ru, detailed: bool = False):
    """Print a reasoning unit."""
    print(f"\n{Colors.BOLD}{Colors.YELLOW}[{ru.reason_id}]{Colors.END}")
    print(f"{Colors.BOLD}Relation:{Colors.END} {ru.relation}")
    print(f"{Colors.BOLD}Score:{Colors.END} {ru.score:.4f}")
    print(f"{Colors.BOLD}Topic:{Colors.END} {ru.topic}")

    if ru.llm.get('rationale'):
        print(f"{Colors.BOLD}Rationale:{Colors.END}")
        print(f"  {ru.llm['rationale']}")

    print(f"\n{Colors.BOLD}Knowledge Units ({len(ru.knowledge_ids)}):{Colors.END}")
    for ku_id in ru.knowledge_ids:
        print(f"  - {ku_id}")

    if detailed:
        print(f"\n{Colors.BOLD}Evidence:{Colors.END}")
        for i, evidence in enumerate(ru.evidence, 1):
            print(f"  {i}. [{evidence.ku_id}]")
            print(f"     {evidence.claim[:200]}...")


def cmd_list_kus(args, loader: ArtifactLoader):
    """List knowledge units with filters."""
    print_header("Knowledge Units")

    # Apply filters
    kus = loader.filter_kus(
        query=args.query,
        confidence=args.confidence,
        min_sources=args.min_sources,
        tags=args.tags.split(',') if args.tags else None
    )

    if not kus:
        print(f"{Colors.YELLOW}No knowledge units found matching filters.{Colors.END}")
        return

    print(f"\nFound {len(kus)} knowledge units")

    # Apply limit
    if args.limit:
        kus = kus[:args.limit]
        print(f"(showing first {len(kus)})")

    for ku in kus:
        print_ku(ku, detailed=args.detailed)

    if args.json:
        output = [
            {
                "id": ku.id,
                "claim": ku.claim,
                "query": ku.created_from_query,
                "confidence": ku.confidence,
                "source_count": len(ku.sources)
            }
            for ku in kus
        ]
        print(f"\n{Colors.BOLD}JSON Output:{Colors.END}")
        print(json.dumps(output, indent=2))


def cmd_list_rus(args, loader: ArtifactLoader):
    """List reasoning units with filters."""
    print_header("Reasoning Units")

    # Apply filters
    rus = loader.filter_rus(
        relation=args.relation,
        min_score=args.min_score,
        topic=args.topic
    )

    if not rus:
        print(f"{Colors.YELLOW}No reasoning units found matching filters.{Colors.END}")
        return

    print(f"\nFound {len(rus)} reasoning units")

    # Apply limit
    if args.limit:
        rus = rus[:args.limit]
        print(f"(showing first {len(rus)})")

    for ru in rus:
        print_ru(ru, detailed=args.detailed)


def cmd_show_ku(args, loader: ArtifactLoader):
    """Show detailed information about a KU."""
    ku = loader.get_ku(args.id)

    if not ku:
        print(f"{Colors.RED}Knowledge unit not found: {args.id}{Colors.END}")
        return

    print_header(f"Knowledge Unit: {args.id}")
    print_ku(ku, detailed=True)

    # Show related reasoning units
    rus = loader.get_rus_for_ku(args.id)
    if rus:
        print(f"\n{Colors.BOLD}Related Reasoning Units ({len(rus)}):{Colors.END}")
        for ru in rus:
            print(f"  - [{ru.reason_id}] {ru.relation} (score: {ru.score:.4f})")
            if ru.llm.get('rationale'):
                print(f"    {ru.llm['rationale'][:150]}...")


def cmd_show_ru(args, loader: ArtifactLoader):
    """Show detailed information about an RU."""
    ru = loader.get_ru(args.id)

    if not ru:
        print(f"{Colors.RED}Reasoning unit not found: {args.id}{Colors.END}")
        return

    print_header(f"Reasoning Unit: {args.id}")
    print_ru(ru, detailed=True)


def cmd_trace(args, loader: ArtifactLoader):
    """Trace provenance chain for a KU."""
    provenance = loader.trace_provenance(args.id)

    if "error" in provenance:
        print(f"{Colors.RED}{provenance['error']}{Colors.END}")
        return

    ku = provenance['ku']
    print_header(f"Provenance Trace: {args.id}")

    # Show KU
    print(f"\n{Colors.BOLD}Knowledge Unit:{Colors.END}")
    print_ku(ku, detailed=True)

    # Show reasoning connections
    if provenance['reasoning_units']:
        print(f"\n{Colors.BOLD}Reasoning Connections ({len(provenance['reasoning_units'])}):{Colors.END}")
        for ru in provenance['reasoning_units']:
            print(f"  - [{ru.reason_id}] {ru.relation} (score: {ru.score:.4f})")
            other_kus = [kid for kid in ru.knowledge_ids if kid != args.id]
            print(f"    Connected to: {', '.join(other_kus)}")

    # Show related KUs
    if provenance['related_kus']:
        print(f"\n{Colors.BOLD}Related Knowledge Units ({len(provenance['related_kus'])}):{Colors.END}")
        for related_ku in provenance['related_kus'][:5]:  # Show first 5
            print(f"  - [{related_ku.id}]")
            print(f"    {related_ku.claim[:150]}...")

    # Show documents
    print(f"\n{Colors.BOLD}Source Documents ({len(provenance['documents'])}):{Colors.END}")
    for doc in provenance['documents']:
        print(f"  - {doc}")

    # Show chunks
    print(f"\n{Colors.BOLD}Source Chunks ({len(provenance['chunk_ids'])}):{Colors.END}")
    for chunk_id in provenance['chunk_ids']:
        print(f"  - {chunk_id}")


def cmd_graph(args, loader: ArtifactLoader):
    """Generate graph visualization."""
    print_header("Graph Generation")

    builder = GraphBuilder(loader)

    # Determine which KUs to include
    ku_ids = None
    if args.query:
        kus = loader.get_kus_by_query(args.query)
        ku_ids = [ku.id for ku in kus]
        print(f"Building graph for {len(ku_ids)} KUs matching query: {args.query}")

    # Build graph
    if args.graph_type == 'ku':
        graph = builder.build_ku_graph(ku_ids=ku_ids)
    elif args.graph_type == 'provenance':
        graph = builder.build_provenance_graph(ku_ids=ku_ids)
    elif args.graph_type == 'query':
        graph = builder.build_query_graph()
    else:  # full
        graph = builder.build_full_graph(ku_ids=ku_ids)

    # Show stats
    stats = graph.get_stats()
    print(f"\n{Colors.BOLD}Graph Statistics:{Colors.END}")
    print(f"  Nodes: {stats['nodes']['total']}")
    for node_type, count in stats['nodes']['by_type'].items():
        print(f"    - {node_type}: {count}")
    print(f"  Edges: {stats['edges']['total']}")
    for relation, count in stats['edges']['by_relation'].items():
        print(f"    - {relation}: {count}")

    # Export if requested
    if args.output:
        output_path = Path(args.output)

        if args.format == 'json':
            graph_dict = graph.to_dict()
            with open(output_path, 'w') as f:
                json.dump(graph_dict, f, indent=2)
            print(f"\n{Colors.GREEN}✓ Graph exported to: {output_path}{Colors.END}")

        elif args.format in ['dot', 'graphviz']:
            export_graph(graph, output_path, format='dot')
            print(f"\n{Colors.GREEN}✓ GraphViz DOT exported to: {output_path}{Colors.END}")
            print(f"  Render with: dot -Tpng {output_path} -o graph.png")

        elif args.format == 'cytoscape':
            export_graph(graph, output_path, format='cytoscape')
            print(f"\n{Colors.GREEN}✓ Cytoscape JSON exported to: {output_path}{Colors.END}")
            print(f"  Import into Cytoscape Desktop for interactive analysis")

        elif args.format == 'd3':
            export_graph(graph, output_path, format='d3')
            print(f"\n{Colors.GREEN}✓ D3.js JSON exported to: {output_path}{Colors.END}")

        elif args.format == 'mermaid':
            export_graph(graph, output_path, format='mermaid')
            print(f"\n{Colors.GREEN}✓ Mermaid diagram exported to: {output_path}{Colors.END}")
            print(f"  Paste into GitHub markdown for rendering")


def cmd_stats(args, loader: ArtifactLoader):
    """Show artifact statistics."""
    print_header("Artifact Statistics")

    stats = loader.get_stats()

    if "error" in stats:
        print(f"{Colors.RED}{stats['error']}{Colors.END}")
        return

    # Knowledge Units
    ku_stats = stats['knowledge_units']
    print(f"\n{Colors.BOLD}Knowledge Units:{Colors.END}")
    print(f"  Total: {ku_stats['total']}")
    print(f"  Total Sources: {ku_stats['total_sources']}")
    print(f"  Avg Sources per KU: {ku_stats['avg_sources_per_ku']:.2f}")
    print(f"  Unique Queries: {ku_stats['unique_queries']}")
    print(f"  Unique Documents: {ku_stats['unique_documents']}")
    print(f"  Unique Chunks: {ku_stats['unique_chunks']}")

    # Reasoning Units
    ru_stats = stats['reasoning_units']
    print(f"\n{Colors.BOLD}Reasoning Units:{Colors.END}")
    print(f"  Total: {ru_stats['total']}")

    if ru_stats['by_relation']:
        print(f"  By Relation:")
        for relation, count in sorted(ru_stats['by_relation'].items(), key=lambda x: x[1], reverse=True):
            print(f"    - {relation}: {count}")


def cmd_coverage(args, loader: ArtifactLoader):
    """Analyze query × document coverage."""
    print_header("Coverage Analysis")

    analyzer = CoverageAnalyzer(loader)
    matrix = analyzer.build_coverage_matrix()

    # Show ASCII heatmap
    if not args.no_heatmap:
        print()
        heatmap = analyzer.generate_heatmap_ascii(matrix)
        print(heatmap)

    # Find coverage gaps
    if args.show_gaps:
        gaps = analyzer.find_coverage_gaps(matrix, min_sources=args.min_sources)
        if gaps:
            print(f"\n{Colors.BOLD}{Colors.RED}Coverage Gaps ({len(gaps)}):{Colors.END}")
            for gap in gaps:
                severity_color = Colors.RED if gap['severity'] == 'critical' else Colors.YELLOW
                print(f"\n  {severity_color}[{gap['severity'].upper()}]{Colors.END} {gap['query']}")
                print(f"    Documents: {gap['document_count']}, KUs: {gap['ku_count']}")
                print(f"    Recommendation: {gap['recommendation']}")

    # Find coverage overlaps
    if args.show_overlaps:
        overlaps = analyzer.find_coverage_overlaps(matrix)
        if overlaps:
            print(f"\n{Colors.BOLD}{Colors.CYAN}Coverage Overlaps ({len(overlaps)}):{Colors.END}")
            for overlap in overlaps[:10]:  # Show top 10
                print(f"\n  {overlap['query1']} <-> {overlap['query2']}")
                print(f"    Shared documents: {overlap['shared_count']}")
                print(f"    Overlap ratio: {overlap['overlap_ratio']:.2%}")
                print(f"    {overlap['interpretation']}")

    # Analyze document utilization
    if args.show_utilization:
        utilization = analyzer.analyze_document_utilization(matrix)
        print(f"\n{Colors.BOLD}{Colors.GREEN}Document Utilization:{Colors.END}")
        for doc in utilization[:10]:  # Show top 10
            print(f"\n  {doc['document']}")
            print(f"    Queries: {doc['query_count']}, KUs: {doc['ku_count']}")
            print(f"    Confidence: high={doc['confidence_dist']['high']}, medium={doc['confidence_dist']['medium']}, low={doc['confidence_dist']['low']}")
            print(f"    {doc['assessment']}")

    # Export options
    if args.output_html:
        output_path = Path(args.output_html)
        analyzer.generate_heatmap_html(matrix, output_path)
        print(f"\n{Colors.GREEN}✓ HTML heatmap exported to: {output_path}{Colors.END}")

    if args.output_json:
        output_path = Path(args.output_json)
        analyzer.export_coverage_json(matrix, output_path)
        print(f"\n{Colors.GREEN}✓ JSON data exported to: {output_path}{Colors.END}")

    if args.output_csv:
        output_path = Path(args.output_csv)
        analyzer.export_coverage_csv(matrix, output_path)
        print(f"\n{Colors.GREEN}✓ CSV data exported to: {output_path}{Colors.END}")


def main():
    parser = argparse.ArgumentParser(
        description="god-explore: Phase 11 Introspection Layer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # === LIST command ===
    list_parser = subparsers.add_parser('list', help='List artifacts')
    list_subparsers = list_parser.add_subparsers(dest='list_type', help='Artifact type')

    # list kus
    list_kus = list_subparsers.add_parser('kus', help='List knowledge units')
    list_kus.add_argument('--query', help='Filter by query')
    list_kus.add_argument('--confidence', choices=['high', 'medium', 'low'], help='Filter by confidence')
    list_kus.add_argument('--min-sources', type=int, default=0, help='Minimum number of sources')
    list_kus.add_argument('--tags', help='Filter by tags (comma-separated)')
    list_kus.add_argument('--limit', type=int, help='Limit number of results')
    list_kus.add_argument('--detailed', action='store_true', help='Show detailed information')
    list_kus.add_argument('--json', action='store_true', help='Output as JSON')

    # list rus
    list_rus = list_subparsers.add_parser('rus', help='List reasoning units')
    list_rus.add_argument('--relation', choices=['conflict', 'support', 'elaboration'], help='Filter by relation')
    list_rus.add_argument('--min-score', type=float, default=0.0, help='Minimum score')
    list_rus.add_argument('--topic', help='Filter by topic')
    list_rus.add_argument('--limit', type=int, help='Limit number of results')
    list_rus.add_argument('--detailed', action='store_true', help='Show detailed information')

    # === SHOW command ===
    show_parser = subparsers.add_parser('show', help='Show detailed information')
    show_subparsers = show_parser.add_subparsers(dest='show_type', help='Artifact type')

    # show ku
    show_ku = show_subparsers.add_parser('ku', help='Show knowledge unit')
    show_ku.add_argument('id', help='Knowledge unit ID')

    # show ru
    show_ru = show_subparsers.add_parser('ru', help='Show reasoning unit')
    show_ru.add_argument('id', help='Reasoning unit ID')

    # === TRACE command ===
    trace_parser = subparsers.add_parser('trace', help='Trace provenance chain')
    trace_subparsers = trace_parser.add_subparsers(dest='trace_type', help='Artifact type')

    # trace ku
    trace_ku = trace_subparsers.add_parser('ku', help='Trace knowledge unit provenance')
    trace_ku.add_argument('id', help='Knowledge unit ID')

    # === GRAPH command ===
    graph_parser = subparsers.add_parser('graph', help='Generate graph visualization')
    graph_parser.add_argument('--query', help='Filter by query')
    graph_parser.add_argument('--graph-type', choices=['ku', 'provenance', 'query', 'full'], default='ku',
                            help='Type of graph to build')
    graph_parser.add_argument('--format', choices=['json', 'dot', 'graphviz', 'cytoscape', 'd3', 'mermaid'], default='json',
                            help='Output format')
    graph_parser.add_argument('--output', help='Output file path')

    # === STATS command ===
    stats_parser = subparsers.add_parser('stats', help='Show artifact statistics')

    # === COVERAGE command ===
    coverage_parser = subparsers.add_parser('coverage', help='Analyze query × document coverage')
    coverage_parser.add_argument('--no-heatmap', action='store_true', help='Skip ASCII heatmap display')
    coverage_parser.add_argument('--show-gaps', action='store_true', help='Show coverage gaps')
    coverage_parser.add_argument('--show-overlaps', action='store_true', help='Show coverage overlaps')
    coverage_parser.add_argument('--show-utilization', action='store_true', help='Show document utilization')
    coverage_parser.add_argument('--min-sources', type=int, default=2, help='Minimum sources for gap detection')
    coverage_parser.add_argument('--output-html', help='Export HTML heatmap to file')
    coverage_parser.add_argument('--output-json', help='Export JSON data to file')
    coverage_parser.add_argument('--output-csv', help='Export CSV data to file')

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize loader
    try:
        loader = ArtifactLoader()
    except Exception as e:
        print(f"{Colors.RED}Error initializing artifact loader: {e}{Colors.END}")
        return 1

    # Route to command handler
    try:
        if args.command == 'list':
            if args.list_type == 'kus':
                cmd_list_kus(args, loader)
            elif args.list_type == 'rus':
                cmd_list_rus(args, loader)
            else:
                list_parser.print_help()

        elif args.command == 'show':
            if args.show_type == 'ku':
                cmd_show_ku(args, loader)
            elif args.show_type == 'ru':
                cmd_show_ru(args, loader)
            else:
                show_parser.print_help()

        elif args.command == 'trace':
            if args.trace_type == 'ku':
                cmd_trace(args, loader)
            else:
                trace_parser.print_help()

        elif args.command == 'graph':
            cmd_graph(args, loader)

        elif args.command == 'stats':
            cmd_stats(args, loader)

        elif args.command == 'coverage':
            cmd_coverage(args, loader)

    except Exception as e:
        print(f"{Colors.RED}Error executing command: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
