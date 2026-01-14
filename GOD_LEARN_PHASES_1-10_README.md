# God-Learn Scholarly Pipeline: Phases 1-10

**From Raw PDFs to Grounded, Citation-Locked Academic Prose**

This document covers the foundational God-Learn pipeline (Phases 1-10) that transforms scholarly PDFs into verifiable, citation-locked knowledge with full provenance traceability.

---

## Overview

| Phase | Name | Purpose | Key Output |
|-------|------|---------|------------|
| **1-3** | Ingestion Pipeline | PDF → Chunks → Vectors | `manifest.jsonl`, `vector_db_1536/` |
| **4** | Retrieval & Synthesis | Query-time search with citations | Retrieved chunks with provenance |
| **5** | Highlight-Aware Retrieval | Bias toward annotated passages | Highlight-boosted rankings |
| **6** | Knowledge Promotion | Extract knowledge units from hits | `god-learn/knowledge.jsonl` |
| **7** | Cross-Document Reasoning | Build reasoning graph over KUs | `god-reason/reasoning.jsonl` |
| **8** | Long-Form Assembly | Transform reasoning to prose | `draft.md`, `trace.jsonl` |
| **9** | Epistemic Interaction | REPORT/ANSWER with grounding | `report.json`, `answer.json` |
| **10** | Presentation Layer | UI-friendly rendering | `answer.ui.json` |

**Core Guarantee**: Every claim is traceable to an exact PDF page. No hallucinated content is possible.

---

## Quick Start

```bash
# Phase 1-3: Ingest PDFs
python3 scripts/ingest/run_ingest.py --root corpus/
python3 scripts/ingest/run_ingest_phase2.py --root corpus/
python3 scripts/ingest/verify_ingest.py --root corpus/

# Phase 4: Query and retrieve
python3 scripts/retrieval/query_chunks.py "phantasia and action" --k 10 --include_docs

# Phase 6: Promote to knowledge units
python3 scripts/learn/promote_hits.py --hits_json /tmp/hits.json --query "phantasia"

# Phase 7: Build reasoning graph
python3 scripts/reason/reason_over_knowledge.py --knowledge god-learn/knowledge.jsonl

# Phase 8: Assemble long-form draft
python3 scripts/assemble/assemble_longform.py --ordering argument --out god-assemble

# Phase 9: Generate answer
python3 scripts/interaction/answer.py --query "phantasia and action" --format json

# Phase 10: Render UI
python3 scripts/presentation/phase10_render_ui.py --answer-full answer.json --out answer.ui.json
```

---

## Phases 1-3: Ingestion Pipeline

**Purpose**: Create a restart-safe, page-aware, citation-preserving substrate for scholarly PDFs.

### Phase 1: Ingest Skeleton

Extracts text from PDFs with page-accurate provenance.

**Key Properties**:
- **Document ID**: `sha256(path_rel + ":" + file_sha256)[:16]` - stable, rename-sensitive
- **Chunk ID**: `<doc_id>:<chunk_index:05d>` - deterministic ordering
- **Page Provenance**: 1-based PDF pages via `pdftotext -layout`
- **Manifest**: Append-only JSONL for crash safety and auditing

```bash
python3 scripts/ingest/run_ingest.py \
  --root /path/to/corpus
```

### Phase 2: Embedding & Vector Storage

Embeds chunks and stores in ChromaDB.

**Configuration**:
- Embedding endpoint: `http://127.0.0.1:8000/embed`
- Embedding dimension: **1536** (hard requirement)
- Vector store: `vector_db_1536/`
- Collection: `knowledge_chunks`

**Features**:
- Adaptive batch splitting for large chunks
- Idempotent upserts (re-runs never duplicate)
- Conservative timeouts for slow inference

```bash
python3 scripts/ingest/run_ingest_phase2.py \
  --root /path/to/corpus
```

### Phase 3: Verification & Audit

Proves correctness without modifying anything.

```bash
# Full verification (manifest + filesystem + vectors)
python3 scripts/ingest/verify_ingest.py \
  --root corpus/ \
  --manifest scripts/ingest/manifest.jsonl \
  --chroma_dir vector_db_1536 \
  --collection knowledge_chunks

# Audit only (no vector access)
python3 scripts/ingest/audit_ingest.py \
  --root corpus/ \
  --manifest scripts/ingest/manifest.jsonl

# One-command health check
./scripts/ingest/healthcheck.sh
```

**After Phase 3**: Every vector is provably traceable to exact bytes and pages.

### Directory Structure

```
corpus/
└── rhetorical_ontology/           # Collection (first directory)
    ├── Aristotle - De Anima.pdf
    ├── Nussbaum - Phantasia.pdf
    └── ...

scripts/ingest/
├── run_ingest.py                  # Phase 1
├── run_ingest_phase2.py           # Phase 2
├── verify_ingest.py               # Phase 3 verification
├── audit_ingest.py                # Phase 3 audit
├── healthcheck.sh                 # One-command check
└── manifest.jsonl                 # Append-only record

vector_db_1536/                    # ChromaDB persistent storage
```

---

## Phase 4: Retrieval & Synthesis

**Purpose**: Query-time access to the corpus with citation-locked outputs.

### Invariants

- Query-time only - no ingestion or embedding changes
- Citations derived strictly from stored page provenance
- Deterministic and replayable

### Components

**D1 - Retrieval CLI** (`query_chunks.py`):
```bash
python3 scripts/retrieval/query_chunks.py \
  "phantasia and action" \
  --k 10 \
  --overfetch 8 \
  --where '{"collection":"rhetorical_ontology"}' \
  --include_docs \
  --print_json > /tmp/retrieval.json
```

**D2 - Deterministic Filtering** (`filtering.py`):
- Drops bibliography/reference chunks
- Drops page header/footer "furniture"
- Drops OCR-noise chunks
- No LLM logic permitted

**D3 - Citation-Locked Synthesis** (`synthesize_cited.py`):
```bash
python3 scripts/retrieval/synthesize_cited.py /tmp/retrieval.json --take 8
```

Output includes:
- Claims with trailing citations
- Evidence pack with chunk traceability
- Page-accurate references

### Verification

```bash
# Verify retrieval + synthesis pipeline
python3 scripts/retrieval/verify_phase4.py "phantasia and action"

# Full Phase 3 + Phase 4 check
./scripts/retrieval/phase4check.sh
```

---

## Phase 5: Highlight-Aware Retrieval

**Purpose**: Bias retrieval toward researcher-annotated passages without altering candidate sets.

### Properties

- No re-ingestion, re-chunking, or re-embedding
- Highlights affect **ordering only**
- Deterministic and replayable

### Mechanism

1. Extract PDF highlights
2. Map highlights → chunk IDs
3. Merge into global highlight index
4. Apply bounded score boost at retrieval time

```bash
# Retrieval with highlight boost
python3 scripts/retrieval/query_chunks.py \
  "phantasia and action" \
  --use_highlights \
  --k 30 \
  --include_docs

# Verify highlight integration
./scripts/highlights/phase5check.sh
```

---

## Phase 6: Knowledge Promotion

**Purpose**: Promote high-signal retrieval results into durable, citation-locked Knowledge Units (KUs).

### Properties

- Promotion is explicit and query-conditioned
- Knowledge units are append-only and immutable
- Never performs retrieval (consumes Phase 4/5 output)

### How It Works

1. Retrieve top-K chunks with `--include_docs`
2. For each chunk: extract best sentence by query keyword overlap
3. Construct KU with claim + source metadata
4. Generate stable ID: `ku_` + sha256({claim + sources})[:16]
5. Append to `knowledge.jsonl` if not already present

### Commands

```bash
# Generate retrieval hits
python3 scripts/retrieval/query_chunks.py \
  "phantasia and action" \
  --k 30 --overfetch 60 \
  --use_highlights --include_docs \
  --print_json > /tmp/phase4_hits.json

# Dry-run promotion (preview)
python3 scripts/learn/promote_hits.py \
  --hits_json /tmp/phase4_hits.json \
  --query "phantasia and action" \
  --dry_run

# Promote for real
python3 scripts/learn/promote_hits.py \
  --hits_json /tmp/phase4_hits.json \
  --query "phantasia and action"

# Verify
python3 scripts/learn/verify_knowledge.py --strict_order
```

### Output Schema

```json
{
  "id": "ku_00ddb2542e3d3dfa",
  "claim": "Extractive sentence from chunk...",
  "sources": [
    {
      "author": "Aristotle",
      "title": "De Anima",
      "path_rel": "rhetorical_ontology/DeAnima.pdf",
      "pages": "19-20",
      "chunk_id": "docid:00023"
    }
  ],
  "confidence": "high",
  "created_from_query": "phantasia and action"
}
```

### Directory Structure

```
god-learn/
├── knowledge.jsonl    # Append-only KUs
└── index.json         # id → byte offset (for idempotency)
```

---

## Phase 7: Cross-Document Reasoning

**Purpose**: Construct inspectable reasoning **as data**, not prose.

### Key Decisions

- **No embeddings, no vector search** - all retrieval complete by Phase 6
- **Operates only on promoted KUs** - closed, curated knowledge set
- **Char n-gram similarity (n=4)** - avoids domain overfitting
- **Deterministic top-K pruning** - prevents combinatorial explosion

### Relation Types

| Relation | Meaning |
|----------|---------|
| `support` | KU A provides evidence for KU B |
| `contrast` | KU A presents opposing view to KU B |
| `elaboration` | KU A expands on KU B |
| `inheritance` | KU A is a specialization of KU B |
| `conflict` | KU A contradicts KU B |

### Commands

```bash
# Build reasoning graph
python3 scripts/reason/reason_over_knowledge.py \
  --knowledge god-learn/knowledge.jsonl \
  --out god-reason \
  --top_k_per_unit 12

# Verify
python3 scripts/reason/verify_reasoning.py \
  --knowledge god-learn/knowledge.jsonl \
  --reasoning god-reason/reasoning.jsonl \
  --strict_order
```

### Output Schema

```json
{
  "reason_id": "ru_0265cbc52dae4b20",
  "relation": "contrast",
  "topic": "all",
  "knowledge_ids": ["ku_abc...", "ku_def..."],
  "shared_ngrams_count": 34,
  "evidence": [
    {"ku_id": "...", "claim": "...", "sources": [...]}
  ],
  "score": 0.061483
}
```

### Directory Structure

```
god-reason/
├── reasoning.jsonl    # One reasoning unit per line
└── index.json         # Run metadata and statistics
```

---

## Phase 8: Long-Form Assembly

**Purpose**: Transform reasoning graph into academic prose without creating new knowledge.

### Phase 8A: Deterministic Assembly

Converts reasoning units to paragraphs with 1:1 mapping.

**Ordering Modes**:
- **Argument-driven** (recommended): Traverses graph from anchor KU, prioritizes `support → contrast → elaboration`
- **Relation-driven**: Groups by dominant relation type

```bash
python3 scripts/assemble/assemble_longform.py \
  --ordering argument \
  --out god-assemble-arg

python3 scripts/assemble/verify_phase8.py --out god-assemble-arg --strict
```

### Phase 8B: Style Render Pass

Applies trained academic style without altering structure or provenance.

**Preserved verbatim**:
- Section headers
- KU footnote references (`[^ku_...]`)
- Footnote definitions
- Trace integrity

```bash
python3 scripts/assemble/render_style.py \
  --in god-assemble-arg/draft.md \
  --out god-assemble-arg/draft_styled.md \
  --profile academic-formal
```

### Output Structure

```
god-assemble-arg/
├── draft.md           # Assembled prose
├── outline.json       # Section structure
├── trace.jsonl        # Paragraph → reason_id → ku_id mapping
└── report_phase8.txt  # Assembly statistics
```

### Guarantees

- All prose grounded in citation-locked KUs
- All reasoning relations explicit and inspectable
- No hallucinated claims possible
- Reproducible from locked inputs

---

## Phase 9: Epistemic Interaction Layer

**Purpose**: Read-only interaction interface over locked Phase 1-8 artifacts.

### Sub-Phases

| Phase | Name | Description |
|-------|------|-------------|
| 9A | REPORT | Coverage diagnostics (deterministic, no LLM) |
| 9B | ANSWER | Structured, grounded presentation |
| 9C | SYNTHESIS | Controlled claim synthesis with grounding enforcement |

### Data-Source Modes

- **local**: Corpus-only, non-generative
- **hybrid**: Local first, external only with explicit justification

### Commands

```bash
# Basic answer (Phase 9B)
python3 scripts/interaction/answer.py \
  --query "phantasia and action" \
  --format md

# With synthesis (Phase 9C)
python3 scripts/interaction/answer.py \
  --query "phantasia and action" \
  --enable_synthesis \
  --format json

# Strict mode (enforce grounding)
python3 scripts/interaction/answer.py \
  --query "phantasia and action" \
  --enable_synthesis \
  --strict \
  --strict_inferences_fail
```

### Synthesis Output

```json
{
  "synthesis": {
    "enabled": true,
    "claims": [
      {
        "claim_id": "c1",
        "text": "...",
        "type": "assertion",
        "supports": ["ku_...", "ru_..."]
      }
    ]
  }
}
```

**Claim Types**:
- `assertion` - must be grounded in KU/RU
- `inference` - explicitly ungrounded (flagged)

### Invariants

- Phase 9 is read-only
- No mutation of Phases 1-8 artifacts
- All grounding references verified
- Ungrounded content never silently accepted

---

## Phase 10: Presentation Layer

**Purpose**: Convert Phase 9 artifacts into UI-friendly JSON.

### Properties

- **Presentation-only** - non-authoritative
- **Regenerable** - safe to discard and recreate
- **Grounding-validated** - every support ID verified against Phase 9

### Command

```bash
python3 scripts/presentation/phase10_render_ui.py \
  --report report.json \
  --answer-full answer.json \
  --out answer.ui.json \
  --max-output-tokens 1600
```

### Features

- Optional LLM-assisted rendering for readability
- Strict JSON parsing with validation
- Graceful fallback to deterministic rendering on any failure
- Debug instrumentation for troubleshooting

### Failure Handling

If LLM produces invalid output:
1. Raw output saved to `*.llm_raw.txt` (debug only)
2. Automatic fallback to deterministic rendering
3. No hallucinations enter the system

### Output Schema

```json
{
  "query": "phantasia and action",
  "ui": {
    "summary": "...",
    "key_points": [
      {
        "point": "...",
        "support": [
          {"id": "ku_...", "type": "knowledge_unit"}
        ]
      }
    ]
  },
  "generation": {
    "llm_used": true,
    "fallback": false
  }
}
```

---

## Architectural Invariants

All phases preserve these guarantees:

### 1. Citation Locking
Every claim traces to:
- Exact PDF file (by SHA-256)
- Exact page range (1-based)
- Exact chunk ID

### 2. Immutability
- Earlier phases are never modified by later phases
- Append-only where additions occur
- Deterministic and replayable

### 3. Explicit Failures
- No silent failures
- Clear diagnostics
- Verification at every phase boundary

### 4. No Hallucination
- Phase 6 extracts; it does not generate
- Phase 7 relates; it does not infer
- Phase 8 assembles; it does not create
- Phase 9/10 present; they do not invent

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION (1-3)                          │
│  PDF → pdftotext → Chunks → Embeddings → ChromaDB              │
│  Output: manifest.jsonl, vector_db_1536/                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RETRIEVAL (4-5)                            │
│  Query → Embed → Search → Filter → Rank (+ Highlights)          │
│  Output: Retrieved chunks with page provenance                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE (6-7)                              │
│  Chunks → Extract KUs → Build Reasoning Graph                   │
│  Output: knowledge.jsonl, reasoning.jsonl                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ASSEMBLY (8)                                 │
│  Reasoning → Paragraphs → Style                                 │
│  Output: draft.md, trace.jsonl                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  INTERACTION (9-10)                             │
│  Query → REPORT/ANSWER → UI Render                              │
│  Output: report.json, answer.json, answer.ui.json               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Verification Commands

```bash
# Phase 1-3: Ingestion integrity
./scripts/ingest/healthcheck.sh

# Phase 4: Retrieval + synthesis
./scripts/retrieval/phase4check.sh

# Phase 5: Highlight integration
./scripts/highlights/phase5check.sh

# Phase 6: Knowledge units
python3 scripts/learn/verify_knowledge.py --strict_order

# Phase 7: Reasoning graph
python3 scripts/reason/verify_reasoning.py \
  --knowledge god-learn/knowledge.jsonl \
  --reasoning god-reason/reasoning.jsonl

# Phase 8: Assembly
python3 scripts/assemble/verify_phase8.py --out god-assemble-arg --strict

# Full pipeline proof
python3 scripts/learn/verify_knowledge.py --strict_order && \
python3 scripts/ingest/verify_ingest.py --root corpus/ && \
./scripts/highlights/phase5check.sh
```

---

## Requirements

- Python 3.10+
- Local embedding server at `http://127.0.0.1:8000/embed` (1536-dim)
- ChromaDB
- `pdftotext` (poppler-utils)
- Optional: Claude/OpenAI API for Phase 9C/10 LLM features

---

## Summary

| Phase | Lines | Key Guarantee |
|-------|-------|---------------|
| 1-3 | ~2,000 | Every chunk traceable to PDF bytes + pages |
| 4-5 | ~1,500 | Citations derived from stored provenance only |
| 6 | ~500 | KUs are extractive, never generative |
| 7 | ~800 | Reasoning is explicit, auditable, deterministic |
| 8 | ~1,200 | Prose is grounded in locked reasoning |
| 9 | ~2,500 | Interaction is read-only, grounding-enforced |
| 10 | ~500 | Presentation is regenerable, non-authoritative |
| **Total** | **~9,000** | **No hallucinated content possible** |

---

## What's Next

**Phases 11-17** extend the pipeline with:
- Phase 11: Introspection Layer (explore and visualize)
- Phase 15: QA Infrastructure (regression detection)
- Phase 16: Provenance Auditing (chain verification)
- Phase 17: Corpus Growth (safe scaling)

See `GOD_LEARN_PHASES_11-17_README.md` for details.

---

*This document covers God-Learn Phases 1-10. For extended pipeline phases, see `GOD_LEARN_PHASES_11-17_README.md`.*
