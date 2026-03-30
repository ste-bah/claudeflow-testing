# TASK-AGT-010: `/rollback-behavior` Skill

```
Task ID:       TASK-AGT-010
Status:        BLOCKED
Implements:    REQ-BEHAV-006
Depends On:    TASK-AGT-008 (adjust-behavior skill)
Complexity:    Low
Guardrails:    GR-003 (behavior changes require user approval)
NFRs:          NFR-006 (MemoryGraph resilience)
Security:      Low risk — rollback is a read-then-write operation on existing data. No LLM involved. Verify rollback cannot be used to restore a rule that was deactivated for security reasons without user seeing the full rule text.
```

## Context

`/rollback-behavior` provides version history inspection and rollback for behavior rules. It works at the individual rule level (rollback a specific rule to a previous version) or at the agent level (rollback all rules to a previous point-in-time snapshot).

The key design constraint from REQ-BEHAV-006: rollback creates a NEW version (never deletes history). This preserves the full audit trail and SUPERSEDES chain.

## Scope

### In Scope
- `.claude/skills/rollback-behavior.md` skill file
- Show version history for a rule or agent
- Rollback a single rule to a previous version
- Rollback all rules for an agent to a point-in-time snapshot
- Create new versions on rollback (never delete history)
- Update behavior.md after rollback
- SUPERSEDES chain maintenance

### Out of Scope
- Creating new behavior rules (TASK-AGT-008)
- Modifying rule text during rollback (use /adjust-behavior for that)
- Behavior injection into /run-agent (TASK-AGT-009)

## Key Design Decisions

1. **Rollback = create new version with old content**: Rolling back rule v3 to v1's content creates v4 with v1's text, priority, and category. v3 is deactivated. SUPERSEDES chain: v4→v3→v2→v1.
2. **Point-in-time rollback is per-agent**: When rolling back all rules for an agent to a timestamp, each rule is individually rolled back to its version that was active at that timestamp.
3. **No LLM involved**: Rollback is a pure data operation — no merge, no validation beyond user confirmation.
4. **Stale reference warning**: If the rollback target version references MemoryGraph keys or patterns that no longer exist, a warning is issued but rollback proceeds (EC-BEHAV-004).

## Detailed Specifications

### Skill File: `.claude/skills/rollback-behavior.md`

```yaml
---
name: rollback-behavior
description: View version history and rollback behavioral rules for an agent.
arguments:
  - name: agent_name
    description: "Agent name, or 'global' for global rules"
    required: true
  - name: subcommand
    description: "history | rollback"
    required: false
    default: "history"
  - name: rule_group_id
    description: "Specific rule to operate on (optional — if omitted, operates on all rules for the agent)"
    required: false
  - name: target_version
    description: "Version number to rollback to (required for rollback subcommand)"
    required: false
---
```

### Subcommand: `history`

```
SYNTAX:
  /rollback-behavior {agent_name}                         → show all rules + version summaries
  /rollback-behavior {agent_name} history                 → same as above
  /rollback-behavior {agent_name} history {rule_group_id} → show version history for one rule

ALGORITHM (all rules):
  1. Recall all rules (active AND inactive) for agent_scope:
     Call mcp__memorygraph__search_memories:
       query: f"behavior_rule {agent_name}"
       type: "behavior_rule"
     Filter: metadata.agent_scope == agent_name (or "global")
  2. Group by rule_group_id
  3. For each group, sort versions by metadata.version ASC
  4. Display:

  ## Behavior Rule History — {agent_name}

  ### Rule: {rule_group_id}
  Current: v{version} ({active ? "active" : "inactive"})
  Category: {category}

  | Version | Status | Priority | Rule Text (first 60 chars) | Modified | Modified By |
  |---------|--------|----------|---------------------------|----------|-------------|
  | v3      | active | P75      | Always cite specific se... | 2026-03-30 14:30 | user_request |
  | v2      | inactive | P50    | Cite section numbers wh... | 2026-03-30 12:00 | user_request |
  | v1      | inactive | P50    | Reference SEC filing se... | 2026-03-30 10:00 | user_request |

  ### Rule: {rule_group_id_2}
  ...

  ---
  To rollback a rule: /rollback-behavior {agent_name} rollback {rule_group_id} {version}
  To rollback all rules to a point in time: /rollback-behavior {agent_name} rollback --before "2026-03-30T12:00:00Z"

ALGORITHM (single rule):
  Same as above but filtered to the specified rule_group_id.
  If rule_group_id not found: error "Rule '{rule_group_id}' not found for agent '{agent_name}'."
```

### Subcommand: `rollback` (single rule)

```
SYNTAX:
  /rollback-behavior {agent_name} rollback {rule_group_id} {target_version}

ALGORITHM:
  1. Find the target version:
     Search MemoryGraph for the specific rule_group_id + version combination:
     Call mcp__memorygraph__search_memories:
       query: f"behavior_rule {rule_group_id} v{target_version}"
       type: "behavior_rule"
     Filter: metadata.rule_group_id == rule_group_id AND metadata.version == target_version
     If not found: error "Version {target_version} not found for rule '{rule_group_id}'."

  2. Find the current active version:
     Filter: metadata.rule_group_id == rule_group_id AND metadata.active == true
     If no active version: info "Rule '{rule_group_id}' is already inactive. Rollback will reactivate it with v{target_version} content."

  3. Show rollback preview to user:

     ## Rollback Preview — {agent_name}

     **Rule**: {rule_group_id}
     **Current (v{current_version})**: {current_rule_text}
     **Priority**: {current_priority}

     **Rolling back to (v{target_version})**: {target_rule_text}
     **Priority**: {target_priority}

     This will:
     - Create a new version (v{current_version + 1}) with v{target_version}'s content
     - Deactivate the current version (v{current_version})
     - The version history will be preserved

     Proceed? (yes / no)

  4. On user approval:
     a. Deactivate current active version:
        Call mcp__memorygraph__update_memory:
          name: {current_node_name}
          metadata: { ...current_metadata, active: false }

     b. Create new version with target's content:
        new_version = current_version + 1  (or max_version + 1 if current was inactive)
        slug = _make_slug(target_rule_text)
        new_node_name = f"behavior_rule:{agent_scope}:{target_category}:{slug}:v{new_version}"
        Call mcp__memorygraph__store_memory:
          name: {new_node_name}
          type: "behavior_rule"
          metadata: {
            schema_version: "1.0.0",
            category: target.metadata.category,
            rule: target.metadata.rule,
            priority: target.metadata.priority,
            source: "user_request",
            version: new_version,
            active: true,
            agent_scope: target.metadata.agent_scope,
            rule_group_id: rule_group_id,
            created_at: target.metadata.created_at,  # preserve original creation date
            modified_at: now_iso(),
            modified_by: "rollback"
          }
          tags: ["behavior-rule", agent_scope, target.metadata.category]

     c. Create SUPERSEDES relationship:
        Call mcp__memorygraph__create_relationship:
          source: {new_node_name}
          target: {current_node_name}  (the deactivated version)
          relationship_type: "SUPERSEDES"
          context: f"Rollback to v{target_version} content"

     d. If agent_scope != "global":
        Create APPLIES_TO relationship for new node

     e. Regenerate behavior.md:
        Read all active rules for agent_scope
        Write to .claude/agents/custom/{agent_scope}/behavior.md

  5. Confirm to user:
     "Rolled back rule '{rule_group_id}' from v{current_version} to v{target_version} content.
      New version created: v{new_version}. Version history preserved."
```

### Subcommand: `rollback` (point-in-time, all rules)

```
SYNTAX:
  /rollback-behavior {agent_name} rollback --before "2026-03-30T12:00:00Z"

ALGORITHM:
  1. Parse the target timestamp (ISO 8601 UTC)
     If invalid: error "Invalid timestamp format. Use ISO 8601 UTC, e.g., '2026-03-30T12:00:00Z'"

  2. For each rule_group_id associated with agent_name:
     a. Find the version that was active at the target timestamp:
        Get all versions for this rule_group_id
        Sort by version ASC
        Find the highest-version entry where metadata.modified_at <= target_timestamp
        This is the "target version" for this rule

     b. If no version existed before the target timestamp:
        This rule was created after the target time → mark for deactivation

  3. Show rollback preview:

     ## Point-in-Time Rollback Preview — {agent_name}
     **Target**: {target_timestamp}

     | Rule Group | Current | Rollback To | Action |
     |------------|---------|-------------|--------|
     | brg-a1b2c3 | v3 (P75, "Always cite...") | v1 (P50, "Reference SEC...") | Rollback |
     | brg-d4e5f6 | v2 (P60, "Use bullet...") | v2 (P60, "Use bullet...") | No change |
     | brg-g7h8i9 | v1 (P40, "Log all...") | — | Deactivate (didn't exist at target time) |

     This will create new versions for {n} rules. Version history will be preserved.

     Proceed? (yes / no)

  4. On approval, apply each rollback individually using the single-rule algorithm above.
     Rules marked "No change" are skipped.
     Rules marked "Deactivate" are deactivated (no new version created).

  5. Regenerate behavior.md after all rollbacks complete.

  6. Confirm:
     "Point-in-time rollback complete. {n} rules rolled back, {m} deactivated, {k} unchanged."
```

### Version Listing Display Format

```
## Behavior Rule History — sec-filing-analyzer

### Rule: brg-a1b2c3d4
Current: v4 (active) — Rolled back from v3 to v1 content
Category: analysis

| Ver | Status   | P   | Rule Text                          | Modified           | By           |
|-----|----------|-----|------------------------------------|--------------------|--------------|
| v4  | active   | 50  | Reference SEC filing sections w... | 2026-03-30 16:00   | rollback     |
| v3  | inactive | 75  | Always cite specific section nu... | 2026-03-30 14:30   | user_request |
| v2  | inactive | 50  | Cite section numbers when refer... | 2026-03-30 12:00   | user_request |
| v1  | inactive | 50  | Reference SEC filing sections w... | 2026-03-30 10:00   | user_request |

SUPERSEDES chain: v4 → v3 → v2 → v1

---

Commands:
  /rollback-behavior sec-filing-analyzer rollback brg-a1b2c3d4 2   ← rollback to v2
  /rollback-behavior sec-filing-analyzer rollback --before "2026-03-30T12:00:00Z"  ← point-in-time
```

## Files to Create

- `.claude/skills/rollback-behavior.md` — The full skill file with YAML frontmatter and step-by-step implementation

## Files to Modify

- None directly. behavior.md is regenerated as a side effect of rollback.

## Validation Criteria

### Unit Tests

- [ ] **Rollback v3 to v1**: Rule has versions v1, v2, v3 (v3 active). Rollback to v1. Verify: v4 created with v1's content, v3 deactivated, SUPERSEDES chain v4→v3→v2→v1.
- [ ] **Rollback preserves created_at**: v4 (rollback) has v1's created_at timestamp, not the rollback timestamp. modified_at is the rollback timestamp.
- [ ] **Rollback preserves rule_group_id**: v4 has the same rule_group_id as v1, v2, v3.
- [ ] **SUPERSEDES chain integrity**: After rollback v3→v1 creating v4, query SUPERSEDES from v4 → get v3. Query SUPERSEDES from v3 → get v2. Full chain traversable.
- [ ] **Version history after rollback**: get_version_history returns 4 entries (v1, v2, v3, v4) sorted by version ASC. Only v4 is active.
- [ ] **Rollback to current content (no-op)**: Rule is at v3. Rollback to v3. System detects content is identical and informs user: "Rule is already at v3 content. No rollback needed." No new version created.
- [ ] **Rollback of inactive rule**: Rule was deactivated (no active version). Rollback to v1 creates v(max+1) with active=true, effectively reactivating the rule.
- [ ] **Point-in-time rollback**: 3 rules, each with multiple versions. Target timestamp is between v1 and v2 for all. Verify each rule is individually rolled back to v1.
- [ ] **Point-in-time: rule didn't exist**: Rule created after target timestamp. Verify it is deactivated, not rolled back.
- [ ] **Point-in-time: rule unchanged**: Rule's active version was already the version active at target timestamp. Verify no action taken, marked "No change".
- [ ] **behavior.md regeneration**: After rollback, verify behavior.md reflects only the active rules.
- [ ] **Stale reference warning (EC-BEHAV-004)**: Rollback to a version that references a MemoryGraph key pattern no longer in use. Verify warning issued but rollback proceeds.
- [ ] **Rule group not found**: Rollback with invalid rule_group_id. Error: "Rule 'brg-invalid' not found for agent 'test-agent'."
- [ ] **Version not found**: Rollback to v99 when only v1-v3 exist. Error: "Version 99 not found for rule 'brg-a1b2c3d4'."
- [ ] **Invalid timestamp**: Point-in-time rollback with "not-a-date". Error about format.
- [ ] **User rejects rollback**: User says "no" at confirmation. No changes made.

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: `/rollback-behavior test-agent history` shows version history in a live Claude Code session
- [ ] **OPERATIONAL READINESS**: `/rollback-behavior test-agent rollback {rule_group_id} 1` creates a new version and deactivates the current one
- [ ] **GR-003 COMPLIANCE**: Verify user must confirm before any rollback writes occur
- [ ] **SUPERSEDES CHAIN**: After rollback, `mcp__memorygraph__get_related_memories` traverses the full SUPERSEDES chain
- [ ] **NO DELETION**: Verify that after rollback, all old versions still exist in MemoryGraph (active=false, but present)

### Live Smoke Test

- [ ] Create agent "test-agent" with `/create-agent`
- [ ] Add rule via `/adjust-behavior test-agent "Use TypeScript strict mode"` (creates v1)
- [ ] Modify rule via `/adjust-behavior test-agent "Use TypeScript strict mode with no-implicit-any"` (creates v2)
- [ ] Modify again via `/adjust-behavior test-agent "Use TypeScript strict mode with no-implicit-any and strict-null-checks"` (creates v3)
- [ ] Run `/rollback-behavior test-agent history` — verify 3 versions shown
- [ ] Run `/rollback-behavior test-agent rollback {rule_group_id} 1` — verify v4 created with v1 text
- [ ] Run `/rollback-behavior test-agent history` — verify 4 versions, v4 active
- [ ] Verify `.claude/agents/custom/test-agent/behavior.md` contains v1's rule text
- [ ] Run `/run-agent test-agent "hello"` — verify BEHAVIORAL RULES contains v1's text

## Test Commands

```bash
# These tests are manual — invoke in a Claude Code session

# Setup
/create-agent --name test-agent --description "Test agent for rollback"
/adjust-behavior test-agent "Use TypeScript strict mode"
/adjust-behavior test-agent "Use TypeScript strict mode with no-implicit-any"
/adjust-behavior test-agent "Use TypeScript strict mode with no-implicit-any and strict-null-checks"

# View history
/rollback-behavior test-agent history

# Rollback to v1
/rollback-behavior test-agent rollback {rule_group_id_from_history} 1

# Verify
/rollback-behavior test-agent history
# mcp__memorygraph__search_memories query="behavior_rule active test-agent"
```
