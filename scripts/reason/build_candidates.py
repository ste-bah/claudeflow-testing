#!/usr/bin/env python3
"""
Phase 7A: Deterministic candidate edge generation over promoted knowledge units.

Input:  god-learn/knowledge.jsonl
Output: god-reason/candidates.jsonl (+ index_candidates.json)

Constraints:
- NO Chroma queries
- NO embeddings
- Deterministic output
- Candidate edges only (not final reasoning)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional


STOPWORDS: Set[str] = {
    "the","a","an","and","or","of","to","in","on","for","with","by","as","is","are",
    "was","were","be","been","being","that","this","these","those","it","its","at",
    "from","into","over","under","between","through","during","without","within",
    "not","no","but","however","rather","than","then","so","such","also","more","most",
}

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z\-']+")


@dataclass(frozen=True)
class KnowledgeUnit:
    ku_id: str
    claim: str
    sources: list
    meta: dict


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def normalize_text(s: str) -> str:
    return " ".join(str(s).strip().split())


def char_ngrams(s: str, n: int = 4) -> Set[str]:
    s = re.sub(r"\s+", " ", s.lower()).strip()
    s = re.sub(r"[^a-z0-9 \-']", "", s)
    if len(s) < n:
        return {s} if s else set()
    return {s[i:i+n] for i in range(len(s) - n + 1)}


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def load_knowledge(path: Path) -> List[KnowledgeUnit]:
    units: List[KnowledgeUnit] = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            ku_id = obj.get("id") or obj.get("ku_id")
            if not ku_id:
                raise SystemExit(f"[7A] Missing knowledge id at line {line_no}")
            claim = normalize_text(obj.get("claim", ""))
            sources = obj.get("sources", obj.get("citations", []))
            meta = {k: v for k, v in obj.items() if k not in ("id", "ku_id", "claim", "sources", "citations")}
            units.append(KnowledgeUnit(ku_id=str(ku_id), claim=claim, sources=sources, meta=meta))
    units.sort(key=lambda u: u.ku_id)  # deterministic
    return units


def sources_fingerprint(sources: list) -> List[Dict[str, Any]]:
    """
    Keep only stable, provenance-relevant fields for hashing and for ChatGPT display.
    Your schema: author/title/path_rel/pages/chunk_id. (pages is important.)
    """
    out = []
    if not isinstance(sources, list):
        return out
    for s in sources:
        if not isinstance(s, dict):
            continue
        out.append({
            "author": s.get("author"),
            "title": s.get("title"),
            "path_rel": s.get("path_rel"),
            "pages": s.get("pages"),
            "chunk_id": s.get("chunk_id"),
        })
    return out


def stable_candidate_id(a: KnowledgeUnit, b: KnowledgeUnit, shared_sample: List[str]) -> str:
    # canonicalize ordering by ku_id so cand_id is symmetric
    ida, idb = (a.ku_id, b.ku_id) if a.ku_id < b.ku_id else (b.ku_id, a.ku_id)
    ca, cb = (a.claim, b.claim) if a.ku_id < b.ku_id else (b.claim, a.claim)
    sa, sb = (sources_fingerprint(a.sources), sources_fingerprint(b.sources)) if a.ku_id < b.ku_id else (sources_fingerprint(b.sources), sources_fingerprint(a.sources))

    canonical = {
        "ku_a": ida,
        "ku_b": idb,
        "claim_a": ca,
        "claim_b": cb,
        "sources_a": sa,
        "sources_b": sb,
        "shared_ngrams_sample": shared_sample,
    }
    s = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
    return "cand_" + sha256_hex(s)[:16]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--knowledge", default="god-learn/knowledge.jsonl")
    ap.add_argument("--out", default="god-reason")
    ap.add_argument("--max_pairs", type=int, default=200000, help="Safety cap on pairwise comparisons")
    ap.add_argument("--top_k_candidates", type=int, default=25, help="Candidate edges kept per knowledge unit")
    ap.add_argument("--min_jaccard", type=float, default=0.03, help="Similarity floor (prevents weak chains)")
    ap.add_argument("--min_shared_ngrams", type=int, default=20, help="Shared ngram floor")
    args = ap.parse_args()

    kpath = Path(args.knowledge)
    if not kpath.exists():
        raise SystemExit(f"[7A] Missing input: {kpath}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    units = load_knowledge(kpath)
    n = len(units)

    # Precompute ngrams (deterministic)
    grams: Dict[str, Set[str]] = {u.ku_id: char_ngrams(u.claim, n=4) for u in units}

    # Generate all passing pairs (bounded by max_pairs)
    pairs: List[Dict[str, Any]] = []
    considered = 0

    for i in range(n):
        for j in range(i + 1, n):
            if considered >= args.max_pairs:
                break
            considered += 1

            a = units[i]
            b = units[j]
            ga = grams[a.ku_id]
            gb = grams[b.ku_id]
            shared = ga & gb
            shared_count = len(shared)
            score = jaccard(ga, gb)
            if score < args.min_jaccard:
                continue
            if shared_count < args.min_shared_ngrams:
                continue

            shared_sample = sorted(shared)[:25]
            cand_id = stable_candidate_id(a, b, shared_sample)

            # canonical edge ordering (ku_a < ku_b)
            if a.ku_id < b.ku_id:
                ku_a, ku_b = a, b
            else:
                ku_a, ku_b = b, a

            pairs.append({
                "cand_id": cand_id,
                "knowledge_ids": [ku_a.ku_id, ku_b.ku_id],
                "claims": {ku_a.ku_id: ku_a.claim, ku_b.ku_id: ku_b.claim},
                "sources": {ku_a.ku_id: sources_fingerprint(ku_a.sources), ku_b.ku_id: sources_fingerprint(ku_b.sources)},
                "shared_ngrams_sample": shared_sample,
                "shared_ngrams_count": shared_count,
                "score": round(score, 6),
                "hash": "sha256:" + sha256_hex(json.dumps({
                    "knowledge_ids": [ku_a.ku_id, ku_b.ku_id],
                    "shared_ngrams_sample": shared_sample,
                    "score": round(score, 6),
                }, sort_keys=True, ensure_ascii=False)),
            })

        if considered >= args.max_pairs:
            break

    # Deterministic ordering (global)
    pairs.sort(key=lambda r: (r["knowledge_ids"][0], r["knowledge_ids"][1], -r["score"], r["cand_id"]))

    # Top-K candidates per knowledge unit
    by_ku: Dict[str, List[Dict[str, Any]]] = {}
    for r in pairs:
        a_id, b_id = r["knowledge_ids"]
        by_ku.setdefault(a_id, []).append(r)
        by_ku.setdefault(b_id, []).append(r)

    keep: Set[str] = set()
    for ku_id in sorted(by_ku.keys()):
        edges = by_ku[ku_id]
        edges_sorted = sorted(edges, key=lambda e: (-e["score"], e["cand_id"]))
        for e in edges_sorted[: max(0, args.top_k_candidates)]:
            keep.add(e["cand_id"])

    kept = [r for r in pairs if r["cand_id"] in keep]
    kept.sort(key=lambda r: (r["knowledge_ids"][0], r["knowledge_ids"][1], -r["score"], r["cand_id"]))

    candidates_path = out_dir / "candidates.jsonl"
    with candidates_path.open("w", encoding="utf-8") as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    index = {
        "phase": "7A",
        "input": str(kpath),
        "output": str(candidates_path),
        "stats": {
            "knowledge_units": len(units),
            "pairs_considered": considered,
            "pairs_passing_thresholds": len(pairs),
            "candidates_kept": len(kept),
            "top_k_candidates": args.top_k_candidates,
            "min_jaccard": args.min_jaccard,
            "min_shared_ngrams": args.min_shared_ngrams,
        },
        "determinism": {
            "units_sorted_by": "ku_id",
            "candidate_order": "(ku_a, ku_b, -score, cand_id)",
            "candidate_id": "sha256(canonical claims+sources+shared_sample)[:16]",
        }
    }
    (out_dir / "index_candidates.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"[Phase7A:candidates] knowledge={len(units)} kept={len(kept)} wrote={candidates_path}")


if __name__ == "__main__":
    main()
