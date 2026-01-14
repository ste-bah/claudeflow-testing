#!/usr/bin/env python3
"""
Cross-Session Memory Manager

Persists query context and results between sessions for continuity.

Features:
- Query history with timestamps
- Session context (current topic, last query)
- Bookmarked queries/results
- Semantic search over past queries

Storage:
  god-learn/sessions/history.jsonl  - All queries with results
  god-learn/sessions/context.json   - Current session state
  god-learn/sessions/favorites.json - Bookmarked items

Usage:
  god history                    # Show recent queries
  god history search <term>      # Search history
  god history clear              # Clear history
  god history bookmark <id>      # Bookmark a query
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

SESSIONS_DIR = Path("god-learn/sessions")
HISTORY_FILE = SESSIONS_DIR / "history.jsonl"
CONTEXT_FILE = SESSIONS_DIR / "context.json"
FAVORITES_FILE = SESSIONS_DIR / "favorites.json"


@dataclass
class QueryRecord:
    """A single query record in history."""
    id: str
    query: str
    timestamp: float
    timestamp_human: str
    result_count: int
    top_sources: List[str]  # path_rel of top results
    duration_ms: Optional[float] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


@dataclass
class SessionContext:
    """Current session state."""
    session_id: str
    started: float
    last_query: Optional[str] = None
    last_query_id: Optional[str] = None
    active_topic: Optional[str] = None
    query_count: int = 0


def ensure_dirs():
    """Ensure sessions directory exists."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def generate_query_id(query: str, timestamp: float) -> str:
    """Generate stable ID for a query."""
    payload = f"{query}:{timestamp}"
    return "qh_" + hashlib.sha256(payload.encode()).hexdigest()[:12]


def load_context() -> SessionContext:
    """Load or create session context."""
    ensure_dirs()
    if CONTEXT_FILE.exists():
        try:
            data = json.loads(CONTEXT_FILE.read_text())
            return SessionContext(**data)
        except Exception:
            pass

    # Create new session
    now = time.time()
    return SessionContext(
        session_id=f"session_{int(now)}",
        started=now,
        query_count=0
    )


def save_context(ctx: SessionContext):
    """Save session context."""
    ensure_dirs()
    CONTEXT_FILE.write_text(json.dumps(asdict(ctx), indent=2))


def record_query(
    query: str,
    results: List[Dict[str, Any]],
    duration_ms: Optional[float] = None,
    tags: Optional[List[str]] = None
) -> QueryRecord:
    """
    Record a query and its results to history.

    Args:
        query: The query string
        results: List of result dicts (must have 'path_rel' key)
        duration_ms: Query duration in milliseconds
        tags: Optional tags for categorization

    Returns:
        The created QueryRecord
    """
    ensure_dirs()

    now = time.time()
    qid = generate_query_id(query, now)

    top_sources = []
    for r in results[:5]:  # Top 5 sources
        if isinstance(r, dict) and "path_rel" in r:
            top_sources.append(r["path_rel"])

    record = QueryRecord(
        id=qid,
        query=query,
        timestamp=now,
        timestamp_human=datetime.fromtimestamp(now).isoformat(),
        result_count=len(results),
        top_sources=top_sources,
        duration_ms=duration_ms,
        tags=tags
    )

    # Append to history
    with HISTORY_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(record)) + "\n")

    # Update context
    ctx = load_context()
    ctx.last_query = query
    ctx.last_query_id = qid
    ctx.query_count += 1
    save_context(ctx)

    return record


def get_recent_queries(n: int = 10) -> List[QueryRecord]:
    """Get the N most recent queries."""
    ensure_dirs()
    if not HISTORY_FILE.exists():
        return []

    records = []
    with HISTORY_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                records.append(QueryRecord(**data))
            except Exception:
                continue

    # Sort by timestamp descending, take top N
    records.sort(key=lambda r: r.timestamp, reverse=True)
    return records[:n]


def search_history(term: str, limit: int = 20) -> List[QueryRecord]:
    """Search query history for a term."""
    ensure_dirs()
    if not HISTORY_FILE.exists():
        return []

    term_lower = term.lower()
    matches = []

    with HISTORY_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                record = QueryRecord(**data)
                # Search in query text and sources
                if term_lower in record.query.lower():
                    matches.append(record)
                elif any(term_lower in s.lower() for s in record.top_sources):
                    matches.append(record)
            except Exception:
                continue

    # Sort by timestamp descending
    matches.sort(key=lambda r: r.timestamp, reverse=True)
    return matches[:limit]


def clear_history() -> int:
    """Clear all history. Returns count of deleted records."""
    ensure_dirs()
    if not HISTORY_FILE.exists():
        return 0

    count = sum(1 for _ in HISTORY_FILE.open("r"))
    HISTORY_FILE.unlink()
    HISTORY_FILE.touch()

    # Reset context
    ctx = load_context()
    ctx.last_query = None
    ctx.last_query_id = None
    ctx.query_count = 0
    save_context(ctx)

    return count


def load_favorites() -> Dict[str, Any]:
    """Load favorites/bookmarks."""
    ensure_dirs()
    if FAVORITES_FILE.exists():
        try:
            return json.loads(FAVORITES_FILE.read_text())
        except Exception:
            pass
    return {"queries": [], "results": []}


def save_favorites(favorites: Dict[str, Any]):
    """Save favorites/bookmarks."""
    ensure_dirs()
    FAVORITES_FILE.write_text(json.dumps(favorites, indent=2))


def bookmark_query(query_id: str) -> bool:
    """Bookmark a query by ID."""
    # Find the query in history
    ensure_dirs()
    if not HISTORY_FILE.exists():
        return False

    found = None
    with HISTORY_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get("id") == query_id:
                    found = data
                    break
            except Exception:
                continue

    if not found:
        return False

    favorites = load_favorites()
    # Avoid duplicates
    if query_id not in [q.get("id") for q in favorites["queries"]]:
        favorites["queries"].append(found)
        save_favorites(favorites)

    return True


def get_stats() -> Dict[str, Any]:
    """Get history statistics."""
    ensure_dirs()
    records = get_recent_queries(n=10000)  # Load all

    if not records:
        return {
            "total_queries": 0,
            "unique_topics": 0,
            "first_query": None,
            "last_query": None,
            "favorites_count": len(load_favorites().get("queries", []))
        }

    # Extract unique words as rough "topics"
    all_words = set()
    for r in records:
        words = r.query.lower().split()
        all_words.update(w for w in words if len(w) > 3)

    return {
        "total_queries": len(records),
        "unique_topics": len(all_words),
        "first_query": records[-1].timestamp_human if records else None,
        "last_query": records[0].timestamp_human if records else None,
        "favorites_count": len(load_favorites().get("queries", []))
    }


# =========================
# CLI Interface
# =========================

def cmd_list(args) -> int:
    """List recent queries."""
    records = get_recent_queries(n=args.limit)

    if not records:
        print("No queries in history.")
        return 0

    print(f"Recent Queries (last {len(records)}):")
    print("-" * 60)

    for r in records:
        dt = datetime.fromtimestamp(r.timestamp)
        date_str = dt.strftime("%Y-%m-%d %H:%M")
        sources_preview = ", ".join(s.split("/")[-1][:20] for s in r.top_sources[:2])
        print(f"  [{r.id}] {date_str}")
        print(f"    Q: {r.query[:60]}{'...' if len(r.query) > 60 else ''}")
        print(f"    Results: {r.result_count}  Sources: {sources_preview}")
        print()

    return 0


def cmd_search(args) -> int:
    """Search history."""
    if not args.term:
        print("Error: Search term required")
        return 1

    matches = search_history(args.term, limit=args.limit)

    if not matches:
        print(f"No queries matching '{args.term}'")
        return 0

    print(f"Queries matching '{args.term}' ({len(matches)} found):")
    print("-" * 60)

    for r in matches:
        dt = datetime.fromtimestamp(r.timestamp)
        date_str = dt.strftime("%Y-%m-%d %H:%M")
        print(f"  [{r.id}] {date_str}")
        print(f"    Q: {r.query}")
        print()

    return 0


def cmd_clear(args) -> int:
    """Clear history."""
    if not args.force:
        print("This will delete all query history. Use --force to confirm.")
        return 1

    count = clear_history()
    print(f"Cleared {count} queries from history.")
    return 0


def cmd_bookmark(args) -> int:
    """Bookmark a query."""
    if not args.query_id:
        print("Error: Query ID required")
        return 1

    if bookmark_query(args.query_id):
        print(f"Bookmarked query: {args.query_id}")
        return 0
    else:
        print(f"Query not found: {args.query_id}")
        return 1


def cmd_stats(args) -> int:
    """Show history statistics."""
    stats = get_stats()

    print("Query History Statistics:")
    print("-" * 40)
    print(f"  Total queries:   {stats['total_queries']}")
    print(f"  Unique topics:   {stats['unique_topics']}")
    print(f"  First query:     {stats['first_query'] or 'N/A'}")
    print(f"  Last query:      {stats['last_query'] or 'N/A'}")
    print(f"  Bookmarks:       {stats['favorites_count']}")

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Query history and session management",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = ap.add_subparsers(dest="command", help="Command to run")

    # List command
    list_p = subparsers.add_parser("list", help="List recent queries")
    list_p.add_argument("-n", "--limit", type=int, default=10, help="Number of queries to show")

    # Search command
    search_p = subparsers.add_parser("search", help="Search query history")
    search_p.add_argument("term", nargs="?", help="Search term")
    search_p.add_argument("-n", "--limit", type=int, default=20, help="Max results")

    # Clear command
    clear_p = subparsers.add_parser("clear", help="Clear query history")
    clear_p.add_argument("--force", action="store_true", help="Confirm clear")

    # Bookmark command
    bookmark_p = subparsers.add_parser("bookmark", help="Bookmark a query")
    bookmark_p.add_argument("query_id", nargs="?", help="Query ID to bookmark")

    # Stats command
    stats_p = subparsers.add_parser("stats", help="Show history statistics")

    args = ap.parse_args()

    if not args.command:
        # Default to list
        args.limit = 10
        return cmd_list(args)

    commands = {
        "list": cmd_list,
        "search": cmd_search,
        "clear": cmd_clear,
        "bookmark": cmd_bookmark,
        "stats": cmd_stats,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
