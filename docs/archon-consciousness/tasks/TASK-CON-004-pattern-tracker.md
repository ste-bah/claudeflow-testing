# TASK-CON-004: Pattern Tracker

**Status**: Ready
**Phase**: 2 — Core Subsystems
**Implements**: FR-CON-009 (score maintenance), FR-CON-010 (EWMA + warm-up + baseline decay), FR-CON-011 (trend classification), FR-CON-012 (regression + atrophy alerts), FR-CON-027 (spaced reinforcement priority)
**Depends On**: TASK-CON-001 (PatternScore node label)
**Complexity**: Medium

---

## Context

The pattern tracker monitors Archon's compliance with each behavioral rule over time. It uses EWMA scoring updated by the reflection agent, detects trends and regressions, and computes spaced reinforcement priority for session-start injection. This is the "am I getting better?" subsystem.

---

## Prerequisites

- TASK-CON-001 complete (PatternScore schema with rule_id, score, last_tested_session, tested_session_count, last_delta, trend, status)

---

## Scope

### In Scope
- **EWMA scoring** (FR-CON-010):
  - Observation values: correction=0.0, followed=1.0, near_miss=0.7
  - Multiple events per rule per session → average observations
  - Warm-up alpha=0.4 for first 3 TESTED sessions (`tested_session_count` tracks this), then alpha=0.2
  - Formula: `new_score = alpha * observation + (1 - alpha) * current_score`, clamp [0.0, 1.0]
  - Initial score for new rules: 0.5
- **Baseline regression decay** (FR-CON-010):
  - For untested rules: `score = 0.5 + (score - 0.5) * 0.98`
  - Applied each session for active rules not tested in that session
  - Does NOT increment `tested_session_count`
- **Trend classification** (FR-CON-011):
  - After 20+ tested sessions (not total sessions)
  - Linear regression slope on tested-session scores only (exclude decay-only sessions)
  - Improving: slope > +0.01, Stable: abs(slope) <= 0.01, Regressing: slope < -0.01
- **Alerts** (FR-CON-012):
  - Regression: 3+ consecutive tested-session score drops
  - Atrophy: `sessions_since_tested > 30` for score > 0.7, max 3 alerts per session (highest score first)
- **Spaced reinforcement priority** (FR-CON-027):
  - Formula: `priority = (1 - score) * 0.7 + min(0.3, sessions_since_tested * 0.03) + regression_boost`
  - regression_boost = 0.2 if last_delta < 0, else 0.0
  - Range [0.0, 1.2] — sorting only, do not clamp
  - Graduated injection: only rules with priority >= 0.05, min 3, max 10
  - 2 of 10 slots reserved for high-scoring (> 0.7) rules if they exist
  - When fewer than 5 rules meet threshold: "Most rules tracking well; reduced reinforcement"
- **Lifecycle integration** (FR-CON-030):
  - Archived/deprecated rules: frozen score, frozen trend, excluded from EWMA/decay/alerts
  - Only active rules processed
- Unit tests for all formulas at boundary conditions

### Out of Scope
- The reflection agent that produces observations (TASK-CON-007)
- Session-start hook that injects prioritized rules (TASK-CON-010)
- Who calls `update_score()` — that's the reflection agent's job

---

## Approach

1. Tests first for EWMA at boundaries:
   - score=0.5, obs=0.0, alpha=0.4 (warm-up) → 0.3
   - score=0.5, obs=1.0, alpha=0.4 → 0.7
   - score=0.5, obs=0.7, alpha=0.2 (standard) → 0.54
   - 3 consecutive corrections from 0.5 with warm-up → verify trajectory
   - 200 untested sessions from score=0.9 → verify convergence toward 0.5
   - 200 untested sessions from score=0.1 → verify convergence toward 0.5
2. Tests for trend classification: generate synthetic 25-session score history, verify slope calculation
3. Tests for priority formula at boundaries: all-high-scores, all-low-scores, mixed, regression cases
4. Implement `PatternTracker` class with:
   - `update_rule_score(rule_id, observation)` — EWMA update
   - `apply_baseline_decay(rule_ids)` — batch decay for untested rules
   - `classify_trends()` — compute slopes for all rules with 20+ tested sessions
   - `check_alerts()` — regression + atrophy detection
   - `compute_injection_priority()` — returns sorted list with graduated injection logic
5. All methods work on PatternScore nodes in MemoryGraph

---

## Validation Criteria

- [ ] EWMA produces correct values at all boundary conditions listed above
- [ ] Warm-up alpha (0.4) applies only for first 3 tested sessions, then reverts to 0.2
- [ ] `tested_session_count` increments only on tested sessions, not decay sessions
- [ ] Baseline regression decay converges toward 0.5 from both directions
- [ ] Trend slope excludes decay-only sessions
- [ ] Regression alert fires after 3 consecutive tested-session drops
- [ ] Atrophy alert fires when sessions_since_tested > 30 and score > 0.7
- [ ] Max 3 atrophy alerts per session, sorted by highest score
- [ ] Priority formula produces [0.0, 1.2] range
- [ ] Graduated injection: min 3, max 10, threshold 0.05, 2 high-scoring slots
- [ ] Archived rules excluded from all processing
- [ ] All tests pass

---

## Test Commands

```bash
pytest tests/archon-consciousness/test_ewma_scoring.py -v
pytest tests/archon-consciousness/test_baseline_decay.py -v
pytest tests/archon-consciousness/test_trend_classification.py -v
pytest tests/archon-consciousness/test_alerts.py -v
pytest tests/archon-consciousness/test_spaced_reinforcement.py -v
```
