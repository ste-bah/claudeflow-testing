"""
Deterministic, replayable post-retrieval filters.

Goal:
- Remove obvious boilerplate (bibliography / references-heavy chunks)
- Optional metadata gating (collection, is_my_copy)
NO LLM logic. NO re-embedding.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional


# Conservative signals for reference/bibliography chunks
_BIBLIO_HEADER = re.compile(r"^\s*(references|works\s+cited|bibliography)\s*$", re.IGNORECASE | re.MULTILINE)
_YEAR = re.compile(r"\b(18|19|20)\d{2}\b")
_PAREN_YEAR = re.compile(r"\(\s*(18|19|20)\d{2}\s*\)")
_JOURNALISH = re.compile(r"\bvol\.\b|\bno\.\b|\bpp\.\b|\bed\.\b|\btrans\.\b", re.IGNORECASE)


@dataclass(frozen=True)
class FilterConfig:
    require_my_copy: bool = False
    collection: Optional[str] = None
    drop_bibliography_like: bool = True


def _to_bool(v: Any) -> Optional[bool]:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("true", "yes", "1"):
            return True
        if s in ("false", "no", "0"):
            return False
    return None


def is_bibliography_like(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False

    # Strong header signal near the top
    head = t[:800]
    if _BIBLIO_HEADER.search(head):
        return True

    # Heuristics: many years/paren-years + journalish tokens in a small window
    window = head
    year_hits = len(_YEAR.findall(window))
    paren_year_hits = len(_PAREN_YEAR.findall(window))
    journal_hits = 1 if _JOURNALISH.search(window) else 0

    # Additional density markers
    semi_hits = window.count(";")
    dot_hits = window.count(".")

    # Conservative thresholds (tune later if needed)
    if (paren_year_hits >= 6 and (semi_hits >= 6 or journal_hits)) or (year_hits >= 10 and semi_hits >= 8):
        return True

    # If it looks like a list of citations (many short lines ending with years)
    lines = [ln.strip() for ln in window.splitlines() if ln.strip()]
    if len(lines) >= 10:
        tail_year_lines = sum(1 for ln in lines[:25] if _YEAR.search(ln) and len(ln) < 120)
        if tail_year_lines >= 8:
            return True

    return False

def is_page_furniture_like(text: str) -> bool:
    """
    Detects headers/footers and layout noise typical of pdftotext -layout.
    Deterministic heuristics only.
    """
    t = (text or "").strip()
    if not t:
        return False

    head = t[:600]

    # Many uppercase sequences + author/title repeated + page numbers clustered
    # e.g., "NED O'GORMAN ARISTOTLE'S PHANTASIA 29"
    if re.search(r"\b[A-Z][A-Z'\-]{3,}\b.*\b[A-Z][A-Z'\-]{3,}\b", head) and re.search(r"\b\d{1,3}\b", head):
        # If first lines are mostly short tokens / caps / numbers, it's likely a header
        lines = [ln.strip() for ln in head.splitlines() if ln.strip()]
        if lines:
            short_caps = 0
            for ln in lines[:4]:
                if len(ln) <= 80 and (sum(ch.isupper() for ch in ln) / max(1, sum(ch.isalpha() for ch in ln)) > 0.6):
                    short_caps += 1
            if short_caps >= 1:
                return True

    # Line that is basically a page number or "28   TITLE   29"
    if re.search(r"^\s*\d{1,3}\s+[A-Z].+\s+\d{1,3}\s*$", head, re.MULTILINE):
        return True

    return False


def is_ocr_noise_like(text: str) -> bool:
    """
    Detects high corruption: lots of non-alphanumerics, odd escape sequences, etc.
    """
    t = (text or "").strip()
    if not t:
        return False

    sample = t[:800]
    alpha = sum(ch.isalpha() for ch in sample)
    alnum = sum(ch.isalnum() for ch in sample)
    weird = sum((not ch.isalnum()) and (not ch.isspace()) for ch in sample)

    # Too few letters -> likely garbage or table-like
    if alpha < 80 and len(sample) > 200:
        return True

    # Too many weird symbols relative to alnum
    if alnum > 0 and (weird / alnum) > 0.25:
        return True

    # Common corruption markers
    if re.search(r"[~\\]{1,}|�", sample):
        return True

    return False


def passes_filters(meta: Dict[str, Any], doc_text: str, cfg: FilterConfig) -> bool:
    if cfg.collection is not None:
        if meta.get("collection") != cfg.collection:
            return False

    if cfg.require_my_copy:
        b = _to_bool(meta.get("is_my_copy"))
        if b is not True:
            return False

    if cfg.drop_bibliography_like and is_bibliography_like(doc_text):
        return False
    
    # Drop page headers/footers and OCR-garble
    if is_page_furniture_like(doc_text):
        return False
    if is_ocr_noise_like(doc_text):
        return False


    return True
