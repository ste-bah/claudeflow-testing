#!/usr/bin/env python3
"""
Configuration Validator for God-Learn Pipeline.

Validates system setup before running expensive operations:
- Checks critical paths exist
- Verifies services are reachable
- Provides actionable fix suggestions

Usage:
  god config show   # Display current configuration
  god config check  # Validate paths and services
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple
import urllib.request
import urllib.error

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.common.config import get, get_section, DEFAULT_CONFIG


def check_path(path_str: str, name: str, required: bool = True) -> Tuple[bool, str]:
    """Check if a path exists."""
    path = Path(path_str)

    if path.exists():
        if path.is_dir():
            return True, f"OK - Directory exists"
        else:
            return True, f"OK - File exists ({path.stat().st_size} bytes)"
    else:
        if required:
            return False, f"MISSING - Path does not exist"
        else:
            return True, f"OK - Optional, not present"


def check_embedding_service() -> Tuple[bool, str, str]:
    """Check if embedding service is reachable."""
    url = get("embedding.url", "http://localhost:11435/api/embeddings")
    timeout = get("embedding.timeout", 5)

    # Try to connect to the service
    try:
        # For Ollama, use the base URL to check health
        base_url = url.rsplit("/", 2)[0]  # http://localhost:11435
        test_url = f"{base_url}/api/tags"

        req = urllib.request.Request(test_url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                return True, "OK - Embedding service responding", ""
    except urllib.error.URLError as e:
        return False, f"UNREACHABLE - {e.reason}", f"Start Ollama: ollama serve"
    except Exception as e:
        return False, f"ERROR - {str(e)[:50]}", "Check embedding service configuration"

    return False, "UNKNOWN - Could not verify", "Check embedding service"


def check_chroma_db() -> Tuple[bool, str, str]:
    """Check if ChromaDB is accessible."""
    chroma_dir = get("vector_db.chroma_dir")

    if not Path(chroma_dir).exists():
        return False, "MISSING - Vector DB directory not found", f"Run: god ingest embed --root corpus/"

    # Check for SQLite file
    sqlite_file = Path(chroma_dir) / "chroma.sqlite3"
    if not sqlite_file.exists():
        return False, "EMPTY - No database found", "Run: god ingest embed --root corpus/"

    # Try to import and connect
    try:
        import chromadb
        from chromadb.config import Settings

        client = chromadb.PersistentClient(
            path=chroma_dir,
            settings=Settings(anonymized_telemetry=False)
        )

        collections = client.list_collections()
        if collections:
            # Get chunk count from first collection
            coll = collections[0]
            count = coll.count()
            return True, f"OK - {len(collections)} collection(s), {count} vectors", ""
        else:
            return False, "EMPTY - No collections found", "Run: god ingest embed --root corpus/"

    except ImportError:
        return False, "ERROR - chromadb not installed", "pip install chromadb"
    except Exception as e:
        return False, f"ERROR - {str(e)[:50]}", "Check ChromaDB installation"


def run_check(verbose: bool = False) -> int:
    """Run configuration validation checks."""
    print("God-Learn Configuration Check")
    print("=" * 60)
    print()

    errors = 0
    warnings = 0

    # Check critical paths
    print("Paths:")
    print("-" * 60)

    path_checks = [
        ("paths.corpus_root", "Corpus root", True),
        ("vector_db.chroma_dir", "Vector DB", True),
        ("paths.knowledge_file", "Knowledge file", False),
        ("paths.manifest", "Manifest file", False),
        ("paths.logs_dir", "Logs directory", False),
    ]

    for key, name, required in path_checks:
        path = get(key)
        ok, msg = check_path(path, name, required)
        status = "✓" if ok else "✗"
        if not ok and required:
            errors += 1
        elif not ok:
            warnings += 1

        print(f"  {status} {name:<20} {msg}")
        if verbose:
            print(f"      Path: {path}")

    print()

    # Check services
    print("Services:")
    print("-" * 60)

    # Embedding service
    ok, msg, fix = check_embedding_service()
    status = "✓" if ok else "✗"
    if not ok:
        warnings += 1  # Not fatal, can still query cached data
    print(f"  {status} Embedding Service    {msg}")
    if not ok and fix:
        print(f"      Fix: {fix}")

    # ChromaDB
    ok, msg, fix = check_chroma_db()
    status = "✓" if ok else "✗"
    if not ok:
        errors += 1
    print(f"  {status} Vector Database      {msg}")
    if not ok and fix:
        print(f"      Fix: {fix}")

    print()

    # Summary
    print("=" * 60)
    if errors == 0 and warnings == 0:
        print("✓ All checks passed. System ready.")
        return 0
    elif errors == 0:
        print(f"⚠ {warnings} warning(s). System may work with reduced functionality.")
        return 0
    else:
        print(f"✗ {errors} error(s), {warnings} warning(s). Please fix errors before proceeding.")
        return 1


def show_config(section: str = None):
    """Display current configuration."""
    print("God-Learn Configuration")
    print("=" * 60)
    print()

    if section:
        config = get_section(section)
        if config:
            print(f"[{section}]")
            for key, value in config.items():
                print(f"  {key}: {value}")
        else:
            print(f"Unknown section: {section}")
            return
    else:
        # Show all sections
        for section_name in sorted(DEFAULT_CONFIG.keys()):
            print(f"[{section_name}]")
            config = get_section(section_name)
            for key, value in config.items():
                print(f"  {key}: {value}")
            print()

    print()
    print("Environment override format: GOD_LEARN_<SECTION>_<KEY>=value")
    print("Example: GOD_LEARN_PATHS_CORPUS_ROOT=/custom/path")


def main() -> int:
    ap = argparse.ArgumentParser(description="Configuration validator")
    ap.add_argument("command", nargs="?", choices=["show", "check"],
                    help="Command to run")
    ap.add_argument("--section", "-s", help="Show specific section only")
    ap.add_argument("--verbose", "-v", action="store_true",
                    help="Show detailed output")
    ap.add_argument("--json", action="store_true",
                    help="Output as JSON")
    args = ap.parse_args()

    if args.command == "show" or (not args.command and args.section):
        show_config(args.section)
        return 0
    elif args.command == "check":
        return run_check(args.verbose)
    else:
        # Default: run check
        return run_check(args.verbose)


if __name__ == "__main__":
    raise SystemExit(main())
