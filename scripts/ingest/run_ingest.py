#!/usr/bin/env python3
"""
Phase 1 — Option B Ingestion Skeleton (Structure Only)

- Walk corpus
- Parse filename metadata
- Compute sha256 + doc_id
- Load manifest.jsonl; decide SKIP vs INGEST
- Extract PDF text with page boundaries via pdftotext -layout (KEEP \f)
- Chunk text (page-aware)
- Print chunk plans
- Append manifest entries
- NO embeddings
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# -----------------------------
# Config (Phase 1)
# -----------------------------

ALLOWED_EXTS = {".pdf", ".md", ".txt"}

# Chunking targets (token-estimated)
TARGET_MIN_TOKENS = 800
TARGET_MAX_TOKENS = 1200
HARD_MAX_TOKENS = 1400  # safety cap


# -----------------------------
# Helpers
# -----------------------------

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def compute_doc_id(path_rel: str, sha256_hex: str) -> str:
    """
    doc_id = sha256(path_rel + ":" + sha256_file)[:16]
    """
    s = f"{path_rel}:{sha256_hex}".encode("utf-8", errors="ignore")
    return hashlib.sha256(s).hexdigest()[:16]


def est_tokens(text: str) -> int:
    """
    Rough token estimate to avoid adding heavy deps in Phase 1.
    Typical English ~4 chars/token; PDFs vary, but this is good enough for chunk sizing.
    """
    text = text.strip()
    if not text:
        return 0
    return max(1, len(text) // 4)


def safe_relpath(path_abs: Path, root: Path) -> str:
    return str(path_abs.resolve().relative_to(root.resolve())).replace("\\", "/")


def collection_from_relpath(path_rel: str) -> str:
    # first segment under root
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
    """
    Best-effort parsing of:
      Author - Title_(Year)_[Qualifier].ext

    Non-fatal; returns null-ish fields if parsing fails.
    """
    stem = path_abs.stem  # no extension
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
        # fallback: keep *something* useful
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
    """
    Returns: { path_abs: latest_record }
    """
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
            if not p:
                continue
            # append-only: last occurrence wins
            latest[p] = rec
    return latest


def should_skip(path_abs: Path, sha256_hex: str, latest_manifest: Dict[str, Dict[str, Any]]) -> bool:
    rec = latest_manifest.get(str(path_abs))
    if not rec:
        return False
    return (rec.get("sha256") == sha256_hex) and (rec.get("status") == "ok")


def run_pdftotext_layout(path_abs: Path) -> str:
    """
    Extraction rule:
      pdftotext -layout input.pdf -
      DO NOT use -nopgbrk
      Page boundaries detected via \f
    """
    cmd = ["pdftotext", "-layout", str(path_abs), "-"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"pdftotext failed (rc={proc.returncode}): {proc.stderr.strip()[:500]}")
    return proc.stdout


def split_pages(pdf_text: str) -> List[Tuple[int, str]]:
    """
    Returns list of (page_number_1_based, page_text).
    Keeps empty pages (as empty strings) so numbering remains faithful.
    """
    pages = pdf_text.split("\f")
    out: List[Tuple[int, str]] = []
    for i, p in enumerate(pages, start=1):
        # do not drop empty; preserve numbering
        out.append((i, p))
    return out


def page_paragraphs(page_no: int, page_text: str) -> List[Tuple[int, str]]:
    """
    Paragraph split: blank-line separated blocks.
    """
    text = page_text.replace("\r\n", "\n").replace("\r", "\n")
    parts = re.split(r"\n\s*\n+", text)
    paras = []
    for p in parts:
        s = p.strip()
        if not s:
            continue
        paras.append((page_no, s))
    return paras


@dataclass
class ChunkPlan:
    chunk_id: str
    chunk_index: int
    page_start: Optional[int]
    page_end: Optional[int]
    token_est: int
    char_len: int
    preview: str


def chunk_paragraphs_page_aware(
    doc_id: str,
    paragraphs: List[Tuple[int, str]],
    target_min: int = TARGET_MIN_TOKENS,
    target_max: int = TARGET_MAX_TOKENS,
    hard_max: int = HARD_MAX_TOKENS,
) -> List[ChunkPlan]:
    """
    Build chunks by concatenating paragraphs, while tracking min/max page numbers in the chunk.
    """
    chunks: List[ChunkPlan] = []

    cur_texts: List[str] = []
    cur_pages: List[int] = []
    cur_tokens = 0

    def flush():
        nonlocal cur_texts, cur_pages, cur_tokens
        if not cur_texts:
            return
        idx = len(chunks)
        ps = min(cur_pages) if cur_pages else None
        pe = max(cur_pages) if cur_pages else None
        text = "\n\n".join(cur_texts)
        cid = f"{doc_id}:{idx:05d}"
        preview = re.sub(r"\s+", " ", text).strip()[:120]
        chunks.append(
            ChunkPlan(
                chunk_id=cid,
                chunk_index=idx,
                page_start=ps,
                page_end=pe,
                token_est=cur_tokens,
                char_len=len(text),
                preview=preview,
            )
        )
        cur_texts = []
        cur_pages = []
        cur_tokens = 0

    for page_no, para in paragraphs:
        t = est_tokens(para)

        # If adding this paragraph would push us beyond target_max AND we already met target_min,
        # flush first (classic greedy pack).
        if cur_texts and (cur_tokens >= target_min) and (cur_tokens + t > target_max):
            flush()

        cur_texts.append(para)
        cur_pages.append(page_no)
        cur_tokens += t

        # Hard cap protection
        if cur_tokens >= hard_max:
            flush()

    flush()
    return chunks


def chunk_non_pdf_text(doc_id: str, text: str) -> List[ChunkPlan]:
    """
    For .md/.txt in Phase 1: chunk without page provenance.
    Still produce stable chunk IDs; page_start/end = null.
    """
    # paragraph-like split
    parts = re.split(r"\n\s*\n+", text.replace("\r\n", "\n").replace("\r", "\n"))
    paras = [p.strip() for p in parts if p.strip()]
    # emulate page-aware paragraph list with page=None; but chunker wants ints.
    # We'll just build chunks directly.
    chunks: List[ChunkPlan] = []
    cur: List[str] = []
    cur_tokens = 0

    def flush():
        nonlocal cur, cur_tokens
        if not cur:
            return
        idx = len(chunks)
        txt = "\n\n".join(cur)
        cid = f"{doc_id}:{idx:05d}"
        preview = re.sub(r"\s+", " ", txt).strip()[:120]
        chunks.append(
            ChunkPlan(
                chunk_id=cid,
                chunk_index=idx,
                page_start=None,
                page_end=None,
                token_est=cur_tokens,
                char_len=len(txt),
                preview=preview,
            )
        )
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


def ensure_parent_dir(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def append_manifest(manifest_path: Path, record: Dict[str, Any]) -> None:
    ensure_parent_dir(manifest_path)
    with manifest_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# -----------------------------
# Main
# -----------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Phase 1 ingest skeleton (no embeddings).")
    ap.add_argument("--root", required=True, help="Corpus root (absolute path recommended).")
    args = ap.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: --root does not exist or is not a directory: {root}", file=sys.stderr)
        return 2

    manifest_path = Path("scripts/ingest/manifest.jsonl")
    latest_manifest = load_latest_manifest_by_path(manifest_path)

    # Walk
    files: List[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() in ALLOWED_EXTS:
            files.append(p)

    files.sort()

    print(f"[Phase1] root={root}")
    print(f"[Phase1] manifest={manifest_path.resolve()}")
    print(f"[Phase1] files_found={len(files)}")

    ok_count = 0
    fail_count = 0
    skip_count = 0

    for path_abs in files:
        t0 = time.time()
        path_rel = safe_relpath(path_abs, root)
        collection = collection_from_relpath(path_rel)
        mtime = int(path_abs.stat().st_mtime)

        meta = parse_filename_metadata(path_abs)

        record_base: Dict[str, Any] = {
            "path_abs": str(path_abs),
            "path_rel": path_rel,
            "collection": collection,
            "mtime": mtime,
            # filled later:
            "sha256": None,
            "doc_id": None,
            "status": None,
            "chunks": None,
            "error": None,
            "ts": int(time.time()),
            "meta": meta,
        }

        try:
            sha = sha256_file(path_abs)
            record_base["sha256"] = sha
            doc_id = compute_doc_id(path_rel, sha)
            record_base["doc_id"] = doc_id

            if should_skip(path_abs, sha, latest_manifest):
                skip_count += 1
                print(f"\n[SKIP] {path_rel}")
                print(f"  doc_id={doc_id} sha256={sha[:12]}… (unchanged, last status ok)")
                continue

            print(f"\n[INGEST] {path_rel}")
            print(f"  doc_id={doc_id}")
            print(f"  sha256={sha[:12]}…  mtime={mtime}")
            if meta.get("author_raw") or meta.get("title_raw"):
                print(f"  meta: author={meta.get('author_raw')} | title={meta.get('title_raw')} | year={meta.get('year')} | qual={meta.get('qualifier')}")

            chunks: List[ChunkPlan]

            if path_abs.suffix.lower() == ".pdf":
                pdf_text = run_pdftotext_layout(path_abs)
                pages = split_pages(pdf_text)

                paragraphs: List[Tuple[int, str]] = []
                for page_no, page_text in pages:
                    paragraphs.extend(page_paragraphs(page_no, page_text))

                chunks = chunk_paragraphs_page_aware(doc_id, paragraphs)

            else:
                # .md / .txt
                text = path_abs.read_text(encoding="utf-8", errors="replace")
                chunks = chunk_non_pdf_text(doc_id, text)

            record_base["chunks"] = len(chunks)
            record_base["status"] = "ok"
            record_base["error"] = None

            # Print chunk plan
            print(f"  chunks={len(chunks)}")
            for ch in chunks:
                if ch.page_start is None:
                    pr = "pages=null"
                elif ch.page_start == ch.page_end:
                    pr = f"page={ch.page_start}"
                else:
                    pr = f"pages={ch.page_start}-{ch.page_end}"
                print(f"    - {ch.chunk_id}  {pr}  tok~{ch.token_est}  chars={ch.char_len}  :: {ch.preview}")

            append_manifest(manifest_path, record_base)
            ok_count += 1

        except Exception as e:
            record_base["status"] = "failed"
            record_base["chunks"] = 0
            record_base["error"] = str(e)[:2000]
            append_manifest(manifest_path, record_base)

            fail_count += 1
            print(f"\n[FAILED] {path_rel}")
            print(f"  error={record_base['error']}", file=sys.stderr)

        finally:
            dt = time.time() - t0
            print(f"  time={dt:.2f}s")

    print("\n[Phase1 Summary]")
    print(f"  ok={ok_count}  failed={fail_count}  skipped={skip_count}  total={len(files)}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
