# TASK-CON-009: `/values` and `/intent` Skills

**Status**: Ready
**Phase**: 3 — User-Facing
**Implements**: FR-CON-016 (`/values` with 9 operations), FR-CON-024 (`/intent` operations)
**Depends On**: TASK-CON-004 (pattern tracker for show-atrophy), TASK-CON-006 (values DAG for all `/values` ops), TASK-CON-008 (intent model for `/intent` ops)
**Complexity**: Medium

---

## Context

These two Claude Code skills are Steven's control interface for the consciousness system. `/values` manages the behavioral rule DAG (add, remove, prioritize, inspect). `/intent` manages the goal model (list, confirm, correct). Both are YAML skill files that invoke the underlying subsystem modules.

---

## Prerequisites

- TASK-CON-004 complete (PatternTracker for atrophy data)
- TASK-CON-006 complete (ValuesDAG for all DAG operations)
- TASK-CON-008 complete (IntentModel for intent operations)

---

## Scope

### In Scope
- **`/values` skill** (FR-CON-016) with 9 operations:
  1. `list` — show all active rules with rule_id, tier, score, trend
  2. `add <rule_text>` — create new rule, assign rule_id, default tier=guidelines
  3. `remove <rule_id>` — archive rule (FR-CON-030 lifecycle)
  4. `reprioritize <rule_a> <rule_b> <edge_type> [context]` — add/update priority edge
  5. `show-conflicts` — list all unresolved conflicts from recent sessions
  6. `show-atrophy` — list all rules with sessions_since_tested > 30 and score > 0.7
  7. `show-deep-chains` — list priority chains longer than 5 hops
  8. `deprecate <old_rule_id> <new_rule_id>` — deprecate rule with SUPERSEDED_BY edge
  9. `show-broken-chains` — list deprecation chains terminating at non-active rules
- **`/intent` skill** (FR-CON-024) with 4 operations:
  1. `list` — show all active persistent goals with confidence, evidence count
  2. `show-evidence <goal_id>` — show all EVIDENCED_BY and CONTRADICTED_BY edges
  3. `confirm <goal_id>` — boost confidence (adds explicit confirmation as evidence)
  4. `correct <goal_id> <new_description>` — update goal description, add correction event
  5. `promote <goal_id>` — promote session-scoped goal to persistent
- **Skill YAML files** with proper frontmatter (name, description, when-to-trigger)
- **Formatted output** for each operation (readable tables/lists in terminal)
- Unit tests for argument parsing and output formatting

### Out of Scope
- The underlying DAG/intent logic (already implemented in TASK-CON-006 and TASK-CON-008)
- Interactive mode / multi-step wizards (keep it simple: command + args → output)
- Session-start injection (TASK-CON-010 handles that via hooks)

---

## Approach

1. Create `/values` skill YAML in `.claude/skills/values/`
2. Create `/intent` skill YAML in `.claude/skills/intent/`
3. Each operation: parse args → call subsystem method → format output
4. Output format: aligned columns for lists, indented detail views for show-evidence
5. Error handling: invalid rule_id → "Rule not found: <id>", invalid operation → show help
6. Tests: argument parsing, each operation with mock subsystem, output formatting

---

## Validation Criteria

- [ ] `/values list` shows all active rules with rule_id, tier, score, trend columns
- [ ] `/values add "new rule text"` creates rule with auto-generated rule_id, tier=guidelines
- [ ] `/values remove <id>` archives rule (soft delete), retains rule_id
- [ ] `/values reprioritize` creates correct edge type with optional context
- [ ] `/values show-conflicts` lists unresolved pairs from recent sessions
- [ ] `/values show-atrophy` lists atrophying rules (sessions_since_tested > 30, score > 0.7)
- [ ] `/values show-deep-chains` lists chains > 5 hops
- [ ] `/values deprecate` creates SUPERSEDED_BY edge, sets status=deprecated
- [ ] `/values show-broken-chains` lists chains terminating at non-active rules
- [ ] `/intent list` shows persistent goals with confidence and evidence count
- [ ] `/intent show-evidence <id>` shows EVIDENCED_BY and CONTRADICTED_BY edges
- [ ] `/intent confirm <id>` adds confirmation evidence, boosts confidence
- [ ] `/intent correct <id>` updates description, logs correction
- [ ] `/intent promote <id>` promotes session goal to persistent
- [ ] Invalid arguments produce helpful error messages
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_values_skill.py -v
pytest tests/archon-consciousness/test_intent_skill.py -v
```
