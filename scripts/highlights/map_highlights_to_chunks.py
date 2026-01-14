#!/usr/bin/env python3
import argparse, json, os
from collections import defaultdict

from rapidfuzz import fuzz
import chromadb


def load_jsonl(path: str):
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def norm(s: str) -> str:
    return " ".join((s or "").split()).strip().lower()


def pages_overlap(page: int, start: int, end: int) -> bool:
    return start <= page <= end


def get_chunks_for_doc(chroma_dir: str, collection: str, path_rel: str):
    """
    Pull all chunks for a single document from Chroma, with metadata and stored chunk text.
    Assumes ingestion stored:
      - metadatas: page_start, page_end, path_rel
      - documents: chunk text
      - ids: chunk_id
    """
    client = chromadb.PersistentClient(path=chroma_dir)
    col = client.get_collection(collection)

    res = col.get(where={"path_rel": path_rel}, include=["metadatas", "documents"])

    ids = res.get("ids", []) or []
    metas = res.get("metadatas", []) or []
    docs = res.get("documents", []) or []

    chunks = []
    for cid, md, txt in zip(ids, metas, docs):
        ps = md.get("page_start")
        pe = md.get("page_end")
        if ps is None or pe is None:
            continue
        chunks.append(
            {
                "chunk_id": cid,
                "page_start": int(ps),
                "page_end": int(pe),
                "text": txt or "",
            }
        )

    # deterministic ordering
    chunks.sort(key=lambda x: x["chunk_id"])
    return chunks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--highlights_jsonl", required=True)
    ap.add_argument("--chroma_dir", required=True, help="e.g. vector_db_1536")
    ap.add_argument("--collection", default="knowledge_chunks")
    ap.add_argument("--path_rel", required=True)
    ap.add_argument("--out", required=True, help="Output JSON index path")
    ap.add_argument("--min_fuzz", type=int, default=65, help="0 disables fuzzy matching (page-only)")
    ap.add_argument("--max_chunks_per_highlight", type=int, default=6, help="cap matches to avoid runaway fanout")
    args = ap.parse_args()

    highs = load_jsonl(args.highlights_jsonl)
    chunks = get_chunks_for_doc(args.chroma_dir, args.collection, args.path_rel)

    if not chunks:
        raise RuntimeError(f"No chunks found in Chroma for path_rel={args.path_rel}. Check metadata key name.")

    chunk_text_norm = {c["chunk_id"]: norm(c["text"]) for c in chunks}

    index = defaultdict(lambda: {"highlight_count": 0, "pages": set()})

    for h in highs:
        page = int(h["page"])
        htxt = norm(h.get("text", ""))

        # 1) hard gate: page overlap
        candidates = [c for c in chunks if pages_overlap(page, c["page_start"], c["page_end"])]
        if not candidates:
            continue

        # 2) fuzzy match (optional)
        if args.min_fuzz > 0 and htxt:
            scored = []
            for c in candidates:
                ctxt = chunk_text_norm.get(c["chunk_id"], "")
                if not ctxt:
                    continue
                sc = fuzz.token_set_ratio(htxt, ctxt)
                scored.append((sc, c["chunk_id"]))

            scored.sort(key=lambda x: (-x[0], x[1]))  # deterministic
            kept = [cid for sc, cid in scored if sc >= args.min_fuzz]

            # If fuzzy finds nothing, fall back to page-only
            target_ids = kept if kept else [c["chunk_id"] for c in candidates]

            # Cap fanout deterministically
            target_ids = sorted(target_ids)[: args.max_chunks_per_highlight]
        else:
            target_ids = [c["chunk_id"] for c in candidates]
            target_ids = sorted(target_ids)[: args.max_chunks_per_highlight]

        for cid in target_ids:
            index[cid]["highlight_count"] += 1
            index[cid]["pages"].add(page)

    out = {}
    for cid, v in index.items():
        out[cid] = {
            "highlight_count": int(v["highlight_count"]),
            "pages": sorted(v["pages"]),
        }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"[OK] path_rel={args.path_rel}")
    print(f"[OK] chunk_ids_with_highlights={len(out)} -> {args.out}")


if __name__ == "__main__":
    main()
