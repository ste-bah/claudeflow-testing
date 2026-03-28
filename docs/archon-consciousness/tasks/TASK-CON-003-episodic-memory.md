# TASK-CON-003: Episodic Memory

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-001 (store), FR-CON-002 (retrieve + composite + MMR), FR-CON-003 (importance-modulated decay), FR-CON-004 (pin/unpin), FR-CON-026 (dual-stream + mid-session enrichment)
**Depends On**: TASK-CON-001 (Episode node label, PINNED_BY edge)
**Complexity**: Large

---

## Context

Episodic memory is the foundation for analogical reasoning — storing complete events (not just extracted rules) and retrieving them by similarity to the current situation. This task implements the full store/retrieve/pin lifecycle with dual-stream consolidation and composite scoring.

---

## Prerequisites

- TASK-CON-001 complete (Episode schema with 11 fields, PINNED_BY edge type)
- LanceDB accessible via `mcp__lancedb-memory__*` tools

---

## Scope

### In Scope
- **Episode storage (fast path)**:
  - Write 9 fields to MemoryGraph (all except keywords[], tags[] — left empty)
  - Write draft embedding to LanceDB (content-only concatenation: trigger + context + action_taken + outcome + lesson_extracted)
  - Set `embedding_status: "draft"`, `importance: 0.5`
  - Target: < 100ms, zero LLM calls
- **Episode storage (slow path enrichment)**:
  - Extract keywords (3-7) and tags via LLM
  - Regenerate embedding with full concatenation (trigger + context + action_taken + outcome + lesson_extracted + keywords + tags)
  - Upgrade `embedding_status` to `"enriched"`
  - Upgrade importance score via LLM assessment
- **Episode retrieval**:
  - Composite scoring: `score = 0.6 * relevance + 0.4 * recency_with_importance`
  - relevance = (1 - cosine_distance) from LanceDB
  - recency_with_importance = `min(1.0, e^(-lambda_eff * age_days))` where `lambda_eff = 0.023 * (1 - importance * 0.8)`
  - Minimum composite threshold: 0.3 (configurable)
  - MMR reranking (lambda=0.7, configurable) for diversity in top-3
  - recall_count as post-composite tiebreaker (within 0.05)
  - Return top-3 or empty list (EC-CON-001 — novel situation)
- **Mid-session enrichment**:
  - Trigger: retrieval returns only draft-status results AND 3+ drafts in current session
  - Synchronously enrich top-1 result (3-second timeout, fallback to draft with `enrichment_failed: true`)
- **Pin/unpin**:
  - PINNED_BY relationship with reason field
  - Pinned episodes: decay_factor = 1.0 always
- **Episode merge** (EC-CON-012):
  - Keep episode with more non-null fields; if tied, keep more recent
  - Union lesson_extracted (deduplicated)
  - Increment occurrence_count
  - Transfer EVIDENCED_BY edges to survivor
  - Pinned episodes never merge targets
- Unit tests for each operation, boundary conditions on formulas

### Out of Scope
- Reflection agent that creates episodes from self-assessment (TASK-CON-007)
- Slow-path consolidation scheduling (TASK-CON-010 wires this into /loop)
- Composite score recalibration logic (deferred — requires 50+ episodes of feedback data)

---

## Approach

1. Tests first for composite scoring formula at boundaries:
   - age_days=0, importance=0.0 → decay=1.0, composite = 0.6*rel + 0.4
   - age_days=0, importance=1.0 → decay=1.0, composite = 0.6*rel + 0.4
   - age_days=30, importance=0.0 → decay=0.5, composite = 0.6*rel + 0.2
   - age_days=150, importance=1.0 → decay=0.5, composite = 0.6*rel + 0.2
   - Pinned episode: decay=1.0 always
2. Implement `EpisodicMemory` class with `store_fast()`, `store_slow_enrich()`, `retrieve_top3()`, `pin()`, `unpin()`, `merge()`
3. Implement MMR reranking as pure function
4. Implement mid-session enrichment with timeout
5. Integration test: store 5 episodes, retrieve similar, verify scoring order

---

## Validation Criteria

- [ ] Fast-path store completes in < 100ms (no LLM calls)
- [ ] Draft embedding stored in LanceDB with `embedding_status: "draft"`
- [ ] Slow-path enrichment produces keywords, tags, enriched embedding
- [ ] Composite score formula produces correct values at all boundary conditions
- [ ] Composite score stays in [0.0, 1.0] for all inputs
- [ ] MMR reranking prevents 3 near-identical results
- [ ] Empty retrieval returns [] and logs "novel situation" (EC-CON-001)
- [ ] Mid-session enrichment fires only when conditions met, respects 3s timeout
- [ ] Pin/unpin works; pinned episodes exempt from decay
- [ ] Merge algorithm correct: non-null field count, lesson union, edge transfer, pinned protection
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_episodic_memory.py -v
pytest tests/archon-consciousness/test_composite_scoring.py -v
pytest tests/archon-consciousness/test_mmr_reranking.py -v
pytest tests/archon-consciousness/test_episode_merge.py -v
```
