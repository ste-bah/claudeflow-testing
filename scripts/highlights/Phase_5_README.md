Phase 5 — Highlight-Aware Retrieval (README)



Status: ✅ COMPLETE

Scope: Retrieval-time reranking only (no ingestion / no embeddings)



Overview



Phase 5 augments the existing retrieval pipeline with highlight-aware reranking.

PDF highlights and annotations are treated as a secondary deterministic signal that biases retrieval results toward passages the researcher has explicitly marked as salient.



Key properties:



No re-ingestion



No re-chunking



No re-embedding



No manifest changes



No LLM logic



Deterministic and replayable



Highlights influence ordering only, never candidate membership.



Design Contract (Locked)

Highlights MAY:



Increase ranking priority of chunks



Affect ordering within a candidate set



Surface annotated passages earlier



Highlights MUST NOT:



Fabricate new chunks



Remove candidates pre–top-k



Override semantic similarity entirely



Affect Phase 4 behavior when disabled



Files Added (Phase 5)

scripts/highlights/

├── extract\_highlights.py        # PDF annotation extraction

├── map\_highlights\_to\_chunks.py  # Page/text → chunk mapping

├── verify\_highlights.py         # Phase 5.4 verifier

├── phase5check.sh               # End-to-end sanity check

├── out/                          # Per-document highlights (JSONL)

├── index/                        # Per-document highlight→chunk maps

└── highlight\_index.json          # Merged global highlight index



Step-by-Step Usage

1\. Extract highlights from PDFs



Extract annotations from a single document:



ROOT=/home/dalton/projects/claudeflow-testing/corpus

OUT=scripts/highlights/out



python3 scripts/highlights/extract\_highlights.py \\

&nbsp; --root "$ROOT" \\

&nbsp; --path\_rel "rhetorical\_ontology/Aristotle - On The Soul (De Anima)\_(2014)\_\[My Copy].pdf" \\

&nbsp; --out "$OUT/on\_the\_soul.highlights.jsonl"





Output format (JSONL):



{

&nbsp; "path\_rel": "...",

&nbsp; "page": 19,

&nbsp; "type": "highlight",

&nbsp; "text": "highlighted passage",

&nbsp; "comment": "optional annotation text"

}



2\. Map highlights to chunks

CHROMA=vector\_db\_1536

COL=knowledge\_chunks

OUTIDX=scripts/highlights/index



python3 scripts/highlights/map\_highlights\_to\_chunks.py \\

&nbsp; --highlights\_jsonl "$OUT/on\_the\_soul.highlights.jsonl" \\

&nbsp; --chroma\_dir "$CHROMA" \\

&nbsp; --collection "$COL" \\

&nbsp; --path\_rel "rhetorical\_ontology/Aristotle - On The Soul (De Anima)\_(2014)\_\[My Copy].pdf" \\

&nbsp; --out "$OUTIDX/on\_the\_soul.index.json"





Each index maps:



{

&nbsp; "chunk\_id": {

&nbsp;   "highlight\_count": 6,

&nbsp;   "pages": \[19, 20]

&nbsp; }

}



3\. Merge per-document indexes

python3 - <<'PY'

import json, glob

merged = {}

for p in glob.glob("scripts/highlights/index/\*.json"):

&nbsp;   d = json.load(open(p))

&nbsp;   for k,v in d.items():

&nbsp;       merged.setdefault(k, {"highlight\_count":0,"pages":\[]})

&nbsp;       merged\[k]\["highlight\_count"] += v\["highlight\_count"]

&nbsp;       merged\[k]\["pages"] = sorted(set(merged\[k]\["pages"] + v\["pages"]))

json.dump(merged, open("scripts/highlights/highlight\_index.json","w"), indent=2)

print("\[OK] merged -> scripts/highlights/highlight\_index.json")

PY



Retrieval with Highlights

Standard retrieval (Phase 4 behavior)

python3 scripts/retrieval/query\_chunks.py \\

&nbsp; "phantasia and action" --k 12



Highlight-aware retrieval (Phase 5)

python3 scripts/retrieval/query\_chunks.py \\

&nbsp; "phantasia and action" --k 12 --use\_highlights





Additional fields appear:



final\_score = distance - (alpha \* min(highlight\_count, cap))

hl\_count

boost





Defaults:



alpha = 0.02



cap = 5



Sorting is deterministic:



(final\_score, distance, chunk\_id)



Verification (Phase 5.4)

Verify highlight correctness per document

python3 scripts/highlights/verify\_highlights.py \\

&nbsp; --root "$ROOT" \\

&nbsp; --path\_rel "rhetorical\_ontology/Aristotle - On The Soul (De Anima)\_(2014)\_\[My Copy].pdf" \\

&nbsp; --highlights\_jsonl "scripts/highlights/out/on\_the\_soul.highlights.jsonl"





Checks:



Highlight pages ∈ valid PDF page range



All mapped chunk\_ids exist in Chroma



Full Phase 5 check (recommended)

./scripts/highlights/phase5check.sh





Runs:



Phase 3 audit



Phase 3 verify



Phase 4 verify



Phase 5 highlight verification



Side-by-side diff of retrieval with/without highlights



Proven Invariants

Property	Status

Candidate pool unchanged	✅ Verified

Ordering-only rerank	✅ Verified

Deterministic output	✅ Verified

Phase 4 unaffected	✅ Verified

Page provenance intact	✅ Verified

Phase 5 Completion Statement



Phase 5 successfully integrates PDF highlights as a bounded, deterministic reranking signal at query time. Highlight-aware retrieval surfaces researcher-annotated passages earlier while preserving semantic similarity, provenance integrity, and full replayability. No ingestion, embedding, or manifest changes were required.



Next Phase



Phase 6 — Knowledge Promotion



Promote high-signal, citation-locked syntheses into /god-learn

(Option B → Option A convergence).

