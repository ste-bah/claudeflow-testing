#!/usr/bin/env python3
"""
Phase 8 verifier — enforces paragraph-level provenance and citation locking.

Validates:
  - draft.md exists and contains P8 provenance markers
  - trace.jsonl exists and covers each provenance-tagged paragraph
  - each trace record's reason_id exists in god-reason/reasoning.jsonl
  - each trace record's knowledge_ids exist in god-learn/knowledge.jsonl
  - each paragraph cites EVERY knowledge_id it uses (footnote refs [^ku_x])
  - each cited knowledge_id has a footnote definition [^ku_x]:
  - strict mode:
      - every KU footnote must include a page locator (no NO_PAGE)
      - no [NO_KU] placeholders remain
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


P_MARKER_RE = re.compile(r"<!--\s*P8:\s*section=([^\s]+)\s+ru=([^\s]+)\s+ku=([^\s]+)\s*-->")
FOOTNOTE_DEF_RE = re.compile(r"^\[\^(ku_[A-Za-z0-9_]+)\]:\s*(.+)$")
FOOTNOTE_REF_RE = re.compile(r"\[\^(ku_[A-Za-z0-9_]+)\]")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise SystemExit(f"[Phase8:verify] JSON decode error in {path} line {line_no}: {e}")
    return rows


def split_blocks(md: str) -> List[str]:
    return [b.strip() for b in re.split(r"\n\s*\n", md) if b.strip()]


def load_ids(root: Path) -> Tuple[Set[str], Dict[str, List[str]]]:
    k_rows = read_jsonl(root / "god-learn" / "knowledge.jsonl")
    knowledge_ids: Set[str] = set()
    for r in k_rows:
        kid = r.get("knowledge_id") or r.get("kid") or r.get("ku_id") or r.get("id")
        if kid:
            knowledge_ids.add(str(kid))

    r_rows = read_jsonl(root / "god-reason" / "reasoning.jsonl")
    ru_to_k: Dict[str, List[str]] = {}
    for r in r_rows:
        rid = r.get("reason_id") or r.get("rid") or r.get("ru_id") or r.get("id")
        if not rid:
            continue
        kids = r.get("knowledge_ids") or r.get("knowledgeIds") or r.get("k_ids") or []
        if not isinstance(kids, list):
            kids = []
        ru_to_k[str(rid)] = [str(x) for x in kids if x is not None and str(x).strip()]
    return knowledge_ids, ru_to_k


def parse_footnotes(md: str) -> Dict[str, str]:
    footnotes: Dict[str, str] = {}
    for line in md.splitlines():
        m = FOOTNOTE_DEF_RE.match(line.strip())
        if m:
            footnotes[m.group(1)] = m.group(2).strip()
    return footnotes


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=str, default=".", help="Project root")
    ap.add_argument("--out", type=str, default="god-assemble", help="Phase 8 output directory")
    ap.add_argument("--strict", action="store_true", help="Fail if any KU footnote lacks a page locator")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    out_dir = (root / args.out).resolve()

    draft_path = out_dir / "draft.md"
    trace_path = out_dir / "trace.jsonl"

    if not draft_path.exists():
        raise SystemExit(f"[Phase8:verify] Missing {draft_path}")
    if not trace_path.exists():
        raise SystemExit(f"[Phase8:verify] Missing {trace_path}")

    md = draft_path.read_text(encoding="utf-8")
    blocks = split_blocks(md)

    knowledge_ids, ru_to_k = load_ids(root)
    trace_rows = read_jsonl(trace_path)

    trace_by_ru_sec: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for tr in trace_rows:
        sec = str(tr.get("section_id", ""))
        rids = tr.get("reason_ids") or []
        if not isinstance(rids, list) or not rids:
            continue
        rid = str(rids[0])
        trace_by_ru_sec[(rid, sec)] = tr

    footnotes = parse_footnotes(md)

    p8_blocks = [b for b in blocks if "P8:" in b]
    if not p8_blocks:
        raise SystemExit("[Phase8:verify] No provenance-tagged paragraphs found (expected <!-- P8: ... -->)")

    errors: List[str] = []
    checked = 0

    for b in p8_blocks:
        m = P_MARKER_RE.search(b)
        if not m:
            errors.append("Block missing valid P8 marker: " + b[:140].replace("\n", " ") + "…")
            continue

        sec_id, ru_id, ku_list = m.group(1), m.group(2), m.group(3)
        checked += 1

        if ru_id not in ru_to_k:
            errors.append(f"Unknown reason_id in draft paragraph: ru={ru_id} section={sec_id}")

        marker_kus = [] if ku_list == "NONE" else [k for k in ku_list.split(",") if k]

        tr = trace_by_ru_sec.get((ru_id, sec_id))
        if not tr:
            errors.append(f"Missing trace row for paragraph: ru={ru_id} section={sec_id}")
            continue

        trace_kus = tr.get("knowledge_ids") or []
        if not isinstance(trace_kus, list):
            trace_kus = []
        trace_kus = [str(x) for x in trace_kus]

        if sorted(marker_kus) != sorted(trace_kus):
            errors.append(
                f"KU mismatch ru={ru_id} section={sec_id}: marker={sorted(marker_kus)} trace={sorted(trace_kus)}"
            )

        ru_kus = [k for k in ru_to_k.get(ru_id, []) if k in knowledge_ids]
        if sorted(ru_kus) != sorted(trace_kus):
            errors.append(
                f"Trace KUs do not match reasoning.jsonl ru={ru_id}: reasoning={sorted(ru_kus)} trace={sorted(trace_kus)}"
            )

        missing_k = [k for k in trace_kus if k not in knowledge_ids]
        if missing_k:
            errors.append(f"Trace references missing knowledge IDs ru={ru_id}: {missing_k}")

        refs = set(FOOTNOTE_REF_RE.findall(b))
        expected_refs = set(trace_kus)
        if expected_refs and not expected_refs.issubset(refs):
            # Helpful hint for the exact issue you hit:
            if not refs:
                errors.append(
                    f"Paragraph contains no footnote refs ru={ru_id} section={sec_id}. "
                    f"This usually means the paragraph body got split into a different markdown block due to an internal blank line."
                )
            errors.append(
                f"Paragraph missing required footnote refs ru={ru_id} section={sec_id}: "
                f"expected={sorted(expected_refs)} found={sorted(refs)}"
            )

        for k in trace_kus:
            if k not in footnotes:
                errors.append(f"Missing footnote definition for {k} (ru={ru_id} section={sec_id})")
            elif args.strict:
                if "NO_PAGE" in footnotes[k] and re.search(r"\d", footnotes[k]) is None:
                    errors.append(f"Footnote lacks page locator for {k}: {footnotes[k]}")

        if args.strict and "[NO_KU]" in b:
            errors.append(f"Placeholder [NO_KU] remains in paragraph ru={ru_id} section={sec_id}")

    if errors:
        print(f"[Phase8:verify] FAIL checked_paragraphs={checked} errors={len(errors)}")
        for e in errors[:250]:
            print("  -", e)
        raise SystemExit(2)

    print(f"[Phase8:verify] OK checked_paragraphs={checked} strict={bool(args.strict)}")


if __name__ == "__main__":
    main()
