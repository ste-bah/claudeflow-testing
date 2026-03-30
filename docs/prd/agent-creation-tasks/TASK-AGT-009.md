# TASK-AGT-009: Behavior Injection in `/run-agent`

```
Task ID:       TASK-AGT-009
Status:        BLOCKED
Implements:    REQ-BEHAV-004
Depends On:    TASK-AGT-005 (run-agent skill), TASK-AGT-007 (behavior rule schema)
Complexity:    Medium
Guardrails:    GR-004 (token budgets enforced), GR-006 (/run-agent requires confirmation)
NFRs:          NFR-001 (context assembly < 5s), NFR-006 (MemoryGraph resilience)
Security:      Medium risk — behavior rules are injected into the assembled prompt. Rules with adversarial content could influence agent behavior. Mitigation: rules are user-approved (GR-003), and the BEHAVIORAL RULES section is clearly delineated with "auto-injected, do not override" header.
```

## Context

This task modifies the existing `/run-agent` skill (from TASK-AGT-005) to auto-inject active behavior rules from MemoryGraph into the Context Envelope. When a user runs an agent, the system transparently recalls all applicable behavior rules, sorts them by priority, merges them with the static `behavior.md` content, and inserts the combined set into the BEHAVIORAL RULES section of the assembled prompt.

This is the "read path" complement to `/adjust-behavior` (TASK-AGT-008, the "write path"). The two tasks together complete the behavior rule lifecycle: adjust stores rules, injection recalls and applies them.

## Scope

### In Scope
- Modify `.claude/skills/run-agent.md` to add behavior rule recall and injection
- Injection algorithm: recall → sort → format → insert into BEHAVIORAL RULES section
- Agent-specific + global rule merging with precedence logic
- Token budget impact calculation for injected rules
- behavior.md reconciliation check (file mtime vs MemoryGraph last_modified)
- Warning when behavior rules consume excessive tokens (EC-BEHAV-002)

### Out of Scope
- Creating or modifying behavior rules (TASK-AGT-008)
- The BEHAVIORAL RULES section header and format in the Context Envelope (already defined in REQ-RUN-003 via TASK-AGT-005)
- Rollback (TASK-AGT-010)
- Context Envelope specification document (TASK-AGT-011)

## Key Design Decisions

1. **MemoryGraph rules are authoritative**: When both `behavior.md` and MemoryGraph rules exist, both are included in the prompt. MemoryGraph rules appear after behavior.md content, separated by a divider. If there is divergence, a warning is logged.
2. **behavior.md is never modified by injection**: The injection step is read-only. It reads behavior.md and MemoryGraph rules, formats them, and inserts the combined text into the prompt. It never writes to behavior.md (that is /adjust-behavior's job).
3. **Token budget for behavior rules comes from the dynamic context allocation**: The 15,000 token controllable budget has ~500 tokens reserved for behavior rules by default. If injected rules exceed this, other dynamic sections (LEANN results, memory recall) are truncated first.
4. **Reconciliation is a warning, not a blocker**: If behavior.md and MemoryGraph diverge, the system warns but proceeds. The user can resolve via `/adjust-behavior`.

## Detailed Specifications

### Injection Algorithm

```
FUNCTION inject_behavior_rules(agent_name: str, behavior_md_content: str | None) -> InjectionResult:
  """
  Called during Context Envelope assembly in /run-agent, after reading
  behavior.md and before final prompt assembly.

  Returns:
    InjectionResult:
      combined_text: str  — The formatted text to insert into BEHAVIORAL RULES section
      token_estimate: int — Estimated token count of combined_text
      warnings: list[str] — Any warnings to surface to the user
  """

  warnings = []

  # Step 1: Recall rules from MemoryGraph
  try:
    agent_rules = recall_active_rules(agent_name)  # agent-scoped
    global_rules = recall_active_rules("global")    # global
  except MemoryGraphUnavailableError:
    warnings.append("MemoryGraph unavailable. Running with behavior.md only.")
    agent_rules = []
    global_rules = []

  # Step 2: Sort and merge
  # Sort key: (-priority, scope_rank, -modified_at_epoch, -version)
  # scope_rank: 0 for agent-scoped, 1 for global (agent-scoped wins at same priority)
  all_mg_rules = []
  for r in agent_rules:
    all_mg_rules.append((r, 0))  # scope_rank = 0
  for r in global_rules:
    all_mg_rules.append((r, 1))  # scope_rank = 1

  all_mg_rules.sort(key=lambda x: (
    -x[0].metadata.priority,
    x[1],  # agent-scoped (0) before global (1)
    -parse_iso(x[0].metadata.modified_at).timestamp(),
    -x[0].metadata.version
  ))

  sorted_rules = [r for r, _ in all_mg_rules]

  # Step 3: Reconciliation check
  if behavior_md_content and len(sorted_rules) > 0:
    # Check if behavior.md was modified after the most recent MemoryGraph rule
    behavior_md_path = f".claude/agents/custom/{agent_name}/behavior.md"
    try:
      file_mtime = os.path.getmtime(behavior_md_path)
      mg_latest = max(parse_iso(r.metadata.modified_at).timestamp() for r in sorted_rules)

      if file_mtime > mg_latest + 60:  # 60s grace period
        warnings.append(
          f"behavior.md was modified ({format_time(file_mtime)}) after the last "
          f"MemoryGraph rule update ({format_time(mg_latest)}). File and MemoryGraph "
          f"rules may be inconsistent. Run /adjust-behavior to reconcile."
        )
    except (OSError, ValueError):
      pass  # file access error, skip reconciliation check

  # Step 4: Format combined text
  sections = []

  # Section A: behavior.md content (if exists and non-empty)
  if behavior_md_content and behavior_md_content.strip():
    sections.append("### From behavior.md")
    sections.append(behavior_md_content.strip())

  # Section B: MemoryGraph rules (if any)
  if sorted_rules:
    sections.append("")
    sections.append("### From MemoryGraph (auto-injected, sorted by priority)")
    for i, rule in enumerate(sorted_rules, 1):
      scope_tag = "(global)" if rule.metadata.agent_scope == "global" else ""
      sections.append(
        f"{i}. **[P{rule.metadata.priority}]** [{rule.metadata.category}] "
        f"{rule.metadata.rule} {scope_tag}".strip()
      )

  combined_text = "\n".join(sections)

  # Step 5: Token budget estimation
  token_estimate = len(combined_text) // 4 + 20  # rough estimate + section overhead

  # Step 6: Token budget warning (EC-BEHAV-002)
  BEHAVIOR_TOKEN_WARNING_THRESHOLD = 500
  if token_estimate > BEHAVIOR_TOKEN_WARNING_THRESHOLD:
    warnings.append(
      f"Behavior rules consume ~{token_estimate} tokens ({len(sorted_rules)} rules). "
      f"Consider consolidating with /adjust-behavior."
    )

  return InjectionResult(
    combined_text=combined_text,
    token_estimate=token_estimate,
    warnings=warnings
  )
```

### Integration Point in `/run-agent`

The existing `/run-agent` skill (from TASK-AGT-005) assembles the Context Envelope in this order (REQ-RUN-002):

```
1. Read agent.md      → role_section
2. Read context.md    → context_section
3. Read tools.md      → tools_section
4. Read behavior.md   → behavior_md_content
5. Recall MemoryGraph → memory_section
6. Execute LEANN      → code_section
7. Append task        → task_section
8. Validate tokens
```

**This task inserts a new step between 4 and 5:**

```
4.  Read behavior.md              → behavior_md_content
4a. inject_behavior_rules(agent_name, behavior_md_content)
    → combined_behavior_text, behavior_tokens, behavior_warnings
5.  Recall MemoryGraph            → memory_section
...
```

And modifies the prompt assembly (REQ-RUN-003) to use `combined_behavior_text` instead of raw `behavior_md_content`:

```
## BEHAVIORAL RULES (auto-injected, do not override)
{combined_behavior_text}
```

### Token Budget Impact

```
BUDGET WORKSHEET (modified from REQ-DEF-003):

  agent.md:          max 3,000 tokens    (unchanged)
  context.md:        max 5,000 tokens    (unchanged)
  tools.md:          max 2,000 tokens    (unchanged)
  behavior.md:       max 1,500 tokens    (file content only)
  MG behavior rules: ~200-500 tokens     (NEW: from MemoryGraph)
                     ─────────────
  Definition total:  max ~12,000 tokens

  Dynamic context:
  MemoryGraph recall:    500-2,000 tokens
  Behavior rules (MG):   200-500 tokens  (already counted above, not double-counted)
  Task description:       200-500 tokens
                         ─────────────
  Dynamic total:         900-3,000 tokens

TRUNCATION PRIORITY (when total exceeds 15,000 tokens):
  1. LEANN code context results (truncate first — supplementary)
  2. MemoryGraph recall entries (truncate second — helpful but not critical)
  3. context.md (truncate third — domain knowledge, large)
  4. MemoryGraph behavior rules (truncate fourth — most recent rules survive)
  5. NEVER truncate: agent.md, behavior.md file content, task description

When truncating MemoryGraph behavior rules:
  - Keep rules sorted by priority DESC
  - Truncate from the bottom (lowest priority rules removed first)
  - Always keep at least the top 5 rules regardless of token budget
  - Add truncation marker: "[{n} lower-priority rules omitted due to token budget]"
```

### Reconciliation Check Details

```
RECONCILIATION ALGORITHM:

  behavior_md_path = ".claude/agents/custom/{agent_name}/behavior.md"

  CASE 1: behavior.md exists, MemoryGraph rules exist
    Compare file mtime vs max(modified_at) of MemoryGraph rules
    If file is newer by >60s:
      WARNING: "behavior.md was modified outside /adjust-behavior..."
    If MemoryGraph is newer:
      No warning (normal flow — /adjust-behavior updates both)
    Action: Include BOTH in prompt (behavior.md content + MG rules)

  CASE 2: behavior.md exists, no MemoryGraph rules
    No warning (agent has static-only behavior rules, no MG rules yet)
    Action: Include behavior.md content only

  CASE 3: No behavior.md, MemoryGraph rules exist
    No warning (agent uses MG-only behavior rules)
    Action: Include MG rules only

  CASE 4: No behavior.md, no MemoryGraph rules
    No warning, no behavior section content
    Action: Omit BEHAVIORAL RULES section entirely from prompt
    (Save tokens by not including an empty section)
```

## Files to Create

- None (this task modifies existing files only)

## Files to Modify

- `.claude/skills/run-agent.md` — Add behavior injection step between behavior.md read and MemoryGraph recall. Add reconciliation check. Update token budget accounting.

## Validation Criteria

### Unit Tests

- [ ] **Injection with 0 MG rules, no behavior.md**: Returns empty combined_text, 0 token estimate, no warnings. BEHAVIORAL RULES section omitted from prompt.
- [ ] **Injection with 0 MG rules, behavior.md exists**: Returns behavior.md content only under "From behavior.md" header. No "From MemoryGraph" section.
- [ ] **Injection with 3 MG rules, no behavior.md**: Returns formatted MG rules only. "From behavior.md" section absent.
- [ ] **Injection with 5 MG rules and behavior.md**: Returns both sections separated correctly. behavior.md first, then MG rules.
- [ ] **Injection with 10 rules**: All 10 rules appear sorted by priority DESC. Token estimate is reasonable (~150 tokens for 10 short rules).
- [ ] **Priority sort correctness**: Rules with priorities 30, 80, 50, 80 → output order: 80, 80, 50, 30.
- [ ] **Agent-specific overrides global at same priority**: Agent rule P50 and global rule P50. Agent rule appears first in output.
- [ ] **Tiebreaker: modified_at**: Two agent rules both P50. Rule modified "2026-03-30T14:00:00Z" appears before rule modified "2026-03-30T10:00:00Z".
- [ ] **MemoryGraph unavailable**: Recall throws error. Warning added: "MemoryGraph unavailable." Combined text contains only behavior.md content.
- [ ] **Reconciliation warning: file newer**: behavior.md mtime is 5 minutes after most recent MG rule. Warning issued about inconsistency.
- [ ] **Reconciliation: no warning when MG newer**: Most recent MG rule is newer than behavior.md mtime. No reconciliation warning.
- [ ] **Token budget warning**: 20 rules with ~100 char text each. Token estimate exceeds 500. Warning issued about consolidation.
- [ ] **Truncation: low-priority rules dropped first**: 30 rules total, budget allows 15. The 15 highest-priority rules survive. Truncation marker added.
- [ ] **Truncation: always keep top 5**: Even if budget is very tight, the 5 highest-priority rules are never truncated.
- [ ] **Empty behavior section omitted**: No behavior.md, no MG rules. The "## BEHAVIORAL RULES" section header does not appear in the assembled prompt.
- [ ] **Scope tag in output**: Global rules show "(global)" tag. Agent-scoped rules do not show a scope tag.

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: Create 3 behavior rules in MemoryGraph for agent "test-agent". Run `/run-agent test-agent "do something"`. Verify the assembled prompt contains all 3 rules in the BEHAVIORAL RULES section, sorted by priority.
- [ ] **TOKEN BUDGET COMPLIANCE**: Assembled prompt with 10 behavior rules still stays within 15,000 token controllable limit.
- [ ] **RECONCILIATION DETECTION**: Manually edit `.claude/agents/custom/test-agent/behavior.md` (touch the file). Run `/run-agent`. Verify reconciliation warning appears.
- [ ] **GRACEFUL DEGRADATION**: Kill MemoryGraph (or disconnect). Run `/run-agent`. Verify it proceeds with behavior.md only and shows MemoryGraph unavailable warning.

### Live Smoke Test

- [ ] Create agent "test-agent" via `/create-agent`
- [ ] Add 3 behavior rules via `/adjust-behavior test-agent`:
  - P80: "Always use TypeScript strict mode" (coding)
  - P50: "Prefer concise responses" (communication)
  - P30: "Log all decisions" (quality)
- [ ] Run `/run-agent test-agent "write a hello world"`
- [ ] Verify in the confirmation prompt that the token count includes behavior rules
- [ ] Verify the assembled prompt contains all 3 rules sorted: P80, P50, P30
- [ ] Verify the P80 rule appears first in the BEHAVIORAL RULES section
- [ ] Add a global rule: `/adjust-behavior "Always respond in English"`
- [ ] Run `/run-agent test-agent "write a hello world"` again
- [ ] Verify the global rule appears after agent-scoped rules at the same or lower priority

## Test Commands

```bash
# These tests are manual — invoke in a Claude Code session

# Setup: Create test agent and rules
/create-agent --name test-agent --description "A test agent for behavior injection"
/adjust-behavior test-agent "Always use TypeScript strict mode"
/adjust-behavior test-agent "Prefer concise responses"
/adjust-behavior test-agent "Log all decisions"

# Test: Run agent and verify behavior rules in prompt
/run-agent test-agent "Write a hello world program"
# Verify: Confirmation prompt shows token count including behavior rules
# Verify: After approval, the subagent's prompt contains BEHAVIORAL RULES section

# Verify MemoryGraph content
# mcp__memorygraph__search_memories query="behavior_rule active test-agent"
```
