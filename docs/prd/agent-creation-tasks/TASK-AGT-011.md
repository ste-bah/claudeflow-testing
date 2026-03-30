# TASK-AGT-011: Context Envelope Specification

```
Task ID:       TASK-AGT-011
Status:        BLOCKED
Implements:    REQ-RUN-002, REQ-RUN-003
Depends On:    TASK-AGT-005 (run-agent skill), TASK-AGT-009 (behavior injection)
Complexity:    Medium
Guardrails:    GR-004 (token budgets enforced), GR-006 (/run-agent requires confirmation)
NFRs:          NFR-001 (context assembly < 5s), NFR-005 (cost control)
Security:      Low risk — documentation task. Verify the specification does not expose internal system prompts or MemoryGraph key patterns that could be exploited if the document is accidentally shared.
```

## Context

This is a DOCUMENTATION task, not a code task. The deliverable is a reference document that specifies the exact Context Envelope assembly protocol — the algorithm by which `/run-agent` reads agent definition files, recalls MemoryGraph entries, executes LEANN queries, injects behavior rules, and assembles them into the structured prompt that gets passed to the Task tool.

The document must be precise enough to serve as the canonical implementation reference for `/run-agent` (TASK-AGT-005) and as a debugging aid when prompts are too large, rules are missing, or agent behavior is unexpected. It consolidates specifications scattered across REQ-RUN-002, REQ-RUN-003, REQ-DEF-003, REQ-BEHAV-004, and TASK-AGT-009 into a single authoritative source.

## Scope

### In Scope
- Exact assembly algorithm with step-by-step pseudocode
- Token counting methodology at each assembly step
- Exact truncation priority with worked examples
- Exact prompt template with section markers
- Budget worksheet with real numbers (matching REQ-DEF-003)
- Worked examples: minimal agent, full agent, over-budget agent with truncation
- Section-by-section format specification
- Error handling at each step

### Out of Scope
- Implementation code (this is a spec document, not a skill or module)
- Autolearn execution recording (TASK-AGT-013, Phase 4)
- Two-phase fallback (TASK-AGT-007/REQ-LEARN-007, Phase 4)
- Agent evolution (Phase 4)

## Key Design Decisions

1. **Single source of truth**: This document supersedes any conflicting specification in individual task specs. If TASK-AGT-005 and TASK-AGT-009 disagree on assembly order, this document wins.
2. **Token counting is approximate**: We use `len(text) // 4` as the token estimator. This is intentionally conservative (real tokenizers give slightly fewer tokens). The goal is to stay well within budget, not optimize to the byte.
3. **Fixed overhead is OUTSIDE the budget**: CLAUDE.md auto-injection (~2,100 tokens) and subagent system overhead (~2,010 tokens) are unavoidable. The 15,000 token controllable limit applies only to content we assemble.
4. **Truncation preserves agent identity**: agent.md and the task description are NEVER truncated. behavior.md file content is never truncated. MemoryGraph behavior rules truncate lowest-priority first. Everything else truncates in a defined priority order.

## Detailed Specifications

### Document Structure

The reference document MUST contain these sections in this order:

```
1. Overview and Terminology
2. Token Budget Worksheet
3. Assembly Algorithm (step-by-step)
4. Prompt Template (exact section markers)
5. Truncation Protocol
6. Worked Examples
7. Error Handling
8. Appendix: Token Estimation Function
```

### Section 1: Overview and Terminology

```markdown
# Context Envelope Specification v1.0

## Overview

The Context Envelope is the structured prompt assembled by `/run-agent` and passed
to the Task tool when invoking a custom agent. It combines static definition files,
dynamic MemoryGraph context, behavior rules, and the user's task description into
a single prompt with clearly delineated sections.

## Terminology

- **Context Envelope**: The complete assembled prompt string
- **Controllable content**: Everything we assemble (definition files + dynamic context)
- **Fixed overhead**: CLAUDE.md (~2,100 tokens) + subagent system prompt (~2,010 tokens) — not counted in our budget
- **Section**: A labeled block within the prompt (e.g., ## ROLE, ## DOMAIN CONTEXT)
- **Token estimate**: Approximate count using len(text) // 4
- **Hard limit**: 15,000 tokens for controllable content
- **Soft warning**: 12,000 tokens — triggers a "approaching budget" notice
```

### Section 2: Token Budget Worksheet

```markdown
## Token Budget Worksheet

### Fixed Overhead (outside our budget, unavoidable)
| Component | Tokens | Source |
|-----------|--------|--------|
| CLAUDE.md auto-injection | ~2,100 | Claude Code harness |
| Subagent system prompt + MCP/skills | ~2,010 | Claude Code harness |
| **Fixed total** | **~4,110** | |

### Controllable Content (our budget: 15,000 tokens max)
| Component | Min | Typical | Max | Source |
|-----------|-----|---------|-----|--------|
| agent.md | 250 | 1,000 | 3,000 | File (REQ-DEF-003) |
| context.md | 0 | 2,000 | 5,000 | File (REQ-DEF-003) |
| tools.md | 0 | 500 | 2,000 | File (REQ-DEF-003) |
| behavior.md (file) | 0 | 300 | 1,500 | File (REQ-DEF-003) |
| Behavior rules (MG) | 0 | 200 | 500 | MemoryGraph (TASK-AGT-009) |
| MemoryGraph recall | 0 | 500 | 2,000 | MemoryGraph (memory-keys.json) |
| LEANN code context | 0 | 300 | 1,000 | LEANN (memory-keys.json) |
| Section headers + markers | 100 | 100 | 150 | Assembly overhead |
| Task description | 50 | 200 | 500 | User input |
| **Controllable total** | **~400** | **~5,100** | **~15,650** | |

### Grand Total
| | Min | Typical | Max |
|--|-----|---------|-----|
| Fixed + Controllable | ~4,510 | ~9,210 | ~19,760 |

Note: Max exceeds 15,000 by 650 tokens. This is why truncation logic exists —
when all files are at max AND dynamic context is large, truncation kicks in.
```

### Section 3: Assembly Algorithm

```markdown
## Assembly Algorithm

### Input
- agent_name: string
- task_description: string
- model_override: string | null (default: inherit from parent)

### Steps

STEP 1: VALIDATE AGENT
  agent_dir = ".claude/agents/custom/{agent_name}/"
  IF agent_dir does not exist:
    ERROR: "Agent '{agent_name}' not found."
  IF agent_dir/agent.md does not exist:
    ERROR: "Invalid agent: {agent_name}/agent.md not found."

STEP 2: READ DEFINITION FILES
  role_text = read_file(agent_dir + "agent.md")         # REQUIRED
  context_text = read_file_or_null(agent_dir + "context.md")  # optional
  tools_text = read_file_or_null(agent_dir + "tools.md")      # optional
  behavior_file_text = read_file_or_null(agent_dir + "behavior.md")  # optional
  memory_keys = read_json_or_null(agent_dir + "memory-keys.json")    # optional

  PER-FILE TOKEN LIMITS (enforce immediately):
    role_tokens = estimate_tokens(role_text)
    IF role_tokens > 3000:
      WARN: "agent.md exceeds 3,000 token limit ({role_tokens} tokens)"
      role_text = truncate_with_marker(role_text, 3000)

    context_tokens = estimate_tokens(context_text) if context_text else 0
    IF context_tokens > 5000:
      WARN: "context.md exceeds 5,000 token limit"
      context_text = truncate_with_marker(context_text, 5000)

    tools_tokens = estimate_tokens(tools_text) if tools_text else 0
    IF tools_tokens > 2000:
      WARN: "tools.md exceeds 2,000 token limit"
      tools_text = truncate_with_marker(tools_text, 2000)

    behavior_file_tokens = estimate_tokens(behavior_file_text) if behavior_file_text else 0
    IF behavior_file_tokens > 1500:
      WARN: "behavior.md exceeds 1,500 token limit"
      behavior_file_text = truncate_with_marker(behavior_file_text, 1500)

STEP 3: INJECT BEHAVIOR RULES (TASK-AGT-009)
  injection_result = inject_behavior_rules(agent_name, behavior_file_text)
  combined_behavior_text = injection_result.combined_text
  behavior_total_tokens = injection_result.token_estimate
  FOR warning IN injection_result.warnings:
    LOG warning

STEP 4: RECALL MEMORYGRAPH CONTEXT
  memory_text = ""
  IF memory_keys AND memory_keys.recall_queries:
    FOR query IN memory_keys.recall_queries:
      TRY:
        result = mcp__memorygraph__recall_memories(query=query)
        IF result:
          memory_text += f"### {query}\n{format_memory(result)}\n\n"
      CATCH MemoryGraphError:
        WARN: "MemoryGraph recall failed for '{query}'"

STEP 5: EXECUTE LEANN QUERIES
  leann_text = ""
  IF memory_keys AND memory_keys.leann_queries:
    FOR query IN memory_keys.leann_queries:
      TRY:
        result = mcp__leann-search__search_code(query=query)
        IF result:
          leann_text += f"### {query}\n{format_leann(result)}\n\n"
      CATCH (LEANNError, ConnectionError):
        # REQ-DEF-007: silently skip, debug-level log only
        DEBUG: "LEANN query skipped: '{query}'"

STEP 6: COMPUTE TOKEN BUDGET
  section_overhead = 150  # section headers, markers, newlines
  task_tokens = estimate_tokens(task_description)

  total_controllable = (
    role_tokens +
    context_tokens +
    tools_tokens +
    behavior_total_tokens +
    estimate_tokens(memory_text) +
    estimate_tokens(leann_text) +
    section_overhead +
    task_tokens
  )

  IF total_controllable > 15000:
    GOTO STEP 6a: TRUNCATION
  ELIF total_controllable > 12000:
    WARN: "Approaching token budget: {total_controllable}/15,000 tokens"

STEP 6a: TRUNCATION (if needed)
  budget_remaining = 15000 - role_tokens - tools_tokens - behavior_total_tokens - section_overhead - task_tokens
  # Note: agent.md, tools.md, behavior (combined), task are NEVER truncated at this stage

  # Priority 1: Truncate LEANN results
  IF estimate_tokens(leann_text) > 0:
    leann_budget = min(estimate_tokens(leann_text), budget_remaining * 0.15)
    leann_text = truncate_with_marker(leann_text, leann_budget)
    budget_remaining -= estimate_tokens(leann_text)

  # Priority 2: Truncate MemoryGraph recall
  IF estimate_tokens(memory_text) > 0:
    memory_budget = min(estimate_tokens(memory_text), budget_remaining * 0.30)
    memory_text = truncate_with_marker(memory_text, memory_budget)
    budget_remaining -= estimate_tokens(memory_text)

  # Priority 3: Truncate context.md
  IF context_tokens > budget_remaining:
    context_text = truncate_with_marker(context_text, budget_remaining)
    context_tokens = budget_remaining

  # Recompute total
  total_controllable = recompute(...)
  IF total_controllable > 15000:
    # Should not happen after truncation, but safety check
    WARN: "Token budget still exceeded after truncation: {total_controllable}"

STEP 7: ASSEMBLE PROMPT
  See "Prompt Template" section below.

STEP 8: SHOW CONFIRMATION (GR-006, REQ-RUN-001)
  OUTPUT to user:
    "About to spawn agent '{agent_name}' with ~{total_controllable} controllable tokens
     (~{total_controllable + 4110} total including fixed overhead).
     Model: {model_override or 'inherited'}.
     Proceed? (yes / no)"

  WAIT for user confirmation.

STEP 9: SPAWN SUBAGENT
  result = Task(agent_name, assembled_prompt, model=model_override)

STEP 10: POST-INVOCATION BOOKKEEPING
  Update meta.json: increment invocation_count, update last_used
  (Atomic write: temp file + rename per REQ-RUN-005)
```

### Section 4: Prompt Template

```markdown
## Prompt Template

The assembled prompt MUST use these exact section markers:

---BEGIN TEMPLATE---
## ROLE
{contents of agent.md, after per-file truncation}

## DOMAIN CONTEXT
{contents of context.md, after per-file and budget truncation}
{omit this section entirely if context.md does not exist or is empty}

## TOOL INSTRUCTIONS
{contents of tools.md, after per-file truncation}
{omit this section entirely if tools.md does not exist or is empty}

## BEHAVIORAL RULES (auto-injected, do not override)
{combined_behavior_text from inject_behavior_rules()}
{omit this section entirely if no behavior rules exist (Case 4 from TASK-AGT-009)}

## MEMORY CONTEXT
{MemoryGraph recall results}
{LEANN code context results}
{omit this section entirely if both are empty}

## YOUR TASK
{task_description from user}
---END TEMPLATE---

### Section Omission Rules
- ROLE: ALWAYS present (agent.md is required)
- DOMAIN CONTEXT: Omit if context.md missing/empty AND no context from MemoryGraph/LEANN
- TOOL INSTRUCTIONS: Omit if tools.md missing/empty
- BEHAVIORAL RULES: Omit if no behavior.md AND no MemoryGraph rules (save ~20 tokens)
- MEMORY CONTEXT: Omit if no recall results AND no LEANN results
- YOUR TASK: ALWAYS present (task description is required)
```

### Section 5: Truncation Protocol

```markdown
## Truncation Protocol

### Per-File Truncation (Step 2)
Applied immediately on file read. Each file has a hard limit.
Truncation method: keep first N tokens worth of text, append marker:
  "[TRUNCATED: {original_tokens} tokens exceeded limit of {limit}]"

### Budget Truncation (Step 6a)
Applied when total controllable tokens exceed 15,000.
Priority order (truncate first → last):

| Priority | Component | Strategy |
|----------|-----------|----------|
| 1 (first) | LEANN code context | Reduce to 15% of remaining budget or remove entirely |
| 2 | MemoryGraph recall | Reduce to 30% of remaining budget |
| 3 | context.md | Reduce to fit remaining budget |
| 4 | MemoryGraph behavior rules | Drop lowest-priority rules (keep top 5 minimum) |
| NEVER | agent.md | Identity of the agent — never truncated beyond per-file limit |
| NEVER | behavior.md (file) | Static rules — never truncated beyond per-file limit |
| NEVER | tools.md | Tool instructions — never truncated beyond per-file limit |
| NEVER | Task description | User's request — never truncated |
| NEVER | Section headers | ~150 tokens overhead — negligible |
```

### Section 6: Worked Examples

```markdown
## Worked Examples

### Example A: Minimal Agent (agent.md only)
- agent.md: 500 tokens
- No other files
- Task: 100 tokens
- Total controllable: 500 + 150 (overhead) + 100 = 750 tokens
- Well within budget. No truncation.
- Sections in prompt: ROLE, YOUR TASK (only 2 sections)

### Example B: Full Agent (all files, within budget)
- agent.md: 2,000 tokens
- context.md: 3,000 tokens
- tools.md: 1,000 tokens
- behavior.md: 500 tokens
- MG behavior rules (5 rules): 200 tokens
- MemoryGraph recall (2 queries): 800 tokens
- LEANN (1 query): 300 tokens
- Task: 200 tokens
- Section overhead: 150 tokens
- Total: 2000+3000+1000+500+200+800+300+200+150 = 8,150 tokens
- Within budget. No truncation.

### Example C: Over-Budget Agent (truncation needed)
- agent.md: 3,000 tokens (at max)
- context.md: 5,000 tokens (at max)
- tools.md: 2,000 tokens (at max)
- behavior.md: 1,500 tokens (at max)
- MG behavior rules (20 rules): 500 tokens
- MemoryGraph recall (5 queries): 2,000 tokens
- LEANN (3 queries): 1,000 tokens
- Task: 400 tokens
- Section overhead: 150 tokens
- Total BEFORE truncation: 15,550 tokens (550 over budget)

Truncation steps:
  Never-truncate budget: 3000 + 2000 + 1500 + 500 + 150 + 400 = 7,550
  Remaining budget for truncatable: 15,000 - 7,550 = 7,450

  Step 1: LEANN → 15% of 7,450 = 1,117 tokens
    LEANN was 1,000 → keep all (under allocation). Remaining: 7,450 - 1,000 = 6,450

  Step 2: MemoryGraph recall → 30% of 6,450 = 1,935 tokens
    Recall was 2,000 → truncate to 1,935. Remaining: 6,450 - 1,935 = 4,515

  Step 3: context.md → fit into 4,515 tokens
    context.md was 5,000 → truncate to 4,515.

  Final total: 3000 + 4515 + 2000 + 1500 + 500 + 1935 + 1000 + 150 + 400 = 15,000 ✓
```

### Section 7: Error Handling

```markdown
## Error Handling

| Step | Error | Handling |
|------|-------|----------|
| 1 | Agent directory not found | Hard error: "Agent '{name}' not found." |
| 1 | agent.md missing | Hard error: "Invalid agent: {name}/agent.md not found." |
| 2 | File read fails (permissions, encoding) | WARN, substitute empty string, continue |
| 2 | memory-keys.json is invalid JSON | WARN: "Invalid memory-keys.json", skip memory context |
| 3 | MemoryGraph unavailable for behavior rules | WARN, use behavior.md only (TASK-AGT-009) |
| 4 | MemoryGraph unavailable for recall | WARN, skip memory context (NFR-006) |
| 4 | Individual recall query fails | WARN for that query, continue with others |
| 5 | LEANN not running | DEBUG log, skip silently (REQ-DEF-007) |
| 5 | Individual LEANN query fails | DEBUG log, skip silently |
| 6a | Budget still exceeded after truncation | WARN with breakdown, proceed anyway |
| 8 | User declines confirmation | Cancel, no subagent spawned |
| 9 | Task tool fails / subagent errors | Report to user, do NOT update invocation count (EC-RUN-005) |
| 10 | meta.json write fails | WARN, continue (bookkeeping failure is non-critical) |
```

### Section 8: Appendix

```markdown
## Appendix: Token Estimation

### estimate_tokens(text: str) -> int
  """Approximate token count. Conservative (overestimates slightly)."""
  if text is None or text == "":
    return 0
  return len(text) // 4

### truncate_with_marker(text: str, max_tokens: int) -> str
  """Truncate text to fit within token budget, appending a marker."""
  if estimate_tokens(text) <= max_tokens:
    return text
  char_limit = max_tokens * 4  # reverse of token estimation
  truncated = text[:char_limit]
  # Find last complete line
  last_newline = truncated.rfind('\n')
  if last_newline > char_limit * 0.8:  # don't lose too much
    truncated = truncated[:last_newline]
  marker = f"\n[TRUNCATED: {estimate_tokens(text)} tokens exceeded limit of {max_tokens}]"
  return truncated + marker
```

## Files to Create

- `docs/prd/agent-creation-tasks/context-envelope-spec.md` — The reference document containing all sections above, formatted as clean markdown

## Files to Modify

- None (documentation task only)

## Validation Criteria

### Unit Tests (document validation, not code tests)

- [ ] **Completeness**: Document contains all 8 sections listed above
- [ ] **Budget worksheet matches REQ-DEF-003**: Per-file limits (3000, 5000, 2000, 1500) match exactly. Total controllable limit (15,000) matches.
- [ ] **Assembly algorithm matches /run-agent implementation**: Walk through the algorithm with a real agent directory and verify each step corresponds to actual /run-agent behavior
- [ ] **Prompt template matches REQ-RUN-003**: Section markers (## ROLE, ## DOMAIN CONTEXT, ## TOOL INSTRUCTIONS, ## BEHAVIORAL RULES, ## MEMORY CONTEXT, ## YOUR TASK) match exactly
- [ ] **Truncation priority matches TASK-AGT-009**: LEANN first, MemoryGraph recall second, context.md third, MG behavior rules fourth. Never-truncate list matches.
- [ ] **Worked Example A**: Verify arithmetic. 500 + 150 + 100 = 750. Correct sections (ROLE + YOUR TASK only).
- [ ] **Worked Example B**: Verify arithmetic. Sum = 8,150. No truncation needed.
- [ ] **Worked Example C**: Verify truncation arithmetic. Final total = 15,000 exactly.
- [ ] **Error handling table covers all assembly steps**: Every step has at least one error case documented
- [ ] **Token estimation function is consistent**: estimate_tokens("hello world") = len("hello world") // 4 = 2 (verified)

### Sherlock Gates

- [ ] **PARITY CHECK**: Take the actual /run-agent skill file (from TASK-AGT-005) and compare assembly order against this document. Every step in the document corresponds to a step in the implementation. No undocumented steps exist in either.
- [ ] **TOKEN BUDGET CHECK**: Run /run-agent on a real agent. Compare the token count shown in the confirmation prompt against the document's estimation formula. Difference should be < 10%.
- [ ] **TRUNCATION VERIFICATION**: Create an agent that exceeds 15,000 tokens. Verify truncation follows the priority documented here (LEANN first, recall second, context.md third).

### Live Smoke Test

- [ ] Create an agent with all files at max token limits
- [ ] Run `/run-agent` and observe the token count in the confirmation prompt
- [ ] Verify the count is reasonable per the budget worksheet
- [ ] Force truncation by adding large MemoryGraph recall data
- [ ] Verify truncation warning appears and the truncation order matches the spec

## Test Commands

```bash
# Verify document exists and is well-formed
cat docs/prd/agent-creation-tasks/context-envelope-spec.md | head -20

# Word count check (document should be substantial — 2000+ words)
wc -w docs/prd/agent-creation-tasks/context-envelope-spec.md

# Verify no broken markdown links or formatting
# (manual review in a markdown renderer)
```
