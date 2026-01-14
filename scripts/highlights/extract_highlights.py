#!/usr/bin/env python3
import argparse, json, os
import fitz  # PyMuPDF

def iter_highlight_annots(page: fitz.Page):
    annot = page.first_annot
    while annot:
        # Many PDF tools store highlight-like marks as "Highlight", "Underline", etc.
        subtype = annot.type[1] if annot.type else "Unknown"
        if subtype in {"Highlight", "Underline", "Squiggly", "StrikeOut"}:
            yield annot, subtype
        annot = annot.next

def extract_annot_text(page: fitz.Page, annot: fitz.Annot) -> str:
    """
    Best-effort extraction of text covered by annotation quads.
    Deterministic order: the order PyMuPDF returns quads.
    """
    parts = []
    verts = annot.vertices  # quadpoints-like vertices
    if not verts:
        # Fallback: use annot rect
        r = annot.rect
        parts.append(page.get_text("text", clip=r).strip())
        return " ".join([p for p in parts if p])

    # vertices come in groups of 4 points (a quad)
    for i in range(0, len(verts), 4):
        quad = verts[i:i+4]
        if len(quad) < 4:
            continue
        r = fitz.Quad(quad).rect
        txt = page.get_text("text", clip=r).strip()
        if txt:
            parts.append(txt)

    # de-dup while preserving order
    seen = set()
    out = []
    for p in parts:
        p = " ".join(p.split())
        if p and p not in seen:
            out.append(p)
            seen.add(p)
    return " ".join(out).strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="Corpus root, e.g. /home/dalton/projects/claudeflow-testing/corpus")
    ap.add_argument("--path_rel", required=True, help="Relative PDF path under root")
    ap.add_argument("--out", required=True, help="Output JSONL path")
    args = ap.parse_args()

    pdf_path = os.path.join(args.root, args.path_rel)
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(pdf_path)

    doc = fitz.open(pdf_path)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    n = 0
    with open(args.out, "w", encoding="utf-8") as f:
        for page_idx in range(doc.page_count):
            page = doc.load_page(page_idx)
            page_num = page_idx + 1  # 1-based (LOCKED)
            for annot, subtype in iter_highlight_annots(page):
                text = extract_annot_text(page, annot)
                # Optional comment/note (varies by PDF producer)
                comment = ""
                try:
                    info = annot.info or {}
                    comment = (info.get("content") or "").strip()
                except Exception:
                    comment = ""

                rec = {
                    "path_rel": args.path_rel,
                    "page": page_num,
                    "type": subtype.lower(),  # "highlight"/"underline"/...
                    "text": text,
                }
                if comment:
                    rec["comment"] = comment

                # Skip empty annotations (but still deterministic)
                if rec["text"] or rec.get("comment"):
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    n += 1

    print(f"[OK] extracted={n} -> {args.out}")

if __name__ == "__main__":
    main()
