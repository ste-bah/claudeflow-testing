# TASK-CON-008: Theory of Intent

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-021 (intent graph + CONTRADICTED_BY + two-tier), FR-CON-022 (confidence formula), FR-CON-023 (query during ambiguity)
**Depends On**: TASK-CON-001 (Intent node label, EVIDENCED_BY/CONTRADICTED_BY edges), TASK-CON-007 (reflection agent for session goal promotion)
**Priority**: SHOULD (not blocking for MVP — can be deferred)
**Complexity**: Medium

---

## Context

The theory of intent models Steven's underlying goals and motivations (not just the rules he states). It links inferred goals to the corrections and instructions that evidence them, enabling better edge-case judgment. This subsystem is marked SHOULD in the PRD — it can be deferred if implementation budget is tight.

---

## Prerequisites

- TASK-CON-001 complete (Intent node, EVIDENCED_BY, CONTRADICTED_BY, SUPERSEDED_BY edges)
- TASK-CON-007 complete (reflection agent handles session goal promotion logic)

---

## Scope

### In Scope
- **Intent graph storage** (FR-CON-021):
  - Goal nodes with: goal_id, description, tier (persistent/session), confidence, status (active/archived), created_at
  - EVIDENCED_BY edges linking goals to correction/instruction memories (with timestamp)
  - CONTRADICTED_BY edges for explicit contradiction tracking (with timestamp + evidence text)
- **Two-tier intents** (FR-CON-021):
  - Persistent: cross-session goals (e.g., "high test coverage")
  - Session-scoped: auto-archived at session end (status="archived", tier="session")
  - Session goals do NOT participate in confidence calculations
  - Recurrence check: if same session goal (semantic similarity > 0.85, scanned against 50 most recent archived session intents) recurs in 3+ sessions → propose promotion to persistent
- **Confidence formula** (FR-CON-022):
  - Confidence = f(evidence_count, recency)
  - Min 3 evidence items for confidence > 0.5
  - 50% weight loss per 60 days without new evidence
  - Computed at query time, not storage time
  - Confidence applies to persistent goals only
- **Ambiguity querying** (FR-CON-023):
  - Given current situation context, query intent model for relevant goals
  - Return goals with confidence > 0.3 that are relevant to the situation
  - Include reasoning: which goal, what evidence, how it informs the decision
- **Contradiction handling**:
  - CONTRADICTED_BY edges are queryable and auditable
  - Goal with more contradictions than evidence → flag for review
- Unit tests for confidence formula, recurrence check, contradiction tracking

### Out of Scope
- `/intent` skill UI (TASK-CON-009)
- Automatic intent inference from corrections (Phase 2 — for now, intents are created manually or by reflection agent)

---

## Approach

1. Tests first for confidence formula:
   - 3 evidence items, all recent → confidence ~0.6
   - 3 evidence items, 61 days old → confidence ~0.3 (50% decay)
   - 2 evidence items → confidence < 0.5
   - 0 evidence (all expired) → archive intent (EC-CON-010)
2. Tests for two-tier lifecycle: create session goal → auto-archive at end → recurrence check after 3 sessions → promotion proposal
3. Tests for contradiction: 2 evidence + 3 contradictions → flagged for review
4. Implement `IntentModel` class with:
   - `create_goal(description, tier, evidence?)` → goal_id
   - `add_evidence(goal_id, evidence_ref)` → EVIDENCED_BY edge
   - `add_contradiction(goal_id, contradiction_text)` → CONTRADICTED_BY edge
   - `compute_confidence(goal_id) -> float` — at query time
   - `archive_session_goals(session_id)`
   - `check_recurrence(goal_description) -> Optional[promotion_proposal]`
   - `query_relevant_goals(context) -> list[GoalWithReasoning]`
5. Recurrence check uses LanceDB similarity search against archived session intent embeddings

---

## Validation Criteria

- [ ] Goal creation with both tiers works
- [ ] EVIDENCED_BY edges link to correction/instruction memories
- [ ] CONTRADICTED_BY edges store timestamp + evidence text
- [ ] Confidence formula: 3 evidence recent → > 0.5, 2 evidence → < 0.5, 61-day decay → ~50% loss
- [ ] Confidence computed at query time, not cached
- [ ] Session goals auto-archived at session end
- [ ] Session goals excluded from confidence calculations
- [ ] Recurrence check: 3+ occurrences (similarity > 0.85) → promotion proposal
- [ ] Recurrence scan limited to 50 most recent archived session intents
- [ ] Zero-evidence goals archived with reason "evidence_expired" (EC-CON-010)
- [ ] Ambiguity query returns goals with confidence > 0.3 + reasoning
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_intent_model.py -v
pytest tests/archon-consciousness/test_intent_confidence.py -v
pytest tests/archon-consciousness/test_intent_recurrence.py -v
pytest tests/archon-consciousness/test_intent_contradiction.py -v
```
