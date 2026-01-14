# God-Learn User Guide

A complete step-by-step guide for running the God-Agent pipeline from start to finish.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Adding Documents](#adding-documents)
5. [Running the Pipeline](#running-the-pipeline)
6. [Exploring Your Knowledge Base](#exploring-your-knowledge-base)
7. [Asking Questions](#asking-questions)
8. [Quality Assurance](#quality-assurance)
9. [Corpus Management](#corpus-management)
10. [Common Workflows](#common-workflows)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The God-Learn pipeline transforms PDF documents into a queryable, citation-locked knowledge base. The system:

- **Extracts** text from PDFs with page-level provenance
- **Embeds** content into vector space for semantic search
- **Promotes** important findings to Knowledge Units (KUs)
- **Reasons** across documents to build connections
- **Answers** questions with full citation trails

```
PDFs → Chunks → Embeddings → Knowledge Units → Reasoning Units → Answers
       (Phase 1-3)   (Phase 4-5)    (Phase 6)       (Phase 7)      (Phase 9)
```

---

## Prerequisites

### System Requirements

- Python 3.8+
- 4GB+ RAM (8GB recommended for large corpora)
- ChromaDB for vector storage

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd claudeflow-testing

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import chromadb; print('ChromaDB OK')"
```

### Directory Structure

The pipeline uses these directories:

```
project/
├── corpus/                    # Your PDF documents
│   └── <domain>/              # Organize by domain
│       └── document.pdf
├── god-learn/                 # Knowledge base
│   ├── knowledge.jsonl        # Knowledge Units
│   ├── index.json             # Index file
│   └── runs/                  # Pipeline run history
├── god-reason/                # Reasoning graph
│   └── reasoning.jsonl        # Reasoning Units
├── scripts/                   # Pipeline scripts
│   ├── ingest/                # Phase 1-3
│   ├── retrieval/             # Phase 4-5
│   ├── learn/                 # Phase 6
│   ├── reason/                # Phase 7
│   ├── assemble/              # Phase 8
│   ├── interaction/           # Phase 9
│   ├── presentation/          # Phase 10
│   ├── explore/               # Phase 11
│   ├── qa/                    # Phase 15
│   ├── audit/                 # Phase 16
│   └── growth/                # Phase 17
└── vector_db_1536/            # ChromaDB storage
```

---

## Quick Start

### 5-Minute Demo

```bash
# 1. Add a PDF to corpus
mkdir -p corpus/demo
cp your-document.pdf corpus/demo/

# 2. Run ingestion (extract text + embed)
python3 scripts/ingest/run_ingest.py --root corpus/demo
python3 scripts/ingest/run_ingest_phase2.py --root corpus/demo

# 3. Ask a question
python3 scripts/interaction/answer.py --query "What is the main argument?"

# 4. View the answer with citations
cat qa/answer-*.md
```

---

## Adding Documents

### Step 1: Organize Your Documents

Create domain folders to organize your PDFs:

```bash
# Create domain folders
mkdir -p corpus/philosophy
mkdir -p corpus/science
mkdir -p corpus/history

# Copy PDFs
cp aristotle-rhetoric.pdf corpus/philosophy/
cp einstein-relativity.pdf corpus/science/
```

**Best Practices:**
- Use descriptive folder names (these become "domains" in the system)
- Keep filenames clean (no special characters)
- One topic per domain helps with organization

### Step 2: Ingest Documents

#### Phase 1: Text Extraction

```bash
# Extract text from all PDFs in corpus
python3 scripts/ingest/run_ingest.py --root corpus/

# Or extract from a specific domain
python3 scripts/ingest/run_ingest.py --root corpus/philosophy
```

This creates:
- `scripts/ingest/manifest.jsonl` - tracks all processed documents
- Extracted text with page numbers preserved

#### Phase 2: Vector Embedding

```bash
# Embed all extracted chunks into ChromaDB
python3 scripts/ingest/run_ingest_phase2.py --root corpus/
```

This stores semantic embeddings for similarity search.

#### Phase 3: Verify Ingestion

```bash
# Run health check
./scripts/ingest/healthcheck.sh

# Or detailed verification
python3 scripts/ingest/verify_ingest.py --root corpus/
```

Expected output:
```
✓ Manifest: 5 documents
✓ Filesystem: 5 PDFs found
✓ Vectors: 5 documents embedded
✓ All checks passed
```

---

## Running the Pipeline

### Full Pipeline (Phases 1-10)

Run all phases in sequence:

```bash
# Phase 1: Extract text
python3 scripts/ingest/run_ingest.py --root corpus/

# Phase 2: Embed chunks
python3 scripts/ingest/run_ingest_phase2.py --root corpus/

# Phase 3: Verify
python3 scripts/ingest/verify_ingest.py --root corpus/

# Phase 4: Test retrieval
python3 scripts/retrieval/query_chunks.py "test query" --k 5

# Phase 6: Promote to Knowledge Units
python3 scripts/retrieval/query_chunks.py "your topic" --print_json > hits.json
python3 scripts/learn/promote_hits.py --hits_json hits.json --query "your topic"

# Phase 7: Build reasoning graph
python3 scripts/reason/reason_over_knowledge.py --out god-reason

# Phase 8: Assemble long-form output (optional)
python3 scripts/assemble/assemble_longform.py --ordering argument

# Phase 9: Answer questions
python3 scripts/interaction/answer.py --query "Your question here"

# Phase 10: Render for UI (optional)
python3 scripts/presentation/phase10_render_ui.py --answer-full qa/answer-latest.json
```

### Incremental Updates

When adding new documents to an existing corpus:

```bash
# 1. Create a snapshot first
python3 -m scripts.growth.cli.growth_cli snapshot -d "Before adding new docs"

# 2. Add new documents
cp new-doc.pdf corpus/philosophy/

# 3. Process incrementally (only new docs)
python3 -m scripts.growth.cli.growth_cli add corpus/philosophy/new-doc.pdf
python3 -m scripts.growth.cli.growth_cli process

# 4. Verify
python3 -m scripts.growth.cli.growth_cli status
```

---

## Exploring Your Knowledge Base

### View Corpus Statistics

```bash
# Quick stats
python3 -m scripts.explore.cli.god_explore stats
```

Output:
```
=== Corpus Statistics ===
Knowledge Units: 127
Reasoning Units: 45
Sources: 12
Domains: 3
Average confidence: 0.82
```

### Browse Knowledge Units

```bash
# List all KUs
python3 -m scripts.explore.cli.god_explore list kus

# Filter by query
python3 -m scripts.explore.cli.god_explore list kus --query "rhetoric"

# Show detailed KU info
python3 -m scripts.explore.cli.god_explore show ku ku-abc123
```

### Browse Reasoning Units

```bash
# List all RUs
python3 -m scripts.explore.cli.god_explore list rus

# Show detailed RU info
python3 -m scripts.explore.cli.god_explore show ru ru-xyz789
```

### Trace Provenance

See exactly where a piece of knowledge came from:

```bash
# Trace a KU back to source
python3 -m scripts.explore.cli.god_explore trace ku ku-abc123
```

Output:
```
=== Provenance Chain ===
KU: ku-abc123
  └─ Chunk: chunk-456
      └─ Source: philosophy/aristotle-rhetoric.pdf
          └─ Page: 42
              └─ Text: "Rhetoric is the counterpart of dialectic..."
```

### Generate Knowledge Graphs

```bash
# Interactive graph
python3 -m scripts.explore.cli.god_explore graph --query "your topic"

# Export as DOT (for Graphviz)
python3 -m scripts.explore.cli.god_explore graph --format dot > graph.dot

# Export as Cytoscape JSON
python3 -m scripts.explore.cli.god_explore graph --format cytoscape > graph.json
```

---

## Asking Questions

### Basic Questions

```bash
# Simple question
python3 scripts/interaction/answer.py --query "What is rhetoric?"
```

### Advanced Options

```bash
# With synthesis (combines knowledge across sources)
python3 scripts/interaction/answer.py --query "Compare Aristotle and Plato on rhetoric" --enable_synthesis

# Strict grounding (fail if insufficient evidence)
python3 scripts/interaction/answer.py --query "What did Aristotle say about memory?" --strict

# JSON output (for programmatic use)
python3 scripts/interaction/answer.py --query "Your question" --format json
```

### Coverage Reports

Before asking, see what your corpus knows about a topic:

```bash
python3 scripts/interaction/report.py --query "memory and cognition"
```

Output:
```
=== Coverage Report ===
Query: "memory and cognition"
Relevant KUs: 23
Coverage: HIGH (87%)
Top sources:
  - aristotle-memory.pdf (12 KUs)
  - plato-theaetetus.pdf (8 KUs)
  - cognitive-science.pdf (3 KUs)
Gaps:
  - Modern neuroscience perspective
  - Empirical studies
```

---

## Quality Assurance

### QA Dashboard

```bash
# Full dashboard
python3 -m scripts.qa.cli.qa_cli dashboard

# Compact single-line status
python3 -m scripts.qa.cli.qa_cli dashboard --compact

# Growth rate analysis
python3 -m scripts.qa.cli.qa_cli dashboard --growth
```

Dashboard output:
```
╔══════════════════════════════════════════════════════════════╗
║                     GOD-LEARN QA DASHBOARD                    ║
╠══════════════════════════════════════════════════════════════╣
║ Coverage:     ████████████████████░░░░  85%  [GOOD]          ║
║ Reasoning:    ██████████████████████░░  92%  [EXCELLENT]     ║
║ Consistency:  ████████████████████████  100% [EXCELLENT]     ║
║ Overall:      A (92/100)                                      ║
╚══════════════════════════════════════════════════════════════╝
```

### Run QA Checks

```bash
# All checks
python3 -m scripts.qa.cli.qa_cli check

# Specific checks
python3 -m scripts.qa.cli.qa_cli check --coverage
python3 -m scripts.qa.cli.qa_cli check --reasoning
python3 -m scripts.qa.cli.qa_cli check --consistency
```

### Capture Baselines

Track quality over time:

```bash
# Capture current state as baseline
python3 -m scripts.qa.cli.qa_cli baseline --all

# Later, compare against baseline
python3 -m scripts.qa.cli.qa_cli check
```

---

## Corpus Management

### Versioning & Snapshots

```bash
# View current status
python3 -m scripts.growth.cli.growth_cli status

# Create a snapshot before changes
python3 -m scripts.growth.cli.growth_cli snapshot -d "Before major update"

# With version bump
python3 -m scripts.growth.cli.growth_cli snapshot --bump minor

# List all snapshots
python3 -m scripts.growth.cli.growth_cli list

# Verify snapshot integrity
python3 -m scripts.growth.cli.growth_cli verify
```

### Rollback

If something goes wrong:

```bash
# List snapshots to find ID
python3 -m scripts.growth.cli.growth_cli list

# Rollback to specific snapshot
python3 -m scripts.growth.cli.growth_cli rollback snapshot-v1.2.0-abc123
```

### Compare Versions

```bash
python3 -m scripts.growth.cli.growth_cli diff v1.0.0 v1.1.0
```

Output:
```
=== Version Diff: v1.0.0 → v1.1.0 ===
Added documents: 3
  + philosophy/new-paper.pdf
  + science/experiment.pdf
  + history/archive.pdf
Removed documents: 0
Modified documents: 1
  ~ philosophy/aristotle.pdf (re-extracted)
New KUs: 47
New RUs: 12
```

### Rebalancing

Detect and fix knowledge imbalances:

```bash
# Check rebalance status
python3 -m scripts.growth.cli.growth_cli rebalance

# Run density analysis
python3 -m scripts.growth.cli.growth_cli rebalance --analyze

# Detect skew
python3 -m scripts.growth.cli.growth_cli rebalance --detect

# Auto-calibrate
python3 -m scripts.growth.cli.growth_cli rebalance --calibrate
```

---

## Common Workflows

### Workflow 1: Add New Research Papers

```bash
# 1. Snapshot current state
python3 -m scripts.growth.cli.growth_cli snapshot -d "Pre-update"

# 2. Add papers to corpus
cp paper1.pdf paper2.pdf corpus/research/

# 3. Process new documents
python3 -m scripts.growth.cli.growth_cli add corpus/research/paper1.pdf
python3 -m scripts.growth.cli.growth_cli add corpus/research/paper2.pdf
python3 -m scripts.growth.cli.growth_cli process

# 4. Verify
python3 -m scripts.qa.cli.qa_cli check
python3 -m scripts.explore.cli.god_explore stats
```

### Workflow 2: Research a Topic

```bash
# 1. Check coverage first
python3 scripts/interaction/report.py --query "your research topic"

# 2. If coverage is good, ask your question
python3 scripts/interaction/answer.py --query "What evidence supports X?" --enable_synthesis

# 3. Trace interesting findings
python3 -m scripts.explore.cli.god_explore trace ku <ku-id-from-answer>

# 4. Generate a visual knowledge graph
python3 -m scripts.explore.cli.god_explore graph --query "your topic" --format dot > topic.dot
dot -Tpng topic.dot -o topic.png
```

### Workflow 3: Write a Paper

```bash
# 1. Build knowledge on your topic
python3 scripts/retrieval/query_chunks.py "your thesis topic" --print_json > thesis_hits.json
python3 scripts/learn/promote_hits.py --hits_json thesis_hits.json --query "your thesis"

# 2. Build reasoning graph
python3 scripts/reason/reason_over_knowledge.py --out god-reason

# 3. Generate draft
python3 scripts/assemble/assemble_longform.py --ordering argument --out drafts/thesis-draft.md

# 4. Apply academic style
python3 scripts/assemble/render_style.py --in drafts/thesis-draft.md --out drafts/thesis-styled.md
```

### Workflow 4: Audit Provenance

```bash
# 1. Run full audit
python3 -m scripts.audit.cli.audit_cli full

# 2. Check for gaps
python3 -m scripts.audit.cli.audit_cli gaps

# 3. Trace specific items
python3 -m scripts.audit.cli.audit_cli chain ru-xyz789

# 4. Auto-fix issues
python3 -m scripts.audit.cli.audit_cli full --fix
```

### Workflow 5: Monitor Corpus Health

```bash
# Daily check
python3 -m scripts.qa.cli.qa_cli dashboard --compact

# Weekly deep check
python3 -m scripts.qa.cli.qa_cli check
python3 -m scripts.growth.cli.growth_cli rebalance --detect
python3 -m scripts.audit.cli.audit_cli gaps

# Monthly
python3 -m scripts.growth.cli.growth_cli snapshot --bump minor -d "Monthly backup"
```

---

## Troubleshooting

### Common Issues

#### "No documents found in corpus"

```bash
# Check corpus structure
ls -la corpus/

# Ensure PDFs exist
find corpus/ -name "*.pdf" | head

# Re-run ingestion
python3 scripts/ingest/run_ingest.py --root corpus/
```

#### "ChromaDB connection failed"

```bash
# Check ChromaDB is running
python3 -c "import chromadb; c = chromadb.Client(); print('OK')"

# Check vector_db directory exists
ls vector_db_1536/

# Reinitialize if needed
rm -rf vector_db_1536/
python3 scripts/ingest/run_ingest_phase2.py --root corpus/
```

#### "Knowledge units not found"

```bash
# Check knowledge file exists
ls -la god-learn/knowledge.jsonl

# Verify content
head god-learn/knowledge.jsonl

# Re-run promotion
python3 scripts/retrieval/query_chunks.py "your topic" --print_json > hits.json
python3 scripts/learn/promote_hits.py --hits_json hits.json --query "your topic"
```

#### "Answer has no citations"

```bash
# Check reasoning graph exists
ls -la god-reason/

# Rebuild reasoning
python3 scripts/reason/reason_over_knowledge.py --out god-reason

# Try with strict mode to see what's missing
python3 scripts/interaction/answer.py --query "your question" --strict
```

#### "Skew detected in corpus"

```bash
# View skew details
python3 -m scripts.growth.cli.growth_cli rebalance --detect

# Generate calibration plan
python3 -m scripts.growth.cli.growth_cli rebalance --calibrate

# Add documents to underrepresented domains
python3 -m scripts.growth.cli.growth_cli add corpus/underrepresented-domain/
```

### Health Check Commands

```bash
# Full system health check
./scripts/ingest/healthcheck.sh && \
python3 -m scripts.qa.cli.qa_cli dashboard --compact && \
python3 -m scripts.growth.cli.growth_cli status
```

### Reset and Start Fresh

```bash
# WARNING: Destructive - removes all processed data
rm -rf god-learn/ god-reason/ vector_db_1536/ .corpus-*

# Re-process everything
python3 scripts/ingest/run_ingest.py --root corpus/
python3 scripts/ingest/run_ingest_phase2.py --root corpus/
```

---

## Exit Codes

All commands follow these conventions:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation/grounding failure |

---

## Further Reading

- **Detailed Phase Documentation**: See `GOD_LEARN_PHASES_1-10_README.md` and `GOD_LEARN_PHASES_11-17_README.md`
- **Command Reference**: See `GOD_LEARN_COMMAND_REFERENCE.md` for all CLI commands
- **Architecture**: See individual phase summary files in `scripts/*/PHASE*_SUMMARY.md`

---

## Summary

The God-Learn pipeline gives you:

1. **Ingestion** (Phases 1-3): PDF → searchable chunks
2. **Retrieval** (Phases 4-5): Semantic search with highlight boosting
3. **Learning** (Phases 6-7): Build knowledge and reasoning graphs
4. **Generation** (Phases 8-10): Answers, papers, and UI-ready output
5. **Introspection** (Phase 11): Explore and visualize your knowledge
6. **Quality** (Phases 15-17): QA, auditing, and corpus management

Start simple with the Quick Start, then expand as needed. The pipeline is designed to grow with your research.

---

*For questions or issues, see the project documentation or raise an issue in the repository.*
