# God‑Learn / God‑Agent Scholarly Pipeline

**Authoritative End‑to‑End README (Phases 1–10)**

This document consolidates all phase READMEs into a single, chronological, drop‑in reference suitable for ingestion by another LLM or long‑term archival. It describes *what exists*, *why it exists*, *how to verify it*, and *what is locked* at each phase boundary.

---

## Phase 1–3 — Option B Ingestion Pipeline (LOCKED)

### Purpose
Establish a restart‑safe, page‑aware, citation‑preserving substrate for scholarly PDFs. These phases create the only pathway from raw documents to vectors.

### Core Guarantees
- Deterministic, restart‑safe ingestion
- Stable document IDs and chunk IDs
- Page‑accurate provenance (1‑based PDF pages)
- Append‑only manifest with auditability

### Phase 1 — Ingest Skeleton
- Corpus rooted at `corpus/`
- First directory = *collection* metadata
- `sha256` = raw PDF bytes
- `doc_id = sha256(path_rel + ":" + sha256)[:16]`
- Chunk IDs: `<doc_id>:<chunk_index>`
- Chunking via `pdftotext -layout`, paragraph‑based, page‑aware
- Manifest: `scripts/ingest/manifest.jsonl` (append‑only)

### Phase 2 — Embedding + Chroma Storage
- Local embedding endpoint: `http://127.0.0.1:8000/embed`
- Embedding dimension: **1536** (hard requirement)
- Vector store: `vector_db_1536/`
- Collection: `knowledge_chunks`
- Idempotent upserts, adaptive batch splitting, conservative timeouts

### Phase 3 — Verification & Audit
- `verify_ingest.py`: proves manifest ↔ filesystem ↔ vectors consistency
- `audit_ingest.py`: classifies corpus state without touching vectors
- `healthcheck.sh`: one‑command proof of correctness

**After Phase 3:** every vector is provably traceable to exact bytes and pages. Retrieval may rely on citations without guessing.

---

## Phase 4 — Retrieval, Deterministic Filtering & Citation‑Locked Synthesis (LOCKED)

### Purpose
Introduce query‑time access to the corpus *without mutating it*.

### Invariants
- Query‑time only
- No ingestion, chunking, embeddings, or manifest changes
- Citations derived strictly from stored page provenance

### Components
- **Retrieval:** `query_chunks.py` (embedding + Chroma search)
- **Filtering:** deterministic heuristics (no LLMs)
- **Synthesis:** `synthesize_cited.py` (sentence extraction + citations)

### Verification
- `verify_phase4.py` ensures citation‑locked outputs
- `phase4check.sh` runs Phase 3 + Phase 4 end‑to‑end

---

## Phase 5 — Highlight‑Aware Retrieval (LOCKED)

### Purpose
Bias retrieval ordering toward researcher‑annotated passages *without altering candidate sets*.

### Properties
- No re‑ingestion, re‑chunking, or re‑embedding
- Highlights affect **ordering only**
- Deterministic and replayable

### Mechanism
- Extract PDF highlights
- Map highlights → chunk IDs
- Merge into a global highlight index
- Apply bounded score boost at retrieval time

### Verification
- Per‑document highlight verification
- End‑to‑end Phase 5 check comparing with/without highlights

---

## Phase 6 — Knowledge Promotion (LOCKED)

### Purpose
Promote high‑signal, citation‑locked retrieval results into immutable **Knowledge Units (KUs)**.

### Properties
- Promotion is explicit and query‑conditioned
- Knowledge units are append‑only and immutable
- Promotion never performs retrieval itself

### Output
- `god-learn/knowledge.jsonl`

This marks the transition from *documents* to *claims‑as‑data*.

---

## Phase 7 — Cross‑Document Reasoning (LOCKED)

### Purpose
Construct inspectable reasoning **as data**, not prose.

### Key Decisions
- No embeddings, no vector search
- Operates only on promoted KUs
- Char‑level n‑gram similarity (n=4)
- Deterministic top‑K pruning

### Output
- `god-reason/reasoning.jsonl`
- Explicit relations: support, contrast, elaboration, inheritance, conflict

Reasoning is now explicit, auditable, and reproducible.

---

## Phase 8 — Long‑Form Assembly & Style Realization (LOCKED)

### Purpose
Transform reasoning‑as‑data into academic prose **without creating new knowledge**.

### Phase 8A — Deterministic Assembly
- Assemble paragraphs 1:1 from reasoning units
- Produce `draft.md`, `outline.json`, `trace.jsonl`
- Strict verification of every paragraph

### Phase 8B — Style Render Pass
- Apply trained GodAgent academic style
- Surface‑level rewrite only
- Citations, structure, and provenance preserved verbatim

### Guarantees
- All prose is citation‑locked
- No hallucinated claims possible
- Fully reproducible from locked inputs

---

## Phase 9 — REPORT & ANSWER (Epistemic Interaction Layer) (LOCKED)

### Purpose
Establish a read‑only epistemic boundary between **knowing** and **saying**.

### Artifacts
- **report.json** — coverage diagnostics (deterministic, no LLM)
- **answer.json** — grounded synthesis artifact (machine‑first)

### Data‑Source Modes
- `local` — corpus‑only, non‑generative
- `hybrid` — local first, external only with explicit justification

### Sub‑Phases
- **9A REPORT:** what the corpus contains
- **9B ANSWER:** structured presentation
- **9C SYNTHESIS (optional):** controlled claim synthesis with grounding enforcement

### Invariants
- Phase 9 never mutates earlier artifacts
- External knowledge is explicit and separable

Phase 9 completes epistemic correctness.

---

## Phase 10 — Presentation / UI Rendering (LOCKED)

### Purpose
Convert authoritative Phase 9 artifacts into UI‑friendly JSON.

### Properties
- Presentation‑only
- Non‑authoritative
- Fully regenerable

### Behavior
- Optional LLM‑assisted rendering
- Strict JSON parsing
- Grounding validation against Phase 9 IDs
- Deterministic fallback on any failure

### Output
- `answer.ui.json`

### Guarantee
Language is applied *after* knowledge, never before.

---

## Final System Guarantees (Phases 1–10)

- Knowledge is earned upstream, never invented downstream
- Every claim is traceable to page‑accurate sources
- Reasoning is explicit, inspectable, and reproducible
- Presentation layers are safe to discard

**This completes the God‑Learn pipeline from raw PDFs to grounded, UI‑ready answers.**

