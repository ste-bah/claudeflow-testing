# TASK-CON-001: MemoryGraph Schema + Rule Registry

**Status**: Ready
**Phase**: 1 — Foundation
**Implements**: FR-CON-001 (episode schema), FR-CON-009 (compliance score schema), FR-CON-013 (DAG node/edge schema), FR-CON-029 (rule_id registry), FR-CON-030 (rule lifecycle)
**Depends On**: None (first task)
**Complexity**: Medium

---

## Context

This task establishes the MemoryGraph schema foundation that all 6 subsystems build on. Nothing can be implemented until these node labels, properties, and edge types exist. This is pure schema + helper code — no business logic beyond CRUD and lifecycle state transitions.

---

## Prerequisites

- MemoryGraph (FalkorDB) running and accessible via `mcp__memorygraph__*` tools
- LanceDB running and accessible via `mcp__lancedb-memory__*` tools
- Existing MemoryGraph memories are NOT modified (GUARD-CON-004)

---

## Scope

### In Scope
- Define 7 MemoryGraph node labels with property schemas:
  - `Episode` (11 fields: timestamp, trigger, context, action_taken, outcome, emotional_valence, lesson_extracted, keywords[], tags[], occurrence_count, importance)
  - `PatternScore` (fields: rule_id, score, last_tested_session, tested_session_count, last_delta, trend, status)
  - `ValuesNode` (fields: rule_id, rule_text, tier, status, created_at)
  - `EmotionalState` (fields: timestamp, previous_state, new_state, confidence, evidence)
  - `Reflection` (fields: session_id, duration, partial, items[])
  - `Intent` (fields: goal_id, description, tier, confidence, status, created_at)
  - `SessionEvent` (fields: session_id, sequence_number, event_type, content, timestamp)
- Define 7 MemoryGraph edge types:
  - `STRICT_PRIORITY` (weight: float, no context)
  - `DEFEASIBLE_PRIORITY` (weight: float, context: ContextDescriptor)
  - `DEFEATS` (context: ContextDescriptor)
  - `EVIDENCED_BY` (timestamp: datetime)
  - `CONTRADICTED_BY` (timestamp: datetime, evidence: string)
  - `SUPERSEDED_BY` (timestamp: datetime)
  - `PINNED_BY` (reason: string)
- Define ContextDescriptor schema: `{mode: string, user_state: string, task_type: string}`
- Implement stable rule_id registry:
  - Create/read/archive/deprecate rules
  - Collision resolution (qualifier word, then -N suffix)
  - rule_id uniqueness enforcement
  - Archived IDs permanently reserved
- Implement rule lifecycle state machine: active → archived, active → deprecated
- Helper functions for common queries (get_active_rules, get_rule_by_id, count_active_rules)
- Unit tests for all schema operations and lifecycle transitions

### Out of Scope
- Episode retrieval/scoring logic (TASK-CON-003)
- EWMA computation (TASK-CON-004)
- DAG traversal/conflict resolution algorithm (TASK-CON-006)
- Reflection agent logic (TASK-CON-007)
- Hook wiring (TASK-CON-010)

---

## Approach

1. Define each node label as a Python dataclass or TypeScript interface with validation
2. Write MemoryGraph helper module that wraps `mcp__memorygraph__store_memory` / `get_memory` / `update_memory` / `delete_memory` with typed wrappers per node label
3. Write rule registry module with create_rule, archive_rule, deprecate_rule, get_rule, list_active_rules
4. Write collision resolution as a pure function: `generate_rule_id(rule_text, existing_ids) -> str`
5. Tests first for each module

---

## Validation Criteria

- [ ] All 7 node labels can be created, read, updated in MemoryGraph
- [ ] ValuesNode supports all 3 edge types with correct properties
- [ ] Rule lifecycle transitions work: active→archived, active→deprecated
- [ ] Archived rule_ids cannot be reused (test: create, archive, attempt create with same ID → error)
- [ ] Collision resolution produces unique IDs (test: 3 rules with similar content → 3 distinct IDs)
- [ ] `count_active_rules()` excludes archived/deprecated
- [ ] Existing MemoryGraph memories are untouched (regression test: recall_memories still works)
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_schema.py -v
pytest tests/archon-consciousness/test_rule_registry.py -v
pytest tests/archon-consciousness/test_rule_lifecycle.py -v
```
