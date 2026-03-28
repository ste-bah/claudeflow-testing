# Archon Consciousness Enhancement — Task Execution Runbook

**PRD**: PRD-ARCHON-CON-001 v2.4
**Process**: Ad-hoc (plan → approve → implement → adversarial review → fix → Sherlock verify)
**Total Tasks**: 10
**Total FRs**: 30 | **NFRs**: 13 | **ECs**: 12 | **GUARDs**: 9 | **RISKs**: 9

---

## Execution Order

Each task follows the ad-hoc cycle:
1. Present plan (bullet list)
2. Steven reviews and approves
3. Implement with TDD (tests first)
4. Adversarial review (spawned reviewer agent)
5. Fix all findings
6. Sherlock cold-read verification
7. Push when Steven says

---

## Phase 1: Foundation

| # | Task ID | Name | FRs | Deps | Status |
|---|---------|------|-----|------|--------|
| 1 | TASK-CON-001 | MemoryGraph Schema + Rule Registry | 001, 009, 013, 029, 030 | None | [ ] |
| 2 | TASK-CON-002 | Session Event Journal | 025, 008 | 001 | [ ] |

## Phase 2: Core Subsystems

| # | Task ID | Name | FRs | Deps | Status |
|---|---------|------|-----|------|--------|
| 3 | TASK-CON-003 | Episodic Memory | 001, 002, 003, 004, 026 | 001 | [ ] |
| 4 | TASK-CON-004 | Pattern Tracker | 009, 010, 011, 012, 027 | 001 | [ ] |
| 5 | TASK-CON-005 | Emotional State Detector | 005, 006, 007 | 002 | [ ] |
| 6 | TASK-CON-006 | Values DAG + Conflict Resolution | 013, 014, 015, 028 | 001 | [ ] |
| 7 | TASK-CON-007 | Reflection Agent | 017, 018, 019, 020 | 001, 003, 004 | [ ] |
| 8 | TASK-CON-008 | Theory of Intent | 021, 022, 023 | 001, 007 | [ ] |

## Phase 3: User-Facing + Integration

| # | Task ID | Name | FRs | Deps | Status |
|---|---------|------|-----|------|--------|
| 9 | TASK-CON-009 | `/values` and `/intent` Skills | 016, 024 | All Phase 2 | [ ] |
| 10 | TASK-CON-010 | Integration Test + Hook Wiring | All NFRs, ECs, GUARDs | All prior | [ ] |

---

## Dependency Graph

```
TASK-CON-001 (schema)
├── TASK-CON-002 (journal) → TASK-CON-005 (emotional)
├── TASK-CON-003 (episodic)─┐
├── TASK-CON-004 (pattern)──┤
│                           └── TASK-CON-007 (reflection)
├── TASK-CON-006 (values)       └── TASK-CON-008 (intent)
│                                   └── TASK-CON-009 (skills)
└───────────────────────────────────────── TASK-CON-010 (integration)
```

## FR Coverage Matrix

| FR | Task | FR | Task | FR | Task |
|----|------|----|------|----|------|
| 001 | 001+003 | 011 | 004 | 021 | 008 |
| 002 | 003 | 012 | 004 | 022 | 008 |
| 003 | 003 | 013 | 001+006 | 023 | 008 |
| 004 | 003 | 014 | 006 | 024 | 009 |
| 005 | 005 | 015 | 006 | 025 | 002 |
| 006 | 005 | 016 | 009 | 026 | 003 |
| 007 | 005 | 017 | 007 | 027 | 004 |
| 008 | 002 | 018 | 007 | 028 | 006 |
| 009 | 001+004 | 019 | 007 | 029 | 001 |
| 010 | 004 | 020 | 007 | 030 | 001 |
