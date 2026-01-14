#!/usr/bin/env python3
"""
Phase 8 — Deterministic long-form assembly

Inputs (locked):
  - god-reason/reasoning.jsonl
  - god-learn/knowledge.jsonl

Outputs (in --out dir, default god-assemble/):
  - outline.json
  - draft.md
  - trace.jsonl
  - report_phase8.txt

Hard constraints:
  - NO Chroma queries
  - NO embeddings
  - NO raw corpus access
  - Deterministic output (stable ordering, stable IDs)

Ordering modes:
  --ordering relation  : relation-bucketed sections (legacy / safe)
  --ordering argument  : argument-driven spine order (recommended)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple


# ----------------------------
# JSON helpers
# ----------------------------

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
                raise SystemExit(f"[Phase8:assemble] JSON decode error in {path} line {line_no}: {e}")
    return rows


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n")


# ----------------------------
# Robust field access
# ----------------------------

def pick_first(d: Dict[str, Any], keys: Sequence[str]) -> Optional[Any]:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def as_str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    return str(x)


def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def stable_hash(text: str, n: int = 12) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


# ----------------------------
# Data models
# ----------------------------

@dataclass(frozen=True)
class KnowledgeUnit:
    kid: str
    claim: str
    citations: List[Dict[str, Any]]
    raw: Dict[str, Any]


@dataclass(frozen=True)
class ReasoningUnit:
    rid: str
    relation: str
    topic: str
    knowledge_ids: List[str]
    raw: Dict[str, Any]


# ----------------------------
# Union-Find for components
# ----------------------------

class UnionFind:
    def __init__(self) -> None:
        self.parent: Dict[str, str] = {}
        self.rank: Dict[str, int] = {}

    def find(self, x: str) -> str:
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
            return x
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1

    def groups(self) -> Dict[str, List[str]]:
        out: Dict[str, List[str]] = {}
        for x in self.parent:
            r = self.find(x)
            out.setdefault(r, []).append(x)
        for r in out:
            out[r].sort()
        return out


# ----------------------------
# Citation extraction/formatting
# ----------------------------

def _page_str_from_cite(c: Dict[str, Any]) -> Optional[str]:
    for k in ["page_range", "pages", "page", "p"]:
        v = c.get(k)
        if v:
            s = as_str(v).strip()
            if re.search(r"\d", s):
                return s

    ps = pick_first(c, ["page_start", "pageStart", "p_start", "start_page"])
    pe = pick_first(c, ["page_end", "pageEnd", "p_end", "end_page"])
    if ps is not None and pe is not None:
        sps, spe = as_str(ps).strip(), as_str(pe).strip()
        if sps and spe:
            if sps == spe:
                return f"p.{sps}"
            return f"pp.{sps}–{spe}"
    if ps is not None:
        sps = as_str(ps).strip()
        if sps:
            return f"p.{sps}"
    return None


def _doc_label_from_cite(c: Dict[str, Any]) -> str:
    for k in ["doc_title", "title", "source_title", "work", "source", "short_cite", "citation"]:
        v = c.get(k)
        if v:
            return normalize_ws(as_str(v))
    for k in ["doc_id", "docId", "document_id"]:
        v = c.get(k)
        if v:
            return normalize_ws(as_str(v))
    return "source"


def resolve_best_citation(cites: List[Dict[str, Any]]) -> Dict[str, str]:
    if not cites:
        return {"label": "source", "page": "", "full": "source"}

    scored: List[Tuple[int, int, str, Dict[str, Any]]] = []
    for c in cites:
        label = _doc_label_from_cite(c)
        page = _page_str_from_cite(c) or ""
        has_page = 1 if page else 0
        label_len = len(label)
        key = json.dumps(c, sort_keys=True, ensure_ascii=False)
        scored.append((has_page, label_len, key, c))

    scored.sort(key=lambda t: (-t[0], -t[1], t[2]))
    best = scored[0][3]
    label = _doc_label_from_cite(best)
    page = _page_str_from_cite(best) or ""
    full = f"{label} {page}".strip() if page else label
    return {"label": label, "page": page, "full": full}


def footnote_text_for_ku(ku: KnowledgeUnit) -> Tuple[str, bool]:
    best = resolve_best_citation(ku.citations)
    has_page = bool(best["page"])
    if best["page"]:
        return (f"{best['label']}, {best['page']} ({ku.kid}).", True)
    return (f"{best['label']} (NO_PAGE) ({ku.kid}).", False)


# ----------------------------
# Relation templates (safe, non-inventive)
# ----------------------------

REL_PRIORITY = {
    "inheritance": 0,
    "elaboration": 1,
    "support": 2,
    "contrast": 3,
    "conflict": 4,
}

def rel_key(rel: str) -> Tuple[int, str]:
    return (REL_PRIORITY.get(rel, 99), rel)

def section_title_for_relation(rel: str) -> str:
    titles = {
        "inheritance": "Conceptual Inheritance",
        "elaboration": "Elaboration and Clarification",
        "support": "Support and Expository Development",
        "contrast": "Contrast and Differentiation",
        "conflict": "Conflict and Theoretical Tension",
    }
    return titles.get(rel, f"Relation: {rel}")

def section_logic_for_relation(rel: str) -> str:
    logic = {
        "inheritance": "Builds definitions and subordination relations to stabilize conceptual scope.",
        "elaboration": "Extends or clarifies claims without changing their basic commitment.",
        "support": "Organizes claims so that one grounds or strengthens another.",
        "contrast": "Stages a tension or distinction that refines interpretation or scope.",
        "conflict": "Marks incompatibilities that require interpretive bracketing or resolution.",
    }
    return logic.get(rel, f"Organized by relation: {rel}.")


def paragraph_text_for_ru(ru: ReasoningUnit, kus: List[KnowledgeUnit]) -> str:
    rel = ru.relation or "elaboration"
    kus_sorted = sorted(kus, key=lambda k: k.kid)
    claims = [normalize_ws(k.claim) for k in kus_sorted]
    if not claims:
        return ""
    if len(claims) == 1:
        return claims[0]

    a, b = claims[0], claims[1]
    if rel == "support":
        return f"{a} Read alongside {b}, this relation functions as support: the second claim strengthens or warrants the first within the same explanatory frame."
    if rel == "contrast":
        return f"{a} Against this, {b} marks a contrast: the two claims differentiate how the same domain should be framed, sharpening what follows from each."
    if rel == "elaboration":
        return f"{a} {b} elaborates the point by clarifying or extending what is implied, without shifting the core commitment."
    if rel == "inheritance":
        return f"{a} Within the reasoning graph this operates as inheritance: one claim specifies a special case or subtype of the other, tightening the conceptual hierarchy at stake."
    if rel == "conflict":
        return f"{a} However, {b} introduces conflict: under a single interpretation, both claims cannot be maintained without revising terms or assumptions."
    return f"{a} In relation to {b}, the graph records the semantic move {rel}."


# ----------------------------
# Loaders (aligned with Phase 7 artifacts)
# ----------------------------

def load_knowledge(path: Path) -> Dict[str, KnowledgeUnit]:
    rows = read_jsonl(path)
    out: Dict[str, KnowledgeUnit] = {}
    for r in rows:
        kid = as_str(pick_first(r, ["knowledge_id", "kid", "ku_id", "id"]))
        if not kid:
            raise SystemExit("[Phase8:assemble] knowledge.jsonl row missing knowledge_id")
        claim = normalize_ws(as_str(pick_first(r, ["claim", "content", "text", "sentence", "body"])))
        cites = r.get("citations") or r.get("sources") or r.get("source_spans") or []
        if not isinstance(cites, list):
            cites = []
        out[kid] = KnowledgeUnit(kid=kid, claim=claim, citations=cites, raw=r)
    return out


def load_reasoning(path: Path) -> Dict[str, ReasoningUnit]:
    rows = read_jsonl(path)
    out: Dict[str, ReasoningUnit] = {}
    for r in rows:
        rid = as_str(pick_first(r, ["reason_id", "rid", "ru_id", "id"]))
        if not rid:
            raise SystemExit("[Phase8:assemble] reasoning.jsonl row missing reason_id")
        rel = as_str(r.get("relation", "")).strip() or "elaboration"
        topic = as_str(r.get("topic", "")).strip() or "all"
        kids = r.get("knowledge_ids") or r.get("knowledgeIds") or r.get("k_ids") or []
        if not isinstance(kids, list):
            kids = []
        kids_norm = [as_str(x).strip() for x in kids if as_str(x).strip()]
        out[rid] = ReasoningUnit(rid=rid, relation=rel, topic=topic, knowledge_ids=kids_norm, raw=r)
    return out


# ----------------------------
# Component construction
# ----------------------------

def build_components(ru_by_id: Dict[str, ReasoningUnit], valid_kids: Set[str]) -> List[Dict[str, Any]]:
    uf = UnionFind()

    # Add nodes
    for ru in ru_by_id.values():
        for kid in ru.knowledge_ids:
            if kid in valid_kids:
                uf.find(kid)

    # Union within each RU hyperedge
    for ru in sorted(ru_by_id.values(), key=lambda x: x.rid):
        kids = [k for k in ru.knowledge_ids if k in valid_kids]
        if len(kids) < 2:
            continue
        base = kids[0]
        for other in kids[1:]:
            uf.union(base, other)

    groups = uf.groups()  # root -> [kids]

    comp_rus: Dict[str, List[str]] = {root: [] for root in groups}
    rel_hist: Dict[str, Dict[str, int]] = {root: {} for root in groups}

    for ru in sorted(ru_by_id.values(), key=lambda x: x.rid):
        kids = [k for k in ru.knowledge_ids if k in valid_kids]
        if not kids:
            continue
        root = uf.find(kids[0])
        comp_rus.setdefault(root, []).append(ru.rid)
        rh = rel_hist.setdefault(root, {})
        rh[ru.relation] = rh.get(ru.relation, 0) + 1

    comps: List[Dict[str, Any]] = []
    for root, kids in groups.items():
        rids = sorted(comp_rus.get(root, []))
        if not rids:
            continue
        comps.append({
            "component_root": root,
            "knowledge_ids": kids,
            "reasoning_units": rids,
            "relations_hist": rel_hist.get(root, {}),
        })
    return comps


def dominant_relation(ru_ids: List[str], ru_by_id: Dict[str, ReasoningUnit]) -> str:
    counts: Dict[str, int] = {}
    for rid in ru_ids:
        rel = ru_by_id[rid].relation
        counts[rel] = counts.get(rel, 0) + 1
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]


def section_id_for_signature(sig: str) -> str:
    return "sec_" + stable_hash(sig, 12)


# ----------------------------
# Argument-driven ordering (Route C)
# ----------------------------

STOPWORDS = {
    "this","that","these","those","there","here","where","when","what","which","who","whom",
    "into","from","with","without","within","between","among","across","about","above","below",
    "over","under","through","during","before","after","again","further","then","once",
    "because","while","until","against","toward","towards",
    "the","and","for","are","but","not","you","your","yours","our","ours","their","theirs",
    "has","have","had","having","is","was","were","be","been","being","as","at","by","of","to","in","on",
    "or","if","it","its","they","them","he","him","his","she","her","we","us","i","me","my","mine",
    "also","only","more","most","some","such","may","might","can","could","would","should","must",
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']{2,}")

def extract_keywords(kus: List[KnowledgeUnit], top_n: int = 3) -> List[str]:
    c = Counter()
    for ku in kus:
        txt = ku.claim.lower()
        for m in WORD_RE.findall(txt):
            w = m.strip("-'")
            if len(w) < 4:
                continue
            if w in STOPWORDS:
                continue
            c[w] += 1
    return [w for w, _ in c.most_common(top_n)]


def build_ku_graph(ru_ids: List[str], ru_by_id: Dict[str, ReasoningUnit], valid_kids: Set[str]) -> Dict[str, Set[str]]:
    g: Dict[str, Set[str]] = {k: set() for k in valid_kids}
    for rid in ru_ids:
        ru = ru_by_id[rid]
        kids = [k for k in ru.knowledge_ids if k in valid_kids]
        for i in range(len(kids)):
            for j in range(i + 1, len(kids)):
                a, b = kids[i], kids[j]
                g.setdefault(a, set()).add(b)
                g.setdefault(b, set()).add(a)
    return g


def compute_ku_degrees(ru_ids: List[str], ru_by_id: Dict[str, ReasoningUnit], valid_kids: Set[str]) -> Dict[str, int]:
    deg = {k: 0 for k in valid_kids}
    for rid in ru_ids:
        kids = [k for k in ru_by_id[rid].knowledge_ids if k in valid_kids]
        for k in set(kids):
            deg[k] = deg.get(k, 0) + 1
    return deg


def bfs_distances(graph: Dict[str, Set[str]], anchor: str) -> Dict[str, int]:
    dist: Dict[str, int] = {anchor: 0}
    q = deque([anchor])
    while q:
        u = q.popleft()
        for v in sorted(graph.get(u, set())):
            if v not in dist:
                dist[v] = dist[u] + 1
                q.append(v)
    return dist


def argument_order_ru_ids(ru_ids: List[str], ru_by_id: Dict[str, ReasoningUnit], component_kids: List[str]) -> Tuple[List[str], str]:
    """
    Deterministic "spine" ordering:
      - choose anchor KU by highest degree (ties lex)
      - compute KU graph distances from anchor
      - sort RUs by (min_dist_to_anchor, relation_priority, reason_id)
    This is simple but produces a paper-like outward expansion from central claims.
    Returns: (ordered_ru_ids, anchor_kid)
    """
    valid_kids = set(component_kids)
    deg = compute_ku_degrees(ru_ids, ru_by_id, valid_kids)
    anchor = sorted(deg.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]  # max degree, then lex
    g = build_ku_graph(ru_ids, ru_by_id, valid_kids)
    dist = bfs_distances(g, anchor)

    def ru_sort_key(rid: str) -> Tuple[int, Tuple[int, str], str]:
        ru = ru_by_id[rid]
        kids = [k for k in ru.knowledge_ids if k in valid_kids]
        # if disconnected for some reason, treat as far away
        md = min((dist.get(k, 10**9) for k in kids), default=10**9)
        return (md, rel_key(ru.relation), rid)

    ordered = sorted(ru_ids, key=ru_sort_key)
    return ordered, anchor


def chunk_ru_ids(ru_ids: List[str], chunk_size: int) -> List[List[str]]:
    if chunk_size <= 0:
        return [ru_ids]
    out: List[List[str]] = []
    for i in range(0, len(ru_ids), chunk_size):
        out.append(ru_ids[i:i + chunk_size])
    return out


# ----------------------------
# Draft + trace emission
# ----------------------------

P_MARKER_FMT = "<!-- P8: section={sec} ru={ru} ku={kus} -->"

def paragraph_id(sec_id: str, ru_id: str) -> str:
    return "p8_" + stable_hash(f"{sec_id}|{ru_id}", 12)


def assemble(
    sections: List[Dict[str, Any]],
    ru_by_id: Dict[str, ReasoningUnit],
    ku_by_id: Dict[str, KnowledgeUnit],
    out_dir: Path,
    max_paragraphs_per_section: int,
    ordering: str,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    # Track footnotes deterministically by knowledge_id
    footnotes: Dict[str, Tuple[str, bool]] = {}  # kid -> (text, has_page)
    footnote_order: List[str] = []
    missing_page_kus: Set[str] = set()

    trace_rows: List[Dict[str, Any]] = []
    md_lines: List[str] = []

    md_lines.append("# Draft (Phase 8)")
    md_lines.append("")
    md_lines.append("> Deterministic assembly from Phase 7 reasoning artifacts. Each paragraph is provenance-tagged and citation-locked to knowledge units.")
    md_lines.append(f"> Ordering: **{ordering}**")
    md_lines.append("")

    paragraph_count = 0

    for sec in sections:
        sec_id = sec["section_id"]
        title = sec["title"]
        sec_logic = sec.get("logic", "").strip()
        ru_ids: List[str] = list(sec["reasoning_units"])

        if max_paragraphs_per_section and len(ru_ids) > max_paragraphs_per_section:
            ru_ids = ru_ids[:max_paragraphs_per_section]

        md_lines.append(f"## {title}")
        md_lines.append("")
        if sec_logic:
            md_lines.append(f"**Section logic:** {sec_logic}")
            md_lines.append("")

        for rid in ru_ids:
            ru = ru_by_id[rid]
            kids = [k for k in ru.knowledge_ids if k in ku_by_id]
            kids_sorted = sorted(kids)
            kus = [ku_by_id[k] for k in kids_sorted]
            pid = paragraph_id(sec_id, ru.rid)

            # Ensure footnotes for each KU
            for k in kids_sorted:
                if k not in footnotes:
                    ft, has_page = footnote_text_for_ku(ku_by_id[k])
                    footnotes[k] = (ft, has_page)
                    footnote_order.append(k)
                    if not has_page:
                        missing_page_kus.add(k)

            # Paragraph body
            body = paragraph_text_for_ru(ru, kus).strip()
            cite_refs = " ".join([f"[^{k}]" for k in kids_sorted]) if kids_sorted else "[NO_KU]"
            marker = P_MARKER_FMT.format(sec=sec_id, ru=ru.rid, kus=",".join(kids_sorted) if kids_sorted else "NONE")

            # Keep each paragraph as a single markdown block
            md_lines.append(marker)
            md_lines.append(f"**Provenance:** `{ru.rid}` ({ru.relation}) → {', '.join(kids_sorted) if kids_sorted else 'NONE'}")
            md_lines.append(f"{body} {cite_refs}".strip())
            md_lines.append("")

            trace_rows.append({
                "paragraph_id": pid,
                "section_id": sec_id,
                "reason_ids": [ru.rid],
                "relation": ru.relation,
                "topic": ru.topic,
                "knowledge_ids": kids_sorted,
                "citations": [
                    {
                        "knowledge_id": k,
                        "footnote_id": k,
                        "resolved": footnotes[k][0],
                        "has_page": footnotes[k][1],
                    }
                    for k in kids_sorted
                ],
            })

            paragraph_count += 1

    # Footnotes section
    md_lines.append("---")
    md_lines.append("")
    md_lines.append("## Footnotes")
    md_lines.append("")
    for k in sorted(set(footnote_order)):
        ft_text = footnotes[k][0]
        md_lines.append(f"[^{k}]: {ft_text}")

    draft_path = out_dir / "draft.md"
    draft_path.write_text("\n".join(md_lines).rstrip() + "\n", encoding="utf-8")

    trace_path = out_dir / "trace.jsonl"
    write_jsonl(trace_path, trace_rows)

    # Outline (light)
    outline_path = out_dir / "outline.json"
    outline = [{
        "section_id": s["section_id"],
        "title": s["title"],
        "ordering": ordering,
        "knowledge_count": len(s.get("knowledge_ids", [])),
        "reasoning_count": len(s.get("reasoning_units", [])),
        "dominant_relation": s.get("dominant_relation", ""),
        "anchor_knowledge_id": s.get("anchor_knowledge_id", ""),
        "relations_hist": s.get("relations_hist", {}),
    } for s in sections]
    write_json(outline_path, outline)

    # Report
    report_path = out_dir / "report_phase8.txt"
    report_lines = []
    report_lines.append("[Phase8] Assembly report")
    report_lines.append(f"ordering={ordering}")
    report_lines.append(f"sections={len(sections)}")
    report_lines.append(f"paragraphs={paragraph_count}")
    report_lines.append(f"trace_rows={len(trace_rows)}")
    report_lines.append(f"knowledge_footnotes={len(footnotes)}")
    report_lines.append(f"knowledge_missing_page={len(missing_page_kus)}")
    if missing_page_kus:
        report_lines.append("missing_page_kus (first 50): " + ", ".join(sorted(missing_page_kus)[:50]))
    report_path.write_text("\n".join(report_lines).rstrip() + "\n", encoding="utf-8")

    print(f"[Phase8:assemble] wrote:")
    print(f"  - {outline_path}")
    print(f"  - {draft_path}")
    print(f"  - {trace_path}")
    print(f"  - {report_path}")


# ----------------------------
# Build sections (relation vs argument)
# ----------------------------

def build_sections_relation(
    comps: List[Dict[str, Any]],
    ru_by_id: Dict[str, ReasoningUnit],
) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    for c in comps:
        kids = c["knowledge_ids"]
        rids = c["reasoning_units"]
        dom_rel = dominant_relation(rids, ru_by_id)

        sec_id = section_id_for_signature("K:" + "|".join(sorted(kids)))
        # Within section: relation priority, then rid
        ordered_rids = sorted(rids, key=lambda rid: (rel_key(ru_by_id[rid].relation), rid))

        sections.append({
            "section_id": sec_id,
            "title": section_title_for_relation(dom_rel),
            "logic": section_logic_for_relation(dom_rel),
            "dominant_relation": dom_rel,
            "knowledge_ids": kids,
            "reasoning_units": ordered_rids,
            "relations_hist": c["relations_hist"],
        })

    # deterministic ordering across sections
    sections.sort(key=lambda s: (-len(s["knowledge_ids"]), rel_key(s["dominant_relation"]), s["section_id"]))
    return sections


def build_sections_argument(
    comps: List[Dict[str, Any]],
    ru_by_id: Dict[str, ReasoningUnit],
    ku_by_id: Dict[str, KnowledgeUnit],
    chunk_size: int,
) -> List[Dict[str, Any]]:
    """
    Argument-driven:
      - For each connected component:
          - choose anchor KU
          - order RU ids outward from anchor (distance + relation priority)
          - chunk into N-paragraph sections
          - title each chunk from KU-claim keywords (deterministic)
    """
    sections: List[Dict[str, Any]] = []

    for c in comps:
        comp_kids: List[str] = c["knowledge_ids"]
        comp_rids: List[str] = c["reasoning_units"]
        if not comp_rids:
            continue

        ordered_rids, anchor = argument_order_ru_ids(comp_rids, ru_by_id, comp_kids)
        chunks = chunk_ru_ids(ordered_rids, chunk_size)

        for idx, chunk in enumerate(chunks):
            # KU set for the chunk (deterministic)
            chunk_kus: Set[str] = set()
            rel_hist: Dict[str, int] = {}
            for rid in chunk:
                ru = ru_by_id[rid]
                rel_hist[ru.relation] = rel_hist.get(ru.relation, 0) + 1
                for k in ru.knowledge_ids:
                    if k in ku_by_id:
                        chunk_kus.add(k)

            chunk_kids = sorted(chunk_kus)
            dom_rel = dominant_relation(chunk, ru_by_id)

            # Title from keywords
            kw = extract_keywords([ku_by_id[k] for k in chunk_kids], top_n=3)
            if kw:
                title = "On " + ", ".join(kw[:-1] + ([f"and {kw[-1]}"] if len(kw) > 1 else [kw[0]]))
            else:
                title = section_title_for_relation(dom_rel)

            logic = (
                f"Argument spine expansion from anchor `{anchor}`: "
                f"ordered by proximity-to-anchor, then relation priority, then reason_id."
            )

            # Stable section id based on component anchor + chunk reason_ids
            sig = f"A:{anchor}|C:{idx}|R:" + "|".join(chunk)
            sec_id = section_id_for_signature(sig)

            sections.append({
                "section_id": sec_id,
                "title": title,
                "logic": logic,
                "dominant_relation": dom_rel,
                "anchor_knowledge_id": anchor,
                "knowledge_ids": chunk_kids,
                "reasoning_units": chunk,  # already ordered
                "relations_hist": rel_hist,
                "component_root": c["component_root"],
            })

    # Order sections deterministically:
    # Larger KU coverage first, then anchor lex, then section_id
    sections.sort(key=lambda s: (-len(s.get("knowledge_ids", [])), as_str(s.get("anchor_knowledge_id", "")), s["section_id"]))
    return sections


# ----------------------------
# Main
# ----------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=str, default=".", help="Project root")
    ap.add_argument("--out", type=str, default="god-assemble", help="Output directory")
    ap.add_argument("--ordering", type=str, default="argument", choices=["relation", "argument"],
                    help="Section/paragraph ordering strategy")
    ap.add_argument("--chunk_size", type=int, default=12,
                    help="(argument ordering) paragraphs per section chunk")
    ap.add_argument("--max_paragraphs_per_section", type=int, default=9999,
                    help="Optional cap for draft size per section")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    out_dir = (root / args.out).resolve()

    knowledge_path = root / "god-learn" / "knowledge.jsonl"
    reasoning_path = root / "god-reason" / "reasoning.jsonl"

    if not knowledge_path.exists():
        raise SystemExit(f"[Phase8:assemble] Missing {knowledge_path}")
    if not reasoning_path.exists():
        raise SystemExit(f"[Phase8:assemble] Missing {reasoning_path}")

    ku_by_id = load_knowledge(knowledge_path)
    ru_by_id = load_reasoning(reasoning_path)

    valid_kids = set(ku_by_id.keys())
    comps = build_components(ru_by_id, valid_kids)

    if args.ordering == "relation":
        sections = build_sections_relation(comps, ru_by_id)
    else:
        sections = build_sections_argument(comps, ru_by_id, ku_by_id, chunk_size=args.chunk_size)

    assemble(
        sections=sections,
        ru_by_id=ru_by_id,
        ku_by_id=ku_by_id,
        out_dir=out_dir,
        max_paragraphs_per_section=args.max_paragraphs_per_section,
        ordering=args.ordering,
    )


if __name__ == "__main__":
    main()
