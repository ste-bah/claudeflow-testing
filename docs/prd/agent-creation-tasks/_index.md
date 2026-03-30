# Task Index — PRD-AGENT-001: Dynamic Agent Creation System

```
PRD:      PRD-AGENT-001 v3.0.0
Created:  2026-03-30
Updated:  2026-03-30
Method:   Ad-hoc dev flow (plan -> review -> TDD -> smoke test -> adversarial -> Sherlock -> push)
```

## Status Legend
- `READY` — All prerequisites met, ready to implement
- `BLOCKED` — Waiting on prerequisite task
- `IN-PROGRESS` — Currently being worked on
- `DONE` — Completed and validated
- `DEFERRED` — Scheduled for future phase

## Execution Method

Each task follows the ad-hoc dev flow:

1. **Plan** — bullet list, no code
2. **Steven reviews** — questions, pushback
3. **Explicit approval** — "proceed" / "yes" / "go ahead"
4. **Implement** — TDD, test file FIRST, then implementation
5. **Live smoke test** — actually invoke the feature as the user would (BLOCKER)
6. **Adversarial review** — cold-read code + "can user access this RIGHT NOW?"
7. **Fix** — all findings
8. **Sherlock verify** — forensic check + operational readiness
9. **Push** — when Steven says

## Sherlock Additions (apply to ALL tasks)

Every task's Sherlock review MUST verify:

- **Operational readiness BLOCKER**: Is the skill/server importable and invocable? Can the user trigger it RIGHT NOW in a Claude Code session?
- **Live smoke test BLOCKER**: Run the actual skill/tool in a real session. Not mocks — real system.
- **Parity check**: If logic exists in parallel implementations (e.g., skill YAML + Python implementation), verify both are consistent.
- **Token budget check**: Any assembled prompt must stay within the 15,000 token controllable limit (REQ-DEF-003).
- **CLAUDE.md compliance**: `/run-agent` requires confirmation per Prime Directive. `/create-agent`, `/adjust-behavior`, tool factory `add_tool` all require user approval (L1 autonomy).

## Technology Stack

- **Skills**: Claude Code skill YAML files under `.claude/skills/`
- **MCP Server**: Python 3.11+ with FastMCP, stdio transport
- **Storage**: MemoryGraph (FalkorDB) for metadata + filesystem for definitions/traces
- **Models**: Opus 4.6 for agent execution, Haiku 4.5 for analysis/merge/evolution, Sonnet 4.6 for CAPTURED extraction
- **Testing**: pytest for Python (tool factory), manual invocation for skills

## File Organization

```
.claude/
  agents/
    custom/               # Agent definitions (created by /create-agent)
      _template/          # Template with example files
      {agent-name}/       # Per-agent directories
        agent.md
        context.md
        tools.md
        behavior.md
        memory-keys.json
        meta.json
    versions/             # Version snapshots (created by evolution)
      {agent-name}/{version}/
    archived/             # Archived agents (moved by /archive-agent)
    traces/               # Execution trace files
      {agent-name}/{timestamp}.json
  skills/
    create-agent.md       # /create-agent skill
    run-agent.md          # /run-agent skill
    adjust-behavior.md    # /adjust-behavior skill
    rollback-behavior.md  # /rollback-behavior skill
    list-agents.md        # /list-agents skill
    archive-agent.md      # /archive-agent skill
    evolve-agent.md       # /evolve-agent skill
    agent-history.md      # /agent-history skill

src/
  tool-factory/
    server.py             # FastMCP tool factory server
    executor.py           # Subprocess sandbox executor
    persistence.py        # Disk persistence for tool definitions

.tool-factory/
  tools/                  # Persisted dynamic tool definitions (gitignored)
    {name}.json
```

---

## Phase 1: Foundation (no dependencies)

| Task ID | Title | Status | Implements | Depends On |
|---------|-------|--------|------------|------------|
| TASK-AGT-001 | Agent definition format + template directory | READY | REQ-DEF-001..007 | — |
| TASK-AGT-002 | Tool Factory MCP server | READY | REQ-TOOL-001..011 | — |
| TASK-AGT-003 | Tool Factory registration + permissions | BLOCKED | REQ-TOOL-001 | TASK-AGT-002 |
| TASK-AGT-004 | `/create-agent` skill | BLOCKED | REQ-CREATE-001..008 | TASK-AGT-001 |
| TASK-AGT-005 | `/run-agent` skill | BLOCKED | REQ-RUN-001..007 | TASK-AGT-001, TASK-AGT-003 |
| TASK-AGT-006 | Reference agent validation | BLOCKED | Success metrics | TASK-AGT-004, TASK-AGT-005 |

---

## Phase 2: Behavior Adjustment

| Task ID | Title | Status | Implements | Depends On |
|---------|-------|--------|------------|------------|
| TASK-AGT-007 | Behavior rule MemoryGraph schema | BLOCKED | REQ-BEHAV-003 | TASK-AGT-001 |
| TASK-AGT-008 | `/adjust-behavior` skill | BLOCKED | REQ-BEHAV-001..005 | TASK-AGT-007 |
| TASK-AGT-009 | Behavior injection in `/run-agent` | BLOCKED | REQ-BEHAV-004 | TASK-AGT-005, TASK-AGT-007 |
| TASK-AGT-010 | `/rollback-behavior` skill | BLOCKED | REQ-BEHAV-006 | TASK-AGT-008 |

---

## Phase 3: Context Inheritance + Lifecycle

| Task ID | Title | Status | Implements | Depends On |
|---------|-------|--------|------------|------------|
| TASK-AGT-011 | Context Envelope specification | BLOCKED | REQ-RUN-002, REQ-RUN-003 | TASK-AGT-005, TASK-AGT-009 |
| TASK-AGT-012 | `/list-agents` + `/archive-agent` + `/restore-agent` | BLOCKED | REQ-LIST-001..002, REQ-ARCHIVE-001..002 | TASK-AGT-001 |

---

## Phase 4: Autolearn

| Task ID | Title | Status | Implements | Depends On |
|---------|-------|--------|------------|------------|
| TASK-AGT-013 | Execution recording + quality counters | BLOCKED | REQ-LEARN-001, REQ-LEARN-002 | TASK-AGT-005 |
| TASK-AGT-014 | Post-task analysis | BLOCKED | REQ-LEARN-003, REQ-LEARN-004 | TASK-AGT-013 |
| TASK-AGT-015 | FIX evolution mode + version DAG | BLOCKED | REQ-LEARN-005 (FIX), REQ-LEARN-006, REQ-LEARN-011 | TASK-AGT-014 |
| TASK-AGT-016 | DERIVED + CAPTURED + two-phase execution | BLOCKED | REQ-LEARN-005 (DERIVED/CAPTURED), REQ-LEARN-007, REQ-LEARN-008 | TASK-AGT-015 |
| TASK-AGT-017 | Periodic health monitoring + anti-loop guards | BLOCKED | REQ-LEARN-009, REQ-LEARN-010, REQ-LEARN-014, REQ-LEARN-006 (guards) | TASK-AGT-014 |
| TASK-AGT-018 | `/evolve-agent` + `/agent-history` skills | BLOCKED | REQ-LEARN-012, REQ-LEARN-013 | TASK-AGT-015 |

---

## Dependency Graph

```
TASK-AGT-001 (Agent Format) ─────┬──> TASK-AGT-004 (create-agent) ──┐
                                 │                                    │
                                 ├──> TASK-AGT-005 (run-agent) ──────┤──> TASK-AGT-006 (Validation)
                                 │        │                           │
TASK-AGT-002 (Tool Factory) ─┐  │        │                           │
                              ├──┤        ├──> TASK-AGT-009 (behavior inject)
TASK-AGT-003 (Registration)──┘  │        │        │
                                 │        │        ├──> TASK-AGT-011 (Context Envelope)
                                 ├──> TASK-AGT-007 (behavior schema)
                                 │        │
                                 │        ├──> TASK-AGT-008 (adjust-behavior)
                                 │        │        │
                                 │        │        ├──> TASK-AGT-010 (rollback)
                                 │        │
                                 ├──> TASK-AGT-012 (lifecycle skills)
                                 │
                                 └──> TASK-AGT-013 (exec recording) ──> TASK-AGT-014 (analysis)
                                                                            │
                                          TASK-AGT-015 (FIX evolution) <────┤
                                               │                            │
                                          TASK-AGT-016 (DERIVED/CAPTURED) <─┤
                                               │                            │
                                          TASK-AGT-018 (evolve/history) <───┤
                                                                            │
                                          TASK-AGT-017 (health monitor) <───┘
```

## Estimated Effort

| Phase | Tasks | Sessions | Total Tests (est.) |
|-------|-------|----------|-------------------|
| Phase 1 | 6 | 2-3 | ~200 |
| Phase 2 | 4 | 1-2 | ~100 |
| Phase 3 | 2 | 1 | ~50 |
| Phase 4 | 6 | 2-3 | ~200 |
| **Total** | **18** | **6-9** | **~550** |
