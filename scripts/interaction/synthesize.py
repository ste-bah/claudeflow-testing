#!/usr/bin/env python3
"""
Phase 9C synthesis (controlled, claim-structured, grounding-enforced).

Hard invariants:
- Consumes ONLY the report_snapshot already built by Phase 9A/9B.
- Never re-queries corpus / vector DB / knowledge / reasoning.
- Produces structured claims, then enforces grounding.

This module is called by scripts/interaction/answer.py when --enable_synthesis is set.

Public API:
- synthesize_claims(query, report_snapshot, llm_cmd_raw, timeout_s) -> SynthesisOutcome
- enforce_grounding(synthesis, report_snapshot) -> SynthesisOutcome
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from llm_cmd import get_llm_cmd, run_llm_cmd



# ----------------------------
# Types
# ----------------------------
@dataclass
class SynthesisOutcome:
    synthesis: Dict[str, Any]
    warnings: List[str]


# ----------------------------
# Helpers: collect valid support IDs from report_snapshot
# ----------------------------
def _collect_valid_support_ids(report_snapshot: Dict[str, Any]) -> Tuple[Set[str], Set[str], Set[str]]:
    """
    Collect valid IDs from the REPORT snapshot.

    Supports BOTH possible shapes:
    A) REPORT-style (what your JSON shows):
       - retrieval.phase4_payload.results[].chunk_id
       - knowledge_units.hits[].knowledge_id
       - reasoning_edges.edges[].reason_id
    B) layer-style (if you ever embed trimmed layer arrays in report_snapshot):
       - layers.evidence[].chunk_id
       - layers.knowledge_units[].knowledge_id / ku_id
       - layers.reasoning_edges[].reason_id / ru_id
    """
    chunk_ids: Set[str] = set()
    ku_ids: Set[str] = set()
    ru_ids: Set[str] = set()

    # ---- A) REPORT-style: retrieval.phase4_payload.results
    retrieval = report_snapshot.get("retrieval")
    if isinstance(retrieval, dict):
        p4 = retrieval.get("phase4_payload")
        if isinstance(p4, dict):
            results = p4.get("results")
            if isinstance(results, list):
                for r in results:
                    if not isinstance(r, dict):
                        continue
                    cid = r.get("chunk_id")
                    if isinstance(cid, str) and cid.strip():
                        chunk_ids.add(cid.strip())

    # ---- A) REPORT-style: knowledge_units.hits
    kus = report_snapshot.get("knowledge_units")
    if isinstance(kus, dict):
        hits = kus.get("hits")
        if isinstance(hits, list):
            for h in hits:
                if not isinstance(h, dict):
                    continue
                kid = h.get("knowledge_id") or h.get("ku_id") or h.get("id")
                if isinstance(kid, str) and kid.strip():
                    ku_ids.add(kid.strip())

    # ---- A) REPORT-style: reasoning_edges.edges
    reas = report_snapshot.get("reasoning_edges")
    if isinstance(reas, dict):
        edges = reas.get("edges")
        if isinstance(edges, list):
            for e in edges:
                if not isinstance(e, dict):
                    continue
                rid = e.get("reason_id") or e.get("ru_id") or e.get("id")
                if isinstance(rid, str) and rid.strip():
                    ru_ids.add(rid.strip())

    # ---- B) Layer-style (optional)
    layers = report_snapshot.get("layers")
    if isinstance(layers, dict):
        ev = layers.get("evidence")
        if isinstance(ev, list):
            for e in ev:
                if not isinstance(e, dict):
                    continue
                cid = e.get("chunk_id") or e.get("id")
                if isinstance(cid, str) and cid.strip():
                    chunk_ids.add(cid.strip())

        lk = layers.get("knowledge_units")
        if isinstance(lk, list):
            for k in lk:
                if not isinstance(k, dict):
                    continue
                kid = k.get("knowledge_id") or k.get("ku_id") or k.get("id")
                if isinstance(kid, str) and kid.strip():
                    ku_ids.add(kid.strip())

        le = layers.get("reasoning_edges")
        if isinstance(le, list):
            for r in le:
                if not isinstance(r, dict):
                    continue
                rid = r.get("reason_id") or r.get("ru_id") or r.get("id")
                if isinstance(rid, str) and rid.strip():
                    ru_ids.add(rid.strip())

    return chunk_ids, ku_ids, ru_ids



# ----------------------------
# Prompt builder
# ----------------------------
def _build_prompt(*, query: str, report_snapshot: Dict[str, Any], max_items: int = 18) -> str:
    # Collect allowed IDs first (now works with your schema)
    chunk_ids, ku_ids, ru_ids = _collect_valid_support_ids(report_snapshot)

    # ---- Evidence table from retrieval.phase4_payload.results
    evidence_tbl: List[Dict[str, Any]] = []
    retrieval = report_snapshot.get("retrieval")
    if isinstance(retrieval, dict):
        p4 = retrieval.get("phase4_payload")
        if isinstance(p4, dict):
            results = p4.get("results")
            if isinstance(results, list):
                for r in results[:max_items]:
                    if not isinstance(r, dict):
                        continue
                    cid = r.get("chunk_id")
                    txt = r.get("text") or ""
                    if isinstance(cid, str) and cid.strip():
                        evidence_tbl.append(
                            {"chunk_id": cid.strip(), "quote": str(txt).replace("\n", " ")[:260]}
                        )

    # ---- KU table from knowledge_units.hits
    ku_tbl: List[Dict[str, Any]] = []
    kus = report_snapshot.get("knowledge_units")
    if isinstance(kus, dict):
        hits = kus.get("hits")
        if isinstance(hits, list):
            for h in hits[:max_items]:
                if not isinstance(h, dict):
                    continue
                kid = h.get("knowledge_id") or h.get("ku_id") or h.get("id")
                claim = h.get("claim") or h.get("text") or ""
                if isinstance(kid, str) and kid.strip():
                    ku_tbl.append({"ku_id": kid.strip(), "claim": str(claim)[:260]})

    # ---- Edge table from reasoning_edges.edges
    edge_tbl: List[Dict[str, Any]] = []
    reas = report_snapshot.get("reasoning_edges")
    if isinstance(reas, dict):
        edges = reas.get("edges")
        if isinstance(edges, list):
            for e in edges[:max_items]:
                if not isinstance(e, dict):
                    continue
                rid = e.get("reason_id") or e.get("edge_id") or e.get("id") or e.get("ru_id")
                rel = e.get("relation") or ""
                kids = e.get("knowledge_ids") or []
                if not isinstance(kids, list):
                    kids = []
                kids = [x for x in kids if isinstance(x, str)]
                if isinstance(rid, str) and rid.strip():
                    edge_tbl.append({"ru_id": rid.strip(), "relation": str(rel), "knowledge_ids": kids[:10]})

    rules = {
        "task": "Return ONLY valid JSON. No prose. No markdown fences.",
        "required_schema": {
            "claims": [
                {
                    "claim_id": "c1",
                    "text": "short, precise claim grounded in the tables",
                    "type": "assertion|inference",
                    "supports": ["chunk_id|ku_id|ru_id"]
                }
            ]
        },
        "hard_rules": [
            "supports may ONLY contain IDs that appear in ALLOWED_IDS.",
            "Produce 3–7 claims total.",
            "At least 2 claims MUST be type=assertion and MUST each have supports with >=1 allowed ID.",
            "If you cannot ground a claim in ALLOWED_IDS, set type=inference and supports=[].",
            "Prefer grounding assertions with ku_id and/or ru_id; chunk_id is allowed too.",
            "Do not invent authors, titles, or IDs."
        ],
    }

    payload = {
        "query": query,
        "ALLOWED_IDS": {
            "chunk_ids": sorted(list(chunk_ids))[:200],
            "ku_ids": sorted(list(ku_ids))[:200],
            "ru_ids": sorted(list(ru_ids))[:200],
        },
        "EVIDENCE_TABLE": evidence_tbl,
        "KU_TABLE": ku_tbl,
        "EDGE_TABLE": edge_tbl,
    }

    return "\n".join(
        [
            "SYSTEM_RULES_JSON:",
            json.dumps(rules, ensure_ascii=False),
            "",
            "INPUT_JSON:",
            json.dumps(payload, ensure_ascii=False),
            "",
            "OUTPUT_JSON_ONLY:",
        ]
    )





# ----------------------------
# Parsing: strict JSON object extraction
# ----------------------------
_JSON_OBJECT_RE = re.compile(r"\{.*\}\s*$", re.DOTALL)


def _strip_code_fences(t: str) -> str:
    """
    Remove common markdown fences like:
      ```json
      {...}
      ```
    """
    s = (t or "").strip()
    if not s:
        return s

    # Normalize newlines
    s = s.replace("\r\n", "\n").replace("\r", "\n").strip()

    # If it starts with ```..., strip the first fence line and the last fence line if present
    if s.startswith("```"):
        lines = s.split("\n")
        # Drop first line: ``` or ```json
        lines = lines[1:]
        # Drop last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()

    return s


def _extract_first_json_object(s: str) -> str:
    """
    Scan for the first complete JSON object by balancing braces.
    This handles trailing junk/banners/fences.
    """
    s = s.strip()
    start = s.find("{")
    if start < 0:
        return ""

    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return s[start : i + 1]
    return ""


def _parse_json_strict(stdout_text: str) -> Dict[str, Any]:
    """
    Robust JSON parsing:
    - strips markdown fences
    - extracts first balanced {...}
    - json.loads
    """
    raw = (stdout_text or "").strip()
    if not raw:
        raise ValueError("Empty LLM output.")

    raw = _strip_code_fences(raw)

    candidate = _extract_first_json_object(raw)
    if not candidate:
        head = (stdout_text or "")[:800]
        raise ValueError(f"LLM output did not contain a JSON object. stdout_head={head!r}")

    try:
        obj = json.loads(candidate)
    except Exception as e:
        head = (stdout_text or "")[:800]
        raise ValueError(f"LLM output was not valid JSON: {e}. stdout_head={head!r}")

    if not isinstance(obj, dict):
        raise ValueError("LLM output JSON must be an object.")
    return obj



def _normalize_claims(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure minimal contract exists even if the model omits some fields.
    """
    claims = obj.get("claims")
    if not isinstance(claims, list):
        raise ValueError("LLM output must contain a top-level 'claims' array.")

    norm: List[Dict[str, Any]] = []
    for i, c in enumerate(claims, 1):
        if not isinstance(c, dict):
            raise ValueError("Each claim must be a JSON object.")
        cid = c.get("claim_id") or f"c{i}"
        text = c.get("text") or ""
        ctype = c.get("type") or "assertion"
        supports = c.get("supports")
        if not isinstance(supports, list):
            supports = []

        norm.append(
            {
                "claim_id": str(cid),
                "text": str(text),
                "type": str(ctype),
                "supports": [str(x) for x in supports],
            }
        )

    return {"claims": norm}


# ----------------------------
# Public API
# ----------------------------
def synthesize_claims(
    *,
    query: str,
    report_snapshot: Dict[str, Any],
    llm_cmd_raw: Optional[str],
    timeout_s: int = 120,
) -> SynthesisOutcome:
    """
    Run the external LLM command and parse structured JSON claims.
    """
    llm_cmd = get_llm_cmd(llm_cmd_raw)
    if not llm_cmd:
        raise RuntimeError("No LLM command provided. Set --llm_cmd or GOD_LEARN_LLM_CMD.")

    prompt = _build_prompt(query=query, report_snapshot=report_snapshot)

    try:
        r = run_llm_cmd(prompt, llm_cmd=llm_cmd, timeout_s=int(timeout_s))
    except RuntimeError as e:
        if "timed out" not in str(e):
            raise
        r = run_llm_cmd(prompt, llm_cmd=llm_cmd, timeout_s=int(timeout_s))


    if r.returncode != 0:
        err = (r.stderr or "").strip()
        raise RuntimeError(f"LLM command failed (rc={r.returncode}): {err[:800]}")

    obj = _parse_json_strict(r.stdout)
    obj = _normalize_claims(obj)

    return SynthesisOutcome(synthesis=obj, warnings=[])



def enforce_grounding(*, synthesis: Dict[str, Any], report_snapshot: Dict[str, Any]) -> SynthesisOutcome:
    """
    Enforce grounding:
    - Normalize supports to strings
    - Dedupe supports while preserving order
    - Remove invalid supports
    - If type=assertion but supports becomes empty -> demote to inference and warn
    """
    chunk_ids, ku_ids, ru_ids = _collect_valid_support_ids(report_snapshot)
    valid_all = chunk_ids | ku_ids | ru_ids

    warnings: List[str] = []

    claims = synthesis.get("claims", [])
    if not isinstance(claims, list):
        raise ValueError("synthesis['claims'] must be a list.")

    for c in claims:
        if not isinstance(c, dict):
            continue

        cid = str(c.get("claim_id") or "(unknown)")
        ctype = str(c.get("type") or "assertion").strip()

        supports = c.get("supports", [])
        if not isinstance(supports, list):
            supports = []

        # Normalize to strings, strip, drop empties
        supports_s = [str(x).strip() for x in supports if str(x).strip()]

        # Dedupe while preserving order
        seen: set[str] = set()
        supports_s = [x for x in supports_s if not (x in seen or seen.add(x))]

        valid_supports: List[str] = []
        invalid_supports: List[str] = []

        for sid in supports_s:
            if sid in valid_all:
                valid_supports.append(sid)
            else:
                invalid_supports.append(sid)

        if invalid_supports:
            warnings.append(f"Claim {cid} had invalid supports removed: {', '.join(invalid_supports)}")

        c["supports"] = valid_supports

        if ctype == "assertion" and len(valid_supports) == 0:
            c["type"] = "inference"
            warnings.append(f"Claim {cid} demoted to inference due to missing grounding.")

        if str(c.get("type")).strip() not in ("assertion", "inference"):
            c["type"] = "inference"
            warnings.append(f"Claim {cid} had unknown type; coerced to inference.")

    synthesis["claims"] = claims
    return SynthesisOutcome(synthesis=synthesis, warnings=warnings)

