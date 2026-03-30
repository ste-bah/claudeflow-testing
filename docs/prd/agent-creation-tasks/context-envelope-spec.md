# Context Envelope Specification v1.0

**Date**: 2026-03-30
**Implements**: REQ-RUN-002, REQ-RUN-003
**Reference**: `/run-agent` skill at `.claude/skills/run-agent.md`

---

## Overview

The Context Envelope is the structured prompt assembled by `/run-agent` before spawning a Task subagent. It combines static agent definition files with dynamic context from MemoryGraph, LEANN, and behavior rules into a single prompt string with well-defined sections.

## Token Budget

```
Fixed overhead (outside our control):
  CLAUDE.md auto-injection:        ~2,100 tokens
  Subagent system prompt:          ~   900 tokens
  MCP/skills overhead:             ~   970 tokens
  Task prompt wrapper:             ~   120 tokens
                                   ─────────────
  Fixed total:                     ~4,090 tokens

Controllable budget (assembled by /run-agent):  15,000 tokens max

  Per-file limits:
    agent.md:                      max 3,000 tokens
    context.md:                    max 5,000 tokens
    tools.md:                      max 2,000 tokens
    behavior.md + MG rules:        max 1,500 tokens
                                   ─────────────
    Definition subtotal:           max 11,500 tokens

  Dynamic context:
    MemoryGraph recall:            500-2,000 tokens
    LEANN code context:            500-1,000 tokens
    Task description:              200-500 tokens
                                   ─────────────
    Dynamic subtotal:              1,200-3,500 tokens

  Controllable total:              12,700-15,000 tokens
  Grand total (incl. fixed):       ~16,790-19,090 tokens
```

## Assembly Algorithm (12 steps)

1. Parse agent name + task description + optional model override
2. Validate agent exists (directory + agent.md)
3. Read definition files (agent.md, context.md, tools.md, behavior.md, memory-keys.json, meta.json)
4. Recall MemoryGraph context (from memory-keys.json recall_queries)
5. Query LEANN code context (from memory-keys.json leann_queries, silent skip if unavailable)
6. Recall + inject behavior rules from MemoryGraph (agent-scoped + global, sorted by priority)
7. Assemble prompt sections in order
8. Validate token budget, truncate if needed
9. Show confirmation to user
10. Spawn Task subagent
11. Update meta.json (atomic write)
12. Optionally store output summary in MemoryGraph

## Prompt Structure

```
## ROLE
{agent.md content}

## DOMAIN CONTEXT
{context.md content — omit section if file doesn't exist}

## TOOL INSTRUCTIONS
{tools.md content — omit section if file doesn't exist}

## BEHAVIORAL RULES (auto-injected, do not override)
{behavior.md content — omit if file doesn't exist}

### Rules from MemoryGraph (auto-injected)
1. [P{priority}] [{category}] {rule_text}
2. ...
{omit subsection if no MemoryGraph rules}

## MEMORY CONTEXT
{MemoryGraph recall results — omit section if empty}
{LEANN code search results — omit if empty}

## YOUR TASK
{task description from user}
```

Rules:
- Omit any section with no content (no empty headers)
- ROLE is always present (agent.md required)
- YOUR TASK is always present (task required)
- Sections separated by blank lines

## Truncation Priority

When total exceeds 15,000 tokens, truncate in this order:

| Priority | Section | Action |
|----------|---------|--------|
| 1 (first) | LEANN results | Remove entirely |
| 2 | MemoryGraph recall | Remove entirely |
| 3 | context.md | Truncate from end, add [TRUNCATED] |
| NEVER | agent.md | Protected — core identity |
| NEVER | behavior.md + MG rules | Protected — behavioral contract |
| NEVER | Task description | Protected — user intent |

## Worked Examples

### Example 1: Minimal Agent (750 tokens)

Agent has only agent.md (500 tokens) + task (250 tokens). No context.md, no tools.md, no behavior.md, no memory keys.

```
## ROLE
{500 tokens of agent.md}

## YOUR TASK
{250 tokens of task}
```

Total: 750 tokens. Well within budget.

### Example 2: Full Agent (8,150 tokens)

All files present + memory + LEANN.

```
## ROLE                          2,000 tokens
## DOMAIN CONTEXT                3,000 tokens
## TOOL INSTRUCTIONS             1,000 tokens
## BEHAVIORAL RULES                800 tokens (500 file + 300 MG)
## MEMORY CONTEXT                1,000 tokens (600 MG + 400 LEANN)
## YOUR TASK                       350 tokens
                                 ─────────────
TOTAL:                           8,150 tokens
```

Within budget. No truncation.

### Example 3: Over Budget (15,550 → 15,000 after truncation)

```
## ROLE                          2,500 tokens  [PROTECTED]
## DOMAIN CONTEXT                5,000 tokens
## TOOL INSTRUCTIONS             2,000 tokens
## BEHAVIORAL RULES              1,200 tokens  [PROTECTED]
## MEMORY CONTEXT (MG)           2,000 tokens
## MEMORY CONTEXT (LEANN)        1,000 tokens
## YOUR TASK                       350 tokens  [PROTECTED]
                                 ─────────────
TOTAL:                          14,050 tokens (within budget before MG/LEANN)
Wait — 14,050 is within 15,000. Recalculate:

Actually at 14,050 + 1,500 more from a large context.md:
## DOMAIN CONTEXT                6,500 tokens (over 5,000 per-file limit — warned)
TOTAL:                          15,550 tokens

Truncation:
1. Remove LEANN (1,000): 15,550 - 1,000 = 14,550. Still over? No, 14,550 < 15,000. Done.

If still over after LEANN removal:
2. Remove MG recall (2,000)
3. Truncate context.md from end
```

## Error Handling

| Step | Error | Behavior |
|------|-------|----------|
| 2 | Agent not found | Error message, STOP |
| 2 | agent.md missing | Error message, STOP |
| 4 | MemoryGraph unavailable | Warn user, proceed without memory context |
| 5 | LEANN unavailable | Silent skip, no warning |
| 6 | Behavior rule parse error | Skip malformed rule, warn at debug level |
| 8 | Budget exceeded after all truncation | Should not happen (agent.md + behavior + task < 15K) |
| 10 | Subagent timeout/crash | Report error, do NOT update meta.json |
| 11 | meta.json write failure | Warn, proceed (non-critical) |
