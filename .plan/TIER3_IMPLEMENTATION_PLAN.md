# Tier 3 Implementation Plan

## Overview
Five larger features with higher effort but significant impact.

---

## #11 Corpus Diff Visualization

**Goal**: Show changes between corpus snapshots visually.

**Implementation**:
1. Create `scripts/growth/diff_visualizer.py`:
   - Load two snapshots by ID or "current" vs snapshot
   - Compare: added docs, removed docs, modified docs
   - Compare: KU count changes, chunk count changes
   - Output: text summary, JSON, or ASCII table

2. Add to CLI: `god grow diff <snapshot1> <snapshot2>`

**Files**:
- NEW: `scripts/growth/diff_visualizer.py`
- EDIT: `scripts/god` (add diff subcommand to grow)

---

## #12 Web Dashboard

**Goal**: Browser-based interface for QA and exploration.

**Implementation**:
1. Create `scripts/dashboard/app.py`:
   - Flask/FastAPI lightweight server
   - Endpoints: /api/stats, /api/alerts, /api/history, /api/search
   - Static HTML dashboard with live updates

2. Create `scripts/dashboard/templates/`:
   - index.html - Main dashboard view
   - Static JS for AJAX updates

3. Add to CLI: `god dashboard` (starts server on localhost:5000)

**Files**:
- NEW: `scripts/dashboard/app.py`
- NEW: `scripts/dashboard/templates/index.html`
- EDIT: `scripts/god` (add dashboard command)

---

## #13 LaTeX/DOCX Export

**Goal**: Export assembled prose to academic formats.

**Implementation**:
1. Create `scripts/export/academic_export.py`:
   - Read assembled prose from Phase 8
   - Export to LaTeX (.tex) with proper citations
   - Export to DOCX using python-docx
   - Export to Markdown with citation links

2. Add to CLI:
   - `god export latex --input assembled.json --output paper.tex`
   - `god export docx --input assembled.json --output paper.docx`

**Dependencies**: python-docx

**Files**:
- NEW: `scripts/export/academic_export.py`
- EDIT: `scripts/god` (add export command)

---

## #14 Semantic Duplicate Detection

**Goal**: Find near-duplicate chunks using embedding similarity.

**Implementation**:
1. Create `scripts/qa/duplicate_detector.py`:
   - Load all chunk embeddings from vector DB
   - Compute pairwise similarity (above threshold = duplicate)
   - Use locality-sensitive hashing for efficiency
   - Report: duplicate pairs with similarity scores

2. Add to CLI: `god qa duplicates --threshold 0.95`

**Files**:
- NEW: `scripts/qa/duplicate_detector.py`
- EDIT: `scripts/god` (add duplicates to qa dispatcher)

---

## #15 Multi-Query Batching

**Goal**: Run multiple queries in parallel for efficiency.

**Implementation**:
1. Create `scripts/retrieval/batch_query.py`:
   - Accept file with queries (one per line) or JSON array
   - Run queries in parallel using ThreadPoolExecutor
   - Aggregate results into single output
   - Progress bar for batch status

2. Add to CLI: `god query --batch queries.txt --output results.json`

**Files**:
- NEW: `scripts/retrieval/batch_query.py`
- EDIT: `scripts/god` (add batch support to query)

---

## Execution Order

1. **#11 Diff Visualization** - Builds on existing snapshot infra
2. **#14 Duplicate Detection** - Uses existing vector DB
3. **#15 Multi-Query Batching** - Extends query functionality
4. **#13 LaTeX/DOCX Export** - Requires python-docx install
5. **#12 Web Dashboard** - Most complex, last

---

## Dependencies to Install

```bash
pip install python-docx flask
```

