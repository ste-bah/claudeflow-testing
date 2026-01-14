#!/usr/bin/env python3
"""
Phase 7C: Compile final reasoning.jsonl from:
  - candidates_annotated.jsonl (preferred) OR candidates.jsonl
  - optional selections.jsonl (explicit per-KU picks)

Output: god-reason/reasoning.jsonl + god-reason/index.json

Guarantees:
- Deterministic ordering
- Same canonical hash fields as reason_over_knowledge.py
- Compatible with verify_reasoning.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple, Optional


CONF_RANK = {"high": 3, "medium": 2, "low": 1, None: 0}
REL_ALLOWED = {"support", "contrast", "inheritance", "elaboration", "conflict"}


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def stable_reason_id(canonical_json_sorted: str) -> str:
    return "ru_" + sha256_hex(canonical_json_sorted)[:16]


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
                raise SystemExit(f"[7C] JSON parse error {path}:{line_no}: {e}")
    return rows


def load_selections(path: Path) -> Dict[str, List[Dict[str, Any]]]:
    """
    selections.jsonl schema (one per KU):
      {"ku_id":"ku_...", "selected":[{"cand_id":"cand_...", "rank":1}, ...]}
    """
    rows = read_jsonl(path)
    out: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        ku_id = r.get("ku_id")
        sel = r.get("selected", [])
        if ku_id and isinstance(sel, list):
            out[str(ku_id)] = sel
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", default="god-reason/candidates_annotated.jsonl")
    ap.add_argument("--out", default="god-reason")
    ap.add_argument("--topic", default="all", help="Topic string to write into reasoning units")
    ap.add_argument("--top_k_per_unit", type=int, default=12)
    ap.add_argument("--selections", default=None, help="Optional selections.jsonl (explicit LLM picks)")
    args = ap.parse_args()

    cand_path = Path(args.candidates)
    if not cand_path.exists():
        raise SystemExit(f"[7C] Missing candidates: {cand_path}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates = read_jsonl(cand_path)

    selections: Optional[Dict[str, List[Dict[str, Any]]]] = None
    if args.selections:
        sel_path = Path(args.selections)
        if not sel_path.exists():
            raise SystemExit(f"[7C] Missing selections file: {sel_path}")
        selections = load_selections(sel_path)

    # Build a map for quick lookup
    cand_by_id: Dict[str, Dict[str, Any]] = {c["cand_id"]: c for c in candidates}

    # Determine which candidates to keep:
    keep_ids: Set[str] = set()

    if selections is not None:
        # Explicit: union of all selected cand_ids across KU rows
        for ku_id, sel_list in selections.items():
            for s in sel_list:
                cid = s.get("cand_id")
                if cid in cand_by_id:
                    keep_ids.add(cid)
    else:
        # Policy-based: keep those with llm.relation != none (and allowed), else drop
        for c in candidates:
            llm = c.get("llm", {}) if isinstance(c.get("llm"), dict) else {}
            rel = llm.get("relation", "none")
            if rel in REL_ALLOWED:
                keep_ids.add(c["cand_id"])

    kept = [cand_by_id[cid] for cid in sorted(keep_ids) if cid in cand_by_id]

    # Deterministic top-K pruning per knowledge unit (authoritative edges)
    by_ku: Dict[str, List[Dict[str, Any]]] = {}
    for c in kept:
        a_id, b_id = c["knowledge_ids"]
        by_ku.setdefault(a_id, []).append(c)
        by_ku.setdefault(b_id, []).append(c)

    final_keep: Set[str] = set()
    for ku_id in sorted(by_ku.keys()):
        edges = by_ku[ku_id]

        def edge_key(e: Dict[str, Any]) -> Tuple[int, float, str]:
            llm = e.get("llm", {}) if isinstance(e.get("llm"), dict) else {}
            conf = llm.get("confidence")
            conf_rank = CONF_RANK.get(conf, 0)
            score = float(e.get("score", 0.0))
            return (-conf_rank, -score, e["cand_id"])

        edges_sorted = sorted(edges, key=edge_key)
        for e in edges_sorted[: max(0, args.top_k_per_unit)]:
            final_keep.add(e["cand_id"])

    kept2 = [c for c in kept if c["cand_id"] in final_keep]

    # Emit reasoning rows in the same canonical schema as reason_over_knowledge.py
    reasoning_rows: List[Dict[str, Any]] = []

    for c in sorted(kept2, key=lambda r: (r["knowledge_ids"][0], r["knowledge_ids"][1], -r["score"], r["cand_id"])):
        a_id, b_id = c["knowledge_ids"]

        llm = c.get("llm", {}) if isinstance(c.get("llm"), dict) else {}
        rel = llm.get("relation", None)
        if rel not in REL_ALLOWED:
            # If no relation, skip (should not happen if kept properly)
            continue

        shared_sample = c.get("shared_ngrams_sample", [])
        if not isinstance(shared_sample, list):
            shared_sample = []

        canonical = {
            "relation": rel,
            "topic": args.topic,
            "knowledge_ids": [a_id, b_id],
            "shared_ngrams_sample": shared_sample,
        }
        canonical_s = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
        rid = stable_reason_id(canonical_s)

        claim_a = c.get("claims", {}).get(a_id, "")
        claim_b = c.get("claims", {}).get(b_id, "")
        src_a = c.get("sources", {}).get(a_id, [])
        src_b = c.get("sources", {}).get(b_id, [])

        row = {
            "reason_id": rid,
            "relation": rel,
            "topic": args.topic,
            "knowledge_ids": [a_id, b_id],
            "shared_ngrams_sample": shared_sample,
            "shared_ngrams_count": int(c.get("shared_ngrams_count", 0)),
            "evidence": [
                {"ku_id": a_id, "claim": claim_a, "sources": src_a},
                {"ku_id": b_id, "claim": claim_b, "sources": src_b},
            ],
            "score": round(float(c.get("score", 0.0)), 6),
            "hash": "sha256:" + sha256_hex(canonical_s),
            "llm": {
                "cand_id": c["cand_id"],
                "confidence": llm.get("confidence"),
                "rationale": llm.get("rationale"),
                "topic_labels": llm.get("topic_labels", []),
            },
        }
        reasoning_rows.append(row)

    # Deterministic ordering required by verify_reasoning --strict_order
    reasoning_rows.sort(key=lambda r: (r["topic"], r["relation"], r["reason_id"]))

    reasoning_path = out_dir / "reasoning.jsonl"
    with reasoning_path.open("w", encoding="utf-8") as f:
        for r in reasoning_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    index = {
        "phase": "7C",
        "input": str(cand_path),
        "output": str(reasoning_path),
        "topic": args.topic,
        "stats": {
            "candidates_in": len(candidates),
            "kept_after_relation_filter": len(kept),
            "kept_after_topk": len(reasoning_rows),
            "top_k_per_unit": args.top_k_per_unit,
            "explicit_selections": bool(selections is not None),
        },
        "determinism": {
            "reason_id": "ru_sha256(canonical_json)[:16]",
            "canonical_fields": ["relation", "topic", "knowledge_ids", "shared_ngrams_sample"],
            "ordering": "(topic, relation, reason_id)",
        },
    }
    (out_dir / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"[Phase7C:compile] reasoning={len(reasoning_rows)} wrote={reasoning_path}")


if __name__ == "__main__":
    main()
