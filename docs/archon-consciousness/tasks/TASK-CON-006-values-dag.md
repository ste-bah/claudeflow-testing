# TASK-CON-006: Values DAG + Conflict Resolution

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-013 (DAG structure + defeasible logic), FR-CON-014 (6-step resolution algorithm), FR-CON-015 (cycle detection), FR-CON-028 (tier classification)
**Depends On**: TASK-CON-001 (ValuesNode label, edge types, ContextDescriptor)
**Complexity**: Large

---

## Context

The values DAG resolves conflicts between contradictory behavioral rules using defeasible logic. It has 4 tiers, 3 edge types, context-sensitive matching, hysteresis caching, and a 6-step resolution algorithm. This is the most algorithmically complex subsystem.

---

## Prerequisites

- TASK-CON-001 complete (ValuesNode, STRICT_PRIORITY/DEFEASIBLE_PRIORITY/DEFEATS edges, ContextDescriptor)
- Rule registry with rule_ids and tier assignments available

---

## Scope

### In Scope
- **DAG structure** (FR-CON-013):
  - 4 tiers: safety > ethics > guidelines > helpfulness
  - 3 edge types with properties per schema
  - Hysteresis: session-scoped cache keyed by unordered pair {A, B}
- **6-step resolution algorithm** (FR-CON-014):
  - Step 0: Hysteresis cache check (FIRST — return cached winner if exists)
  - Step 1: Tier check (different tiers → higher wins; unseeded → default guidelines)
  - Step 2: STRICT_PRIORITY (direct + transitive, max 10 hops)
  - Step 3: DEFEATS (1-hop only, context must match via ContextDescriptor)
  - Step 4: DEFEASIBLE_PRIORITY (direct + transitive with context matching on ALL edges, max 10 hops, weight as tiebreaker)
  - Step 5: Unresolved (flag for Steven, EC-CON-004)
  - Cache every resolution from Steps 1-4
  - Log: both rule IDs, winner, step, path, context, reason
- **ContextDescriptor matching**:
  - Schema: `{mode: "pipeline"|"manual"|"any", user_state: <6 states>|"any", task_type: "coding"|"research"|"review"|"any"}`
  - Field-by-field: "any" matches everything, specific values require exact match, null context matches all
- **Cycle detection** (FR-CON-015):
  - Detect cycles in STRICT_PRIORITY and DEFEASIBLE_PRIORITY edges
  - Flag for Steven; block resolution until resolved
- **Tier classification** (FR-CON-028):
  - Functions to assign/reassign tier to a rule
  - Default: guidelines for unclassified rules
  - Tier assignment is user-driven (any rule can be any tier)
- **Lifecycle integration**:
  - Steps 2-4 skip edges where either endpoint is archived/deprecated (FR-CON-030)
  - Archiving a rule flushes hysteresis entries involving that rule_id
- Unit tests for each step of the algorithm, ContextDescriptor matching, cycle detection, max-depth enforcement

### Out of Scope
- `/values` skill UI (TASK-CON-009)
- Populating the initial DAG (Human Oversight Checkpoint — Steven does this)
- Edge creation/deletion (part of `/values` skill in TASK-CON-009, but the underlying add_edge/remove_edge functions are in scope here)

---

## Approach

1. Tests first for ContextDescriptor matching: exact match, "any" wildcard, null context, mismatched fields
2. Tests for each algorithm step in isolation:
   - Step 0: cache hit, cache miss
   - Step 1: different tiers, same tier, unseeded rules
   - Step 2: direct STRICT edge, transitive STRICT (3 hops), max 10 depth exceeded
   - Step 3: DEFEATS with matching context, non-matching context, 1-hop only
   - Step 4: DEFEASIBLE direct, transitive with context on all edges, mixed context paths, weight tiebreaker
   - Step 5: no path → unresolved
3. Tests for cycle detection: simple cycle (A→B→A), longer cycle (A→B→C→A), no cycle
4. Implement `ValuesDAG` class with:
   - `resolve_conflict(rule_a, rule_b, current_context) -> Resolution`
   - `add_edge(source, target, edge_type, weight?, context?)`
   - `remove_edge(source, target)`
   - `detect_cycles() -> list[Cycle]`
   - `assign_tier(rule_id, tier)`
   - `flush_hysteresis(rule_id?)` — flush one rule's entries or all
   - Internal `_hysteresis_cache: dict[frozenset, Resolution]`
5. Resolution object: `{winner, loser, step, path, context_evaluated, reason}`
6. Performance target: < 50ms for 200-node graph (NFR-CON-PERF-003)

---

## Validation Criteria

- [ ] Step 0 (hysteresis): cached winner returned without traversal
- [ ] Step 1 (tier): safety beats everything, guidelines beats helpfulness, same-tier falls through
- [ ] Step 1: unseeded rule defaults to guidelines
- [ ] Step 2 (STRICT): direct edge works, transitive (3 hops) works, 11-hop chain → treated as no path
- [ ] Step 3 (DEFEATS): matching context blocks target, non-matching ignored, no transitive
- [ ] Step 4 (DEFEASIBLE): context matching on all edges, mismatched edge invalidates path, weight tiebreaker
- [ ] Step 5: no valid path → unresolved, logged
- [ ] Cycle detection catches A→B→A and A→B→C→A
- [ ] Archived rule edges skipped in Steps 2-4
- [ ] Archiving flushes relevant hysteresis entries
- [ ] Resolution logging includes all required fields
- [ ] < 50ms for 200-node graph (benchmark test)
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_context_matching.py -v
pytest tests/archon-consciousness/test_conflict_resolution.py -v
pytest tests/archon-consciousness/test_cycle_detection.py -v
pytest tests/archon-consciousness/test_dag_performance.py -v
```
