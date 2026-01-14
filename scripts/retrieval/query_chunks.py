#!/usr/bin/env python3
"""
Phase 4 (D1): query_chunks.py

Retrieval-only CLI:
- Embeds the query via local embedding server
- Queries Chroma (knowledge_chunks)
- Prints top-K chunks with provenance:
  path_rel, page_start-page_end, chunk_id, distance

Phase 5: optional highlight-aware reranking (query-time only)
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.retrieval.filtering import FilterConfig, passes_filters

import argparse
import json
from typing import Any, Dict, List, Optional

import requests
import chromadb

import signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)


DEFAULT_EMBED_URL = "http://127.0.0.1:8000/embed"
DEFAULT_CHROMA_DIR = "vector_db_1536"
DEFAULT_COLLECTION = "knowledge_chunks"


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def embed_query(text: str, embed_url: str, timeout_s: int = 120) -> List[float]:
    payload = {"texts": [text]}
    r = requests.post(embed_url, json=payload, timeout=timeout_s)
    r.raise_for_status()
    data = r.json()

    if isinstance(data, dict):
        if "embeddings" in data and isinstance(data["embeddings"], list):
            return data["embeddings"][0]
        if "data" in data and isinstance(data["data"], list):
            return data["data"][0]
        if "embedding" in data and isinstance(data["embedding"], list):
            return data["embedding"]
    if isinstance(data, list) and data and isinstance(data[0], dict) and "embedding" in data[0]:
        return data[0]["embedding"]

    raise ValueError(f"Unrecognized embedding response shape: {json.dumps(data)[:500]}")


def open_chroma(chroma_dir: str, collection_name: str):
    client = chromadb.PersistentClient(path=chroma_dir)
    return client.get_or_create_collection(collection_name)


def safe_get_meta(meta: Dict[str, Any], key: str, default: Any = None) -> Any:
    return meta.get(key, default)


def load_highlight_index(path: str) -> Dict[str, Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("highlight index must be a JSON object keyed by chunk_id")
    return data


def apply_highlight_rerank(
    rows: List[Dict[str, Any]],
    hl_index: Dict[str, Dict[str, Any]],
    alpha: float,
    cap: int,
) -> List[Dict[str, Any]]:
    """
    Adds: highlight_count, rerank_boost, final_score
    Sorts deterministically by: final_score asc, distance asc, chunk_id asc
    """
    for r in rows:
        cid = r["chunk_id"]
        h = hl_index.get(cid)
        hc = int(h.get("highlight_count", 0)) if isinstance(h, dict) else 0
        boost = alpha * min(hc, cap)
        r["highlight_count"] = hc
        r["rerank_boost"] = boost
        r["final_score"] = float(r["distance"]) - boost

    rows.sort(key=lambda x: (x["final_score"], x["distance"], x["chunk_id"]))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="Natural-language query string")
    ap.add_argument("--k", type=int, default=12, help="Top-K results to return")
    ap.add_argument("--n_results", type=int, default=None, help="Alias for --k (optional)")
    ap.add_argument("--embed_url", default=DEFAULT_EMBED_URL)
    ap.add_argument("--chroma_dir", default=DEFAULT_CHROMA_DIR)
    ap.add_argument("--collection", default=DEFAULT_COLLECTION)
    ap.add_argument("--where", default=None, help="Optional JSON dict for Chroma where-filter (metadata)")
    ap.add_argument("--include_docs", action="store_true", help="Also print chunk text (documents)")
    ap.add_argument("--overfetch", type=int, default=3, help="Retrieve k*overfetch then filter down to k")
    ap.add_argument("--require_my_copy", action="store_true", help="Filter results to is_my_copy==True (if present)")
    ap.add_argument("--keep_biblio", action="store_true", help="Do not drop bibliography-like chunks")
    ap.add_argument("--collection_filter", default=None, help="Post-filter: metadata.collection must equal this")
    ap.add_argument("--print_json", action="store_true", help="Emit JSON results for downstream synthesis")
    

    # Phase 5: highlight-aware reranking (query-time only)
    ap.add_argument("--use_highlights", action="store_true",
                    help="Rerank results using highlight_index.json (deterministic secondary signal)")
    ap.add_argument("--highlights_index", default="scripts/highlights/highlight_index.json",
                    help="Path to merged highlight index JSON")
    ap.add_argument("--highlight_alpha", type=float, default=0.02,
                    help="Boost factor: final_score = distance - alpha*min(highlight_count, cap)")
    ap.add_argument("--highlight_cap", type=int, default=5,
                    help="Cap highlight_count contribution per chunk to keep boost bounded")
    ap.add_argument("--debug_dump_candidates_json", default=None,
                help="Write FULL filtered candidate list (pre-top-k) to this path as JSON")

    # Presets for common workflows
    ap.add_argument("--preset", choices=["research", "quick", "strict"],
                    help="Apply preset configuration: "
                         "research (k=20, highlights, include_docs), "
                         "quick (k=5, minimal), "
                         "strict (k=12, require_my_copy, no biblio)")

    args = ap.parse_args()

    # Apply presets (values can still be overridden by explicit flags)
    if args.preset == "research":
        if args.k == 12:  # Default wasn't changed
            args.k = 20
        if args.overfetch == 3:
            args.overfetch = 5
        args.use_highlights = True
        args.include_docs = True
    elif args.preset == "quick":
        if args.k == 12:
            args.k = 5
        if args.overfetch == 3:
            args.overfetch = 2
    elif args.preset == "strict":
        args.require_my_copy = True
        args.keep_biblio = False
    k = args.n_results if args.n_results is not None else args.k

    where: Optional[Dict[str, Any]] = None
    if args.where:
        try:
            where = json.loads(args.where)
            if not isinstance(where, dict):
                raise ValueError("where must be a JSON object")
        except Exception as ex:
            eprint(f"[ERROR] Failed to parse --where JSON: {ex}")
            return 2

    # 1) Embed query
    try:
        q_emb = embed_query(args.query, args.embed_url)
    except Exception as ex:
        eprint(f"[ERROR] Embedding failed: {ex}")
        return 3

    # 2) Query Chroma
    try:
        col = open_chroma(args.chroma_dir, args.collection)
        raw_k = max(k * args.overfetch, k)
        res = col.query(
            query_embeddings=[q_emb],
            n_results=raw_k,
            where=where,
            include=["metadatas", "documents", "distances"],
        )
    except Exception as ex:
        eprint(f"[ERROR] Chroma query failed: {ex}")
        return 4

    ids = res.get("ids", [[]])[0] or []
    metas = res.get("metadatas", [[]])[0] or []
    dists = res.get("distances", [[]])[0] or []
    docs = res.get("documents", [[]])[0] or []

    # 2.1 Filters
    cfg = FilterConfig(
        require_my_copy=args.require_my_copy,
        collection=args.collection_filter,
        drop_bibliography_like=(not args.keep_biblio),
    )

    # 3) Header printing (only for non-JSON)
    if not args.print_json:
        print(f"\n[QUERY]\n{args.query}\n")
        print(f"[CONFIG] chroma_dir={args.chroma_dir} collection={args.collection} k={k}")
        if where:
            print(f"[WHERE] {json.dumps(where)}")
        print("\n[RESULTS]\n")

    # 4) Build filtered candidates (ALWAYS, regardless of print_json)
    raw_rank = 0
    candidates: List[Dict[str, Any]] = []
    for chunk_id, meta, doc, dist in zip(ids, metas, docs, dists):
        raw_rank += 1
        meta = meta or {}
        doc = doc or ""

        if not passes_filters(meta, doc, cfg):
            continue

        candidates.append({
            "raw_rank": raw_rank,
            "chunk_id": chunk_id,
            "distance": dist,
            "path_rel": safe_get_meta(meta, "path_rel", "UNKNOWN_PATH"),
            "page_start": safe_get_meta(meta, "page_start", "NA"),
            "page_end": safe_get_meta(meta, "page_end", "NA"),
            "text": doc.strip() if args.include_docs else None,
            "meta": meta,
        })

    # 5) Optional highlight rerank (ordering only)
    if args.use_highlights:
        try:
            hl_index = load_highlight_index(args.highlights_index)
        except Exception as ex:
            eprint(f"[ERROR] Failed to load highlights index: {ex}")
            return 5
        candidates = apply_highlight_rerank(
            candidates,
            hl_index=hl_index,
            alpha=args.highlight_alpha,
            cap=args.highlight_cap,
        )
    else:
        candidates.sort(key=lambda x: (x["distance"], x["chunk_id"]))

    # 6) Top-k and final ranks
    top = candidates[:k]
    json_rows: List[Dict[str, Any]] = []
    for i, row in enumerate(top, start=1):
        row["rank"] = i
        json_rows.append(row)

    if args.debug_dump_candidates_json:
        with open(args.debug_dump_candidates_json, "w", encoding="utf-8") as f:
            json.dump(candidates, f, ensure_ascii=False, indent=2)


    # 7) Print rows (non-JSON)
    if not args.print_json:
        if len(top) == 0:
            print("[NO RESULTS AFTER FILTERING]")
        else:
            for row in top:
                printed = row["rank"]
                chunk_id = row["chunk_id"]
                dist = row["distance"]
                rr = row["raw_rank"]
                path_rel = row["path_rel"]
                page_start = row["page_start"]
                page_end = row["page_end"]

                hc = row.get("highlight_count", 0)
                boost = row.get("rerank_boost", 0.0)
                final_score = row.get("final_score", None)

                if args.use_highlights:
                    print(f"{printed:02d}. chunk_id={chunk_id}  distance={dist}  final_score={final_score}  "
                          f"hl_count={hc}  boost={boost:.4f}  (raw_rank={rr})")
                else:
                    print(f"{printed:02d}. chunk_id={chunk_id}  distance={dist}  (raw_rank={rr})")

                print(f"    path_rel={path_rel}")
                print(f"    pages={page_start}-{page_end}")

                if args.include_docs and row.get("text") is not None:
                    text = row["text"]
                    preview = text[:800] + ("…" if len(text) > 800 else "")
                    print("    text_preview:")
                    for line in preview.splitlines():
                        print(f"      {line}")
                print()

        return 0

    # 8) JSON output
    payload = {
        "query": args.query,
        "config": {
            "chroma_dir": args.chroma_dir,
            "collection": args.collection,
            "k": k,
            "overfetch": args.overfetch,
            "where": where,
            "filters": {
                "require_my_copy": args.require_my_copy,
                "collection_filter": args.collection_filter,
                "keep_biblio": args.keep_biblio,
            },
            "include_docs": args.include_docs,
            "use_highlights": args.use_highlights,
            "highlights_index": args.highlights_index,
            "highlight_alpha": args.highlight_alpha,
            "highlight_cap": args.highlight_cap,
        },
        "results": json_rows,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
