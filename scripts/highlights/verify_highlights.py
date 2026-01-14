#!/usr/bin/env python3
"""
Phase 5 (D5.4): verify_highlights.py

Checks:
1) highlight pages are valid for each PDF (1..page_count)
2) mapped chunk_ids in highlight_index.json exist in Chroma
"""

import argparse
import json
import os
from typing import Dict, Any

import chromadb

try:
    import fitz  # PyMuPDF
except Exception as ex:
    raise SystemExit(
        "Missing dependency: PyMuPDF (import fitz). Install with: pip install pymupdf\n"
        f"Original error: {ex}"
    )


def load_jsonl_pages(path: str):
    n = 0
    pages = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            n += 1
            rec = json.loads(line)
            pages.append(int(rec["page"]))
    return n, pages


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--path_rel", required=True)
    ap.add_argument("--highlights_jsonl", required=True)
    ap.add_argument("--highlight_index", default="scripts/highlights/highlight_index.json")
    ap.add_argument("--chroma_dir", default="vector_db_1536")
    ap.add_argument("--collection", default="knowledge_chunks")
    args = ap.parse_args()

    pdf_path = os.path.join(args.root, args.path_rel)
    if not os.path.exists(pdf_path):
        print(f"[FAIL] missing pdf: {pdf_path}")
        return 2

    doc = fitz.open(pdf_path)
    n_pages_pdf = doc.page_count

    n_highs, pages = load_jsonl_pages(args.highlights_jsonl)
    bad = [p for p in pages if p < 1 or p > n_pages_pdf]
    if bad:
        print(f"[FAIL] invalid highlight pages: {sorted(set(bad))[:20]} (pdf_pages={n_pages_pdf})")
        return 3

    idx: Dict[str, Any] = json.load(open(args.highlight_index, "r", encoding="utf-8"))
    if not isinstance(idx, dict):
        print("[FAIL] highlight_index is not a dict")
        return 4

    # Verify chunk_ids exist in Chroma
    client = chromadb.PersistentClient(path=args.chroma_dir)
    col = client.get_collection(args.collection)

    cids = list(idx.keys())
    missing = 0

    B = 200
    for i in range(0, len(cids), B):
        batch = cids[i:i+B]
        got = col.get(ids=batch)  # ids returned implicitly
        present = set(got.get("ids", []) or [])
        for cid in batch:
            if cid not in present:
                missing += 1

    if missing:
        print(f"[FAIL] chunk_ids missing in chroma: {missing}")
        return 5

    print(f"[OK] {args.path_rel}")
    print(f"[OK] highlights_jsonl={n_highs} pages_ok=1..{n_pages_pdf}")
    print(f"[OK] highlight_index chunk_ids exist in chroma ({len(cids)} checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
