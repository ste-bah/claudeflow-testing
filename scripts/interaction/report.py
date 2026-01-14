#!/usr/bin/env python3
"""
Phase 9 (A): REPORT mode (non-generative, read-only)

Design goals:
- Read-only interaction layer: MUST NOT call update/promote/compile.
- Deterministic output: stable ordering + stable schema.
- Reuse Phase 4 retrieval as the authority for query -> evidence.
  We call scripts/retrieval/query_chunks.py --print_json and embed its payload.

Inputs:
- query string
- retrieval knobs (k, overfetch, where, include_docs, highlights knobs)
- Phase 6 knobs (knowledge.jsonl surfacing)
- Phase 7 knobs (reasoning.jsonl surfacing)

Outputs:
- JSON (canonical ReportEnvelope) or minimal Markdown rendering
- Optional --out to write report artifact (recommended: reports/)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


REPO_ROOT = Path(__file__).resolve().parents[2]
PHASE4_QUERY = REPO_ROOT / "scripts" / "retrieval" / "query_chunks.py"


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_where(where_str: Optional[str]) -> Optional[Dict[str, Any]]:
    if not where_str:
        return None
    try:
        obj = json.loads(where_str)
    except Exception as ex:
        raise ValueError(f"--where must be valid JSON: {ex}") from ex
    if not isinstance(obj, dict):
        raise ValueError("--where must be a JSON object (dict)")
    return obj


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    if not path.exists():
        return items
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if isinstance(obj, dict):
                items.append(obj)
    return items


def get_nested(d: Dict[str, Any], *keys: str) -> Optional[Any]:
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur


# ----------------------------
# Phase 4 retrieval invocation
# ----------------------------

def run_phase4_query_chunks(args: argparse.Namespace) -> Dict[str, Any]:
    """
    Calls Phase 4 retrieval entrypoint as a subprocess and returns parsed JSON payload.
    """
    if not PHASE4_QUERY.exists():
        raise FileNotFoundError(f"Missing Phase 4 entrypoint: {PHASE4_QUERY}")

    cmd: List[str] = [
        sys.executable,
        str(PHASE4_QUERY),
        args.query,
        "--k", str(args.k),
        "--overfetch", str(args.overfetch),
        "--print_json",
    ]

    # pass-through knobs
    if args.embed_url:
        cmd += ["--embed_url", args.embed_url]
    if args.chroma_dir:
        cmd += ["--chroma_dir", args.chroma_dir]
    if args.collection:
        cmd += ["--collection", args.collection]
    if args.where:
        cmd += ["--where", args.where]

    if args.include_docs:
        cmd += ["--include_docs"]

    if args.require_my_copy:
        cmd += ["--require_my_copy"]
    if args.keep_biblio:
        cmd += ["--keep_biblio"]
    if args.collection_filter:
        cmd += ["--collection_filter", args.collection_filter]

    # Phase 5 highlight reranking is allowed (still query-time only, deterministic).
    if args.use_highlights:
        cmd += ["--use_highlights"]
        if args.highlights_index:
            cmd += ["--highlights_index", args.highlights_index]
        cmd += ["--highlight_alpha", str(args.highlight_alpha)]
        cmd += ["--highlight_cap", str(args.highlight_cap)]

    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            "Phase 4 retrieval failed.\n"
            f"Command: {' '.join(cmd)}\n"
            f"Exit code: {proc.returncode}\n"
            f"STDERR:\n{proc.stderr.strip()}\n"
        )

    try:
        payload = json.loads(proc.stdout)
    except Exception as ex:
        raise RuntimeError(
            "Phase 4 retrieval returned non-JSON output.\n"
            f"Command: {' '.join(cmd)}\n"
            f"STDOUT (first 500 chars):\n{proc.stdout[:500]}\n"
        ) from ex

    # Minimal contract checks
    if not isinstance(payload, dict):
        raise ValueError("Phase 4 payload must be a JSON object")
    for k in ("query", "config", "results"):
        if k not in payload:
            raise ValueError(f"Phase 4 payload missing key: {k}")
    if not isinstance(payload["results"], list):
        raise ValueError("Phase 4 payload 'results' must be a list")

    return payload


def compute_retrieval_stats(phase4_payload: Dict[str, Any]) -> Dict[str, Any]:
    results = phase4_payload.get("results", []) or []
    distances: List[float] = []
    doc_paths: List[str] = []

    for r in results:
        if isinstance(r, dict):
            d = r.get("distance", None)
            if isinstance(d, (int, float)):
                distances.append(float(d))
            p = r.get("path_rel", None)
            if isinstance(p, str):
                doc_paths.append(p)

    distinct_docs = sorted(set(doc_paths))
    stats: Dict[str, Any] = {
        "n_returned": len(results),
        "distinct_docs": len(distinct_docs),
        "distinct_doc_paths": distinct_docs,
    }
    if distances:
        stats.update(
            {
                "distance_min": min(distances),
                "distance_max": max(distances),
            }
        )
    return stats


# ----------------------------
# Phase 6: KU surfacing
# ----------------------------

_STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "as", "by",
    "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those"
}


def tokenize_query(q: str) -> List[str]:
    parts = re.findall(r"[a-z0-9]+", q.lower())
    return [p for p in parts if p and p not in _STOP]


def normalize_ku(o: Dict[str, Any]) -> Dict[str, Any]:
    ku_id = o.get("knowledge_id") or o.get("id") or o.get("ku_id") or "UNKNOWN_KU"
    claim = o.get("claim") or o.get("text") or o.get("content") or ""

    source_chunk = (
        o.get("chunk_id")
        or get_nested(o, "source", "chunk_id")
        or get_nested(o, "provenance", "chunk_id")
        or get_nested(o, "meta", "chunk_id")
    )
    source_doc = (
        o.get("doc_id")
        or get_nested(o, "source", "doc_id")
        or get_nested(o, "provenance", "doc_id")
        or get_nested(o, "meta", "doc_id")
    )

    return {
        "knowledge_id": str(ku_id),
        "claim": str(claim),
        "source_chunk_id": str(source_chunk) if isinstance(source_chunk, str) else None,
        "source_doc_id": str(source_doc) if isinstance(source_doc, str) else None,
        "raw": o,
    }


def doc_id_from_chunk_id(chunk_id: str) -> Optional[str]:
    if not isinstance(chunk_id, str):
        return None
    if ":" not in chunk_id:
        return None
    return chunk_id.split(":", 1)[0]


def surface_knowledge_units(
    query: str,
    phase4_payload: Dict[str, Any],
    knowledge_path: Path,
    top_ku: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    kus_raw = load_jsonl(knowledge_path)
    kus = [normalize_ku(o) for o in kus_raw]

    # Retrieval overlap sets
    retr_chunk_ids = set()
    retr_doc_ids = set()
    for r in (phase4_payload.get("results") or []):
        if not isinstance(r, dict):
            continue
        cid = r.get("chunk_id")
        if isinstance(cid, str):
            retr_chunk_ids.add(cid)
            did = doc_id_from_chunk_id(cid)
            if did:
                retr_doc_ids.add(did)

    q_terms = tokenize_query(query)

    scored: List[Dict[str, Any]] = []
    n_overlap_chunk = 0
    n_overlap_doc = 0
    n_positive = 0

    for ku in kus:
        claim_l = ku["claim"].lower()
        lex = sum(1 for t in q_terms if t in claim_l)

        overlap_chunk = ku["source_chunk_id"] in retr_chunk_ids if ku["source_chunk_id"] else False
        overlap_doc = False

        if ku["source_doc_id"] and ku["source_doc_id"] in retr_doc_ids:
            overlap_doc = True
        elif ku["source_chunk_id"]:
            did = doc_id_from_chunk_id(ku["source_chunk_id"])
            overlap_doc = bool(did and did in retr_doc_ids)

        overlap_score = (100 if overlap_chunk else 0) + (30 if overlap_doc else 0)
        score = overlap_score + lex

        if overlap_chunk:
            n_overlap_chunk += 1
        if overlap_doc:
            n_overlap_doc += 1
        if score > 0:
            n_positive += 1

        scored.append({
            "knowledge_id": ku["knowledge_id"],
            "score": score,
            "overlap": {"chunk": overlap_chunk, "doc": overlap_doc},
            "claim": ku["claim"][:800],
            "source": {
                "chunk_id": ku["source_chunk_id"],
                "doc_id": ku["source_doc_id"] or (
                    doc_id_from_chunk_id(ku["source_chunk_id"]) if ku["source_chunk_id"] else None
                ),
            },
        })

    scored.sort(key=lambda x: (-int(x["score"]), x["knowledge_id"]))

    stats = {
        "n_total": len(kus),
        "n_scored_positive": n_positive,
        "n_overlap_chunk": n_overlap_chunk,
        "n_overlap_doc": n_overlap_doc,
        "knowledge_path": str(knowledge_path),
    }

    return scored[:top_ku], stats


# ----------------------------
# Phase 7: Reasoning edges
# ----------------------------

def normalize_edge(o: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(o, dict):
        return None
    rid = o.get("reason_id") or o.get("id") or "UNKNOWN_REASON"
    rel = o.get("relation") or "UNKNOWN_RELATION"
    topic = o.get("topic", None)
    kids = o.get("knowledge_ids") or o.get("knowledge_id_pair") or []
    if not isinstance(kids, list):
        kids = []
    kids = [str(x) for x in kids if x is not None]
    return {
        "reason_id": str(rid),
        "relation": str(rel),
        "topic": str(topic) if topic is not None else None,
        "knowledge_ids": kids,
        "raw": o,
    }


def surface_reasoning_edges(
    surfaced_ku_ids: List[str],
    reasoning_path: Path,
    top_edges: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    edges_raw = load_jsonl(reasoning_path)
    edges_norm: List[Dict[str, Any]] = []
    for o in edges_raw:
        n = normalize_edge(o)
        if n:
            edges_norm.append(n)

    ku_set = set([k for k in surfaced_ku_ids if isinstance(k, str) and k])

    hits: List[Dict[str, Any]] = []
    by_rel: Dict[str, int] = {}

    for e in edges_norm:
        kids = e.get("knowledge_ids", [])
        if not kids:
            continue
        overlap = sorted(set(kids) & ku_set)
        if not overlap:
            continue

        rel = e.get("relation", "UNKNOWN_RELATION")
        by_rel[rel] = by_rel.get(rel, 0) + 1

        hits.append({
            "reason_id": e["reason_id"],
            "relation": rel,
            "topic": e.get("topic"),
            "knowledge_ids": kids,
            "overlap_ku_ids": overlap,
        })

    # Deterministic sorting: relation then reason_id
    hits.sort(key=lambda x: (x.get("relation", ""), x.get("reason_id", "")))

    stats = {
        "n_total": len(edges_norm),
        "n_hits": len(hits),
        "by_relation": dict(sorted(by_rel.items(), key=lambda kv: kv[0])),
        "reasoning_path": str(reasoning_path),
    }

    return hits[:top_edges], stats


# ----------------------------
# Phase 9A envelope
# ----------------------------

def build_report_envelope(
    query: str,
    phase4_payload: Dict[str, Any],
    args: argparse.Namespace,
) -> Dict[str, Any]:
    retrieval_stats = compute_retrieval_stats(phase4_payload)

    # Phase 6 paths/params
    knowledge_path = Path(args.knowledge_path)
    if not knowledge_path.is_absolute():
        knowledge_path = (REPO_ROOT / knowledge_path).resolve()

    ku_hits, ku_stats = surface_knowledge_units(
        query=query,
        phase4_payload=phase4_payload,
        knowledge_path=knowledge_path,
        top_ku=args.top_ku,
    )

    # Phase 7 paths/params
    reasoning_path = Path(args.reasoning_path)
    if not reasoning_path.is_absolute():
        reasoning_path = (REPO_ROOT / reasoning_path).resolve()

    surfaced_ku_ids = [
        h.get("knowledge_id") for h in ku_hits
        if isinstance(h, dict) and h.get("knowledge_id")
    ]
    edge_hits, edge_stats = surface_reasoning_edges(
        surfaced_ku_ids=surfaced_ku_ids,
        reasoning_path=reasoning_path,
        top_edges=args.top_edges,
    )

    # Coverage grade: retrieval + KU presence + reasoning edges + semantic relevance
    retr_n = int(retrieval_stats["n_returned"])
    ku_n = len(ku_hits)
    edge_n = int(edge_stats.get("n_hits", 0))

    # GAP-H02: Consider semantic relevance via distance scores
    # Cosine distance: 0 = identical, 1 = orthogonal, 2 = opposite
    # Threshold: distances < 0.8 = relevant, 0.8-1.0 = marginal, > 1.0 = irrelevant
    dist_min = retrieval_stats.get("distance_min", 999.0)
    is_semantically_relevant = dist_min < 0.85  # Best match has reasonable similarity

    if retr_n == 0:
        grade = "NONE"
    elif retr_n >= 8 and ku_n >= 3 and is_semantically_relevant:
        grade = "HIGH"
    elif retr_n >= 3 and ku_n >= 1 and is_semantically_relevant:
        grade = "MED"
    elif retr_n > 0 and not is_semantically_relevant:
        # Retrieved chunks but poor semantic match = effectively no useful coverage
        grade = "LOW"
    else:
        grade = "LOW"

    report: Dict[str, Any] = {
        "query": query,
        "timestamp_utc": utc_now_iso(),
        "inputs": {
            "repo_root": str(REPO_ROOT),
            "phase4_entrypoint": str(PHASE4_QUERY),
            "requested": {
                # Phase 4
                "k": args.k,
                "overfetch": args.overfetch,
                "where": parse_where(args.where) if args.where else None,
                "include_docs": bool(args.include_docs),
                "use_highlights": bool(args.use_highlights),

                # Phase 6
                "knowledge_path": str(knowledge_path),
                "top_ku": int(args.top_ku),

                # Phase 7
                "reasoning_path": str(reasoning_path),
                "top_edges": int(args.top_edges),
            },
        },
        "retrieval": {
            "phase4_payload": phase4_payload,
            "stats": retrieval_stats,
        },
        "knowledge_units": {
            "hits": ku_hits,
            "stats": ku_stats,
        },
        "reasoning_edges": {
            "edges": edge_hits,
            "stats": edge_stats,
        },
        "vocab_bridge": {
            "query_terms": [],
            "mapped_terms": [],
            "unmapped_terms": [],
            "method": "not_implemented_yet",
        },
        "coverage_summary": {
            "coverage_grade": grade,
            "coverage_rationale": [
                f"retrieved_chunks={retrieval_stats['n_returned']}",
                f"distinct_docs={retrieval_stats['distinct_docs']}",
                f"ku_hits={ku_n}",
                f"reason_edges={edge_n}",
                f"distance_min={dist_min:.3f}",
                f"semantic_relevant={is_semantically_relevant}",
            ],
            "gaps": [],
            "explicit_limitations": [
                "Vector similarity indicates proximity, not entailment.",
                "Report mode is diagnostic only; no synthesis is performed.",
            ],
        },
        "limitations": [
            "Report does not modify corpus/embeddings/knowledge store.",
            "Report does not perform generative interpretation.",
            "Phase 9A: Knowledge Units are surfaced via overlap + lexical scoring; reasoning edges are filtered by surfaced KU ids.",
        ],
    }

    # Deterministic gaps
    if retrieval_stats["n_returned"] == 0:
        report["coverage_summary"]["gaps"].append("No retrieved chunks after Phase 4 filtering.")
    elif retrieval_stats["distinct_docs"] <= 1:
        report["coverage_summary"]["gaps"].append("Low document diversity in retrieved evidence (<=1 source).")

    if retrieval_stats["n_returned"] > 0 and ku_n == 0:
        report["coverage_summary"]["gaps"].append(
            "Retrieved evidence exists, but no promoted Knowledge Units surfaced (yet)."
        )

    if ku_n > 0 and edge_n == 0:
        report["coverage_summary"]["gaps"].append(
            "Promoted Knowledge Units surfaced, but no reasoning edges connect them (yet)."
        )

    return report


def validate_report_minimal(report: Dict[str, Any]) -> None:
    required_top = [
        "query",
        "timestamp_utc",
        "inputs",
        "retrieval",
        "knowledge_units",
        "reasoning_edges",
        "vocab_bridge",
        "coverage_summary",
        "limitations",
    ]
    for k in required_top:
        if k not in report:
            raise ValueError(f"Report missing required top-level key: {k}")

    if not isinstance(report["retrieval"], dict) or "phase4_payload" not in report["retrieval"]:
        raise ValueError("Report missing retrieval.phase4_payload")
    if not isinstance(report["retrieval"].get("stats"), dict):
        raise ValueError("Report missing retrieval.stats")

    if not isinstance(report.get("knowledge_units"), dict):
        raise ValueError("Report missing knowledge_units")
    if not isinstance(report["knowledge_units"].get("hits", []), list):
        raise ValueError("Report knowledge_units.hits must be a list")
    if not isinstance(report["knowledge_units"].get("stats", {}), dict):
        raise ValueError("Report knowledge_units.stats must be an object")

    if not isinstance(report.get("reasoning_edges"), dict):
        raise ValueError("Report missing reasoning_edges")
    if not isinstance(report["reasoning_edges"].get("edges", []), list):
        raise ValueError("Report reasoning_edges.edges must be a list")
    if not isinstance(report["reasoning_edges"].get("stats", {}), dict):
        raise ValueError("Report reasoning_edges.stats must be an object")


# ----------------------------
# Rendering
# ----------------------------

def render_markdown(report: Dict[str, Any]) -> str:
    q = report["query"]
    cov = report["coverage_summary"]["coverage_grade"]
    stats = report["retrieval"]["stats"]
    n = stats.get("n_returned", 0)
    d = stats.get("distinct_docs", 0)

    lines: List[str] = []
    lines.append("# God-Learn REPORT")
    lines.append("")
    lines.append(f"**Query:** {q}")
    lines.append(f"**Coverage:** `{cov}`")
    lines.append("")
    lines.append("## Retrieval (Phase 4)")
    lines.append(f"- Retrieved chunks: **{n}**")
    lines.append(f"- Distinct documents: **{d}**")
    lines.append("")

    phase4 = report["retrieval"]["phase4_payload"]
    results = phase4.get("results", []) or []
    if not results:
        lines.append("_No results._")
        lines.append("")
    else:
        lines.append("### Top evidence")
        for r in results[: min(8, len(results))]:
            if not isinstance(r, dict):
                continue
            chunk_id = r.get("chunk_id", "UNKNOWN")
            dist = r.get("distance", "NA")
            path_rel = r.get("path_rel", "UNKNOWN_PATH")
            ps = r.get("page_start", "NA")
            pe = r.get("page_end", "NA")
            lines.append(f"- `{chunk_id}`  dist={dist}  **{path_rel}**  pages={ps}-{pe}")
        lines.append("")

    # Knowledge Units (Phase 6) — FIXED indentation (always printed once)
    lines.append("## Knowledge Units (Phase 6)")
    ku_stats = report.get("knowledge_units", {}).get("stats", {}) or {}
    ku_hits = report.get("knowledge_units", {}).get("hits", []) or []
    lines.append(f"- Total KUs: **{ku_stats.get('n_total', 0)}**")
    lines.append(f"- Positive-scored KUs: **{ku_stats.get('n_scored_positive', 0)}**")
    lines.append(f"- Overlap (chunk): **{ku_stats.get('n_overlap_chunk', 0)}**")
    lines.append(f"- Overlap (doc): **{ku_stats.get('n_overlap_doc', 0)}**")
    lines.append("")

    if not ku_hits:
        lines.append("_No KU hits._")
        lines.append("")
    else:
        lines.append("### Top KUs")
        for ku in ku_hits[: min(8, len(ku_hits))]:
            kid = ku.get("knowledge_id", "UNKNOWN")
            score = ku.get("score", 0)
            overlap = ku.get("overlap", {}) or {}
            och = "Y" if overlap.get("chunk") else "N"
            odo = "Y" if overlap.get("doc") else "N"
            claim = (ku.get("claim") or "").replace("\n", " ").strip()
            lines.append(f"- `{kid}` score={score} overlap(chunk={och},doc={odo}) — {claim[:180]}")
        lines.append("")

    # Reasoning edges (Phase 7)
    lines.append("## Reasoning Edges (Phase 7)")
    e_stats = report.get("reasoning_edges", {}).get("stats", {}) or {}
    e_hits = report.get("reasoning_edges", {}).get("edges", []) or []
    lines.append(f"- Total edges: **{e_stats.get('n_total', 0)}**")
    lines.append(f"- Matching edges: **{e_stats.get('n_hits', 0)}**")
    by_rel = e_stats.get("by_relation", {}) or {}
    if by_rel:
        rel_bits = ", ".join([f"{k}={v}" for k, v in by_rel.items()])
        lines.append(f"- By relation: {rel_bits}")
    lines.append("")

    if not e_hits:
        lines.append("_No reasoning edges matched surfaced KUs._")
        lines.append("")
    else:
        lines.append("### Top edges")
        for e in e_hits[: min(10, len(e_hits))]:
            rid = e.get("reason_id", "UNKNOWN")
            rel = e.get("relation", "UNKNOWN")
            kids = e.get("knowledge_ids", [])
            kids_show = ", ".join(kids[:2]) + ("..." if len(kids) > 2 else "")
            lines.append(f"- `{rid}` **{rel}** — {kids_show}")
        lines.append("")

    gaps = report["coverage_summary"].get("gaps", []) or []
    if gaps:
        lines.append("## Gaps / limitations (diagnostic)")
        for g in gaps:
            lines.append(f"- {g}")
        lines.append("")

    lines.append("## Notes")
    for lim in report.get("limitations", []):
        lines.append(f"- {lim}")
    lines.append("")

    return "\n".join(lines)


# ----------------------------
# CLI
# ----------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Phase 9A: REPORT mode (read-only diagnostics)")
    ap.add_argument("--query", required=True, help="Natural-language query string")
    ap.add_argument("--format", choices=["json", "md"], default="json", help="Output format")
    ap.add_argument("--out", default=None, help="Optional path to write output (otherwise stdout)")

    # Retrieval knobs (match Phase 4)
    ap.add_argument("--k", type=int, default=8, help="Top-K results")
    ap.add_argument("--overfetch", type=int, default=8, help="Retrieve k*overfetch then filter down to k")
    ap.add_argument(
        "--where",
        default='{"collection":"rhetorical_ontology"}',
        help="Chroma where-filter JSON (string). Default matches run_query_and_synthesize.sh",
    )

    # include_docs: default True, allow explicit disable
    g_docs = ap.add_mutually_exclusive_group()
    g_docs.add_argument("--include_docs", action="store_true", help="Include chunk documents in Phase 4 payload")
    g_docs.add_argument("--no_include_docs", action="store_true", help="Do NOT include chunk documents in Phase 4 payload")

    ap.add_argument("--embed_url", default=None, help="Override embed url (optional)")
    ap.add_argument("--chroma_dir", default=None, help="Override chroma dir (optional)")
    ap.add_argument("--collection", default=None, help="Override collection name (optional)")

    # Phase 4 filters passthrough
    ap.add_argument("--require_my_copy", action="store_true", help="Filter to is_my_copy==True (if present)")
    ap.add_argument("--keep_biblio", action="store_true", help="Do not drop bibliography-like chunks")
    ap.add_argument("--collection_filter", default=None, help="Post-filter: metadata.collection must equal this")

    # Optional highlight rerank passthrough (still deterministic)
    ap.add_argument("--use_highlights", action="store_true", help="Enable highlight-based rerank (Phase 5 signal)")
    ap.add_argument("--highlights_index", default=None, help="Path to highlight index JSON")
    ap.add_argument("--highlight_alpha", type=float, default=0.02)
    ap.add_argument("--highlight_cap", type=int, default=5)

    # Phase 6 (read-only): Knowledge Unit surfacing
    ap.add_argument("--knowledge_path", default="god-learn/knowledge.jsonl",
                    help="Path to knowledge.jsonl (repo-relative or absolute)")
    ap.add_argument("--top_ku", type=int, default=20,
                    help="Max Knowledge Units to include in report")

    # Phase 7 (read-only): Reasoning graph
    ap.add_argument("--reasoning_path", default="god-reason/reasoning.jsonl",
                    help="Path to reasoning.jsonl (repo-relative or absolute)")
    ap.add_argument("--top_edges", type=int, default=30,
                    help="Max reasoning edges to include in report")

    args = ap.parse_args()

    # Default include_docs to True unless explicitly disabled
    if args.no_include_docs:
        args.include_docs = False
    elif not getattr(args, "include_docs", False):
        args.include_docs = True

    # Validate where JSON early
    try:
        _ = parse_where(args.where) if args.where else None
    except Exception as ex:
        eprint(f"[ERROR] {ex}")
        return 2

    # Run Phase 4 retrieval
    try:
        phase4_payload = run_phase4_query_chunks(args)
    except Exception as ex:
        eprint(str(ex))
        return 3

    report = build_report_envelope(args.query, phase4_payload, args)
    try:
        validate_report_minimal(report)
    except Exception as ex:
        eprint(f"[ERROR] Report validation failed: {ex}")
        return 4

    if args.format == "json":
        out_text = json.dumps(report, ensure_ascii=False, indent=2)
    else:
        out_text = render_markdown(report)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(out_text, encoding="utf-8")
    else:
        print(out_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
