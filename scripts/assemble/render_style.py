#!/usr/bin/env python3
"""
Phase 8B: Style render pass (constrained rewrite).

Goals:
- Rewrite paragraph surface text only (no structure changes).
- Preserve:
  - P8 markers / provenance lines (kept verbatim)
  - KU footnote refs like [^ku_...]
  - Footnote definitions block (kept verbatim)
- Output draft_styled.md suitable for verify_phase8.py --strict

Usage:
  python3 scripts/assemble/render_style.py \
    --in god-assemble-arg/draft.md \
    --out god-assemble-arg/draft_styled.md \
    --profile academic-formal
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
from typing import List, Tuple

# --- Heuristics for "do not rewrite" blocks ---
RE_FOOTNOTE_DEF = re.compile(r"^\[\^ku_[0-9a-f]+\]:", re.IGNORECASE)
RE_P8_MARKER = re.compile(r"^\s*(<!--\s*P8:|<!--\s*PROVENANCE:|<!--\s*TRACE:|<!--\s*KU:)", re.IGNORECASE)
RE_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+")
RE_CODE_FENCE = re.compile(r"^\s*```")
RE_TABLE_LINE = re.compile(r"^\s*\|")  # markdown table rows
RE_LIST_LINE = re.compile(r"^\s*([-*+]|\d+\.)\s+")
RE_BLOCKQUOTE = re.compile(r"^\s*>\s+")

# Footnote ref tokens must be preserved within rewritten paragraphs
RE_FOOTNOTE_REF = re.compile(r"\[\^ku_[0-9a-f]+\]", re.IGNORECASE)


def split_blocks(md: str) -> List[str]:
    """
    Split markdown into blocks separated by 1+ blank lines.
    Keeps internal newlines inside a block.
    """
    # Normalize line endings
    md = md.replace("\r\n", "\n").replace("\r", "\n")
    parts = re.split(r"\n{2,}", md)
    return parts


def is_non_rewrite_block(block: str) -> bool:
    """
    Decide if a block should be left verbatim.
    """
    lines = block.split("\n")
    if not lines:
        return True

    # Footnote definitions: keep verbatim
    if RE_FOOTNOTE_DEF.match(lines[0].strip()):
        return True

    # P8 / provenance markers: keep verbatim
    if any(RE_P8_MARKER.match(ln) for ln in lines if ln.strip()):
        return True

    # Headings: keep verbatim
    if RE_HEADING.match(lines[0]):
        return True

    # Code fences or code blocks: keep verbatim
    if any(RE_CODE_FENCE.match(ln) for ln in lines):
        return True

    # Tables: keep verbatim
    if all((ln.strip() == "" or RE_TABLE_LINE.match(ln)) for ln in lines):
        # entire block looks like a table
        return True

    # Lists: keep verbatim
    if all((ln.strip() == "" or RE_LIST_LINE.match(ln)) for ln in lines):
        return True

    # Blockquotes: keep verbatim
    if all((ln.strip() == "" or RE_BLOCKQUOTE.match(ln)) for ln in lines):
        return True

    return False


def protect_tokens(text: str) -> Tuple[str, List[str]]:
    """
    Replace KU footnote refs with placeholders to prevent edits.
    """
    tokens: List[str] = []

    def _sub(m: re.Match) -> str:
        tokens.append(m.group(0))
        return f"@@KUFOOTNOTE_{len(tokens)-1}@@"

    protected = RE_FOOTNOTE_REF.sub(_sub, text)
    return protected, tokens


def restore_tokens(text: str, tokens: List[str]) -> str:
    for i, tok in enumerate(tokens):
        text = text.replace(f"@@KUFOOTNOTE_{i}@@", tok)
    return text


def godagent_rewrite(paragraph: str, profile: str) -> str:
    """
    Calls GodAgent CLI to rewrite a paragraph in the target style.

    IMPORTANT:
    - The README documents: `write <task>`, `ask <query>`, `style-status`, `learn-style`.
    - It does NOT document an explicit "apply-style" flag.
    - So we embed "use style profile X" into the prompt and rely on the style system being active.

    If your CLI supports a real flag (e.g., --style, --profile), add it here.
    """
    # Strong constraints to preserve structure/tokens.
    prompt = (
        f"Rewrite the following paragraph in the writing style of the profile named {profile}. "
        "Do not add or remove citations. Do not add new claims. "
        "Do not change any placeholders like @@KUFOOTNOTE_0@@. "
        "Preserve meaning; improve academic clarity, cadence, and diction.\n\n"
        "PARAGRAPH:\n"
        f"{paragraph}\n"
    )

    # Try `write` first (best fit), fallback to `ask` if needed.
    base = ["npx", "tsx", "src/god-agent/universal/cli.ts"]

    for cmd in (["write", prompt], ["ask", prompt]):
        try:
            p = subprocess.run(
                base + cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )
            out = p.stdout.strip()
            if not out:
                continue

            # Heuristic: return last non-empty chunk.
            # If your CLI prints banners, adjust extraction accordingly.
            chunks = [c.strip() for c in re.split(r"\n{2,}", out) if c.strip()]
            return chunks[-1] if chunks else out

        except subprocess.CalledProcessError:
            continue

    raise RuntimeError("GodAgent CLI call failed (write/ask). See stderr for details.")


def normalize_paragraph(block: str) -> str:
    """
    Collapse internal newlines into spaces for LLM rewrite,
    but keep it a single paragraph. (We restore as single line.)
    """
    lines = [ln.strip() for ln in block.split("\n")]
    # Keep single spaces between lines
    return " ".join([ln for ln in lines if ln != ""]).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Input draft.md")
    ap.add_argument("--out", dest="out", required=True, help="Output draft_styled.md")
    ap.add_argument("--profile", required=True, help="GodAgent style profile name (e.g., academic-formal)")
    ap.add_argument("--max_chars", type=int, default=1800, help="Safety cap per paragraph rewrite")
    args = ap.parse_args()

    src = open(args.inp, "r", encoding="utf-8").read()
    blocks = split_blocks(src)

    out_blocks: List[str] = []
    changed = 0
    kept = 0

    for b in blocks:
        raw = b
        if b.strip() == "":
            out_blocks.append(raw)
            continue

        if is_non_rewrite_block(b):
            out_blocks.append(raw)
            kept += 1
            continue

        para = normalize_paragraph(b)
        if len(para) > args.max_chars:
            # Too long: keep as-is rather than risking truncation / structure edits.
            out_blocks.append(raw)
            kept += 1
            continue

        protected, tokens = protect_tokens(para)
        rewritten = godagent_rewrite(protected, args.profile)
        rewritten = rewritten.strip()
        rewritten = restore_tokens(rewritten, tokens)

        # Final sanity: ensure all KU refs remain present
        for tok in tokens:
            if tok not in rewritten:
                raise RuntimeError(f"Lost protected token during rewrite: {tok}")

        out_blocks.append(rewritten)
        changed += 1

    out_md = "\n\n".join(out_blocks).rstrip() + "\n"
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(out_md)

    print(f"[render_style] wrote: {args.out}")
    print(f"[render_style] changed_blocks={changed} kept_blocks={kept} total_blocks={len(blocks)}")


if __name__ == "__main__":
    main()
