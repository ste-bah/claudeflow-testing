\# Phase 4 — Retrieval + Deterministic Filtering + Citation-Locked Synthesis



Phase 4 operates \*\*only at query time\*\*. It MUST NOT modify:

\- ingestion

\- chunking

\- embeddings

\- manifest records

\- Chroma contents



Outputs are citation-aware using \*\*stored page provenance\*\* (`page\_start`, `page\_end`) only.



---



\## Components



\### D1 — Retrieval CLI

\*\*File:\*\* `scripts/retrieval/query\_chunks.py`



Embeds a natural-language query via the local embedding endpoint and queries Chroma.



\*\*Key features\*\*

\- Query embedding: `http://127.0.0.1:8000/embed`

\- Chroma collection: `knowledge\_chunks` (in `vector\_db\_1536/`)

\- Prints provenance per chunk:

&nbsp; - `chunk\_id`

&nbsp; - `distance`

&nbsp; - `path\_rel`

&nbsp; - `pages=page\_start-page\_end`

\- Deterministic overfetch + post-filtering

\- `--print\_json` mode for downstream synthesis



\*\*Example (human-readable)\*\*

```bash

python3 scripts/retrieval/query\_chunks.py \\

&nbsp; "phantasia and action" \\

&nbsp; --k 10 \\

&nbsp; --overfetch 8 \\

&nbsp; --where '{"collection":"rhetorical\_ontology"}' \\

&nbsp; --include\_docs


Example JSON only export

python3 scripts/retrieval/query_chunks.py \
  "phantasia and action" \
  --k 8 \
  --overfetch 8 \
  --where '{"collection":"rhetorical_ontology"}' \
  --include_docs \
  --print_json > /tmp/retrieval.json



D2 — Deterministic Filtering

File: scripts/retrieval/filtering.py

Applies deterministic filters to retrieved chunks:

Drops bibliography/reference-heavy chunks

Drops page header/footer “furniture”

Drops OCR-noise-like chunks

Optional metadata gating (e.g. require is_my_copy when present)

No LLM logic is permitted here.

D3 — Citation-Locked Synthesis

File: scripts/retrieval/synthesize_cited.py

Consumes the retrieval JSON and produces:

“Claims” section: deterministic sentence extraction + trailing citation

“Evidence pack” section: chunk traceability (chunk_id, distance, source, pages)

Example

python3 scripts/retrieval/synthesize_cited.py /tmp/retrieval.json --take 8


Citations are derived ONLY from:

path_rel

page_start

page_end

No inferred/guessed pagination.

Verification
Phase 4 verification (retrieval + synthesis)

File: scripts/retrieval/verify_phase4.py

Runs retrieval → validates JSON → runs synthesis → validates citation-locked claims.

python3 scripts/retrieval/verify_phase4.py "phantasia and action"

Full Phase 3 + Phase 4 check

File: scripts/retrieval/phase4check.sh

Runs:

Phase 3 audit

Phase 3 verify

Phase 4 verify (query configurable)

# default query
scripts/retrieval/phase4check.sh

# custom query
scripts/retrieval/phase4check.sh "phantasia and deliberation"

Success Criteria (Phase 4)

Retrieval returns relevant chunks with provenance

Filtering is deterministic and replayable

Synthesis output is citation-locked with page-accurate references

No ingestion/embedding code paths are touched


If you want, paste your current `run_query_and_synthesize.sh` and I’ll update it the same way (default query + optional `--where` passthrough) so both entrypoints behave consistently.
