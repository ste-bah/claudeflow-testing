#!/usr/bin/env python3
"""
Auto-Promotion: Automatically promote high-confidence retrieval hits to KUs

Runs after queries and automatically promotes results that meet
confidence thresholds without manual intervention.

Config: god-learn/config/auto_promote.json
  - enabled: bool - Master switch
  - distance_threshold: float - Max distance for auto-promotion (lower = more similar)
  - min_overlap_score: int - Min query overlap score
  - require_highlight: bool - Require highlight matches
  - max_auto_per_query: int - Max units to auto-promote per query
  - min_claim_chars: int - Minimum characters for extracted claim
  - confidence_label: str - Label for auto-promoted units

Usage:
  python scripts/learn/auto_promote.py --results_json results.json --query "topic"
  god promote --auto --results_json results.json --query "topic"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import get_logger

# Paths
GOD_LEARN_DIR = Path("god-learn")
CONFIG_FILE = GOD_LEARN_DIR / "config" / "auto_promote.json"
KNOWLEDGE_JSONL = GOD_LEARN_DIR / "knowledge.jsonl"
INDEX_JSON = GOD_LEARN_DIR / "index.json"
LOG_FILE = GOD_LEARN_DIR / "auto_promote.log"

# Initialize logger
logger = get_logger("auto_promote")

# Sentence splitter
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def load_config() -> Dict[str, Any]:
    """Load auto-promotion configuration."""
    default_config = {
        "enabled": True,
        "distance_threshold": 0.6,
        "min_overlap_score": 3,
        "require_highlight": False,
        "max_auto_per_query": 3,
        "min_claim_chars": 40,
        "confidence_label": "auto-high",
        "log_file": str(LOG_FILE)
    }

    if CONFIG_FILE.exists():
        try:
            with CONFIG_FILE.open("r") as f:
                user_config = json.load(f)
                default_config.update(user_config)
        except Exception as e:
            logger.warning(f"Failed to load config: {e}")

    return default_config


def save_config(config: Dict[str, Any]):
    """Save configuration."""
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_FILE.open("w") as f:
        json.dump(config, f, indent=2)


def normalize_claim(s: str) -> str:
    """Normalize whitespace in claim."""
    return re.sub(r"\s+", " ", s).strip()


def canonical_source_key(src: Dict[str, Any]) -> str:
    """Generate canonical key for source."""
    return f"{src.get('path_rel','')}:{src.get('pages','')}:{src.get('chunk_id','')}"


def stable_id(claim: str, sources: List[Dict[str, Any]]) -> str:
    """Generate stable ID for a knowledge unit."""
    payload = {
        "claim": claim,
        "sources": sorted(canonical_source_key(s) for s in sources),
    }
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return "ku_" + h[:16]


def best_sentence_extract(text: str, query: str) -> Tuple[str, str]:
    """Extract best sentence matching query."""
    if not text or not text.strip():
        return ("", "empty_text")

    q_words = [w for w in re.findall(r"[A-Za-z]+", query.lower()) if len(w) >= 4]
    q_set = set(q_words)

    sents = [normalize_claim(s) for s in SENT_SPLIT.split(text) if normalize_claim(s)]
    if not sents:
        return ("", "no_sentences")

    scored: List[Tuple[int, int, int, str]] = []
    for idx, s in enumerate(sents):
        s_words = set(re.findall(r"[A-Za-z]+", s.lower()))
        overlap = len(q_set.intersection(s_words))
        scored.append((overlap, len(s), -idx, s))

    scored.sort(reverse=True)
    best = scored[0]
    overlap, length, neg_idx, sent = best
    reason = f"overlap={overlap} len={length} idx={-neg_idx}"
    return (sent, reason)


def check_threshold(result: Dict[str, Any], config: Dict[str, Any], query: str) -> Tuple[bool, str]:
    """
    Check if a result meets auto-promotion thresholds.

    Returns: (passes: bool, reason: str)
    """
    distance = result.get("distance", 1.0)
    highlight_count = result.get("highlight_count", 0)

    # Distance check
    if distance > config["distance_threshold"]:
        return (False, f"distance {distance:.3f} > threshold {config['distance_threshold']}")

    # Highlight check (optional)
    if config["require_highlight"] and highlight_count == 0:
        return (False, "no highlights and require_highlight=True")

    # Overlap score check
    text = result.get("text", "")
    if text:
        q_words = [w for w in re.findall(r"[A-Za-z]+", query.lower()) if len(w) >= 4]
        t_words = set(re.findall(r"[A-Za-z]+", text.lower()))
        overlap = len(set(q_words).intersection(t_words))
        if overlap < config["min_overlap_score"]:
            return (False, f"overlap {overlap} < min {config['min_overlap_score']}")

    return (True, "passed all thresholds")


def auto_promote(
    results: List[Dict[str, Any]],
    query: str,
    config: Dict[str, Any],
    dry_run: bool = False
) -> List[Dict[str, Any]]:
    """
    Automatically promote qualifying results to knowledge units.

    Returns: List of promoted units
    """
    if not config.get("enabled", True):
        logger.info("Auto-promotion disabled in config")
        return []

    # Load existing index for deduplication
    index: Dict[str, int] = {}
    if INDEX_JSON.exists():
        try:
            index = json.loads(INDEX_JSON.read_text())
        except Exception:
            pass

    promoted = []
    min_chars = config.get("min_claim_chars", 40)
    max_per_query = config.get("max_auto_per_query", 3)
    confidence_label = config.get("confidence_label", "auto-high")

    for r in results:
        if len(promoted) >= max_per_query:
            break

        # Check thresholds
        passes, reason = check_threshold(r, config, query)
        if not passes:
            logger.debug(f"Skipping {r.get('chunk_id')}: {reason}")
            continue

        # Extract claim
        text = r.get("text", "")
        claim, extract_reason = best_sentence_extract(text, query)
        claim = normalize_claim(claim)

        if not claim or len(claim) < min_chars:
            logger.debug(f"Skipping {r.get('chunk_id')}: claim too short ({len(claim)} chars)")
            continue

        # Build source
        meta = r.get("meta") if isinstance(r.get("meta"), dict) else {}
        author = str(meta.get("author_raw") or "").strip()
        title = str(meta.get("title_raw") or "").strip()

        if not author:
            fname = r.get("path_rel", "").split("/")[-1]
            author = fname.split(" - ")[0].strip() if " - " in fname else "Unknown"

        if not title:
            title = r.get("path_rel", "").split("/")[-1].replace(".pdf", "").strip()

        page_start = r.get("page_start", 0)
        page_end = r.get("page_end", 0)
        pages_str = f"{page_start}-{page_end}" if page_start != page_end else str(page_start)

        source = {
            "author": author,
            "title": title,
            "path_rel": r.get("path_rel", ""),
            "pages": pages_str,
            "chunk_id": r.get("chunk_id", ""),
        }

        # Create unit
        unit = {
            "id": "",
            "claim": claim,
            "sources": [source],
            "confidence": confidence_label,
            "tags": ["auto-promoted"],
            "created_from_query": query,
            "auto_promoted": True,
            "auto_promote_timestamp": datetime.now().isoformat(),
            "debug": {
                "extract_reason": extract_reason,
                "distance": r.get("distance"),
                "threshold_reason": reason,
                "rank": r.get("rank"),
            }
        }

        uid = stable_id(unit["claim"], unit["sources"])
        unit["id"] = uid

        # Check for duplicates
        if uid in index:
            logger.debug(f"Skipping duplicate: {uid}")
            continue

        promoted.append(unit)
        logger.info(f"Auto-promoting: {uid} (distance={r.get('distance', 'N/A'):.3f})")

    if not promoted:
        logger.info("No results met auto-promotion thresholds")
        return []

    if dry_run:
        logger.info(f"Dry run: would promote {len(promoted)} units")
        return promoted

    # Write to knowledge file
    GOD_LEARN_DIR.mkdir(parents=True, exist_ok=True)
    KNOWLEDGE_JSONL.touch(exist_ok=True)

    with KNOWLEDGE_JSONL.open("a", encoding="utf-8") as f:
        for u in promoted:
            offset = f.tell()
            f.write(json.dumps(u, ensure_ascii=False) + "\n")
            index[u["id"]] = offset

    # Update index
    INDEX_JSON.write_text(json.dumps(dict(sorted(index.items())), indent=2))

    logger.info(f"Auto-promoted {len(promoted)} units")

    # Log to auto_promote.log
    log_file = Path(config.get("log_file", LOG_FILE))
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with log_file.open("a") as f:
        for u in promoted:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "query": query,
                "unit_id": u["id"],
                "claim_preview": u["claim"][:100],
                "source": u["sources"][0]["path_rel"] if u["sources"] else ""
            }
            f.write(json.dumps(log_entry) + "\n")

    return promoted


def main() -> int:
    ap = argparse.ArgumentParser(description="Auto-promote high-confidence hits to Knowledge Units")
    ap.add_argument("--results_json", required=True, help="Path to retrieval results JSON")
    ap.add_argument("--query", required=True, help="Query that produced the results")
    ap.add_argument("--dry_run", action="store_true", help="Show what would be promoted without writing")
    ap.add_argument("--show_config", action="store_true", help="Show current configuration")
    ap.add_argument("--set_threshold", type=float, help="Set distance threshold")
    ap.add_argument("--enable", action="store_true", help="Enable auto-promotion")
    ap.add_argument("--disable", action="store_true", help="Disable auto-promotion")
    args = ap.parse_args()

    config = load_config()

    # Handle config commands
    if args.show_config:
        print(json.dumps(config, indent=2))
        return 0

    if args.set_threshold is not None:
        config["distance_threshold"] = args.set_threshold
        save_config(config)
        print(f"Distance threshold set to {args.set_threshold}")
        return 0

    if args.enable:
        config["enabled"] = True
        save_config(config)
        print("Auto-promotion enabled")
        return 0

    if args.disable:
        config["enabled"] = False
        save_config(config)
        print("Auto-promotion disabled")
        return 0

    # Load results
    results_path = Path(args.results_json)
    if not results_path.exists():
        logger.error(f"Results file not found: {results_path}")
        return 1

    try:
        data = json.loads(results_path.read_text())
        results = data.get("results", []) if isinstance(data, dict) else data
    except Exception as e:
        logger.error(f"Failed to load results: {e}")
        return 1

    # Run auto-promotion
    promoted = auto_promote(results, args.query, config, dry_run=args.dry_run)

    if args.dry_run:
        print(json.dumps(promoted, indent=2))
    else:
        print(f"[AutoPromote] promoted={len(promoted)}")
        for u in promoted:
            print(f"  {u['id']}: {u['claim'][:60]}...")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
