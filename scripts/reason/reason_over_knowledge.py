#!/usr/bin/env python3
"""
Phase 7: Cross-document reasoning over promoted knowledge units.

- Input:  god-learn/knowledge.jsonl
- Output: god-reason/reasoning.jsonl + god-reason/index.json

Constraints:
- NO Chroma queries
- NO embeddings
- Deterministic output
- Every reasoning unit references >= 2 knowledge units
- No new uncited claims: reasoning units only relate existing claims
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Set, Tuple

import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple


STOPWORDS: Set[str] = {
    # small, fixed list to keep determinism simple (expand if needed)
    "the","a","an","and","or","of","to","in","on","for","with","by","as","is","are",
    "was","were","be","been","being","that","this","these","those","it","its","at",
    "from","into","over","under","between","through","during","without","within",
    "not","no","but","however","rather","than","then","so","such","also","more","most",
}

CONTRAST_MARKERS = {"however", "but", "rather", "yet", "nevertheless", "although", "whereas"}
ELAB_MARKERS = {"for example", "e.g.", "specifically", "in particular", "thus", "therefore", "because"}

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z\-']+")

@dataclass(frozen=True)
class KnowledgeUnit:
    ku_id: str
    claim: str
    sources: list
    meta: dict


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def stable_reason_id(parts: List[str]) -> str:
    # ru_<16 hex>
    h = sha256_hex("|".join(parts))[:16]
    return f"ru_{h}"


def normalize_text(s: str) -> str:
    return " ".join(s.strip().split())


def tokenize(claim: str) -> List[str]:
    claim_l = claim.lower()
    toks = [m.group(0) for m in TOKEN_RE.finditer(claim_l)]
    toks = [t for t in toks if t not in STOPWORDS and len(t) >= 3]
    return toks

def char_ngrams(s: str, n: int = 5) -> set[str]:
    s = re.sub(r"\s+", " ", s.lower()).strip()
    s = re.sub(r"[^a-z0-9 \-']", "", s)  # conservative normalization
    if len(s) < n:
        return {s} if s else set()
    return {s[i:i+n] for i in range(len(s) - n + 1)}


def term_set(claim: str) -> Set[str]:
    return set(tokenize(claim))


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def contains_any_phrase(text_l: str, phrases: Set[str]) -> bool:
    return any(p in text_l for p in phrases)


def infer_relation(claim_a: str, claim_b: str, score: float, shared: Set[str]) -> str | None:
    """
    Char n-gram similarity-based relation inference (no curated keyword lists).
    `score` is Jaccard(char_ngrams(a), char_ngrams(b)).
    """
    a_l = claim_a.lower()
    b_l = claim_b.lower()

    # Contrast / elaboration rely on explicit discourse markers
    if score >= 0.06 and (contains_any_phrase(a_l, CONTRAST_MARKERS) or contains_any_phrase(b_l, CONTRAST_MARKERS)):
        return "contrast"

    if score >= 0.06 and (contains_any_phrase(a_l, ELAB_MARKERS) or contains_any_phrase(b_l, ELAB_MARKERS)):
        return "elaboration"

    # "Inheritance" here means near-duplicate / very strong similarity
    if score >= 0.18:
        return "inheritance"

    # Default: support when there is modest similarity
    if score >= 0.08:
        return "support"

    return None





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
                raise ValueError(f"Missing knowledge id at line {line_no}")
            claim = normalize_text(obj.get("claim", ""))
            sources = obj.get("sources", obj.get("citations", []))
            meta = {k: v for k, v in obj.items() if k not in ("id", "ku_id", "claim", "sources", "citations")}
            units.append(KnowledgeUnit(ku_id=ku_id, claim=claim, sources=sources, meta=meta))

    # Deterministic base ordering
    units.sort(key=lambda u: u.ku_id)
    return units

#Disabled Topic Bucketing (below), this is a single bucket for minimal working version
def topic_bucket(units: List[KnowledgeUnit], query: str | None) -> Dict[str, List[KnowledgeUnit]]:
    # Phase 7 early-stage: single bucket for dense cross-document reasoning.
    # Bucketing will be reintroduced later as a scalability optimization.
    if query:
        return {"query": [u for u in units if query.lower() in u.claim.lower()]}
    return {"all": units}


#def topic_bucket(units: List[KnowledgeUnit], query: str | None) -> Dict[str, List[KnowledgeUnit]]:
    """
    Deterministic topic bucketing:
    - If --query provided: single bucket "query"
    - Else: bucket by top keyword among a small controlled vocabulary (fallback "misc")
    """
 #   if query:
  #      return {"query": [u for u in units if query.lower() in u.claim.lower()]}

#    vocab = [
#        "phantasia", "action", "movement", "perception", "desire", "rhetoric", "lexis", "appearance",
#        "epideictic", "soul", "imagination", "deliberation"
 #   ]

#    buckets: Dict[str, List[KnowledgeUnit]] = {k: [] for k in vocab}
#    buckets["misc"] = []

    #for u in units:
     #   c = u.claim.lower()
      #  placed = False
       # for k in vocab:
        #    if k in c:
         #       buckets[k].append(u)
          #      placed = True
           #     break
      #  if not placed:
      #      buckets["misc"].append(u)

    # Drop empty buckets for cleaner output
   # buckets = {k: v for k, v in buckets.items() if v}
    # Deterministic bucket order handled later by sorting keys
   # return buckets


def build_reasoning(
    units: List[KnowledgeUnit],
    query: str | None,
    max_pairs: int,
    top_k_per_unit: int,
) -> Tuple[List[dict], dict]:

    buckets = topic_bucket(units, query=query)

    reasoning_rows: List[dict] = []
    stats = {
        "units_total": len(units),
        "buckets": {k: len(v) for k, v in buckets.items()},
        "pairs_considered": 0,
        "reasoning_units_emitted": 0,
        "reasoning_units_pre_prune": 0,
        "reasoning_units_post_prune": 0,
        "top_k_per_unit": top_k_per_unit,
    }

    for topic in sorted(buckets.keys()):
        bucket = buckets[topic]
        # pairwise comparisons, deterministic order
        n = len(bucket)
        for i in range(n):
            for j in range(i + 1, n):
                if stats["pairs_considered"] >= max_pairs:
                    break
                a = bucket[i]
                b = bucket[j]

                ga = char_ngrams(a.claim, n=4)
                gb = char_ngrams(b.claim, n=4)
                shared = ga & gb
                score = jaccard(ga, gb)
                rel = infer_relation(a.claim, b.claim, score, shared)

                stats["pairs_considered"] += 1
                if rel is None:
                    continue

                # Deterministic small sample of shared n-grams (avoid huge JSONL rows)
                shared_sample = sorted(shared)[:25]

                # Stable hash from canonical fields only (do NOT hash the full shared set)
                canonical = {
                    "relation": rel,
                    "topic": topic,
                    "knowledge_ids": [a.ku_id, b.ku_id],
                    "shared_ngrams_sample": shared_sample,
                }
                canonical_s = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
                rid = stable_reason_id([canonical_s])

                row = {
                    "reason_id": rid,
                    "relation": rel,
                    "topic": topic,
                    "knowledge_ids": [a.ku_id, b.ku_id],
                    "shared_ngrams_sample": shared_sample,
                    "shared_ngrams_count": len(shared),
                    "evidence": [
                        {"ku_id": a.ku_id, "claim": a.claim, "sources": a.sources},
                        {"ku_id": b.ku_id, "claim": b.claim, "sources": b.sources},
                    ],
                    "score": round(score, 6),
                    "hash": "sha256:" + sha256_hex(canonical_s),
                }
                reasoning_rows.append(row)

            if stats["pairs_considered"] >= max_pairs:
                break

    # Deterministic ordering of emitted reasoning units (pre-prune)
    reasoning_rows.sort(key=lambda r: (r["topic"], r["relation"], r["reason_id"]))
    stats["reasoning_units_pre_prune"] = len(reasoning_rows)

    # --- Deterministic top-K pruning per knowledge unit ---
    def prune_top_k_per_unit(rows: List[dict], k: int) -> List[dict]:
        if k <= 0:
            return rows

        by_unit: Dict[str, List[dict]] = {}
        for r in rows:
            a_id, b_id = r["knowledge_ids"]
            by_unit.setdefault(a_id, []).append(r)
            by_unit.setdefault(b_id, []).append(r)

        keep_ids: Set[str] = set()
        for ku_id, edges in by_unit.items():
            # Highest score first; tie-break deterministically by reason_id
            edges_sorted = sorted(edges, key=lambda e: (-e["score"], e["reason_id"]))
            for e in edges_sorted[:k]:
                keep_ids.add(e["reason_id"])

        pruned = [r for r in rows if r["reason_id"] in keep_ids]
        pruned.sort(key=lambda r: (r["topic"], r["relation"], r["reason_id"]))
        return pruned

    reasoning_rows = prune_top_k_per_unit(reasoning_rows, top_k_per_unit)
    stats["reasoning_units_post_prune"] = len(reasoning_rows)

    stats["reasoning_units_emitted"] = len(reasoning_rows)
    return reasoning_rows, stats



def write_outputs(out_dir: Path, rows: List[dict], stats: dict, query: str | None) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    reasoning_path = out_dir / "reasoning.jsonl"
    index_path = out_dir / "index.json"

    with reasoning_path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    index = {
        "phase": 7,
        "input": "god-learn/knowledge.jsonl",
        "output": {
            "reasoning_jsonl": str(reasoning_path),
            "index_json": str(index_path),
        },
        "query": query,
        "stats": stats,
        "determinism": {
            "sorted_units_by": "ku_id",
            "sorted_buckets_by": "topic key",
            "sorted_outputs_by": "(topic, relation, reason_id)",
            "hashing": "sha256(canonical_json_sorted_keys)",
        },
    }
    with index_path.open("w", encoding="utf-8") as f:
        f.write(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--knowledge", default="god-learn/knowledge.jsonl")
    ap.add_argument("--out", default="god-reason")
    ap.add_argument("--query", default=None, help="Optional substring filter on claim text")
    ap.add_argument("--max_pairs", type=int, default=200000, help="Safety cap on pairwise comparisons")
    ap.add_argument("--top_k_per_unit", type=int, default=12,
                help="Keep only top-K edges per knowledge unit (0 disables)")

    args = ap.parse_args()

    knowledge_path = Path(args.knowledge)
    if not knowledge_path.exists():
        raise SystemExit(f"Missing input: {knowledge_path}")

    units = load_knowledge(knowledge_path)
    rows, stats = build_reasoning(
        units,
        query=args.query,
        max_pairs=args.max_pairs,
        top_k_per_unit=args.top_k_per_unit,
    )
    write_outputs(Path(args.out), rows, stats, query=args.query)

    print(f"[Phase7:reason] units={len(units)} reasoning={len(rows)} out={args.out}")


if __name__ == "__main__":
    main()
