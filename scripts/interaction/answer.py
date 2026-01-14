#!/usr/bin/env python3
"""
Phase 9B — ANSWER (deterministic baseline) + Phase 9C (optional synthesis)

Goal:
- Build an AnswerEnvelope using the locked schema.
- Read-only over Phases 1–8 artifacts (via Phase 9A REPORT).
- Present layered output: evidence, knowledge units, reasoning edges.

Phase 9B (default):
- Deterministic, non-LLM.
- Synthesis present but disabled.

Phase 9C (optional, explicitly enabled):
- Controlled LLM synthesis that MUST:
  - Consume ONLY report_snapshot (no re-querying corpus/vector DB).
  - Emit structured JSON claims (not free prose).
  - Enforce grounding against IDs present in report_snapshot layers.
  - Interact correctly with --strict.

Strict mode (Phase 9B + 9C):
- Never hides data.
- Computes provenance diagnostics and attaches them to the envelope.
- Exits with code 2 if provenance checks fail (and still prints/writes output).
- If synthesis enabled: exits 2 if any *assertion* lacks grounding after enforcement.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path


# ----------------------------
# SIGPIPE hygiene (avoid BrokenPipe spam)
# ----------------------------
def _install_sigpipe_guard() -> None:
    try:
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    except Exception:
        pass


# ----------------------------
# Report acquisition
# ----------------------------
def _try_import_report_builder() -> Optional[Any]:
    """
    Preferred path (once you refactor report.py):
      from scripts.interaction.report import build_report_envelope
    Fallback handled elsewhere if this import fails.
    """
    try:
        from scripts.interaction.report import build_report_envelope  # type: ignore
        return build_report_envelope
    except Exception:
        return None


def _run_report_subprocess(query: str, include_docs: bool, k: int, overfetch: int) -> Dict[str, Any]:
    """
    Fallback mode: call report.py --format json and parse stdout.
    This keeps answer.py working even before you refactor report.py into a library.
    """
    report_py = os.path.join("scripts", "interaction", "report.py")
    if not os.path.exists(report_py):
        raise FileNotFoundError(f"Missing {report_py}. Cannot build ANSWER without REPORT.")

    cmd = [
        sys.executable,
        report_py,
        "--query",
        query,
        "--format",
        "json",
        "--k",
        str(k),
        "--overfetch",
        str(overfetch),
    ]
    if not include_docs:
        cmd.append("--no_include_docs")

    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if p.returncode != 0:
        raise RuntimeError(
            "REPORT subprocess failed.\n"
            f"cmd: {' '.join(cmd)}\n"
            f"stderr:\n{p.stderr.strip()}\n"
        )

    try:
        return json.loads(p.stdout)
    except Exception as e:
        raise RuntimeError(
            "Failed to parse REPORT JSON from stdout.\n"
            f"error: {e}\n"
            f"stdout head:\n{p.stdout[:500]}"
        )


# ----------------------------
# Best-effort quote extraction
# ----------------------------
def _extract_text_from_obj(o: Dict[str, Any]) -> str:
    """
    We do NOT assume a single canonical key name for text because Phase 4 payload
    shapes vary. We try common candidates and fallback gracefully.
    """
    for key in ("text", "content", "chunk_text", "page_text", "snippet", "raw_text"):
        v = o.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()

    chunk = o.get("chunk")
    if isinstance(chunk, dict):
        for key in ("text", "content", "chunk_text"):
            v = chunk.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()

    return ""


def _trim_quote(s: str, max_chars: int = 360) -> str:
    s = " ".join(s.split())
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 1].rstrip() + "…"


def _coerce_pages(o: Dict[str, Any]) -> Tuple[Optional[int], Optional[int]]:
    """
    Attempt to coerce page ranges from known keys.
    """
    pages = o.get("pages")
    if isinstance(pages, list) and len(pages) >= 2:
        a, b = pages[0], pages[1]
        if isinstance(a, int) and isinstance(b, int):
            return a, b

    for a_key, b_key in (("page_start", "page_end"), ("p_start", "p_end"), ("start_page", "end_page")):
        a = o.get(a_key)
        b = o.get(b_key)
        if isinstance(a, int) and isinstance(b, int):
            return a, b

    p = o.get("page")
    if isinstance(p, int):
        return p, p

    return None, None


def _coerce_doc_path(o: Dict[str, Any]) -> str:
    # Phase 4 payload in your system uses path_rel
    for key in (
        "path_rel",  # <-- your actual key
        "path_abs",
        "doc_path",
        "doc_rel",
        "doc_relpath",
        "pdf_rel",
        "pdf_relpath",
        "path",
        "source",
        "document",
        "pdf_path",
    ):
        v = o.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()

    meta = o.get("meta")
    if isinstance(meta, dict):
        for key in ("path_rel", "path", "doc_path", "pdf_path"):
            v = meta.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()

    doc = o.get("doc")
    if isinstance(doc, dict):
        for key in ("path_rel", "path", "relpath", "doc_path"):
            v = doc.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()

    return ""


def _coerce_chunk_id(o: Dict[str, Any]) -> str:
    for key in ("chunk_id", "id", "chunk", "chunk_uid"):
        v = o.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


# ----------------------------
# AnswerEnvelope builder
# ----------------------------
def build_answer_envelope(report: Dict[str, Any], *, max_evidence: int) -> Dict[str, Any]:
    query = report.get("query", "")
    ts = datetime.now(timezone.utc).isoformat()

    # ---- Evidence layer (from Phase 4 payload inside report)
    evidence_items: List[Dict[str, Any]] = []

    phase4 = None
    retrieval = report.get("retrieval")
    if isinstance(retrieval, dict):
        phase4 = retrieval.get("phase4_payload")

    candidates: List[Dict[str, Any]] = []
    if isinstance(phase4, dict):
        for key in ("chunks", "results", "items", "top_k", "hits"):
            v = phase4.get(key)
            if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
                candidates = v
                break

    if not candidates and isinstance(phase4, list) and all(isinstance(x, dict) for x in phase4):
        candidates = phase4

    for o in candidates[:max_evidence]:
        chunk_id = _coerce_chunk_id(o)
        doc_path = _coerce_doc_path(o)
        p0, p1 = _coerce_pages(o)
        text = _extract_text_from_obj(o)
        quote = _trim_quote(text) if text else ""

        evidence_items.append(
            {
                "chunk_id": chunk_id or "(unknown_chunk_id)",
                "doc_path": doc_path or "(unknown_doc_path)",
                "pages": [p0 if p0 is not None else -1, p1 if p1 is not None else -1],
                "quote": quote,
            }
        )

    # ---- Knowledge Units layer
    ku_items: List[Dict[str, Any]] = []
    knowledge_units = report.get("knowledge_units")
    if isinstance(knowledge_units, dict):
        hits = knowledge_units.get("hits")
        if isinstance(hits, list):
            for h in hits:
                if not isinstance(h, dict):
                    continue
                ku_id = h.get("knowledge_id") or h.get("ku_id") or h.get("id")
                claim = h.get("claim") or h.get("text") or ""
                if isinstance(ku_id, str) and ku_id:
                    ku_items.append({"ku_id": ku_id, "claim": claim if isinstance(claim, str) else ""})

    # ---- Reasoning edges layer
    edge_items: List[Dict[str, Any]] = []
    reasoning = report.get("reasoning_edges")
    if isinstance(reasoning, dict):
        edges = reasoning.get("edges")
        if isinstance(edges, list):
            for e in edges:
                if not isinstance(e, dict):
                    continue
                edge_id = e.get("reason_id") or e.get("edge_id") or e.get("id")
                relation = e.get("relation")
                knowledge_ids = e.get("knowledge_ids") or e.get("knowledge_units") or []
                if not isinstance(knowledge_ids, list):
                    knowledge_ids = []
                if isinstance(edge_id, str) and edge_id and isinstance(relation, str) and relation:
                    edge_items.append(
                        {
                            "edge_id": edge_id,
                            "relation": relation,
                            "knowledge_ids": [x for x in knowledge_ids if isinstance(x, str)],
                        }
                    )

    # ---- Warnings
    warnings: List[str] = []
    if isinstance(knowledge_units, dict):
        stats = knowledge_units.get("stats")
        if isinstance(stats, dict):
            overlap = stats.get("overlap_hits")
            if overlap == 0:
                warnings.append(
                    "KU provenance overlap is 0; KU surfacing may be lexical-only "
                    "(expected if provenance fields are absent)."
                )

    answer: Dict[str, Any] = {
        "query": query,
        "timestamp_utc": ts,
        "report_snapshot": report,
        "layers": {
            "evidence": evidence_items,
            "knowledge_units": ku_items,
            "reasoning_edges": edge_items,
            # Synthesis is present in the schema, but disabled in Phase 9B baseline.
            "synthesis": {
                "enabled": False,
                "text": "",
                "claims": [],
            },
        },
        "claim_map": [],
        "warnings": warnings,
        # present but filled only if --strict
        "strict_diagnostics": None,
    }

    return answer


def compute_strict_diagnostics(answer: Dict[str, Any]) -> Dict[str, Any]:
    """
    Strict = provenance completeness checks.
    Never removes data; only reports problems.

    NOTE: This function is Phase 9B's provenance checker (evidence completeness).
    Phase 9C adds an additional strict gate for synthesis grounding (handled in main()).
    """
    issues: List[Dict[str, Any]] = []

    ev = answer.get("layers", {}).get("evidence", [])
    if isinstance(ev, list):
        for e in ev:
            if not isinstance(e, dict):
                continue
            chunk_id = e.get("chunk_id")
            doc_path = e.get("doc_path")
            pages = e.get("pages")

            missing: List[str] = []
            if not (isinstance(chunk_id, str) and chunk_id and chunk_id != "(unknown_chunk_id)"):
                missing.append("chunk_id")
            if not (isinstance(doc_path, str) and doc_path and doc_path != "(unknown_doc_path)"):
                missing.append("doc_path")
            if (
                not isinstance(pages, list)
                or len(pages) < 2
                or not all(isinstance(x, int) for x in pages[:2])
                or pages[0] < 0
                or pages[1] < 0
            ):
                missing.append("pages")

            if missing:
                issues.append(
                    {
                        "layer": "evidence",
                        "chunk_id": chunk_id if isinstance(chunk_id, str) else "",
                        "doc_path": doc_path if isinstance(doc_path, str) else "",
                        "pages": pages if isinstance(pages, list) else [],
                        "missing": missing,
                    }
                )

    return {
        "ok": len(issues) == 0,
        "issue_count": len(issues),
        "issues": issues,
    }


# ----------------------------
# Formatting
# ----------------------------
def _shorten_path(p: str, keep: int = 2) -> str:
    """
    Render a compact path for MD display while preserving the full value.
    Example:
      rhetorical_ontology/foo/bar/baz.pdf -> rhetorical_ontology/…/baz.pdf
    """
    if not p or "/" not in p:
        return p
    parts = p.split("/")
    if len(parts) <= keep + 1:
        return p
    return f"{parts[0]}/…/{parts[-1]}"


def render_md(answer: Dict[str, Any], *, max_evidence: int, max_edges: int = 30) -> str:
    q = answer.get("query", "")
    ts = answer.get("timestamp_utc", "")
    lines: List[str] = []

    sd = answer.get("strict_diagnostics")

    # ---- Header
    lines.append("# God-Learn ANSWER")
    lines.append("")
    lines.append(f"**Query:** {q}")
    lines.append(f"**Timestamp (UTC):** {ts}")
    lines.append("")

    # ---- Summary
    ev_n = len(answer.get("layers", {}).get("evidence", []) or [])
    ku_n = len(answer.get("layers", {}).get("knowledge_units", []) or [])
    ed_n = len(answer.get("layers", {}).get("reasoning_edges", []) or [])

    lines.append("## Summary")
    lines.append(f"- Evidence: **{ev_n}**")
    lines.append(f"- Knowledge Units: **{ku_n}**")
    lines.append(f"- Reasoning Edges: **{ed_n}**")
    if isinstance(sd, dict):
        lines.append(f"- Strict (provenance): **{'OK' if sd.get('ok') else 'FAIL'}**")
    # Synthesis summary
    syn = answer.get("layers", {}).get("synthesis", {})
    syn_enabled = bool(isinstance(syn, dict) and syn.get("enabled"))
    lines.append(f"- Synthesis: **{'ENABLED' if syn_enabled else 'DISABLED'}**")
    lines.append("")

    # ---- Strict Diagnostics (if present)
    if isinstance(sd, dict):
        lines.append("## Strict Diagnostics")
        ok = sd.get("ok")
        n = sd.get("issue_count", 0)
        if ok is True:
            lines.append("- ✅ Provenance checks: OK")
        else:
            lines.append(f"- ❌ Provenance checks: FAIL ({n} issue(s))")
            issues = sd.get("issues", [])
            if isinstance(issues, list):
                for it in issues[:20]:
                    if not isinstance(it, dict):
                        continue
                    cid = it.get("chunk_id") or "(unknown)"
                    miss = it.get("missing") or []
                    miss_s = ", ".join(miss) if isinstance(miss, list) else str(miss)
                    lines.append(f"  - {cid}: missing {miss_s}")
                if len(issues) > 20:
                    lines.append(f"  - …and {len(issues)-20} more")
        lines.append("")

    # ---- Warnings
    warnings = answer.get("warnings") or []
    if isinstance(warnings, list) and warnings:
        lines.append("## Warnings")
        for w in warnings:
            if isinstance(w, str) and w.strip():
                lines.append(f"- {w.strip()}")
        lines.append("")

    # ---- Evidence
    lines.append("## Evidence (Phase 4)")
    ev = answer.get("layers", {}).get("evidence", [])
    if not ev:
        lines.append("_No evidence returned._")
    else:
        for i, e in enumerate(ev[:max_evidence], 1):
            chunk_id = e.get("chunk_id", "(unknown)")
            doc_path = e.get("doc_path", "")
            pages = e.get("pages", [-1, -1])
            quote = e.get("quote", "")

            p0, p1 = (-1, -1)
            if isinstance(pages, list) and len(pages) >= 2:
                p0, p1 = pages[0], pages[1]

            lines.append(f"**E{i}. {chunk_id}**")
            if doc_path:
                lines.append(f"- **Document:** `{_shorten_path(doc_path)}`")
            lines.append(f"- **Pages:** {p0}–{p1}")
            if isinstance(quote, str) and quote.strip():
                lines.append(f"> {quote}")
            lines.append("")

    # ---- Knowledge Units
    lines.append("## Knowledge Units (Phase 6)")
    kus = answer.get("layers", {}).get("knowledge_units", [])
    if not kus:
        lines.append("_No knowledge units surfaced._")
    else:
        for i, ku in enumerate(kus, 1):
            ku_id = ku.get("ku_id", "(unknown)")
            claim = ku.get("claim", "")
            lines.append(f"{i}. **{ku_id}** — {claim}")
    lines.append("")

    # ---- Reasoning Edges
    lines.append("## Reasoning Edges (Phase 7)")
    edges = answer.get("layers", {}).get("reasoning_edges", [])
    if not edges:
        lines.append("_No reasoning edges matched._")
    else:
        for i, e in enumerate(edges[:max_edges], 1):
            edge_id = e.get("edge_id", "(unknown)")
            rel = e.get("relation", "(unknown)")
            k_ids = e.get("knowledge_ids", [])
            if not isinstance(k_ids, list):
                k_ids = []
            kid_str = ", ".join(k_ids[:6]) + ("…" if len(k_ids) > 6 else "")
            lines.append(f"{i}. **{edge_id}** ({rel})")
            if kid_str:
                lines.append(f"   - KUs: {kid_str}")
    lines.append("")

    # ---- Synthesis
    lines.append("## Synthesis")
    synthesis = answer.get("layers", {}).get("synthesis", {})
    if not (isinstance(synthesis, dict) and synthesis.get("enabled")):
        lines.append("_Disabled in deterministic Phase 9B baseline._")
        lines.append("")
    else:
        claims = synthesis.get("claims", [])
        if not isinstance(claims, list) or not claims:
            lines.append("_Enabled, but no claims produced._")
            lines.append("")
        else:
            for i, c in enumerate(claims, 1):
                if not isinstance(c, dict):
                    continue
                cid = c.get("claim_id", f"c{i}")
                ctype = c.get("type", "assertion")
                text = c.get("text", "")
                supports = c.get("supports", [])
                if not isinstance(supports, list):
                    supports = []
                sup_s = ", ".join(str(x) for x in supports) if supports else "(none)"
                lines.append(f"{i}. **{cid}** [{ctype}] — {text}")
                lines.append(f"   - supports: {sup_s}")
            lines.append("")

    # ---- Claim Map
    lines.append("## Claim Map")
    cm = answer.get("claim_map", [])
    if not isinstance(cm, list) or not cm:
        lines.append("_Empty._")
        lines.append("")
    else:
        for it in cm:
            if not isinstance(it, dict):
                continue
            cid = it.get("claim_id", "(unknown)")
            ctype = it.get("type", "")
            gb = it.get("grounded_by", [])
            if not isinstance(gb, list):
                gb = []
            gb_s = ", ".join(str(x) for x in gb) if gb else "(none)"
            if ctype:
                lines.append(f"- **{cid}** [{ctype}] → {gb_s}")
            else:
                lines.append(f"- **{cid}** → {gb_s}")
        lines.append("")

    return "\n".join(lines)


# ----------------------------
# Phase 9C integration
# ----------------------------
def _apply_synthesis_if_enabled(answer: Dict[str, Any], *, llm_cmd: Optional[str], llm_timeout_s: int) -> None:
    """
    Mutates ONLY the AnswerEnvelope (in-memory).
    Does NOT touch Phase 1–8 artifacts.
    Consumes ONLY answer['report_snapshot'].
    """
    from synthesize import synthesize_claims, enforce_grounding  # type: ignore

    report_snapshot = answer.get("report_snapshot", {}) or {}
    query = answer.get("query", "") or ""

    syn_out = synthesize_claims(
        query=query,
        report_snapshot=report_snapshot,
        llm_cmd_raw=llm_cmd,
        timeout_s=int(llm_timeout_s),
    )

    grounded = enforce_grounding(
        synthesis=syn_out.synthesis,
        report_snapshot=report_snapshot,
    )

    # Attach synthesis (schema location: layers.synthesis)
    answer.setdefault("layers", {})
    answer["layers"]["synthesis"] = {
        "enabled": True,
        "text": "",  # reserved for Phase 10 rhetorical rendering
        "claims": grounded.synthesis.get("claims", []) or [],
    }

    # Build claim_map
    claim_map: List[Dict[str, Any]] = []
    for c in grounded.synthesis.get("claims", []) or []:
        if not isinstance(c, dict):
            continue
        claim_map.append(
            {
                "claim_id": c.get("claim_id"),
                "grounded_by": c.get("supports", []) or [],
                "type": c.get("type"),
            }
        )
    answer["claim_map"] = claim_map

    # Merge warnings
    answer.setdefault("warnings", [])
    if isinstance(answer["warnings"], list):
        answer["warnings"].extend(grounded.warnings)


def _strict_synthesis_grounding_ok(answer: Dict[str, Any]) -> bool:
    """
    In --strict mode with synthesis enabled:
    FAIL if any claim of type 'assertion' has no supports.
    (Inferences are allowed, but must be explicitly typed as inference.)
    """
    syn = answer.get("layers", {}).get("synthesis", {})
    if not (isinstance(syn, dict) and syn.get("enabled")):
        return True

    claims = syn.get("claims", [])
    if not isinstance(claims, list):
        return True

    bad: List[str] = []
    for c in claims:
        if not isinstance(c, dict):
            continue
        if (c.get("type") or "").strip() != "assertion":
            continue
        supports = c.get("supports", [])
        if not isinstance(supports, list) or len(supports) == 0:
            bad.append(str(c.get("claim_id") or "(unknown)"))

    if bad:
        answer.setdefault("warnings", [])
        if isinstance(answer["warnings"], list):
            answer["warnings"].append(
                "Strict synthesis grounding failed: ungrounded assertion(s): " + ", ".join(bad)
            )
        return False

    return True

def _strict_synthesis_no_inferences_ok(answer: Dict[str, Any]) -> bool:
    """
    If enabled by CLI: fail strict if ANY claim is type=inference.
    """
    syn = answer.get("layers", {}).get("synthesis", {})
    if not (isinstance(syn, dict) and syn.get("enabled")):
        return True

    claims = syn.get("claims", [])
    if not isinstance(claims, list):
        return True

    bad: List[str] = []
    for c in claims:
        if not isinstance(c, dict):
            continue
        if (c.get("type") or "").strip() == "inference":
            bad.append(str(c.get("claim_id") or "(unknown)"))

    if bad:
        answer.setdefault("warnings", [])
        if isinstance(answer["warnings"], list):
            answer["warnings"].append(
                "Strict inference gate failed: inference claim(s) present: " + ", ".join(bad)
            )
        return False

    return True

# ----------------------------
# CLI
# ----------------------------
def main() -> int:
    _install_sigpipe_guard()

    ap = argparse.ArgumentParser(description="Phase 9B ANSWER (deterministic) with optional Phase 9C synthesis")
    ap.add_argument("--query", required=True, help="User query string")
    ap.add_argument("--format", choices=["json", "md"], default="md", help="Output format")
    ap.add_argument("--out", default="", help="Write output to a file path (optional)")
    ap.add_argument("--max_evidence", type=int, default=8, help="Max evidence items to include")
    ap.add_argument("--k", type=int, default=8, help="Pass-through to REPORT/Phase 4 retrieval")
    ap.add_argument("--overfetch", type=int, default=8, help="Pass-through to REPORT/Phase 4 retrieval")
    ap.add_argument("--no_include_docs", action="store_true", help="Pass-through to REPORT")
    ap.add_argument("--strict", action="store_true", help="Fail (exit 2) on strict checks, but still print output.")
    ap.add_argument("--max_edges", type=int, default=30, help="Max reasoning edges to print in md")

    # Phase 9C flags
    ap.add_argument("--enable_synthesis", action="store_true", help="Enable Phase 9C synthesis (default off).")
    ap.add_argument("--llm_cmd", type=str, default=None, help="External LLM command (or set GOD_LEARN_LLM_CMD).")
    ap.add_argument("--llm_timeout_s", type=int, default=120, help="LLM timeout seconds (default 120).")
        # Phase 9C caching + stricter strict
    ap.add_argument("--synthesis_cache_in", default="", help="Load synthesis JSON from file (skip LLM).")
    ap.add_argument("--synthesis_cache_out", default="", help="Write grounded synthesis JSON to file.")
    ap.add_argument(
        "--strict_inferences_fail",
        action="store_true",
        help="With --strict and synthesis enabled: fail if ANY claim is type=inference.",
    )


    args = ap.parse_args()
    include_docs = not args.no_include_docs

    # Build REPORT (required dependency)
    builder = _try_import_report_builder()
    if builder is not None:
        try:
            report = builder(
                query=args.query,
                k=args.k,
                overfetch=args.overfetch,
                include_docs=include_docs,
            )
        except TypeError:
            report = _run_report_subprocess(
                query=args.query,
                include_docs=include_docs,
                k=args.k,
                overfetch=args.overfetch,
            )
    else:
        report = _run_report_subprocess(
            query=args.query,
            include_docs=include_docs,
            k=args.k,
            overfetch=args.overfetch,
        )

    # Build deterministic AnswerEnvelope
    answer = build_answer_envelope(report, max_evidence=args.max_evidence)

    # Optional Phase 9C synthesis (mutates ONLY the envelope)
    if args.enable_synthesis:
        _apply_synthesis_if_enabled(answer, llm_cmd=args.llm_cmd, llm_timeout_s=int(args.llm_timeout_s))

    # Strict checks
    exit_code = 0
    if args.strict:
        sd = compute_strict_diagnostics(answer)
        answer["strict_diagnostics"] = sd

        ok = bool(sd.get("ok", False))
        if not ok:
            exit_code = 2

        # Additional strict gate if synthesis enabled
        if args.enable_synthesis:
            if not _strict_synthesis_grounding_ok(answer):
                exit_code = 2
            if args.strict_inferences_fail:
                if not _strict_synthesis_no_inferences_ok(answer):
                    exit_code = 2


    # Render
    if args.format == "json":
        out_s = json.dumps(answer, ensure_ascii=False, indent=2)
    else:
        out_s = render_md(answer, max_evidence=args.max_evidence, max_edges=args.max_edges)

    # Write/print (always)
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out_s)
            if not out_s.endswith("\n"):
                f.write("\n")
    else:
        try:
            print(out_s)
        except BrokenPipeError:
            return 0

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
