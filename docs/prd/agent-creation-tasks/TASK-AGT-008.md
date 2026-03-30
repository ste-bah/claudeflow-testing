# TASK-AGT-008: `/adjust-behavior` Skill

```
Task ID:       TASK-AGT-008
Status:        BLOCKED
Implements:    REQ-BEHAV-001, REQ-BEHAV-002, REQ-BEHAV-003, REQ-BEHAV-005
Depends On:    TASK-AGT-007 (behavior rule schema)
Complexity:    High
Guardrails:    GR-003 (behavior changes require user approval), GR-007 (Haiku merge output is diff-validated)
NFRs:          NFR-005 (Haiku for merge, $0.001-0.005 per merge), NFR-006 (MemoryGraph resilience)
Security:      Medium risk — LLM-mediated merge could hallucinate rules. Diff validation (GR-007) is the primary mitigation. Verify Haiku prompt does not leak existing rule content in a way that enables prompt injection via rule text.
```

## Context

`/adjust-behavior` is the primary interface for modifying an agent's behavioral rules at runtime. It implements LLM-mediated merging: the user provides a natural language adjustment, the system recalls existing rules, a Haiku subagent merges them, a diff validation step catches hallucinations, and the user approves before anything is stored.

This is the most security-sensitive behavior task because it involves LLM output flowing into stored rules that get auto-injected into future agent prompts (via TASK-AGT-009). The diff validation step (REQ-BEHAV-002 step 4) is the critical guardrail.

## Scope

### In Scope
- `.claude/skills/adjust-behavior.md` skill file with full implementation
- Haiku merge prompt template (exact system prompt + message format)
- Diff validation algorithm (detect removed, new, changed rules)
- Full merge pipeline: recall → format → Haiku merge → diff validate → show to user → store on approval
- Global behavior adjustment (no agent specified)
- Agent-scoped behavior adjustment
- Version increment and SUPERSEDES relationship creation on update
- Error handling for MemoryGraph unavailability

### Out of Scope
- Automatic rule extraction from conversation (REQ-BEHAV-007, deferred/COULD)
- Rollback (TASK-AGT-010)
- Behavior injection into `/run-agent` (TASK-AGT-009)

## Key Design Decisions

1. **Haiku for merge, not Opus**: The merge task is relatively simple (combine existing rules with a new instruction). Haiku is sufficient and costs ~100x less than Opus. The diff validation catches any quality issues.
2. **Structured output from Haiku**: The merge subagent returns JSON (not free-form markdown) to enable programmatic diff validation. Each rule is a separate object with category, priority, and rule text.
3. **Diff validation is mandatory, not optional**: Even if the merge looks clean, the diff step always runs. This is GR-007.
4. **New rules default to priority 50**: Unless the user specifies a priority in their adjustment request, new rules get priority 50 (middle of range). The user can adjust priority in the approval step.
5. **Category inference by Haiku**: The merge subagent infers the category for new rules based on content. The user can override in the approval step.

## Detailed Specifications

### Skill File: `.claude/skills/adjust-behavior.md`

```yaml
---
name: adjust-behavior
description: Adjust behavioral rules for a custom agent or globally. Uses LLM-mediated merging with diff validation.
triggers:
  - /adjust-behavior
  - adjust behavior
  - change behavior
  - add behavior rule
arguments:
  - name: agent_name
    description: "Name of the agent to adjust, or 'global' for global rules"
    required: false
    default: "global"
  - name: adjustment
    description: "Natural language description of the behavior change"
    required: true
---
```

### Merge Pipeline (step by step)

#### Step 1: Parse Input

```
INPUT: /adjust-behavior {agent_name} "adjustment text"
       /adjust-behavior "adjustment text"   (implies global)

PARSING:
  If first non-flag arg matches an existing agent in .claude/agents/custom/:
    agent_scope = that agent name
    adjustment = remaining text (quoted string)
  Else:
    agent_scope = "global"
    adjustment = full argument text (quoted string)

VALIDATION:
  - adjustment must be non-empty after strip
  - adjustment must be <= 1000 chars (prevent prompt injection via mega-string)
  - If agent_scope != "global", verify .claude/agents/custom/{agent_scope}/ exists
    Error if not: "Agent '{agent_scope}' not found. Run /list-agents to see available agents."
```

#### Step 2: Recall Current Rules

```
ALGORITHM:
  1. Call mcp__memorygraph__search_memories:
       query: f"behavior_rule active {agent_scope}"
       type: "behavior_rule"
     Filter: metadata.active == true AND metadata.agent_scope == agent_scope
  2. Sort by priority DESC, then modified_at DESC
  3. If agent_scope != "global", ALSO recall global rules:
     Call mcp__memorygraph__search_memories:
       query: "behavior_rule active global"
       type: "behavior_rule"
     Filter: metadata.active == true AND metadata.agent_scope == "global"
     (Global rules shown for context but not editable in an agent-scoped adjustment)
  4. Format as current_rules_markdown (see below)
```

#### Step 3: Format Current Rules as Markdown

```
FORMAT (for Haiku prompt input):

## Current Rules for {agent_scope}

### Agent-Scoped Rules
1. [P{priority}] [{category}] {rule_text}  (rule_group_id: {id}, v{version})
2. [P{priority}] [{category}] {rule_text}  (rule_group_id: {id}, v{version})

### Global Rules (read-only context, do not modify)
1. [P{priority}] [{category}] {rule_text}
2. [P{priority}] [{category}] {rule_text}

---

If no rules exist yet:
## Current Rules for {agent_scope}
No existing rules.
```

#### Step 4: Haiku Merge Prompt

**System prompt for the merge subagent:**

```
You are a behavior rule merge assistant. Your job is to integrate a new behavior adjustment into an existing set of rules.

RULES:
1. Preserve ALL existing rules unless the adjustment explicitly contradicts or replaces one.
2. If the adjustment contradicts an existing rule, mark the old rule as REMOVED and add the new rule.
3. If the adjustment modifies an existing rule, mark the old rule as MODIFIED and provide the updated text.
4. If the adjustment adds a new behavior, add it as a NEW rule.
5. Assign a category to new rules: communication, coding, delegation, analysis, or quality.
6. Assign a priority (1-100) to new rules. Default is 50 unless the user's language implies urgency ("always", "never", "critical" → 75-90; "prefer", "try to" → 30-40).
7. Do NOT invent, remove, or rephrase rules that are unrelated to the adjustment.
8. Do NOT modify global rules — they are read-only context.
9. Output ONLY valid JSON. No markdown, no explanation, no preamble.

OUTPUT FORMAT (strict JSON):
{
  "merged_rules": [
    {
      "rule_group_id": "brg-existing-id or null for new",
      "category": "coding",
      "rule": "The rule text",
      "priority": 75,
      "status": "UNCHANGED|MODIFIED|NEW|REMOVED",
      "original_rule": "original text if MODIFIED or REMOVED, null otherwise",
      "change_reason": "Why this change was made (only for MODIFIED, NEW, REMOVED)"
    }
  ]
}
```

**User message for the merge subagent:**

```
## Current Rules
{current_rules_markdown}

## Adjustment Request
{adjustment}

## Agent Scope
{agent_scope}

Produce the merged ruleset as JSON.
```

**Task tool invocation:**

```
Task("behavior-merge", prompt_text, model="haiku")
```

#### Step 5: Parse Haiku Output

```
ALGORITHM:
  1. Extract JSON from Haiku response:
     - Try json.loads on full response
     - If fails, try regex to extract JSON block: /\{[\s\S]*\}/
     - If fails: error "Merge failed: could not parse Haiku output as JSON. Please try again."
  2. Validate schema:
     - merged_rules must be an array
     - Each entry must have: rule_group_id (string|null), category (valid), rule (string), priority (int 1-100), status (valid enum)
     - If validation fails: error "Merge produced invalid output. Please try again."
  3. Return: parsed merged_rules array
```

#### Step 6: Diff Validation (GR-007)

This is the critical hallucination detection step.

```
ALGORITHM:
  INPUT: existing_rules (from step 2), merged_rules (from step 5), adjustment (user input)

  FLAGS = []

  # Check 1: Detect removed rules
  existing_ids = { r.rule_group_id for r in existing_rules }
  merged_ids = { r.rule_group_id for r in merged_rules if r.status != "REMOVED" }
  removed_ids = existing_ids - merged_ids
  for id in removed_ids:
    original = find_rule_by_group_id(existing_rules, id)
    merged_entry = find_rule_by_group_id(merged_rules, id)
    if merged_entry and merged_entry.status == "REMOVED":
      FLAGS.append({
        "type": "REMOVED",
        "severity": "warning",
        "rule_group_id": id,
        "original_rule": original.rule,
        "reason": merged_entry.change_reason
      })
    else:
      # Rule disappeared without being marked REMOVED — hallucination
      FLAGS.append({
        "type": "SILENTLY_REMOVED",
        "severity": "error",
        "rule_group_id": id,
        "original_rule": original.rule,
        "reason": "Rule was removed without explanation. This may be a merge error."
      })

  # Check 2: Detect new rules not in the adjustment
  for r in merged_rules:
    if r.status == "NEW" and r.rule_group_id is None:
      # Verify the new rule is plausibly related to the adjustment
      # Simple heuristic: at least 1 significant word from the adjustment
      # appears in the new rule (case-insensitive, excluding stopwords)
      adjustment_words = set(adjustment.lower().split()) - STOPWORDS
      rule_words = set(r.rule.lower().split()) - STOPWORDS
      overlap = adjustment_words & rule_words
      if len(overlap) == 0:
        FLAGS.append({
          "type": "HALLUCINATED_NEW",
          "severity": "error",
          "rule": r.rule,
          "reason": "New rule has no word overlap with the adjustment request. May be hallucinated."
        })

  # Check 3: Detect rules with changed wording (MODIFIED)
  for r in merged_rules:
    if r.status == "MODIFIED":
      original = find_rule_by_group_id(existing_rules, r.rule_group_id)
      if original:
        # Check if the modification is related to the adjustment
        # Diff the original and new text
        if original.rule.strip() == r.rule.strip():
          FLAGS.append({
            "type": "COSMETIC_ONLY",
            "severity": "info",
            "rule_group_id": r.rule_group_id,
            "reason": "Marked as MODIFIED but text is identical."
          })
      else:
        FLAGS.append({
          "type": "PHANTOM_MODIFY",
          "severity": "error",
          "rule_group_id": r.rule_group_id,
          "reason": "Marked as MODIFIED but no original rule with this ID exists."
        })

  # Check 4: Detect priority changes not requested
  for r in merged_rules:
    if r.status == "UNCHANGED" and r.rule_group_id:
      original = find_rule_by_group_id(existing_rules, r.rule_group_id)
      if original and original.priority != r.priority:
        FLAGS.append({
          "type": "PRIORITY_CHANGED",
          "severity": "warning",
          "rule_group_id": r.rule_group_id,
          "original_priority": original.priority,
          "new_priority": r.priority,
          "reason": "Priority changed on a rule marked UNCHANGED."
        })

  STOPWORDS = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
               "being", "have", "has", "had", "do", "does", "did", "will",
               "would", "could", "should", "may", "might", "must", "shall",
               "can", "to", "of", "in", "for", "on", "with", "at", "by",
               "from", "as", "into", "through", "during", "before", "after",
               "above", "below", "and", "but", "or", "nor", "not", "so",
               "yet", "both", "either", "neither", "each", "every", "all",
               "any", "few", "more", "most", "other", "some", "such", "no",
               "only", "own", "same", "than", "too", "very", "just", "it",
               "its", "this", "that", "these", "those"}

  Return: FLAGS
```

#### Step 7: Present to User

```
FORMAT (shown to user):

## Behavior Adjustment Review — {agent_scope}

### Adjustment Request
> {adjustment}

### Proposed Changes

{for each rule in merged_rules where status != "UNCHANGED":}

**{status}** [{category}] (priority: {priority})
{if MODIFIED:}
  - Was: {original_rule}
  + Now: {rule}
  Reason: {change_reason}
{elif NEW:}
  + {rule}
  Reason: {change_reason}
{elif REMOVED:}
  - {original_rule}
  Reason: {change_reason}

### Unchanged Rules ({count})
{brief list of unchanged rules, collapsed}

{if FLAGS with severity "error":}
### ⚠ Validation Warnings
{for each flag with severity "error":}
- **{type}**: {reason}
  {details}

RECOMMENDATION: Review the flagged items carefully. The merge model may have
hallucinated or silently removed rules.

{endif}

---

Approve these changes? (yes / no / edit)
- **yes**: Apply all changes
- **no**: Cancel, no changes stored
- **edit**: Modify specific rules before applying
```

#### Step 8: Store on Approval

```
ALGORITHM (on user approval):
  For each rule in merged_rules:
    CASE status == "NEW":
      Call create_behavior_rule (from TASK-AGT-007):
        rule_text = rule.rule
        category = rule.category
        priority = rule.priority
        source = "user_request"
        agent_scope = agent_scope

    CASE status == "MODIFIED":
      Call update_behavior_rule (from TASK-AGT-007):
        rule_group_id = rule.rule_group_id
        new_rule_text = rule.rule
        new_priority = rule.priority
        new_category = rule.category
        source = "user_request"

    CASE status == "REMOVED":
      Call deactivate_behavior_rule (from TASK-AGT-007):
        rule_group_id = rule.rule_group_id

    CASE status == "UNCHANGED":
      No action needed

  # Update behavior.md file (snapshot for human readability)
  # GUARD: Skip behavior.md regeneration when agent_scope is "global" — global rules
  # have no agent directory and .claude/agents/custom/global/ MUST NOT be created.
  IF agent_scope != "global":
  Regenerate .claude/agents/custom/{agent_scope}/behavior.md:
    Read all active rules for agent_scope
    Format as markdown:
      # Behavioral Rules
      # Auto-generated by /adjust-behavior — do not edit manually
      # Source of truth: MemoryGraph behavior_rule nodes
      # Last updated: {now}

      ## Rules (sorted by priority)
      1. **[P{priority}]** [{category}] {rule_text}
      2. ...

  # Confirm to user
  Output: "Behavior rules updated for {agent_scope}. {n_new} new, {n_modified} modified, {n_removed} removed."
```

### Edit Flow (when user chooses "edit")

```
When user selects "edit":
  1. Show each proposed change individually with an index number
  2. User can:
     - "keep 1,3,5" — accept specific changes, discard others
     - "change 2 priority 90" — modify a specific rule's priority
     - "change 2 text 'new text here'" — modify a specific rule's text
     - "reject 4" — exclude a specific change
     - "done" — finalize and apply accepted changes
  3. After "done", run diff validation again on the modified set
  4. Show final confirmation and proceed to store
```

## Files to Create

- `.claude/skills/adjust-behavior.md` — The full skill file with the YAML frontmatter and step-by-step implementation instructions that Claude Code will follow when the user invokes `/adjust-behavior`

## Files to Modify

- None directly. This skill creates/modifies behavior.md files in agent directories as a side effect of execution.

## Validation Criteria

### Unit Tests

- [ ] **Merge with no conflicts**: Existing rules A, B. Adjustment adds C. Haiku returns A (UNCHANGED), B (UNCHANGED), C (NEW). Diff validation: 0 flags. Store: C created, A/B untouched.
- [ ] **Merge with explicit replacement**: Existing rule A ("use tabs"). Adjustment: "use spaces instead of tabs". Haiku returns A (REMOVED), A' (NEW, "use spaces"). Diff validation: 1 REMOVED flag (severity warning, not error — explicit removal). Store: A deactivated, A' created.
- [ ] **Merge with conflict detection**: Existing rule A ("always use strict mode"). Adjustment: "allow any types for prototyping". Haiku returns A (UNCHANGED), B (NEW). If Haiku also marks CONFLICTS_WITH, verify the relationship is created.
- [ ] **Detect hallucinated rule**: Existing rules A, B. Adjustment: "add rule C". Haiku returns A, B, C (NEW), D (NEW, unrelated). Diff validation: 1 HALLUCINATED_NEW flag for D.
- [ ] **Detect silently removed rule**: Existing rules A, B, C. Haiku returns A, B (C missing, no REMOVED status). Diff validation: 1 SILENTLY_REMOVED flag for C.
- [ ] **Priority inference**: Adjustment "ALWAYS cite section numbers" → Haiku assigns priority 75-90. Adjustment "try to keep responses concise" → Haiku assigns priority 30-40.
- [ ] **Global adjustment**: `/adjust-behavior "prefer concise responses"` (no agent name). Verify agent_scope = "global" and rule stored with agent_scope = "global".
- [ ] **Agent-scoped adjustment**: `/adjust-behavior sec-filing-analyzer "cite section numbers"`. Verify agent_scope = "sec-filing-analyzer".
- [ ] **MemoryGraph unavailable**: Recall fails. Skill outputs: "MemoryGraph unavailable. Cannot adjust behavior rules without access to the rule store."
- [ ] **Empty existing rules**: No rules exist. Adjustment adds first rule. Verify clean creation path with no diff validation errors.
- [ ] **SUPERSEDES relationship**: Update rule v1 → v2. Verify SUPERSEDES relationship created from v2 → v1.
- [ ] **behavior.md regeneration**: After applying changes, verify behavior.md in agent directory is regenerated with correct content.
- [ ] **Adjustment text too long (>1000 chars)**: Error with message about length limit.
- [ ] **Agent not found**: `/adjust-behavior nonexistent-agent "rule"`. Error: "Agent 'nonexistent-agent' not found."
- [ ] **Edit flow**: User selects "edit", keeps some changes, rejects others, modifies priority. Verify only accepted changes are stored.

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: `/adjust-behavior global "always respond in bullet points"` succeeds end-to-end in a live Claude Code session — rules are stored in MemoryGraph, behavior.md is updated
- [ ] **GR-007 COMPLIANCE**: Deliberately craft a Haiku response that removes a rule silently — verify diff validation catches it and flags it to the user
- [ ] **GR-003 COMPLIANCE**: Verify the user sees the diff and must type "yes" before any MemoryGraph writes occur
- [ ] **COST CHECK**: Verify the merge subagent uses model "haiku" (not opus)
- [ ] **PROMPT INJECTION DEFENSE**: Store a rule with text containing "Ignore all previous instructions". Run /adjust-behavior. Verify the merge prompt does not execute the injected text — the rule text is treated as data, not instructions. The Haiku system prompt instructs the model to treat rule text as opaque strings.

### Live Smoke Test

- [ ] `/adjust-behavior global "Always respond in bullet point format"`
  - Verify: Haiku merge produces 1 NEW rule
  - Verify: Diff validation shows 0 error flags
  - Verify: User approval prompt appears
  - Verify: After approval, rule is in MemoryGraph with agent_scope="global"
  - Verify: behavior.md does not exist (global rules have no agent directory)
- [ ] `/adjust-behavior sec-filing-analyzer "Always cite specific section numbers from the 10-K"`
  - Verify: Haiku merge produces 1 NEW rule for sec-filing-analyzer
  - Verify: After approval, rule is in MemoryGraph with agent_scope="sec-filing-analyzer"
  - Verify: `.claude/agents/custom/sec-filing-analyzer/behavior.md` is updated
- [ ] Run `/adjust-behavior sec-filing-analyzer "Never cite section numbers"` (contradicts previous)
  - Verify: Haiku marks the old rule as REMOVED or MODIFIED
  - Verify: Diff validation flags the removal/change as a warning
  - Verify: User sees both the old and new rule in the review

## Test Commands

```bash
# These tests are manual — invoke in a Claude Code session

# Test 1: Global behavior adjustment
/adjust-behavior "Always respond in bullet point format"

# Test 2: Agent-scoped adjustment (requires an agent to exist)
/adjust-behavior sec-filing-analyzer "Always cite specific section numbers"

# Test 3: Contradicting rule
/adjust-behavior sec-filing-analyzer "Never cite section numbers"

# Test 4: Verify MemoryGraph storage
# mcp__memorygraph__search_memories query="behavior_rule active global"
# mcp__memorygraph__search_memories query="behavior_rule active sec-filing-analyzer"
```
