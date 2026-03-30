# TASK-AGT-018: `/evolve-agent` + `/agent-history` Skills

```
Task ID:       TASK-AGT-018
Status:        BLOCKED
Implements:    REQ-LEARN-012, REQ-LEARN-013
Depends On:    TASK-AGT-015 (FIX evolution + version DAG)
Complexity:    Medium
Guardrails:    GR-009 (all evolution requires user approval), GR-006 (confirmation before actions)
NFRs:          NFR-003 (skills as YAML files under .claude/skills/), NFR-005 (cost)
Security:      LOW — /evolve-agent presents suggestions for user approval (no autonomous changes). /agent-history is read-only. Rollback restores files from disk snapshots.
```

## Context

These two skills provide the user-facing interface to the autolearn system. `/evolve-agent` is the manual trigger for evolution — it retrieves pending suggestions from MemoryGraph and presents them for review. `/agent-history` displays the version DAG and enables rollback to any previous version.

Both skills are essential for user trust: `/evolve-agent` gives users control over when and how evolution happens (complementing the automatic triggers), and `/agent-history` provides full transparency into how an agent has changed over time.

## Scope

### In Scope
- `.claude/skills/evolve-agent.md` — manual evolution trigger skill
- `.claude/skills/agent-history.md` — version DAG viewer + rollback skill
- MemoryGraph query patterns for retrieving analyses and version records
- Display format for evolution suggestions (diff view)
- Display format for version history (table + DAG)
- Rollback logic (restore files from snapshot, create new version record)

### Out of Scope
- Evolution execution logic (TASK-AGT-015 — reused by this task)
- Analysis generation (TASK-AGT-014 — this task only reads existing analyses)
- Health monitoring (TASK-AGT-017 — separate trigger path)

## Key Design Decisions

1. **`/evolve-agent` retrieves, does not generate**: This skill queries MemoryGraph for existing analysis records with pending evolution suggestions. It does NOT run new analyses. If no suggestions exist, it tells the user.

2. **Queued suggestions included**: Suggestions that were queued due to the max-1-per-invocation anti-loop guard (tagged `queued-evolution` in MemoryGraph) are presented alongside recent analysis suggestions.

3. **Rollback creates a new version**: Rolling back to version N does not delete versions N+1, N+2, etc. Instead, it copies files from snapshot N back to the agent directory and creates a new version record (type: `ROLLBACK`, generation unchanged, version incremented). This preserves full audit history.

4. **History display is compact**: The table format shows one row per version with key metrics. The full analysis and diff are available on demand (user can ask to expand any version).

## Detailed Specifications

### `/evolve-agent` Skill

**Skill file**: `.claude/skills/evolve-agent.md`

**Invocation**: `/evolve-agent {agent-name}`

**Flow:**

```
1. VALIDATE:
   a. Check agent directory exists: .claude/agents/custom/{agent-name}/
   b. If not found: "Agent '{agent-name}' not found. Run /list-agents to see available agents."

2. RETRIEVE SUGGESTIONS:
   a. Query MemoryGraph for recent analysis records:
      mcp__memorygraph__search_memories with query "agent_analysis {agent-name}"
      Filter: last 10 records, sorted by timestamp descending
   b. Query MemoryGraph for queued evolution suggestions:
      mcp__memorygraph__search_memories with query "queued-evolution {agent-name}"
   c. For each analysis record that has evolution_suggestions:
      Read the corresponding trace file to get full suggestion details
      (trace file path available in execution record via ANALYZED_BY relationship)

3. COLLECT SUGGESTIONS:
   a. Deduplicate: if multiple analyses suggest the same target_file + similar direction,
      keep the most recent one
   b. Group by type: FIX suggestions first, then DERIVED, then CAPTURED
   c. Include queued suggestions (from anti-loop guard)

4. DISPLAY:
   IF no suggestions found:
     Display:
     "No pending evolution suggestions for '{agent-name}'."
     ""
     "Quality metrics:"
     "  Invocations: {invocation_count}"
     "  Completion rate: {completion_rate}"
     "  Effective rate: {effective_rate}"
     ""
     "The agent appears to be performing within acceptable parameters,"
     "or it hasn't been invoked enough times to generate suggestions (minimum 3)."
     DONE.

   IF suggestions found:
     Display header:
     "Evolution suggestions for '{agent-name}' ({N} suggestion(s)):"
     ""

     For each suggestion (numbered):
     "---"
     "[{index}] {type} — {target_file}"
     "Direction: {direction}"
     "Source: {analysis timestamp} (invocation #{invocation_number})"
     "Analysis: task_completed={task_completed}, quality={completion_quality}"
     "Issues: {issues_identified as bullet list}"
     ""

     Display footer:
     "---"
     "Actions:"
     "  'apply N' — Generate and review edits for suggestion N"
     "  'apply all' — Process all suggestions sequentially"
     "  'dismiss N' — Dismiss suggestion N (logged in MemoryGraph)"
     "  'dismiss all' — Dismiss all suggestions"
     ""
     "Which suggestion would you like to apply?"

5. EXECUTE:
   On 'apply N':
     a. Execute the evolution pipeline from TASK-AGT-015 (FIX) or TASK-AGT-016 (DERIVED/CAPTURED)
     b. Present diff to user, await approval
     c. On approval: apply, update meta.json, create version record
     d. On rejection: log, move to next suggestion

   On 'apply all':
     a. Process suggestions sequentially (respect max-1-per-invocation guard)
     b. First suggestion: full pipeline
     c. Remaining suggestions: queued (anti-loop guard)
     d. Notify: "Applied 1 suggestion. Remaining {N-1} suggestions queued for next /evolve-agent run."

   On 'dismiss N':
     a. Store dismissal in MemoryGraph:
        {"type": "evolution_dismissed", "agent_name": "...",
         "suggestion_type": "FIX", "direction": "...", "timestamp": "..."}
     b. Remove from queued-evolution if applicable
     c. Confirm: "Suggestion {N} dismissed."

   On 'dismiss all':
     a. Dismiss all suggestions (store each dismissal in MemoryGraph)
     b. Confirm: "All {N} suggestions dismissed."
```

### `/agent-history` Skill

**Skill file**: `.claude/skills/agent-history.md`

**Invocation**: `/agent-history {agent-name}`

**Flow:**

```
1. VALIDATE:
   a. Check agent exists (same as /evolve-agent)

2. RETRIEVE VERSION HISTORY:
   a. Read current meta.json for evolution_history_last_10
   b. Query MemoryGraph for all version records:
      mcp__memorygraph__search_memories with query "agent_version {agent-name}"
      Sort by version number ascending
   c. For each version record, retrieve quality counters at that version
      (from the backed-up meta.json in snapshot_path, if available)

3. DISPLAY:

   "Version history for '{agent-name}'"
   "Current: version {version}, generation {generation}"
   ""
   "| Ver | Gen | Type     | Trigger              | Date       | Summary                          | Eff.Rate |"
   "|-----|-----|----------|----------------------|------------|----------------------------------|----------|"
   "|  1  |  0  | CREATED  | —                    | 2026-03-30 | Initial creation via /create-agent|   —      |"
   "|  2  |  1  | FIX      | post-task-analysis   | 2026-03-30 | Added EDGAR retry logic           |  0.80    |"
   "|  3  |  2  | DERIVED  | metric-monitor       | 2026-03-31 | Specialized for quarterly filings |  0.65    |"
   ""
   "Current quality metrics:"
   "  Total invocations: {invocation_count}"
   "  Completion rate: {completion_rate}"
   "  Effective rate: {effective_rate}"
   "  Fallback rate: {fallback_rate}"
   ""
   "Actions:"
   "  'details N' — Show full diff and analysis for version N"
   "  'rollback N' — Restore agent to version N"
   ""
   "Which action would you like to take?"

4. ON 'details N':
   a. Read version record from MemoryGraph
   b. Display:
      "Version {N} details:"
      "Type: {evolution_type}"
      "Trigger: {trigger}"
      "Summary: {change_summary}"
      ""
      "Diff:"
      "{content_diff}"
      ""
      "Quality at this version:"
      "  Effective rate: {effective_rate} (over {total_selections} invocations)"
      ""
      "Snapshot path: {snapshot_path}"
      IF snapshot exists on disk:
        "Snapshot files: {list of files in snapshot directory}"
      ELSE:
        "Snapshot: deleted (only diff available)"

5. ON 'rollback N':
   a. Validate version N exists
   b. Check snapshot directory exists on disk:
      .claude/agents/versions/{agent-name}/{N}/
      IF not exists:
        "Cannot rollback to version {N}: snapshot files have been deleted."
        "Only versions with on-disk snapshots can be rolled back to."
        "Available snapshots: {list versions with existing snapshot dirs}"
        DONE.
   c. Confirm with user:
      "Rollback '{agent-name}' to version {N}?"
      "This will:"
      "  - Replace current definition files with version {N} files"
      "  - Create a new version record (type: ROLLBACK)"
      "  - Reset quality counters (fresh evaluation period)"
      "  - Current files will be backed up to version {current_version + 1} first"
      ""
      "Proceed? (yes/no)"
   d. On approval:
      i.   Backup current files to .claude/agents/versions/{name}/{current_version}/
           (same backup logic as FIX evolution)
      ii.  Copy ALL files from .claude/agents/versions/{name}/{N}/ to
           .claude/agents/custom/{name}/
           EXCEPT meta.json (generate new meta.json instead)
      iii. Generate new meta.json:
           {
             "created": "{original_created}",
             "last_used": "{now}",
             "version": current_version + 1,
             "generation": meta.generation,  // generation UNCHANGED on rollback
             "author": "{original_author}",
             "invocation_count": meta.invocation_count,  // lifetime counter preserved
             "quality": {zeros — reset},
             "evolution_history_last_10": [
               ...existing entries...,
               {"version": current_version + 1, "generation": meta.generation,
                "type": "ROLLBACK", "date": "YYYY-MM-DD",
                "trigger": "user-manual",
                "summary": "Rolled back to version {N}"}
             ]
           }
      iv.  Store MemoryGraph version record:
           {
             "name": "version_{agent-name}_v{new_version}",
             "type": "agent_version",
             "metadata": {
               "agent_name": "{agent-name}",
               "version": new_version,
               "generation": meta.generation,
               "evolution_type": "ROLLBACK",
               "parent_version": current_version,
               "rollback_target_version": N,
               "change_summary": "Rolled back to version {N}",
               "content_diff": "{diff between current and version N}",
               "snapshot_path": ".claude/agents/versions/{name}/{new_version}/",
               "trigger": "user-manual",
               "timestamp": "..."
             },
             "tags": ["agent-version", "{agent-name}", "rollback"]
           }
      v.   Create EVOLVED_FROM relationship (new version → current version)
      vi.  Log: "Rolled back '{agent-name}' to version {N}. New version: {new_version}. Quality counters reset."

   e. On rejection:
      "Rollback cancelled. No changes made."
```

### Skill YAML Frontmatter

**evolve-agent.md:**

```yaml
---
name: evolve-agent
description: Review and apply evolution suggestions for a custom agent based on execution analysis
arguments:
  - name: agent-name
    description: Name of the agent to evolve
    required: true
---
```

**agent-history.md:**

```yaml
---
name: agent-history
description: View version history of a custom agent and rollback to previous versions
arguments:
  - name: agent-name
    description: Name of the agent to inspect
    required: true
---
```

### MemoryGraph Query Patterns

**Retrieve analyses for /evolve-agent:**

```
1. mcp__memorygraph__search_memories:
   query: "agent_analysis {agent-name}"
   → returns analysis records with metadata.suggestions_count > 0

2. For each analysis record:
   Read trace file at metadata.execution_record_name → find trace_file path
   Read trace JSON → extract analysis.evolution_suggestions[]

3. mcp__memorygraph__search_memories:
   query: "queued-evolution {agent-name}"
   → returns queued suggestions from anti-loop guard
```

**Retrieve version history for /agent-history:**

```
1. mcp__memorygraph__search_memories:
   query: "agent_version {agent-name}"
   → returns all version records, sorted by metadata.version ascending

2. For each version record:
   Read metadata.snapshot_path → check if directory exists on disk
   Read metadata.content_diff for diff display
   Read backed-up meta.json from snapshot for quality metrics at that version
```

### Rollback Version Record Schema

```json
{
  "name": "version_sec-filing-analyzer_v4",
  "type": "agent_version",
  "metadata": {
    "agent_name": "sec-filing-analyzer",
    "version": 4,
    "generation": 2,
    "evolution_type": "ROLLBACK",
    "parent_version": 3,
    "rollback_target_version": 1,
    "change_summary": "Rolled back to version 1",
    "content_diff": "--- current\n+++ version_1\n...",
    "snapshot_path": ".claude/agents/versions/sec-filing-analyzer/4/",
    "trigger": "user-manual",
    "timestamp": "2026-03-31T10:00:00Z"
  },
  "tags": ["agent-version", "sec-filing-analyzer", "rollback"]
}
```

Key: `generation` does NOT change on rollback. Rollback is a version event, not a generation event. The agent goes back to an older definition but retains its generation lineage.

## Files to Create

- `.claude/skills/evolve-agent.md` — `/evolve-agent` skill
- `.claude/skills/agent-history.md` — `/agent-history` skill

## Files to Modify

- None (these are new skills)

## Validation Criteria

### Unit Tests

- [ ] **`/evolve-agent` with pending suggestions**: Agent has 2 analysis records with suggestions → both displayed with correct format
- [ ] **`/evolve-agent` with no suggestions**: Agent has 0 pending suggestions → "no suggestions" message with quality metrics
- [ ] **`/evolve-agent` with queued suggestions**: Anti-loop queued suggestion appears in list alongside analysis suggestions
- [ ] **`/evolve-agent` deduplication**: Two analyses suggest same fix for same file → only most recent shown
- [ ] **`/evolve-agent` apply triggers FIX pipeline**: Selecting a FIX suggestion invokes TASK-AGT-015 pipeline
- [ ] **`/evolve-agent` dismiss stores record**: Dismissing a suggestion creates MemoryGraph dismissal record
- [ ] **`/evolve-agent` apply all respects anti-loop**: Only first suggestion executed, rest queued
- [ ] **`/evolve-agent` nonexistent agent**: Error message with suggestion to run `/list-agents`
- [ ] **`/agent-history` shows correct lineage**: Agent with 3 versions shows 3 rows in correct order
- [ ] **`/agent-history` shows quality per version**: Each version row shows effective_rate from that version's meta.json
- [ ] **`/agent-history` details shows diff**: `details N` displays content_diff from MemoryGraph
- [ ] **`/agent-history` details shows snapshot status**: Shows "files: agent.md, context.md, ..." if snapshot exists, "deleted" if not
- [ ] **Rollback to previous version**: `rollback 1` restores files from version 1 snapshot
- [ ] **Rollback creates backup of current**: Before restoring, current files are backed up to new version directory
- [ ] **Rollback creates new version record**: After rollback, meta.json.version is incremented, MemoryGraph has ROLLBACK record
- [ ] **Rollback preserves generation**: generation field unchanged after rollback
- [ ] **Rollback preserves invocation_count**: Lifetime counter not reset
- [ ] **Rollback resets quality counters**: All quality metrics reset to 0
- [ ] **Rollback to deleted snapshot**: Error message listing available snapshots
- [ ] **Rollback EVOLVED_FROM relationship**: New version record has relationship to pre-rollback version
- [ ] **`/agent-history` nonexistent agent**: Error message

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: `/evolve-agent {test-agent}` displays suggestions or "no suggestions" message
- [ ] **OPERATIONAL READINESS**: `/agent-history {test-agent}` displays version table
- [ ] **OPERATIONAL READINESS**: Rollback successfully restores files and agent works after rollback
- [ ] **SKILL FORMAT**: Both skill files have valid YAML frontmatter with name, description, arguments
- [ ] **PRIME DIRECTIVE**: Both skills require user confirmation before modifying files (approve/reject gates)
- [ ] **PARITY**: `/agent-history` display matches REQ-LEARN-012 (version, generation, type, trigger, summary, date, quality)
- [ ] **PARITY**: Rollback creates version record per REQ-LEARN-011

### Live Smoke Test

- [ ] Create agent, run 3+ times to generate analyses with suggestions
- [ ] Run `/evolve-agent {agent-name}` → verify suggestions displayed
- [ ] Apply one suggestion → verify files changed, version incremented
- [ ] Run `/agent-history {agent-name}` → verify history table shows CREATED + FIX entries
- [ ] Run `details 2` → verify diff displayed
- [ ] Run `rollback 1` → verify files restored to version 1 content
- [ ] Run agent again → verify it behaves like version 1
- [ ] Run `/agent-history` again → verify ROLLBACK entry appears in history

## Test Commands

```bash
# Manual test flow:
# 1. Setup: create agent, run several times to build history
/create-agent "A test agent for evolution"
/run-agent test-evolution-agent "Task 1"
/run-agent test-evolution-agent "Task 2"
/run-agent test-evolution-agent "Task 3"

# 2. Test /evolve-agent
/evolve-agent test-evolution-agent

# 3. Apply a suggestion (if any)
# Type: apply 1

# 4. Test /agent-history
/agent-history test-evolution-agent

# 5. View details
# Type: details 2

# 6. Test rollback
# Type: rollback 1

# 7. Verify rollback worked
/agent-history test-evolution-agent
cat .claude/agents/custom/test-evolution-agent/meta.json | python3 -m json.tool
```
