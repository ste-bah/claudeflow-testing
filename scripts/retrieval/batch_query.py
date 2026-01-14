#!/usr/bin/env python3
"""
Multi-Query Batch Processor

Runs multiple queries in parallel for efficient bulk retrieval.

Usage:
  god query --batch queries.txt --output results.json
  god query --batch queries.json --parallel 4 --k 5

Input Formats:
  - Text file: One query per line
  - JSON file: Array of queries or objects with "query" field

Output:
  - JSON file with all results aggregated
  - Optional progress bar

Features:
  - Parallel execution using ThreadPoolExecutor
  - Progress tracking
  - Deduplication of results across queries
  - Error handling and retry
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import threading

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Progress lock for thread-safe updates
progress_lock = threading.Lock()
completed_count = 0


@dataclass
class QueryResult:
    """Result for a single query."""
    query: str
    results: List[Dict[str, Any]]
    result_count: int
    duration_ms: float
    error: Optional[str] = None


@dataclass
class BatchResult:
    """Result for batch query execution."""
    timestamp: str
    total_queries: int
    successful: int
    failed: int
    total_duration_ms: float
    queries: List[QueryResult]
    deduplicated_chunks: int


def load_queries(path: str) -> List[str]:
    """Load queries from file."""
    file_path = Path(path)

    if not file_path.exists():
        raise FileNotFoundError(f"Query file not found: {path}")

    content = file_path.read_text().strip()

    # Try JSON first
    try:
        data = json.loads(content)
        if isinstance(data, list):
            # Array of strings or objects
            queries = []
            for item in data:
                if isinstance(item, str):
                    queries.append(item)
                elif isinstance(item, dict) and "query" in item:
                    queries.append(item["query"])
            return queries
        elif isinstance(data, dict) and "queries" in data:
            return data["queries"]
    except json.JSONDecodeError:
        pass

    # Fall back to line-separated
    queries = [line.strip() for line in content.split("\n") if line.strip()]
    return queries


def run_single_query(query: str, k: int = 5) -> QueryResult:
    """Run a single query and return results."""
    import subprocess

    start = time.time()

    try:
        result = subprocess.run(
            [
                sys.executable,
                str(PROJECT_ROOT / "scripts" / "retrieval" / "query_chunks.py"),
                query,
                "--k", str(k),
                "--print_json"
            ],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
            timeout=60
        )

        duration = (time.time() - start) * 1000

        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                # Handle both array and object with "results" key
                if isinstance(data, list):
                    results = data
                elif isinstance(data, dict):
                    results = data.get("results", [])
                else:
                    results = []
                return QueryResult(
                    query=query,
                    results=results,
                    result_count=len(results),
                    duration_ms=duration
                )
            except json.JSONDecodeError:
                return QueryResult(
                    query=query,
                    results=[],
                    result_count=0,
                    duration_ms=duration,
                    error="Failed to parse results"
                )
        else:
            return QueryResult(
                query=query,
                results=[],
                result_count=0,
                duration_ms=duration,
                error=result.stderr[:200] if result.stderr else "Query failed"
            )

    except Exception as e:
        duration = (time.time() - start) * 1000
        return QueryResult(
            query=query,
            results=[],
            result_count=0,
            duration_ms=duration,
            error=str(e)[:200]
        )


def run_batch(
    queries: List[str],
    k: int = 5,
    parallel: int = 4,
    show_progress: bool = True
) -> BatchResult:
    """
    Run multiple queries in parallel.

    Args:
        queries: List of query strings
        k: Number of results per query
        parallel: Number of parallel workers
        show_progress: Show progress bar

    Returns:
        BatchResult with all results
    """
    global completed_count
    completed_count = 0

    total = len(queries)
    start_time = time.time()

    def progress_callback(future):
        global completed_count
        with progress_lock:
            completed_count += 1
            if show_progress:
                pct = completed_count / total * 100
                bar = "=" * int(pct / 5)
                sys.stdout.write(f"\r  [{bar:<20}] {completed_count}/{total} ({pct:.0f}%)")
                sys.stdout.flush()

    results = []

    with ThreadPoolExecutor(max_workers=parallel) as executor:
        # Submit all queries
        futures = {}
        for query in queries:
            future = executor.submit(run_single_query, query, k)
            future.add_done_callback(progress_callback)
            futures[future] = query

        # Collect results
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                query = futures[future]
                results.append(QueryResult(
                    query=query,
                    results=[],
                    result_count=0,
                    duration_ms=0,
                    error=str(e)[:200]
                ))

    if show_progress:
        print()  # Newline after progress bar

    total_duration = (time.time() - start_time) * 1000

    # Count successes/failures
    successful = sum(1 for r in results if r.error is None)
    failed = len(results) - successful

    # Deduplicate chunks across all results
    seen_chunks = set()
    for r in results:
        for chunk in r.results:
            chunk_id = chunk.get("chunk_id") or chunk.get("id", "")
            seen_chunks.add(chunk_id)

    return BatchResult(
        timestamp=datetime.now().isoformat(),
        total_queries=len(queries),
        successful=successful,
        failed=failed,
        total_duration_ms=total_duration,
        queries=results,
        deduplicated_chunks=len(seen_chunks)
    )


def format_summary(result: BatchResult) -> str:
    """Format batch result summary."""
    lines = []

    lines.append("=" * 60)
    lines.append("BATCH QUERY RESULTS")
    lines.append("=" * 60)
    lines.append(f"  Timestamp:       {result.timestamp}")
    lines.append(f"  Total queries:   {result.total_queries}")
    lines.append(f"  Successful:      {result.successful}")
    lines.append(f"  Failed:          {result.failed}")
    lines.append(f"  Total duration:  {result.total_duration_ms:.0f}ms")
    lines.append(f"  Avg per query:   {result.total_duration_ms / max(result.total_queries, 1):.0f}ms")
    lines.append(f"  Unique chunks:   {result.deduplicated_chunks}")
    lines.append("")

    # Per-query summary
    lines.append("Query Results:")
    lines.append("-" * 60)

    for qr in result.queries[:20]:  # Limit display
        status = "OK" if qr.error is None else "ERR"
        lines.append(f"  [{status}] {qr.query[:40]}... ({qr.result_count} results, {qr.duration_ms:.0f}ms)")
        if qr.error:
            lines.append(f"       Error: {qr.error[:50]}")

    if len(result.queries) > 20:
        lines.append(f"  ... and {len(result.queries) - 20} more queries")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Batch query processor")
    ap.add_argument("input", help="Input file (queries.txt or queries.json)")
    ap.add_argument("--output", "-o", help="Output JSON file")
    ap.add_argument("--k", type=int, default=5, help="Results per query (default: 5)")
    ap.add_argument("--parallel", "-p", type=int, default=4,
                    help="Parallel workers (default: 4)")
    ap.add_argument("--quiet", "-q", action="store_true",
                    help="Suppress progress output")
    ap.add_argument("--json", action="store_true",
                    help="Output summary as JSON")
    args = ap.parse_args()

    # Load queries
    try:
        queries = load_queries(args.input)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if not queries:
        print("No queries found in input file.", file=sys.stderr)
        return 1

    print(f"Loaded {len(queries)} queries from {args.input}")
    print(f"Running with {args.parallel} parallel workers, {args.k} results per query")
    print()

    # Run batch
    result = run_batch(
        queries,
        k=args.k,
        parallel=args.parallel,
        show_progress=not args.quiet
    )

    # Output
    if args.output:
        output_data = {
            "timestamp": result.timestamp,
            "total_queries": result.total_queries,
            "successful": result.successful,
            "failed": result.failed,
            "total_duration_ms": result.total_duration_ms,
            "deduplicated_chunks": result.deduplicated_chunks,
            "queries": [asdict(qr) for qr in result.queries]
        }
        Path(args.output).write_text(json.dumps(output_data, indent=2))
        print(f"\nResults saved to: {args.output}")

    if args.json:
        summary = {
            "total_queries": result.total_queries,
            "successful": result.successful,
            "failed": result.failed,
            "total_duration_ms": result.total_duration_ms,
            "unique_chunks": result.deduplicated_chunks
        }
        print(json.dumps(summary, indent=2))
    else:
        print()
        print(format_summary(result))

    return 0 if result.failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
