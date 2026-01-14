#!/usr/bin/env python3
"""
Phase 7B: Apply ChatGPT annotations to deterministic candidates.

Inputs:
  - god-reason/candidates.jsonl
  - annotations.jsonl (your ChatGPT output; JSONL)

Output:
  - god-reason/candidates_annotated.jsonl

Annotation schema (JSONL):
  {"cand_id": "...", "relation": "...", "confidence": "...", "rationale": "...", "topic_labels": [...]?}
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


ALLOWED_RELATIONS = {"support", "contrast", "inheritance", "elaboration", "conflict", "none"}


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception as e:
                raise SystemExit(f"[7B] JSON parse error {path}:{line_no}: {e}")
    return rows


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", default="god-reason/candidates.jsonl")
    ap.add_argument("--annotations", required=True, help="ChatGPT annotations JSONL")
    ap.add_argument("--out", default="god-reason/candidates_annotated.jsonl")
    args = ap.parse_args()

    cand_path = Path(args.candidates)
    ann_path = Path(args.annotations)
    out_path = Path(args.out)

    if not cand_path.exists():
        raise SystemExit(f"[7B] Missing candidates: {cand_path}")
    if not ann_path.exists():
        raise SystemExit(f"[7B] Missing annotations: {ann_path}")

    candidates = read_jsonl(cand_path)
    annotations = read_jsonl(ann_path)

    cand_by_id: Dict[str, Dict[str, Any]] = {c["cand_id"]: c for c in candidates}

    # Validate + apply
    applied = 0
    for a in annotations:
        cid = a.get("cand_id")
        if not cid:
            raise SystemExit("[7B] Annotation missing cand_id")
        if cid not in cand_by_id:
            raise SystemExit(f"[7B] Annotation cand_id not found in candidates: {cid}")

        rel = a.get("relation", "none")
        if rel not in ALLOWED_RELATIONS:
            raise SystemExit(f"[7B] Invalid relation={rel} for cand_id={cid}")

        cand = cand_by_id[cid]
        cand["llm"] = {
            "relation": rel,
            "confidence": a.get("confidence"),
            "rationale": a.get("rationale"),
            "topic_labels": a.get("topic_labels", []),
        }
        applied += 1

    # Deterministic output order: same as candidates file order
    out_rows: List[Dict[str, Any]] = []
    for c in candidates:
        # ensure llm field exists, but keep explicit "none" if absent
        if "llm" not in c:
            c["llm"] = {"relation": "none", "confidence": None, "rationale": None, "topic_labels": []}
        out_rows.append(c)

    write_jsonl(out_path, out_rows)
    print(f"[Phase7B:apply] candidates={len(candidates)} annotations_applied={applied} wrote={out_path}")


if __name__ == "__main__":
    main()
