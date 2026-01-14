#!/usr/bin/env python3
"""
Phase 2 — Embedding + Chroma Storage

- Walk corpus
- Same parsing + sha256/doc_id + skip semantics via manifest
- Extract text (page-aware for PDFs)
- Chunk text (same as Phase 1)
- Embed chunks via http://127.0.0.1:8000/embed
- Assert 1536-D embeddings
- Upsert into Chroma persistent store vector_db_1536/, collection knowledge_chunks
- Append manifest record per file (ok/failed)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

import chromadb
from chromadb.config import Settings

import random


# -----------------------------
# Locked targets
# -----------------------------
EMBED_URL = "http://127.0.0.1:8000/embed"
EMBED_DIM = 1536

CHROMA_DIR = "vector_db_1536"
CHROMA_COLLECTION = "knowledge_chunks"

MANIFEST_PATH = Path("scripts/ingest/manifest.jsonl")

ALLOWED_EXTS = {".pdf", ".md", ".txt"}

# Chunking targets (token-estimated)
TARGET_MIN_TOKENS = 800
TARGET_MAX_TOKENS = 1200
HARD_MAX_TOKENS = 1400

# Embedding batching
EMBED_BATCH_SIZE = 8
EMBED_TIMEOUT_S = 600


# -----------------------------
# Helpers (same as Phase 1)
# -----------------------------

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def compute_doc_id(path_rel: str, sha256_hex: str) -> str:
    s = f"{path_rel}:{sha256_hex}".encode("utf-8", errors="ignore")
    return hashlib.sha256(s).hexdigest()[:16]


def est_tokens(text: str) -> int:
    text = text.strip()
    if not text:
        return 0
    return max(1, len(text) // 4)


def safe_relpath(path_abs: Path, root: Path) -> str:
    return str(path_abs.resolve().relative_to(root.resolve())).replace("\\", "/")


def collection_from_relpath(path_rel: str) -> str:
    parts = path_rel.split("/")
    return parts[0] if parts else ""


FILENAME_RE = re.compile(
    r"""
    ^
    (?P<author>.+?)\s-\s
    (?P<title>.+?)
    (?:_\((?P<year>\d{4})\))?
    (?:_\[(?P<qualifier>[^\]]+)\])?
    $
    """,
    re.VERBOSE,
)


def parse_filename_metadata(path_abs: Path) -> Dict[str, Any]:
    stem = path_abs.stem
    m = FILENAME_RE.match(stem)

    author_raw = None
    title_raw = None
    year = None
    qualifier = None

    if m:
        author_raw = (m.group("author") or "").strip() or None
        title_raw = (m.group("title") or "").strip() or None
        y = m.group("year")
        if y:
            try:
                year = int(y)
            except ValueError:
                year = None
        qualifier = (m.group("qualifier") or "").strip() or None
    else:
        title_raw = stem

    q = qualifier or ""
    is_my_copy = "my copy" in q.lower()
    is_clean_copy = "clean copy" in q.lower()

    return {
        "author_raw": author_raw,
        "title_raw": title_raw,
        "year": year,
        "qualifier": qualifier,
        "is_my_copy": bool(is_my_copy),
        "is_clean_copy": bool(is_clean_copy),
    }


def load_latest_manifest_by_path(manifest_path: Path) -> Dict[str, Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}
    if not manifest_path.exists():
        return latest
    with manifest_path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            p = rec.get("path_abs")
            if p:
                latest[p] = rec
    return latest


def should_skip_phase2(path_abs: Path, sha256_hex: str, latest_manifest: Dict[str, Dict[str, Any]]) -> bool:
    """
    Phase-aware skip:
    Skip only if the latest record for this path_abs indicates Phase 2 succeeded.
    """
    rec = latest_manifest.get(str(path_abs))
    if not rec:
        return False
    same = (rec.get("sha256") == sha256_hex) and (rec.get("status") == "ok")
    phase_ok = int(rec.get("phase") or 0) >= 2
    return same and phase_ok



def ensure_parent_dir(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def append_manifest(record: Dict[str, Any]) -> None:
    ensure_parent_dir(MANIFEST_PATH)
    with MANIFEST_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# -----------------------------
# PDF extraction (locked: pdftotext -layout, keep \f)
# -----------------------------

def run_pdftotext_layout(path_abs: Path) -> str:
    import subprocess
    cmd = ["pdftotext", "-layout", str(path_abs), "-"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"pdftotext failed (rc={proc.returncode}): {proc.stderr.strip()[:500]}")
    return proc.stdout


def split_pages(pdf_text: str) -> List[Tuple[int, str]]:
    pages = pdf_text.split("\f")
    return [(i, p) for i, p in enumerate(pages, start=1)]


def page_paragraphs(page_no: int, page_text: str) -> List[Tuple[int, str]]:
    text = page_text.replace("\r\n", "\n").replace("\r", "\n")
    parts = re.split(r"\n\s*\n+", text)
    out = []
    for p in parts:
        s = p.strip()
        if s:
            out.append((page_no, s))
    return out


@dataclass
class Chunk:
    chunk_id: str
    chunk_index: int
    text: str
    page_start: Optional[int]
    page_end: Optional[int]


def chunk_paragraphs_page_aware(doc_id: str, paragraphs: List[Tuple[int, str]]) -> List[Chunk]:
    chunks: List[Chunk] = []
    cur_texts: List[str] = []
    cur_pages: List[int] = []
    cur_tokens = 0

    def flush():
        nonlocal cur_texts, cur_pages, cur_tokens
        if not cur_texts:
            return
        idx = len(chunks)
        text = "\n\n".join(cur_texts)
        cid = f"{doc_id}:{idx:05d}"
        ps = min(cur_pages) if cur_pages else None
        pe = max(cur_pages) if cur_pages else None
        chunks.append(Chunk(cid, idx, text, ps, pe))
        cur_texts = []
        cur_pages = []
        cur_tokens = 0

    for page_no, para in paragraphs:
        t = est_tokens(para)

        if cur_texts and (cur_tokens >= TARGET_MIN_TOKENS) and (cur_tokens + t > TARGET_MAX_TOKENS):
            flush()

        cur_texts.append(para)
        cur_pages.append(page_no)
        cur_tokens += t

        if cur_tokens >= HARD_MAX_TOKENS:
            flush()

    flush()
    return chunks


def chunk_non_pdf_text(doc_id: str, text: str) -> List[Chunk]:
    parts = re.split(r"\n\s*\n+", text.replace("\r\n", "\n").replace("\r", "\n"))
    paras = [p.strip() for p in parts if p.strip()]

    chunks: List[Chunk] = []
    cur: List[str] = []
    cur_tokens = 0

    def flush():
        nonlocal cur, cur_tokens
        if not cur:
            return
        idx = len(chunks)
        txt = "\n\n".join(cur)
        cid = f"{doc_id}:{idx:05d}"
        chunks.append(Chunk(cid, idx, txt, None, None))
        cur = []
        cur_tokens = 0

    for para in paras:
        t = est_tokens(para)
        if cur and (cur_tokens >= TARGET_MIN_TOKENS) and (cur_tokens + t > TARGET_MAX_TOKENS):
            flush()
        cur.append(para)
        cur_tokens += t
        if cur_tokens >= HARD_MAX_TOKENS:
            flush()

    flush()
    return chunks


# -----------------------------
# Embedding client (robust shape handling)
# -----------------------------

def _extract_embeddings(obj: Any) -> List[List[float]]:
    """
    Supports common response shapes:
      { "embeddings": [[...], ...] }
      { "data": [ {"embedding":[...]} , ... ] }
      { "data": [[...], ...] }
      [ [...], ... ]
    """
    if isinstance(obj, list):
        # could be list-of-vectors
        if obj and isinstance(obj[0], list):
            return obj  # type: ignore
        raise ValueError("Unexpected list response shape")

    if not isinstance(obj, dict):
        raise ValueError("Unexpected embed response type")

    if "embeddings" in obj and isinstance(obj["embeddings"], list):
        return obj["embeddings"]

    if "data" in obj:
        data = obj["data"]
        if isinstance(data, list) and data:
            if isinstance(data[0], dict) and "embedding" in data[0]:
                return [d["embedding"] for d in data]  # type: ignore
            if isinstance(data[0], list):
                return data  # type: ignore

    raise ValueError(f"Unrecognized embed response keys: {list(obj.keys())}")


def embed_texts(texts: List[str], session: requests.Session) -> List[List[float]]:
    """
    Robust embed call:
    - tries multiple payload shapes
    - retries transient failures
    - on timeout/5xx: split the batch and retry (adaptive batching)
    """
    def _try_once(payload: Dict[str, Any]) -> List[List[float]]:
        r = session.post(EMBED_URL, json=payload, timeout=EMBED_TIMEOUT_S)
        if r.status_code >= 400:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        vecs = _extract_embeddings(data)
        if len(vecs) != len(texts):
            raise ValueError(f"Embedding count mismatch: got {len(vecs)} expected {len(texts)}")
        for i, v in enumerate(vecs):
            if (not isinstance(v, list)) or (len(v) != EMBED_DIM):
                raise ValueError(f"Bad embedding dim at {i}: len={len(v) if isinstance(v, list) else 'non-list'} expected {EMBED_DIM}")
        return vecs

    payloads = [{"texts": texts}, {"input": texts}]

    # If the batch is large and fails, split recursively
    def _embed_recursive(txs: List[str], depth: int = 0) -> List[List[float]]:
        if not txs:
            return []
        # base case: single text, just retry a few times
        if len(txs) == 1:
            last_err = None
            for attempt in range(5):
                for payload in [{"texts": txs}, {"input": txs}]:
                    try:
                        return _try_once(payload)
                    except Exception as e:
                        last_err = e
                # backoff
                time.sleep(min(2 ** attempt, 10) + random.random())
            raise RuntimeError(f"Embedding failed for single item after retries: {last_err}")

        # normal case: try whole batch, then split on timeout/overload
        last_err = None
        for attempt in range(3):
            for payload in [{"texts": txs}, {"input": txs}]:
                try:
                    # use a local shim so _extract_embeddings validates length against *txs*
                    r = session.post(EMBED_URL, json=payload, timeout=EMBED_TIMEOUT_S)
                    if r.status_code >= 500:
                        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                    if r.status_code >= 400:
                        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                    data = r.json()
                    vecs = _extract_embeddings(data)
                    if len(vecs) != len(txs):
                        raise ValueError(f"Embedding count mismatch: got {len(vecs)} expected {len(txs)}")
                    for i, v in enumerate(vecs):
                        if (not isinstance(v, list)) or (len(v) != EMBED_DIM):
                            raise ValueError(f"Bad embedding dim at {i}: len={len(v) if isinstance(v, list) else 'non-list'} expected {EMBED_DIM}")
                    return vecs
                except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout) as e:
                    last_err = e
                except Exception as e:
                    last_err = e
            time.sleep(min(2 ** attempt, 8) + random.random())

        # Split batch and embed halves
        mid = len(txs) // 2
        left = _embed_recursive(txs[:mid], depth + 1)
        right = _embed_recursive(txs[mid:], depth + 1)
        return left + right

    # use the recursive function on the original texts
    return _embed_recursive(texts)


# -----------------------------
# Chroma
# -----------------------------

def get_chroma_collection():
    client = chromadb.PersistentClient(
        path=CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(name=CHROMA_COLLECTION)


# -----------------------------
# Main
# -----------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Phase 2: embed + upsert into Chroma.")
    ap.add_argument("--root", required=True, help="Corpus root.")
    ap.add_argument("--force", action="store_true", help="Ignore skip logic and re-embed/upsert.")
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: --root invalid: {root}")
        return 2

    latest_manifest = load_latest_manifest_by_path(MANIFEST_PATH)
    coll = get_chroma_collection()

    files: List[Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTS:
            files.append(p)
    files.sort()

    print(f"[Phase2] root={root}")
    print(f"[Phase2] embed_url={EMBED_URL} dim={EMBED_DIM}")
    print(f"[Phase2] chroma_dir={Path(CHROMA_DIR).resolve()} collection={CHROMA_COLLECTION}")
    print(f"[Phase2] files_found={len(files)}")

    ok = failed = skipped = 0

    with requests.Session() as session:
        for path_abs in files:
            t0 = time.time()
            path_rel = safe_relpath(path_abs, root)
            collection = collection_from_relpath(path_rel)
            mtime = int(path_abs.stat().st_mtime)
            meta = parse_filename_metadata(path_abs)

            base_record: Dict[str, Any] = {
                "path_abs": str(path_abs),
                "path_rel": path_rel,
                "collection": collection,
                "mtime": mtime,
                "sha256": None,
                "doc_id": None,
                "status": None,
                "chunks": None,
                "error": None,
                "ts": int(time.time()),
                "meta": meta,
                "phase": 2,
            }

            try:
                sha = sha256_file(path_abs)
                doc_id = compute_doc_id(path_rel, sha)
                base_record["sha256"] = sha
                base_record["doc_id"] = doc_id

                if (not args.force) and should_skip_phase2(path_abs, sha, latest_manifest):
                    skipped += 1
                    print(f"\n[SKIP] {path_rel} doc_id={doc_id} sha256={sha[:12]}…")
                    continue

                print(f"\n[EMBED+UPSERT] {path_rel}")
                print(f"  doc_id={doc_id} sha256={sha[:12]}…")

                # Rebuild chunks deterministically (same as Phase 1)
                if path_abs.suffix.lower() == ".pdf":
                    pdf_text = run_pdftotext_layout(path_abs)
                    pages = split_pages(pdf_text)
                    paragraphs: List[Tuple[int, str]] = []
                    for page_no, page_text in pages:
                        paragraphs.extend(page_paragraphs(page_no, page_text))
                    chunks = chunk_paragraphs_page_aware(doc_id, paragraphs)
                else:
                    text = path_abs.read_text(encoding="utf-8", errors="replace")
                    chunks = chunk_non_pdf_text(doc_id, text)

                base_record["chunks"] = len(chunks)
                if not chunks:
                    raise RuntimeError("No chunks produced (empty document after extraction).")

                # Batch embed + upsert
                ids: List[str] = []
                documents: List[str] = []
                metadatas: List[Dict[str, Any]] = []
                embeddings: List[List[float]] = []

                def flush_batch():
                    nonlocal ids, documents, metadatas, embeddings
                    if not ids:
                        return
                    coll.upsert(
                        ids=ids,
                        documents=documents,
                        embeddings=embeddings,
                        metadatas=metadatas,
                    )
                    ids, documents, metadatas, embeddings = [], [], [], []

                for i in range(0, len(chunks), EMBED_BATCH_SIZE):
                    batch = chunks[i : i + EMBED_BATCH_SIZE]
                    texts = [c.text for c in batch]
                    vecs = embed_texts(texts, session)

                    for c, v in zip(batch, vecs):
                        ids.append(c.chunk_id)
                        documents.append(c.text)
                        metadatas.append(
                            {
                                "doc_id": doc_id,
                                "chunk_index": c.chunk_index,
                                "path_abs": str(path_abs),
                                "path_rel": path_rel,
                                "collection": collection,
                                "sha256": sha,
                                "mtime": mtime,
                                "page_start": c.page_start,
                                "page_end": c.page_end,
                                **meta,
                            }
                        )
                        embeddings.append(v)

                    flush_batch()
                    print(f"  embedded_upserted {min(i+EMBED_BATCH_SIZE, len(chunks))}/{len(chunks)}")

                base_record["status"] = "ok"
                base_record["error"] = None
                append_manifest(base_record)
                ok += 1

            except Exception as e:
                base_record["status"] = "failed"
                base_record["error"] = str(e)[:2000]
                if base_record["chunks"] is None:
                    base_record["chunks"] = 0
                append_manifest(base_record)
                failed += 1
                print(f"\n[FAILED] {path_rel}\n  error={base_record['error']}")

            finally:
                print(f"  time={time.time()-t0:.2f}s")

    print("\n[Phase2 Summary]")
    print(f"  ok={ok} failed={failed} skipped={skipped} total={len(files)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
