# TASK-CON-010: Integration Test + Hook Wiring

**Status**: Ready
**Phase**: 3 — Integration
**Implements**: All NFRs (13), all ECs (12), all GUARDs (9)
**Depends On**: All prior tasks (001-009)
**Complexity**: Large

---

## Context

This is the final task. It wires all 6 subsystems together via Claude Code hooks (SessionStart, Stop, PreCompact), runs the end-to-end integration test, verifies all NFR performance budgets, validates all edge cases, and confirms all guardrails are enforced. No new business logic — this is pure integration and verification.

---

## Prerequisites

- All tasks TASK-CON-001 through TASK-CON-009 complete and passing
- Claude Code hooks infrastructure available (.claude/settings.json)
- `/loop` consolidation framework available for slow-path wiring

---

## Scope

### In Scope

**Hook Wiring:**
- **SessionStart hook**:
  - Compute spaced reinforcement priority (FR-CON-027) → inject top rules into consciousness block
  - Check for missing reflection from previous session (EC-CON-007) → trigger retroactive reflection
  - Initialize session journal (FR-CON-025)
  - Initialize emotional state to neutral (EC-CON-003)
  - Initialize hysteresis cache (empty)
- **Stop hook**:
  - Flush session event journal (FR-CON-025)
  - Run reflection agent (FR-CON-017) within 30-second budget
  - Archive session-scoped intents (FR-CON-021)
- **PreCompact hook**:
  - Flush session event journal (partial batch)
- **`/loop` integration**:
  - Add consolidation stages: episode-merge (EC-CON-012), slow-path enrichment (FR-CON-026), pattern-update
  - These stages run between sessions, not during

**NFR Verification (13 NFRs):**
- NFR-CON-PERF-001a/b: Episode embedding < 300ms, search < 200ms
- NFR-CON-PERF-002: Emotional classification < 100ms
- NFR-CON-PERF-003: DAG traversal < 50ms for 200 nodes
- NFR-CON-PERF-004: Reflection < 30 seconds
- NFR-CON-REL-001: Episode storage success > 99.5%
- NFR-CON-REL-002: Graceful degradation when MemoryGraph down
- NFR-CON-STOR-001/002: 1000 episode cap, 200 DAG node cap
- NFR-CON-SEC-001/002: No external calls, intent model read-only
- NFR-CON-COMPAT-001/002: Existing recall_memories works, /loop stages integrate

**Edge Case Verification (12 ECs):**
- EC-CON-001 through EC-CON-012 — each gets an explicit test

**Guardrail Verification (9 GUARDs):**
- GUARD-CON-001: Zero HTTP calls during emotional classification (mock network, assert no calls)
- GUARD-CON-002: Personality not self-modified without /values command
- GUARD-CON-003: Every conflict resolution logged
- GUARD-CON-004: Existing memories untouched (dedicated node labels only)
- GUARD-CON-005: Session start overhead < 2 seconds
- GUARD-CON-006: Neutral default when confidence < 0.6
- GUARD-CON-007: Each subsystem individually disableable via feature flag
- GUARD-CON-008: Episode/DAG caps enforced
- GUARD-CON-009: Detection never surfaced to user (grep for banned phrases)

**End-to-End Integration Test:**
- Full session lifecycle: start → work → receive correction → emotional state changes → reflection → next session recall of episode
- Verify episodic recall returns relevant episode in next session
- Verify pattern tracker score updated after reflection
- Verify values DAG resolves a conflict correctly

### Out of Scope
- New business logic (all logic is in tasks 001-009)
- Performance tuning (RISK-CON-009 — deferred to 30-session review)

---

## Approach

1. Wire hooks in `.claude/settings.json` — SessionStart, Stop, PreCompact
2. Wire `/loop` consolidation stages — add episode-merge and slow-path-enrichment
3. Write integration test suite:
   - Simulate full session lifecycle with mocked MemoryGraph/LanceDB
   - Inject corrections, verify reflection produces correct output
   - Verify episodic recall across "sessions" (simulated session boundary)
4. Write NFR benchmark tests:
   - Timing assertions for PERF targets
   - Load tests for STOR caps
   - Network mock for SEC verification
5. Write EC-specific tests (one per edge case, 12 total)
6. Write GUARD-specific tests (one per guardrail, 9 total)
7. Feature flag tests: disable each subsystem individually, verify others still work

---

## Validation Criteria

- [ ] SessionStart hook: injects prioritized rules, checks for missing reflection, initializes state
- [ ] Stop hook: flushes journal, runs reflection, archives session intents
- [ ] `/loop` stages: episode-merge and slow-path-enrichment run without disrupting existing 5 stages
- [ ] All 13 NFRs validated with benchmark/test evidence
- [ ] All 12 edge cases have explicit passing tests
- [ ] All 9 guardrails verified with test evidence
- [ ] End-to-end: correction in session N → episode stored → recall in session N+1 → pattern score updated
- [ ] Feature flags: each subsystem disableable independently
- [ ] Session start overhead < 2 seconds (GUARD-CON-005)
- [ ] Existing recall_memories regression test passes (NFR-CON-COMPAT-001)
- [ ] All tests pass
- [ ] Total test count across all 10 tasks >= 200 (Section 14 delivery criterion)

---

## Test Commands

```bash
# Integration tests
pytest tests/archon-consciousness/test_integration.py -v

# NFR benchmarks
pytest tests/archon-consciousness/test_nfr_performance.py -v
pytest tests/archon-consciousness/test_nfr_reliability.py -v
pytest tests/archon-consciousness/test_nfr_security.py -v
pytest tests/archon-consciousness/test_nfr_compatibility.py -v

# Edge case tests
pytest tests/archon-consciousness/test_edge_cases.py -v

# Guardrail tests
pytest tests/archon-consciousness/test_guardrails.py -v

# Feature flag tests
pytest tests/archon-consciousness/test_feature_flags.py -v

# Full suite
pytest tests/archon-consciousness/ -v --tb=short
```
