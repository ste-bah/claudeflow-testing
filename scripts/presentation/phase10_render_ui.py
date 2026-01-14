#!/usr/bin/env python3
"""
Phase 10 UI renderer (Option B): generate answer.ui.json from Phase 9 artifacts.

- Reads report.json + answer.full.json (read-only).
- Produces answer.ui.json (presentation-only, non-authoritative).
- Validates that UI output references only IDs present in answer.full.json.

Phase 10 invariant:
- Never mutate Phase 9 artifacts.
- LLM is optional; deterministic fallback always available.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

PHASE10_PROVIDER = os.environ.get("PHASE10_PROVIDER", "claude").lower()


# ----------------------------
# Utilities
# ----------------------------

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def read_json(p: Path) -> Dict[str, Any]:
    return json.loads(p.read_text(encoding="utf-8"))

def write_json(p: Path, obj: Dict[str, Any]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def jsonl_append(p: Path, rec: Dict[str, Any]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ----------------------------
# ID extraction from Phase 9 full answer
# ----------------------------

@dataclass(frozen=True)
class AllowedIds:
    chunks: Set[str]
    knowledge_units: Set[str]
    edges: Set[str]

def collect_allowed_ids(answer_full: Dict[str, Any]) -> AllowedIds:
    chunks: Set[str] = set()
    kus: Set[str] = set()
    edges: Set[str] = set()

    layers = answer_full.get("layers", {}) or {}

    # Evidence chunks
    for ev in (layers.get("evidence") or []):
        cid = ev.get("chunk_id") or ev.get("id")
        if isinstance(cid, str) and cid:
            chunks.add(cid)

    # Knowledge units
    for ku in (layers.get("knowledge_units") or []):
        kid = ku.get("knowledge_id") or ku.get("ku_id") or ku.get("id")
        if isinstance(kid, str) and kid:
            kus.add(kid)

    # Reasoning edges
    for ed in (layers.get("reasoning_edges") or []):
        eid = ed.get("edge_id") or ed.get("id")
        if isinstance(eid, str) and eid:
            edges.add(eid)

    return AllowedIds(chunks=chunks, knowledge_units=kus, edges=edges)


# ----------------------------
# Validation of answer.ui.json support references
# ----------------------------

def validate_ui_support(ui: Dict[str, Any], allowed: AllowedIds) -> List[str]:
    errors: List[str] = []
    key_points = (ui.get("ui", {}) or {}).get("key_points") or []
    if not isinstance(key_points, list):
        return ["ui.key_points must be a list"]

    for i, kp in enumerate(key_points):
        support = (kp or {}).get("support") or []
        if not support:
            errors.append(f"key_points[{i}] missing support[]")
            continue
        if not isinstance(support, list):
            errors.append(f"key_points[{i}].support must be a list")
            continue

        for j, ref in enumerate(support):
            kind = (ref or {}).get("kind")
            rid = (ref or {}).get("id")
            if kind not in ("chunk", "knowledge_unit", "edge"):
                errors.append(f"key_points[{i}].support[{j}] invalid kind={kind!r}")
                continue
            if not isinstance(rid, str) or not rid:
                errors.append(f"key_points[{i}].support[{j}] missing id")
                continue

            if kind == "chunk" and rid not in allowed.chunks:
                errors.append(f"key_points[{i}].support[{j}] chunk id not in answer.full.json: {rid}")
            if kind == "knowledge_unit" and rid not in allowed.knowledge_units:
                errors.append(f"key_points[{i}].support[{j}] ku id not in answer.full.json: {rid}")
            if kind == "edge" and rid not in allowed.edges:
                errors.append(f"key_points[{i}].support[{j}] edge id not in answer.full.json: {rid}")

    return errors


# ----------------------------
# Deterministic (no-LLM) renderer fallback
# ----------------------------

def deterministic_render(report: Dict[str, Any], answer_full: Dict[str, Any], allowed: AllowedIds, max_points: int) -> Dict[str, Any]:
    query = answer_full.get("query") or report.get("query") or ""
    mode = answer_full.get("data_source_mode") or report.get("data_source_mode") or "local"

    layers = answer_full.get("layers", {}) or {}
    evidence = layers.get("evidence") or []
    kus = layers.get("knowledge_units") or []
    edges = layers.get("reasoning_edges") or []

    # Simple: take top K knowledge units as key points if present, else use evidence snippets.
    key_points = []
    for ku in kus[:max_points]:
        kid = ku.get("knowledge_id") or ku.get("ku_id") or ku.get("id")
        claim = ku.get("claim") or ku.get("text") or ku.get("statement") or ""

        if not (isinstance(kid, str) and kid and isinstance(claim, str) and claim):
            continue
        key_points.append({
            "text": claim.strip(),
            "support": [{"kind": "knowledge_unit", "id": kid}]
        })

    if not key_points:
        for ev in evidence[:max_points]:
            cid = ev.get("chunk_id") or ev.get("id")
            snippet = ev.get("quote") or ev.get("snippet") or ev.get("text") or ""

            pages = ev.get("pages")
            sref = {"kind": "chunk", "id": cid}
            if isinstance(pages, list) and len(pages) == 2:
                sref["pages"] = pages
            if isinstance(cid, str) and cid and isinstance(snippet, str) and snippet:
                key_points.append({"text": snippet.strip(), "support": [sref]})

    short_answer_md = "\n".join([f"- {kp['text']}" for kp in key_points[:max_points]]) or "_No content available._"

    return {
        "schema_version": "10.0.0",
        "artifact": "answer.ui",
        "timestamp_utc": utc_now_iso(),
        "query": query,
        "data_source_mode": mode,
        "derived_from": {},  # filled by caller
        "generation": {},    # filled by caller
        "ui": {
            "short_answer_md": short_answer_md,
            "key_points": key_points[:max_points],
            "what_we_know": [],
            "what_we_cannot_claim": [],
            "next_queries": []
        }
    }


# ----------------------------
# LLM renderer helpers
# ----------------------------

def call_openai_chat_completion(system_prompt: str, user_prompt: str, model: str, max_output_tokens: int) -> str:
    """
    Uses OpenAI Chat Completions API via environment variables.
    Required:
      - OPENAI_API_KEY
    Optional:
      - OPENAI_BASE_URL (for proxies)
    """
    try:
        from openai import OpenAI
    except Exception as e:
        raise RuntimeError("openai python package not available. pip install openai") from e

    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=os.environ.get("OPENAI_BASE_URL") or None,
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_output_tokens,
        temperature=0.2,
    )
    return resp.choices[0].message.content or ""

def parse_json_strict(s: str) -> Dict[str, Any]:
    # Strip code fences if model returns them
    s2 = re.sub(r"^\s*```(?:json)?\s*", "", s.strip(), flags=re.IGNORECASE)
    s2 = re.sub(r"\s*```\s*$", "", s2.strip())
    return json.loads(s2)

def call_claude_completion(system_prompt: str, user_prompt: str, model: str, max_output_tokens: int) -> str:
    """
    Uses Anthropic Claude API (Messages API).
    Required:
      - ANTHROPIC_API_KEY
    """
    try:
        import anthropic
    except Exception as e:
        raise RuntimeError("anthropic python package not available. pip install anthropic") from e

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    message = client.messages.create(
        model=model,
        max_tokens=max_output_tokens,
        temperature=0.2,
        system=[
            {"type": "text", "text": system_prompt}
        ],
        messages=[
            {"role": "user", "content": [{"type": "text", "text": user_prompt}]}
        ],
    )

    return message.content[0].text


# ----------------------------
# Main
# ----------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True, type=Path, help="Path to Phase 9 report.json")
    ap.add_argument("--answer-full", required=True, type=Path, help="Path to Phase 9 answer.full.json (authoritative)")
    ap.add_argument("--out", required=True, type=Path, help="Output path for answer.ui.json")
    ap.add_argument("--log", required=False, type=Path, help="Optional JSONL log path")
    ap.add_argument("--prompts-dir", required=False, type=Path, default=Path("scripts/presentation/prompts"))
    ap.add_argument("--model", required=False, default=os.environ.get("PHASE10_MODEL", "gpt-5.2-thinking"))
    ap.add_argument("--max-output-tokens", type=int, default=900)
    ap.add_argument("--max-points", type=int, default=7)
    ap.add_argument("--no-llm", action="store_true")
    args = ap.parse_args()

    report = read_json(args.report)
    answer_full = read_json(args.answer_full)
    allowed = collect_allowed_ids(answer_full)

    system_p = read_text(args.prompts_dir / "answer_ui.system.txt") if not args.no_llm else ""
    user_tmpl = read_text(args.prompts_dir / "answer_ui.user.txt") if not args.no_llm else ""

    if not args.no_llm:
        if not system_p.strip():
            raise RuntimeError("System prompt is empty (answer_ui.system.txt)")
        if not user_tmpl.strip():
            raise RuntimeError("User prompt is empty (answer_ui.user.txt)")

    derived = {
        "answer_full_path": str(args.answer_full),
        "report_path": str(args.report),
        "answer_full_sha256": sha256_file(args.answer_full),
        "report_sha256": sha256_file(args.report),
    }

    # Default state
    ui_obj: Dict[str, Any]
    llm_ok = False
    prompt_hash: Optional[str] = None
    raw: Optional[str] = None

    if args.no_llm:
        ui_obj = deterministic_render(report, answer_full, allowed, args.max_points)
        ui_obj["derived_from"] = derived
        ui_obj["generation"] = {
            "phase": 10,
            "epistemic_status": "non_authoritative",
            "renderer": "phase10_render_ui.py",
            "llm_used": False,
            "provider": None,
            "model": None,
            "prompt_sha256": None,
            "max_output_tokens": args.max_output_tokens,
        }
    else:
        # Assemble prompt with embedded Phase 9 content (as JSON)
        payload = {
            "report": report,
            "answer_full": answer_full,
            "limits": {
                "max_points": args.max_points,
                "max_output_tokens": args.max_output_tokens,
            }
        }
        user_prompt = user_tmpl.replace(
            "{{PHASE9_PAYLOAD_JSON}}",
            json.dumps(payload, ensure_ascii=False)
        )

        prompt_hash = sha256_text(system_p + "\n" + user_prompt)

        try:
            if PHASE10_PROVIDER == "openai":
                raw = call_openai_chat_completion(
                    system_p,
                    user_prompt,
                    args.model,
                    args.max_output_tokens
                )
            elif PHASE10_PROVIDER == "claude":
                raw = call_claude_completion(
                    system_p,
                    user_prompt,
                    args.model,
                    args.max_output_tokens
                )
            else:
                raise RuntimeError(f"Unknown PHASE10_PROVIDER={PHASE10_PROVIDER}")

            ui_obj = parse_json_strict(raw)
            llm_ok = True

            if args.log:
                jsonl_append(args.log, {
                    "ts": utc_now_iso(),
                    "event": "phase10_llm_render_ok",
                    "out": str(args.out),
                    "provider": PHASE10_PROVIDER,
                    "model": args.model,
                    "prompt_sha256": prompt_hash,
                })

        except Exception as e:
            print("[phase10] LLM render failed, falling back to deterministic render")
            print("          reason:", repr(e))

            # Dump raw output if we have it (presentation-only debug artifact)
            raw_dump_path: Optional[Path] = None
            if raw is not None:
                try:
                    raw_dump_path = args.out.with_suffix(args.out.suffix + ".llm_raw.txt")
                    raw_dump_path.parent.mkdir(parents=True, exist_ok=True)
                    raw_dump_path.write_text(raw, encoding="utf-8", errors="replace")
                    print("          raw_dump:", str(raw_dump_path))
                except Exception:
                    raw_dump_path = None

            if args.log:
                jsonl_append(args.log, {
                    "ts": utc_now_iso(),
                    "event": "phase10_llm_render_failed",
                    "out": str(args.out),
                    "provider": PHASE10_PROVIDER,
                    "model": args.model,
                    "prompt_sha256": prompt_hash,
                    "reason": repr(e),
                    "raw_dump": str(raw_dump_path) if raw_dump_path else None,
                })

            ui_obj = deterministic_render(
                report=report,
                answer_full=answer_full,
                allowed=allowed,
                max_points=args.max_points,
            )

            ui_obj["generation"] = {
                "phase": 10,
                "epistemic_status": "non_authoritative",
                "renderer": "phase10_render_ui.py",
                "llm_used": False,
                "provider": None,
                "model": None,
                "prompt_sha256": None,
                "max_output_tokens": args.max_output_tokens,
                "fallback_reason": repr(e),
            }

            if args.log:
                jsonl_append(args.log, {
                    "ts": utc_now_iso(),
                    "event": "phase10_render_fallback_ok",
                    "out": str(args.out),
                    "provider": PHASE10_PROVIDER,
                    "model": args.model,
                    "reason": repr(e),
                })

        # Fill required metadata (do NOT clobber fallback generation metadata)
        ui_obj.setdefault("schema_version", "10.0.0")
        ui_obj["artifact"] = "answer.ui"
        ui_obj["timestamp_utc"] = utc_now_iso()
        ui_obj["query"] = ui_obj.get("query") or answer_full.get("query") or report.get("query") or ""
        ui_obj["data_source_mode"] = ui_obj.get("data_source_mode") or answer_full.get("data_source_mode") or report.get("data_source_mode") or "local"
        ui_obj["derived_from"] = derived

        # If LLM succeeded, set generation metadata here; if not, preserve fallback generation.
        if llm_ok:
            ui_obj["generation"] = {
                "phase": 10,
                "epistemic_status": "non_authoritative",
                "renderer": "phase10_render_ui.py",
                "llm_used": True,
                "provider": PHASE10_PROVIDER,
                "model": args.model,
                "prompt_sha256": prompt_hash,
                "max_output_tokens": args.max_output_tokens,
            }

        # Validate grounding (applies to both LLM and fallback)
        errs = validate_ui_support(ui_obj, allowed)
        if errs:
            if args.log:
                jsonl_append(args.log, {
                    "ts": utc_now_iso(),
                    "event": "phase10_validation_failed",
                    "out": str(args.out),
                    "llm_used": llm_ok,
                    "provider": PHASE10_PROVIDER if llm_ok else None,
                    "model": args.model if llm_ok else None,
                    "errors": errs
                })
            print("Phase 10 validation failed:")
            for ee in errs[:50]:
                print(" -", ee)
            return 2

    write_json(args.out, ui_obj)

    if args.log:
        jsonl_append(args.log, {
            "ts": utc_now_iso(),
            "event": "phase10_render_ok",
            "out": str(args.out),
            "llm_used": (False if args.no_llm else llm_ok),
            "provider": (None if args.no_llm else (PHASE10_PROVIDER if llm_ok else None)),
            "model": (None if args.no_llm else (args.model if llm_ok else None)),
        })

    print(f"[phase10] wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
