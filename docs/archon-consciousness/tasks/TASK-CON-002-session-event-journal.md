# TASK-CON-002: Session Event Journal

**Status**: Ready
**Phase**: 1 — Foundation
**Implements**: FR-CON-025 (session event journal), FR-CON-008 (emotional state transition logging)
**Depends On**: TASK-CON-001 (SessionEvent + EmotionalState node labels)
**Complexity**: Small

---

## Context

The session event journal writes key events to MemoryGraph during the session, enabling crash-resilient reflection (EC-CON-007). Events are batched (up to 5) to avoid per-event blocking. This task also implements the EmotionalState transition logger since it shares the same write infrastructure.

---

## Prerequisites

- TASK-CON-001 complete (SessionEvent and EmotionalState node labels exist)
- MemoryGraph accessible

---

## Scope

### In Scope
- Session event journal writer with batching:
  - Accumulate events in-memory list
  - Flush to MemoryGraph every 5 user messages or on explicit flush call
  - Auto-increment sequence_number per session
  - Support event types: correction, decision, state_change, rule_applied, novel_situation_encountered
- Emotional state transition logger:
  - Write EmotionalState nodes on state change
  - Fields: timestamp, previous_state, new_state, confidence, evidence
- Flush-on-demand for session end (Stop hook will call this)
- Unit tests for batching, flushing, sequence numbering

### Out of Scope
- The Stop hook integration itself (TASK-CON-010)
- Emotional state detection logic (TASK-CON-005) — this task only writes transitions, doesn't detect them
- Retroactive reflection from journal (TASK-CON-007)

---

## Approach

1. Create `SessionJournal` class with `log_event(event_type, content)` and `flush()` methods
2. Internal buffer (list), counter for sequence_number, session_id from environment
3. `flush()` writes all buffered events to MemoryGraph in a single call, clears buffer
4. Create `EmotionalStateLogger` with `log_transition(prev, new, confidence, evidence)` — thin wrapper over MemoryGraph write
5. Tests: buffer accumulation, flush writes correct count, sequence numbering, flush clears buffer, max 5 events lost on simulated crash

---

## Validation Criteria

- [ ] Events accumulate in buffer without MemoryGraph writes until flush
- [ ] flush() writes all buffered events with correct sequence_numbers
- [ ] Buffer is cleared after flush
- [ ] Emotional state transitions are written as EmotionalState nodes
- [ ] Event types validated against allowed enum
- [ ] Simulated crash scenario: buffer has 5 events, no flush → 5 events lost (acceptable per FR-CON-025)
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_session_journal.py -v
pytest tests/archon-consciousness/test_emotional_state_logger.py -v
```
