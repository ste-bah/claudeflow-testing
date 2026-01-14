#!/usr/bin/env python3
"""
Phase 7 verification:
- referenced knowledge IDs exist
- each reasoning unit cites >= 2 knowledge IDs
- deterministic ordering checks (basic)
- hash integrity
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load_jsonl(path: Path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception as e:
                raise SystemExit(f"JSON parse error {path}:{line_no}: {e}")
    return rows


def load_knowledge_ids(path: Path) -> set[str]:
    ids = set()
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            ku_id = obj.get("id") or obj.get("ku_id")
            if not ku_id:
                raise SystemExit(f"Missing knowledge id at {path}:{line_no}")
            ids.add(ku_id)
    return ids


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--knowledge", default="god-learn/knowledge.jsonl")
    ap.add_argument("--reasoning", default="god-reason/reasoning.jsonl")
    ap.add_argument("--strict_order", action="store_true")
    args = ap.parse_args()

    kpath = Path(args.knowledge)
    rpath = Path(args.reasoning)

    if not kpath.exists():
        raise SystemExit(f"Missing knowledge file: {kpath}")
    if not rpath.exists():
        raise SystemExit(f"Missing reasoning file: {rpath}")

    kidset = load_knowledge_ids(kpath)
    rows = load_jsonl(rpath)

    # Referential integrity + schema checks
    for i, r in enumerate(rows):
        k = r.get("knowledge_ids")
        if not isinstance(k, list) or len(k) < 2:
            raise SystemExit(f"Row {i}: knowledge_ids must be list len>=2")

        for ku in k:
            if ku not in kidset:
                raise SystemExit(f"Row {i}: unknown knowledge id referenced: {ku}")

        # Hash check
        canonical = {
            "relation": r.get("relation"),
            "topic": r.get("topic"),
            "knowledge_ids": r.get("knowledge_ids"),
            "shared_ngrams_sample": r.get("shared_ngrams_sample"),
        }

        canonical_s = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
        expected = "sha256:" + sha256_hex(canonical_s)
        if r.get("hash") != expected:
            raise SystemExit(f"Row {i}: hash mismatch expected={expected} got={r.get('hash')}")

    # Deterministic ordering check (optional strict)
    if args.strict_order:
        sorted_rows = sorted(rows, key=lambda r: (r.get("topic"), r.get("relation"), r.get("reason_id")))
        if rows != sorted_rows:
            raise SystemExit("Reasoning JSONL is not in deterministic sorted order")

    print(f"[Phase7:verify] OK reasoning_units={len(rows)} knowledge_ids={len(kidset)}")


if __name__ == "__main__":
    main()
