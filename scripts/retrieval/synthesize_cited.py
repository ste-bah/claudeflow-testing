#!/usr/bin/env python3
"""
Phase 4 (D3): Citation-aware synthesis (deterministic, citation-locked)

Input: JSON output from query_chunks.py --print_json --include_docs
Output:
- Structured bullet synthesis where every bullet ends with a citation
- Citations are derived ONLY from stored metadata: path_rel, page_start, page_end
- No inferred/guessed pagination.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List


def short_source_label(path_rel: str) -> str:
    """
    Deterministic label derived from filename.
    Examples:
      "Aristotle - On The Soul (De Anima)_(2014)_[My Copy].pdf"
        -> "Aristotle — On The Soul (De Anima)"
      "Nussbaum, Martha - The Role of Phantasia in Aristotle's Explanation of Action_(1985)_[My Copy].pdf"
        -> "Nussbaum, Martha — The Role of Phantasia in Aristotle's Explanation of Action"
    """
    name = Path(path_rel).name
    name = re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE)

    parts = name.split(" - ", 1)
    if len(parts) == 2:
        author = parts[0].strip()
        title = parts[1].strip()

        # Strip deterministic suffix patterns used in your corpus naming
        title = re.sub(r"_\(\d{4}\)_\[\s*My Copy\s*\]\s*$", "", title)
        title = re.sub(r"_\(\d{4}\)\s*$", "", title)
        title = re.sub(r"_\[\s*My Copy\s*\]\s*$", "", title)

        return f"{author} — {title}"

    return name


def cite(path_rel: str, page_start: Any, page_end: Any) -> str:
    label = short_source_label(path_rel)
    return f"({label}, pp. {page_start}–{page_end})"


def clean_snippet(text: str, max_chars: int = 320) -> str:
    t = (text or "").strip()
    # collapse whitespace deterministically
    t = " ".join(t.split())
    if len(t) <= max_chars:
        return t
    return t[:max_chars].rstrip() + "…"

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")

def strip_leading_layout_junk(s: str) -> str:
    """
    Remove leading artifacts like:
      '10 4 • '  or  '2 • '  or  '10 '  at the start of extracted sentences.
    Deterministic; does not touch interior numbers.
    """
    s = s.lstrip()

    # Common bullet used by pdftotext layouts
    s = s.replace("•", "•")  # no-op; keep for clarity

    # Remove patterns like "10 4 • " or "2 • " or "10 • "
    s = re.sub(r"^\d{1,3}\s+\d{1,3}\s*•\s+", "", s)
    s = re.sub(r"^\d{1,3}\s*•\s+", "", s)

    # Remove a bare leading page-number token (conservative)
    # Only if followed by a lowercase/uppercase word quickly.
    s = re.sub(r"^\d{1,3}\s+(?=[A-Za-z])", "", s)

    return s


def is_junk_sentence(s: str) -> bool:
    s = s.strip()
    if not s:
        return True
    if len(s) < 40:
        return True

    # Too numeric / page-furniture-ish
    digits = sum(ch.isdigit() for ch in s)
    letters = sum(ch.isalpha() for ch in s)
    if letters > 0 and digits / letters > 0.35:
        return True

    # Editorial apparatus / common noise markers
    lowered = s.lower()
    if "omitting" in lowered or "mss" in lowered:
        return True

    # Starts with a bare number / page marker
    if re.match(r"^\d+\s*•?\s*", s):
        # Allow if it quickly turns into real prose
        if len(s) < 80:
            return True

    return False


def pick_claim_sentence(text: str) -> str:
    """
    Deterministically pick a content-like sentence.
    Falls back to a trimmed snippet if we can't find a good sentence.
    """
    t = " ".join((text or "").split())
    if not t:
        return ""

    # Split into sentences (simple + deterministic)
    candidates = _SENT_SPLIT.split(t)

    for s in candidates[:12]:  # only scan early part (stable)
        s = s.strip()
        if not is_junk_sentence(s):
            s = strip_leading_layout_junk(s)
            if s and s[-1] not in ".!?":
                s += "."
            return s


    # Fallback: first 200 chars as a pseudo-sentence
    fallback = strip_leading_layout_junk(fallback)
    if fallback and fallback[-1] not in ".!?":
        fallback += "."
    return fallback

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path", help="Path to JSON produced by query_chunks.py --print_json --include_docs")
    ap.add_argument("--take", type=int, default=8, help="How many top results to use")
    args = ap.parse_args()

    data = json.loads(Path(args.json_path).read_text(encoding="utf-8"))
    query = data.get("query", "")

    results: List[Dict[str, Any]] = data.get("results", [])
    # Must have text for synthesis
    results = [r for r in results if r.get("text")]
    results = results[: args.take]

    print("# Citation-aware synthesis\n")
    print("## Query")
    print(query)
    print()

    if not results:
        print("No results with text found. Re-run retrieval with --include_docs.")
        return 0

    # 1) Claims: extractive bullets (citation-locked)
    print("## Claims (extractive, citation-locked)\n")
    for i, r in enumerate(results, start=1):
        claim = pick_claim_sentence(r["text"])
        c = cite(r["path_rel"], r["page_start"], r["page_end"])
        print(f"{i}. {claim} {c}")

    # 2) Evidence pack: stable traceability for auditing
    print("\n## Evidence pack\n")
    for i, r in enumerate(results, start=1):
        c = cite(r["path_rel"], r["page_start"], r["page_end"])
        print(f"### E{i}: {r['chunk_id']}")
        print(f"- distance: {r['distance']}")
        print(f"- source: {r['path_rel']}")
        print(f"- pages: {r['page_start']}-{r['page_end']}")
        print(f"- citation: {c}")
        print(f"- snippet: {clean_snippet(r['text'], max_chars=800)}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
