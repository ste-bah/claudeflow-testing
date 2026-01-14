#!/usr/bin/env python3
"""
Phase 6 Promotion (from Phase 4/5 retrieval JSON).

Reads the JSON output produced by:
  scripts/retrieval/query_chunks.py --print_json --include_docs ...

Promotes extractive, citation-locked claims into:
  god-learn/knowledge.jsonl  (append-only, idempotent)
  god-learn/index.json       (id -> byte offset)

Design constraints:
- Deterministic: stable hashing + sorted emission
- No ingestion changes: reads only the retrieval JSON + Chroma for validation (optional)
- Citation-locked: every claim is a literal sentence taken from the chunk text, and sources reference chunk_id + pages.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import get_logger

# Initialize logger
logger = get_logger("phase6.promote")

GOD_LEARN_DIR = Path("god-learn")
KNOWLEDGE_JSONL = GOD_LEARN_DIR / "knowledge.jsonl"
INDEX_JSON = GOD_LEARN_DIR / "index.json"

# Conservative sentence splitter:
# - splits on . ! ? followed by whitespace
# - keeps things deterministic
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def die(msg: str, code: int = 1) -> None:
    logger.error(msg, extra={"exit_code": code})
    raise SystemExit(f"[Phase6:promote_hits] ERROR: {msg}")


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        die(f"Failed to read JSON: {path} ({e})")


def save_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize_claim(s: str) -> str:
    # Keep this minimal to preserve extractiveness:
    # - collapse whitespace
    # - trim
    c = re.sub(r"\s+", " ", s).strip()
    return c


def canonical_source_key(src: Dict[str, Any]) -> str:
    return f"{src.get('path_rel','')}:{src.get('pages','')}:{src.get('chunk_id','')}"


def stable_id(claim: str, sources: List[Dict[str, Any]]) -> str:
    payload = {
        "claim": claim,
        "sources": sorted(canonical_source_key(s) for s in sources),
    }
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return "ku_" + h[:16]


def best_sentence_extract(text: str, query: str) -> Tuple[str, str]:
    """
    Deterministic extraction heuristic:
    - Split into sentences
    - Score by overlap with query keywords (case-insensitive)
    - Ties broken by longer sentence, then earlier occurrence
    Returns: (claim_sentence, reason_string)
    """
    if not text or not text.strip():
        return ("", "empty_text")

    q_words = [w for w in re.findall(r"[A-Za-z]+", query.lower()) if len(w) >= 4]
    q_set = set(q_words)

    sents = [normalize_claim(s) for s in SENT_SPLIT.split(text) if normalize_claim(s)]
    if not sents:
        return ("", "no_sentences")

    scored: List[Tuple[int, int, int, str]] = []
    # tuple: (overlap_count, length, -index, sentence)
    for idx, s in enumerate(sents):
        s_words = set(re.findall(r"[A-Za-z]+", s.lower()))
        overlap = len(q_set.intersection(s_words))
        scored.append((overlap, len(s), -idx, s))

    scored.sort(reverse=True)
    best = scored[0]
    overlap, length, neg_idx, sent = best
    reason = f"overlap={overlap} len={length} idx={-neg_idx}"
    return (sent, reason)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hits_json", required=True, help="Phase 4/5 retrieval JSON (must include docs/text)")
    ap.add_argument("--query", required=True, help="Query that produced the hits (traceability + scoring)")
    ap.add_argument("--require_text", action="store_true", help="Hard fail if any result lacks text")
    ap.add_argument("--min_chars", type=int, default=40, help="Minimum chars for extracted claim")
    ap.add_argument("--max_units", type=int, default=0, help="Cap number of promoted units (0 = no cap)")
    ap.add_argument("--dry_run", action="store_true", help="Print promoted units JSON and exit (no writes)")
    args = ap.parse_args()

    hits_path = Path(args.hits_json)
    if not hits_path.exists():
        die(f"Input not found: {hits_path}")

    logger.info("Starting promotion", extra={
        "hits_json": str(hits_path),
        "query": args.query,
        "min_chars": args.min_chars,
        "max_units": args.max_units,
        "dry_run": args.dry_run,
    })

    GOD_LEARN_DIR.mkdir(parents=True, exist_ok=True)

    index: Dict[str, int] = {}
    if INDEX_JSON.exists():
        index = load_json(INDEX_JSON)
        if not isinstance(index, dict):
            die(f"Index file is not a dict: {INDEX_JSON}")

    hits = load_json(hits_path)
    if not isinstance(hits, dict):
        die("hits_json must be a JSON object/dict")

    results = hits.get("results", [])
    if not isinstance(results, list):
        die("hits_json['results'] must be a list")

    promoted: List[Dict[str, Any]] = []

    for i, r in enumerate(results):
        if not isinstance(r, dict):
            die(f"results[{i}] must be an object")

        # Required fields based on your schema
        for k in ("chunk_id", "path_rel", "page_start", "page_end"):
            if k not in r:
                die(f"results[{i}] missing required field: {k}")

        text = r.get("text", "")
        if args.require_text and (not isinstance(text, str) or not text.strip()):
            die(f"results[{i}] has no usable text, but --require_text was set")

        chunk_id = str(r["chunk_id"])
        path_rel = str(r["path_rel"])
        page_start = int(r["page_start"])
        page_end = int(r["page_end"])

        pages_str = f"{page_start}–{page_end}"

        claim, reason = best_sentence_extract(text if isinstance(text, str) else "", args.query)
        claim = normalize_claim(claim)

        # Skip if too short or empty (deterministic)
        if not claim or len(claim) < args.min_chars:
            continue

        # Construct source entry
        # NOTE: author/title not present in hits; we derive safely from path_rel:
        # - author = first token before " - " if present; else "Unknown"
        # - title = filename without suffix and without "(2014)_[My Copy]" noise (minimal)
        meta = r.get("meta") if isinstance(r.get("meta"), dict) else {}

        author_guess = str(meta.get("author_raw") or "").strip()
        title_guess  = str(meta.get("title_raw")  or "").strip()

        # Fallbacks (deterministic) if meta is missing for any reason
        if not author_guess:
            fname = path_rel.split("/")[-1]
            author_guess = fname.split(" - ")[0].strip() if " - " in fname else "Unknown"

        if not title_guess:
            title_guess = path_rel.split("/")[-1].replace(".pdf", "").strip()


        source = {
            "author": author_guess,
            "title": title_guess,
            "path_rel": path_rel,
            "pages": pages_str,
            "chunk_id": chunk_id,
        }


        unit = {
            "id": "",  # filled after stable_id
            "claim": claim,
            "sources": [source],
            "confidence": "high",
            "tags": [],  # optional; keep empty for now
            "created_from_query": args.query,
            "debug": {
                "extract_reason": reason,
                "rank": r.get("rank"),
                "raw_rank": r.get("raw_rank"),
                "distance": r.get("distance"),
                "final_score": r.get("final_score"),
                "highlight_count": r.get("highlight_count"),
                "rerank_boost": r.get("rerank_boost"),
            },
        }

        uid = stable_id(unit["claim"], unit["sources"])
        unit["id"] = uid

        # Idempotency: skip if already in index
        if uid in index:
            logger.debug("Skipping duplicate", extra={"ku_id": uid, "chunk_id": chunk_id})
            continue

        logger.debug("Promoting unit", extra={
            "ku_id": uid,
            "chunk_id": chunk_id,
            "claim_len": len(claim),
            "source": path_rel,
        })
        promoted.append(unit)

        if args.max_units and len(promoted) >= args.max_units:
            break

    # Deterministic output ordering
    promoted.sort(key=lambda u: u["id"])

    if args.dry_run:
        logger.info("Dry run complete", extra={"would_promote": len(promoted)})
        print(json.dumps(promoted, indent=2, ensure_ascii=False))
        return

    KNOWLEDGE_JSONL.touch(exist_ok=True)

    with KNOWLEDGE_JSONL.open("a", encoding="utf-8") as f:
        for u in promoted:
            offset = f.tell()
            f.write(json.dumps(u, ensure_ascii=False) + "\n")
            index[u["id"]] = offset

    # Deterministic index ordering
    save_json(INDEX_JSON, dict(sorted(index.items(), key=lambda kv: kv[0])))

    logger.info("Promotion complete", extra={
        "promoted": len(promoted),
        "total_indexed": len(index),
        "knowledge_file": str(KNOWLEDGE_JSONL),
        "index_file": str(INDEX_JSON),
    })

    print(f"[Phase6:promote_hits] promoted={len(promoted)} total_indexed={len(index)}")
    print(f"[Phase6:promote_hits] wrote: {KNOWLEDGE_JSONL}")
    print(f"[Phase6:promote_hits] index: {INDEX_JSON}")


if __name__ == "__main__":
    main()
