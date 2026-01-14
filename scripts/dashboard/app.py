#!/usr/bin/env python3
"""
God-Learn Web Dashboard

Browser-based interface for QA monitoring, exploration, and quick queries.

Usage:
  god dashboard                # Start on localhost:5000
  god dashboard --port 8080    # Custom port
  god dashboard --host 0.0.0.0 # Allow external access

Features:
  - Real-time corpus statistics
  - QA alerts and health status
  - Query history
  - Quick search interface
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from flask import Flask, render_template, jsonify, request
except ImportError:
    print("Error: Flask is required. Install with: pip install flask")
    sys.exit(1)

app = Flask(__name__, template_folder="templates")

# Configuration
GOD_LEARN_DIR = PROJECT_ROOT / "god-learn"
CORPUS_DIR = PROJECT_ROOT / "corpus"
ALERTS_FILE = GOD_LEARN_DIR / "alerts" / "active.json"
HISTORY_FILE = GOD_LEARN_DIR / "sessions" / "history.jsonl"


def get_corpus_stats() -> Dict[str, Any]:
    """Get corpus statistics."""
    stats = {
        "documents": 0,
        "knowledge_units": 0,
        "chunks": 0,
        "domains": {},
        "last_updated": None,
    }

    # Count documents
    if CORPUS_DIR.exists():
        for domain_dir in CORPUS_DIR.iterdir():
            if domain_dir.is_dir() and not domain_dir.name.startswith("."):
                pdf_count = len(list(domain_dir.glob("*.pdf")))
                if pdf_count > 0:
                    stats["domains"][domain_dir.name] = pdf_count
                    stats["documents"] += pdf_count

    # Count KUs
    knowledge_file = GOD_LEARN_DIR / "knowledge.jsonl"
    if knowledge_file.exists():
        try:
            with knowledge_file.open("r") as f:
                stats["knowledge_units"] = sum(1 for line in f if line.strip())
        except Exception:
            pass

    # Count chunks from manifest
    manifest_file = PROJECT_ROOT / "scripts" / "ingest" / "manifest.jsonl"
    if manifest_file.exists():
        try:
            chunk_count = 0
            with manifest_file.open("r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        rec = json.loads(line)
                        chunk_count += rec.get("chunk_count", 0)
                    except Exception:
                        pass
            stats["chunks"] = chunk_count
        except Exception:
            pass

    # Index file for timestamp
    index_file = GOD_LEARN_DIR / "index.json"
    if index_file.exists():
        stats["last_updated"] = datetime.fromtimestamp(
            index_file.stat().st_mtime
        ).isoformat()

    return stats


def get_alerts() -> List[Dict[str, Any]]:
    """Get active alerts."""
    if not ALERTS_FILE.exists():
        return []

    try:
        data = json.loads(ALERTS_FILE.read_text())
        return data.get("alerts", [])
    except Exception:
        return []


def get_query_history(limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent query history."""
    if not HISTORY_FILE.exists():
        return []

    try:
        queries = []
        with HISTORY_FILE.open("r") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    queries.append(json.loads(line))
                except Exception:
                    pass

        # Sort by timestamp descending and limit
        queries.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return queries[:limit]
    except Exception:
        return []


def get_health_status() -> Dict[str, Any]:
    """Get overall health status."""
    alerts = get_alerts()
    critical = sum(1 for a in alerts if a.get("severity") == "critical")
    warnings = sum(1 for a in alerts if a.get("severity") == "warning")

    if critical > 0:
        status = "critical"
        message = f"{critical} critical issue(s) detected"
    elif warnings > 0:
        status = "warning"
        message = f"{warnings} warning(s) detected"
    else:
        status = "healthy"
        message = "All systems operational"

    return {
        "status": status,
        "message": message,
        "critical_count": critical,
        "warning_count": warnings,
        "alert_count": len(alerts),
    }


def run_query(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Run a quick query against the corpus."""
    try:
        import subprocess
        result = subprocess.run(
            [
                sys.executable,
                str(PROJECT_ROOT / "scripts" / "retrieval" / "query_chunks.py"),
                query,
                "--k", str(limit),
                "--print_json"
            ],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
            timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return []
    except Exception as e:
        return [{"error": str(e)}]


# ========================
# Routes
# ========================

@app.route("/")
def index():
    """Main dashboard page."""
    return render_template("index.html")


@app.route("/api/stats")
def api_stats():
    """Get corpus statistics."""
    return jsonify(get_corpus_stats())


@app.route("/api/alerts")
def api_alerts():
    """Get active alerts."""
    return jsonify({"alerts": get_alerts()})


@app.route("/api/health")
def api_health():
    """Get health status."""
    return jsonify(get_health_status())


@app.route("/api/history")
def api_history():
    """Get query history."""
    limit = request.args.get("limit", 20, type=int)
    return jsonify({"queries": get_query_history(limit)})


@app.route("/api/search")
def api_search():
    """Search the corpus."""
    query = request.args.get("q", "")
    limit = request.args.get("limit", 5, type=int)

    if not query:
        return jsonify({"error": "No query provided", "results": []})

    results = run_query(query, limit)
    return jsonify({"query": query, "results": results})


@app.route("/api/version")
def api_version():
    """Get version information."""
    version_file = PROJECT_ROOT / ".corpus-versions" / "current_version.json"
    version_info = {"version": "unknown", "snapshot_id": None}

    if version_file.exists():
        try:
            data = json.loads(version_file.read_text())
            version_info = {
                "version": f"v{data.get('major', 0)}.{data.get('minor', 0)}.{data.get('patch', 0)}",
                "snapshot_id": data.get("snapshot_id"),
            }
        except Exception:
            pass

    return jsonify(version_info)


def main():
    ap = argparse.ArgumentParser(description="God-Learn Web Dashboard")
    ap.add_argument("--host", default="127.0.0.1", help="Host to bind to (default: 127.0.0.1)")
    ap.add_argument("--port", type=int, default=5000, help="Port to listen on (default: 5000)")
    ap.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = ap.parse_args()

    print(f"""
================================================================================
                        GOD-LEARN WEB DASHBOARD
================================================================================

  Starting server at: http://{args.host}:{args.port}

  API Endpoints:
    /api/stats     - Corpus statistics
    /api/alerts    - Active alerts
    /api/health    - Health status
    /api/history   - Query history
    /api/search    - Search corpus (?q=query&limit=5)
    /api/version   - Version info

  Press Ctrl+C to stop the server.
================================================================================
""")

    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
