#!/usr/bin/env python3
"""
verify_ingest.py — Phase 3 Verification Utility (read-only)

Validates that for every PDF in the corpus:
- A latest manifest record exists for path_abs
- manifest.status == "ok" and manifest.phase >= 2
- sha256_file matches current file bytes
- Chroma contains the expected chunk IDs for doc_id
- Spot-check embedding dimensionality == 1536

Exits non-zero if any failures are detected.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# ---------- helpers ----------

def sha256_file(path: Path, buf_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(buf_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

def load_latest_manifest_records(manifest_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Manifest is append-only JSONL.
    Latest record per path_abs is authoritative.
    Returns: {path_abs: record}
    """
    latest: Dict[str, Dict[str, Any]] = {}
    if not manifest_path.exists():
        return latest

    with manifest_path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                # malformed line should fail verification (trustworthiness)
                latest[f"__JSON_ERROR_LINE_{line_no}__"] = {"_error": str(e), "_line": line}
                continue

            path_abs = rec.get("path_abs")
            if isinstance(path_abs, str) and path_abs:
                latest[path_abs] = rec

    return latest

def iter_pdfs(root: Path) -> Iterable[Path]:
    for p in root.rglob("*.pdf"):
        if p.is_file():
            yield p

def get_chunk_count_from_manifest(rec: Dict[str, Any]) -> Optional[int]:
    # best-effort across likely keys
    for k in ("chunk_count", "num_chunks", "chunks_total"):
        v = rec.get(k)
        if isinstance(v, int):
            return v
    chunks = rec.get("chunks")
    if isinstance(chunks, list):
        return len(chunks)
    return None

def expected_chunk_ids(doc_id: str, n: int) -> List[str]:
    return [f"{doc_id}:{i:05d}" for i in range(n)]

# ---------- chroma ----------

def open_chroma_collection(chroma_dir: Path, collection_name: str):
    try:
        import chromadb
    except ImportError:
        print("[FATAL] chromadb is not installed in this environment.", file=sys.stderr)
        print("        Install it in the same venv you used for Phase 2.", file=sys.stderr)
        raise

    client = chromadb.PersistentClient(path=str(chroma_dir))
    return client.get_or_create_collection(name=collection_name)

def chroma_count_for_doc(collection, doc_id: str) -> int:
    # Chroma supports metadata filters via where
    res = collection.get(where={"doc_id": doc_id}, include=[])
    ids = res.get("ids") or []
    return len(ids)

def chroma_spotcheck_dim(collection, doc_id: str, sample_n: int) -> Tuple[bool, Optional[int], str]:
    """
    Returns (ok, dim_found, msg)
    """
    res = collection.get(where={"doc_id": doc_id}, include=["embeddings"])

    ids = res.get("ids")
    if ids is None:
        ids = []
    embs = res.get("embeddings")
    if embs is None:
        embs = []

    if len(ids) == 0:
        return (False, None, "no vectors returned for doc_id")

    # embeddings is aligned with ids
    if len(embs) == 0 or len(embs) != len(ids):
        return (False, None, "embeddings missing or misaligned in response")

    to_check = min(sample_n, len(embs))
    dim: Optional[int] = None

    for i in range(to_check):
        e = embs[i]
        if e is None:
            return (False, None, "embedding is None")
        try:
            d = len(e)
        except TypeError:
            return (False, None, "embedding has no length")

        if dim is None:
            dim = d
        elif d != dim:
            return (False, dim, f"inconsistent dims in sample (saw {dim} then {d})")

    return (True, dim, f"spot-check ok on {to_check} embeddings")


@dataclass
class Issue:
    code: str
    path: Path
    detail: str

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=str, default="/home/dalton/projects/claudeflow-testing/corpus")
    ap.add_argument("--manifest", type=str, default="scripts/ingest/manifest.jsonl")
    ap.add_argument("--chroma_dir", type=str, default="vector_db_1536")
    ap.add_argument("--collection", type=str, default="knowledge_chunks")
    ap.add_argument("--expected_dim", type=int, default=1536)
    ap.add_argument("--embed_sample", type=int, default=3)
    args = ap.parse_args()

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest).resolve()
    chroma_dir = Path(args.chroma_dir).resolve()

    if not root.exists():
        print(f"[FATAL] corpus root does not exist: {root}", file=sys.stderr)
        return 2

    # load manifest latest records
    latest = load_latest_manifest_records(manifest_path)

    # hard-fail if manifest had JSON errors
    json_errs = [k for k in latest.keys() if k.startswith("__JSON_ERROR_LINE_")]
    if json_errs:
        print("[FATAL] manifest.jsonl contains malformed JSON lines:", file=sys.stderr)
        for k in json_errs:
            rec = latest[k]
            print(f"  {k}: {rec.get('_error')}", file=sys.stderr)
        return 2

    # open chroma
    try:
        collection = open_chroma_collection(chroma_dir, args.collection)
    except Exception as e:
        print(f"[FATAL] cannot open Chroma at {chroma_dir}: {e}", file=sys.stderr)
        return 2

    issues: List[Issue] = []
    ok_count = 0

    for pdf in sorted(iter_pdfs(root)):
        p_abs = str(pdf.resolve())
        rec = latest.get(p_abs)

        if not rec:
            issues.append(Issue("MISSING_MANIFEST", pdf, "no latest manifest record"))
            continue

        status = rec.get("status")
        phase = rec.get("phase")
        if status != "ok" or not isinstance(phase, int) or phase < 2:
            issues.append(Issue("NOT_PHASE2_OK", pdf, f"status={status!r} phase={phase!r}"))
            continue

        sha_now = sha256_file(pdf)
        sha_manifest = rec.get("sha256") or rec.get("sha256_file")
        if sha_manifest != sha_now:
            issues.append(Issue("SHA_MISMATCH", pdf, "sha256_file differs from manifest"))
            continue

        doc_id = rec.get("doc_id")
        if not isinstance(doc_id, str) or not doc_id:
            issues.append(Issue("MISSING_DOC_ID", pdf, "manifest doc_id missing/invalid"))
            continue

        expected_n = get_chunk_count_from_manifest(rec)
        if expected_n is None:
            # still verify Chroma presence, but we can't compare counts
            chroma_n = chroma_count_for_doc(collection, doc_id)
            if chroma_n <= 0:
                issues.append(Issue("COUNT_MISMATCH", pdf, "manifest chunk_count missing and chroma count=0"))
                continue
        else:
            chroma_n = chroma_count_for_doc(collection, doc_id)
            if chroma_n != expected_n:
                issues.append(Issue("COUNT_MISMATCH", pdf, f"manifest={expected_n} chroma={chroma_n}"))
                continue

        dim_ok, dim_found, dim_msg = chroma_spotcheck_dim(collection, doc_id, args.embed_sample)
        if not dim_ok:
            issues.append(Issue("DIM_MISMATCH", pdf, dim_msg))
            continue
        if dim_found != args.expected_dim:
            issues.append(Issue("DIM_MISMATCH", pdf, f"expected {args.expected_dim}, found {dim_found} ({dim_msg})"))
            continue

        ok_count += 1
        print(f"[OK] {pdf.relative_to(root)}")

    # summary
    if issues:
        print("\n--- VERIFY REPORT (FAIL) ---")
        for it in issues:
            rel = it.path.relative_to(root) if it.path.is_relative_to(root) else it.path
            print(f"[{it.code}] {rel} :: {it.detail}")
        print(f"\nOK={ok_count} FAIL={len(issues)} TOTAL={ok_count+len(issues)}")
        return 1

    print(f"\n--- VERIFY REPORT (OK) ---\nOK={ok_count} FAIL=0 TOTAL={ok_count}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
