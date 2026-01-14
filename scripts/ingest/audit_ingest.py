#!/usr/bin/env python3
"""
audit_ingest.py — Phase 3 Audit Utility (read-only)

Classifies corpus PDFs into:
- PHASE0_ONLY       : no manifest record exists for path_abs
- PHASE1_ONLY       : phase==1 ok, but phase 2 not complete
- PHASE2_FAILED     : phase>=2 but status != ok
- PHASE2_COMPLETE   : phase>=2 ok and sha matches current file
- SHA_MISMATCH      : file bytes changed since latest manifest record
- MANIFEST_BROKEN   : missing required fields / invalid record

Manifest is append-only JSONL; latest record per path_abs is authoritative.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple, Optional

def sha256_file(path: Path, buf_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(buf_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

def load_latest_manifest_records(manifest_path: Path) -> Tuple[Dict[str, Dict[str, Any]], List[str]]:
    latest: Dict[str, Dict[str, Any]] = {}
    errors: List[str] = []

    if not manifest_path.exists():
        return latest, errors

    with manifest_path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"line {line_no}: {e}")
                continue

            path_abs = rec.get("path_abs")
            if isinstance(path_abs, str) and path_abs:
                latest[path_abs] = rec

    return latest, errors

def iter_pdfs(root: Path) -> Iterable[Path]:
    for p in root.rglob("*.pdf"):
        if p.is_file():
            yield p

def get_manifest_sha(rec: Dict[str, Any]) -> Optional[str]:
    # tolerate schema variants
    v = rec.get("sha256") or rec.get("sha256_file") or rec.get("file_sha256")
    return v if isinstance(v, str) and v else None

def classify(pdf: Path, rec: Optional[Dict[str, Any]]) -> Tuple[str, str]:
    if rec is None:
        return ("PHASE0_ONLY", "no manifest record")

    status = rec.get("status")
    phase = rec.get("phase")
    sha_manifest = get_manifest_sha(rec)

    if not isinstance(phase, int) or not isinstance(status, str) or sha_manifest is None:
        return ("MANIFEST_BROKEN", f"phase={phase!r} status={status!r} sha={sha_manifest!r}")

    sha_now = sha256_file(pdf)
    if sha_now != sha_manifest:
        return ("SHA_MISMATCH", f"manifest={sha_manifest[:12]}.. current={sha_now[:12]}..")

    if phase == 1 and status == "ok":
        return ("PHASE1_ONLY", "phase 1 ok, phase 2 missing")

    if phase >= 2 and status != "ok":
        return ("PHASE2_FAILED", f"phase={phase} status={status!r}")

    if phase >= 2 and status == "ok":
        return ("PHASE2_COMPLETE", f"phase={phase} ok")

    return ("OTHER", f"phase={phase} status={status!r}")

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=str, default="/home/dalton/projects/claudeflow-testing/corpus")
    ap.add_argument("--manifest", type=str, default="scripts/ingest/manifest.jsonl")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest).resolve()

    if not root.exists():
        print(f"[FATAL] corpus root does not exist: {root}", file=sys.stderr)
        return 2

    latest, errors = load_latest_manifest_records(manifest_path)
    if errors:
        print("[WARN] manifest.jsonl has JSON parse errors (audit will proceed):", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)

    buckets: Dict[str, List[str]] = {}
    total = 0

    for pdf in sorted(iter_pdfs(root)):
        total += 1
        p_abs = str(pdf.resolve())
        rec = latest.get(p_abs)
        label, why = classify(pdf, rec)
        rel = str(pdf.relative_to(root))
        buckets.setdefault(label, []).append(f"{rel} :: {why}")

    print("\n--- AUDIT REPORT ---")
    print(f"root: {root}")
    print(f"manifest: {manifest_path}")
    print(f"total_pdfs: {total}\n")

    order = [
        "PHASE2_COMPLETE",
        "PHASE1_ONLY",
        "PHASE2_FAILED",
        "SHA_MISMATCH",
        "PHASE0_ONLY",
        "MANIFEST_BROKEN",
        "OTHER",
    ]

    for k in order:
        items = buckets.get(k, [])
        if not items:
            continue
        print(f"[{k}] ({len(items)})")
        for line in items:
            print(f"  - {line}")
        print()

    non_ok = total - len(buckets.get("PHASE2_COMPLETE", []))
    return 0 if non_ok == 0 else 1

if __name__ == "__main__":
    raise SystemExit(main())
