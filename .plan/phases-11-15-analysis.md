# Analysis Plan: God-Learn Phases 11-15

## Context
User proposes 5 additional phases to extend the god-learn system beyond Phase 10. The existing system (Phases 1-10) establishes:
- Deterministic ingestion → embeddings → retrieval (Phases 1-4)
- Highlight-aware reranking (Phase 5)
- Knowledge promotion to KUs (Phase 6)
- Cross-document reasoning as data (Phase 7)
- Assembly into academic prose (Phase 8)
- Epistemic interaction layer (Phase 9)
- UI rendering (Phase 10)

## Current Data Structures
- **KUs (knowledge.jsonl)**: id, claim, sources[], confidence, tags[], created_from_query, debug{}
- **Reasoning (reasoning.jsonl)**: reason_id, relation, knowledge_ids[], shared_ngrams, evidence[], score, llm{}
- All artifacts are JSONL-based, append-only, immutable

## Proposed Phases to Analyze

### Phase 11 — Interactive Exploration Layer
**Goal**: Navigate Phase 9 artifacts (UI/CLI)
**Key Activities**: Expand/collapse, graph traversal, filtering
**Invariant**: Read-only, Phase 9 is authority

### Phase 12 — Visualization & Graph Introspection
**Goal**: Make reasoning/coverage visible
**Key Activities**: Reasoning graphs, coverage heatmaps, promotion lineage, export formats
**Invariant**: Visualization reflects data without interpretation

### Phase 13 — Corpus Growth & Rebalancing
**Goal**: Scale corpus without semantic drift
**Key Activities**: Ingest new docs, selective Phase 6-7 reruns, calibration
**Invariant**: Growth is additive, no silent invalidation

### Phase 14 — Comparative / Multi-Corpus Reasoning
**Goal**: Support cross-corpus comparisons
**Key Activities**: Corpus namespaces, within/across reasoning, origin diagnosis
**Invariant**: No implicit blending, explicit boundaries

### Phase 15 — Evaluation, Auditing, and QA
**Goal**: Measure epistemic reliability
**Key Activities**: Coverage regressions, reasoning stability, promotion consistency, CI validation
**Invariant**: Failures are explicit and diagnosable

## Analysis Approach

### 1. Architectural Coherence
- Does each phase preserve immutability guarantees?
- Are phase boundaries clean?
- Do phases respect the "knowing vs saying" boundary?

### 2. Implementation Complexity
- Estimate engineering effort for each phase
- Identify dependencies on existing infrastructure
- Flag technical challenges

### 3. Risk Assessment
- Where could epistemic guarantees be violated?
- What are the failure modes?
- How can we verify correctness?

### 4. Prioritization
- Which phases deliver most value?
- What's the logical implementation order?
- Are any phases redundant or premature?

### 5. Integration Points
- How do phases integrate with existing CLI?
- What new artifacts are needed?
- What verification scripts are required?

## Deliverables
1. Phase-by-phase architectural review
2. Risk matrix (epistemic, technical, UX)
3. Implementation roadmap with dependencies
4. Verification strategy for each phase
5. Recommendations for modifications/deferrals
