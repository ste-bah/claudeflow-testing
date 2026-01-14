#!/usr/bin/env python3
"""
Phase 6 Verification for god-learn/knowledge.jsonl

Verifies:
- JSONL structure
- Stable ID recomputation
- chunk_id exists in Chroma
- cited pages inside chunk page_start/page_end metadata
- index offsets point to correct rows

Exit codes:
- 0 OK
- 1 structural / soft failures
- 2 provenance violations (hard)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import chromadb


GOD_LEARN_DIR = Path("god-learn")
KNOWLEDGE_JSONL = GOD_LEARN_DIR / "knowledge.jsonl"
INDEX_JSON = GOD_LEARN_DIR / "index.json"

CHROMA_DIR = Path("vector_db_1536")
COLLECTION = "knowledge_chunks"

# Accept "19-20" or "19–20"
PAGE_RE = re.compile(r"^\s*(\d+)\s*[–-]\s*(\d+)\s*$")


def die(msg: str, code: int = 1) -> None:
    raise SystemExit(f"[Phase6:verify] ERROR: {msg}")


def load_index() -> Dict[str, int]:
    if not INDEX_JSON.exists():
        return {}
    d = json.loads(INDEX_JSON.read_text(encoding="utf-8"))
    if not isinstance(d, dict):
        die("index.json is not a dict")
    return {str(k): int(v) for k, v in d.items()}


def canonical_source_key(src: Dict[str, Any]) -> str:
    return f"{src.get('path_rel','')}:{src.get('pages','')}:{src.get('chunk_id','')}"


def recompute_id(claim: str, sources: List[Dict[str, Any]]) -> str:
    payload = {
        "claim": claim.strip(),
        "sources": sorted(canonical_source_key(s) for s in sources),
    }
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return "ku_" + h[:16]


def parse_pages(p: str) -> Tuple[int, int]:
    m = PAGE_RE.match(p)
    if not m:
        die(f"Bad pages format: {p!r}", code=2)
    a, b = int(m.group(1)), int(m.group(2))
    if a <= 0 or b <= 0 or b < a:
        die(f"Invalid pages range: {p!r}", code=2)
    return a, b


def connect_chroma():
    if not CHROMA_DIR.exists():
        die(f"Chroma dir not found: {CHROMA_DIR}", code=2)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_collection(COLLECTION)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict_order", action="store_true", help="Require IDs sorted in JSONL")
    args = ap.parse_args()

    if not KNOWLEDGE_JSONL.exists():
        die(f"Missing: {KNOWLEDGE_JSONL}")

    index = load_index()
    col = connect_chroma()

    ids_seen: List[str] = []
    hard_errors = 0
    soft_errors = 0

    with KNOWLEDGE_JSONL.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue

            try:
                u = json.loads(line)
            except Exception:
                die(f"Invalid JSON on line {line_no}", code=1)

            # Required fields
            for k in ("id", "claim", "sources", "confidence", "tags", "created_from_query"):
                if k not in u:
                    die(f"Missing field {k} on line {line_no}", code=1)

            uid = str(u["id"])
            claim = str(u["claim"])
            sources = u["sources"]

            if not isinstance(sources, list) or not sources:
                die(f"Empty sources on line {line_no}", code=1)

            rid = recompute_id(claim, sources)
            if rid != uid:
                soft_errors += 1
                print(f"[ID_MISMATCH] line={line_no} expected={rid} got={uid}")

            for s in sources:
                for k in ("path_rel", "pages", "chunk_id"):
                    if k not in s:
                        die(f"Source missing {k} for {uid} line={line_no}", code=1)

                ps, pe = parse_pages(str(s["pages"]))
                chunk_id = str(s["chunk_id"])

                res = col.get(ids=[chunk_id], include=["metadatas"])
                if not res or not res.get("ids") or res["ids"][0] is None:
                    hard_errors += 1
                    print(f"[MISSING_CHUNK] {uid} chunk_id={chunk_id}")
                    continue

                md = res["metadatas"][0] or {}
                c_ps = int(md.get("page_start", -1))
                c_pe = int(md.get("page_end", -1))
                if c_ps <= 0 or c_pe <= 0:
                    hard_errors += 1
                    print(f"[MISSING_PAGE_META] {uid} chunk={chunk_id}")
                    continue

                if ps < c_ps or pe > c_pe:
                    hard_errors += 1
                    print(f"[PAGE_OUT_OF_RANGE] {uid} chunk={chunk_id} cites={ps}-{pe} chunk_pages={c_ps}-{c_pe}")

            ids_seen.append(uid)

    if args.strict_order and ids_seen != sorted(ids_seen):
        soft_errors += 1
        print("[ORDER_FAIL] IDs in knowledge.jsonl are not sorted")

    # Index sanity check (spot check all entries; file is small right now)
    if index:
        with KNOWLEDGE_JSONL.open("rb") as bf:
            for uid, off in index.items():
                bf.seek(off)
                line = bf.readline().decode("utf-8", errors="replace").strip()
                if not line:
                    soft_errors += 1
                    print(f"[INDEX_BAD_OFFSET] {uid} offset={off}")
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    soft_errors += 1
                    print(f"[INDEX_BAD_JSON] {uid} offset={off}")
                    continue
                if str(row.get("id")) != uid:
                    soft_errors += 1
                    print(f"[INDEX_POINTS_WRONG_ROW] index_id={uid} row_id={row.get('id')} offset={off}")

    if hard_errors:
        die(f"Hard failures: {hard_errors}", code=2)
    if soft_errors:
        die(f"Soft failures: {soft_errors}", code=1)

    print(f"[Phase6:verify] OK units={len(ids_seen)}")
    raise SystemExit(0)


if __name__ == "__main__":
    main()
