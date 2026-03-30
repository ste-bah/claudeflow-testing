# TASK-AGT-015: FIX Evolution Mode + Version DAG

```
Task ID:       TASK-AGT-015
Status:        BLOCKED
Implements:    REQ-LEARN-005 (FIX only), REQ-LEARN-006, REQ-LEARN-011
Depends On:    TASK-AGT-014 (post-task analysis)
Complexity:    High
Guardrails:    GR-009 (all evolution requires user approval), GR-010 (max 1 evolution per invocation), GR-011 (counter reset post-evolution)
NFRs:          NFR-005 (cost — Haiku for FIX, $0.005-0.02 per evolution)
Security:      MEDIUM — evolution modifies agent definition files. User approval gate (GR-009) is the primary security control. Backup to versions/ ensures rollback is always possible.
```

## Context

FIX evolution is the primary self-repair mechanism: when post-task analysis identifies a specific issue in a specific agent definition file, the system proposes targeted SEARCH/REPLACE edits to fix the issue. The user reviews the diff and approves or rejects the change. On approval, the old files are backed up to the version directory, edits are applied, and `meta.json` is updated with new version/generation numbers and reset quality counters.

This task also implements the Version DAG — every evolution (FIX, DERIVED, CAPTURED) creates a version record in MemoryGraph with content_diff and snapshot_path. The Version DAG is the audit trail that enables `/agent-history` (TASK-AGT-018) to display lineage and enable rollback.

## Scope

### In Scope
- FIX evolution pipeline (read analysis → generate edits → present diff → apply on approval)
- Haiku evolution subagent prompt template
- SEARCH/REPLACE edit schema (JSON array)
- Version backup (copy files to `.claude/agents/versions/{name}/{version}/`)
- Version DAG records in MemoryGraph
- meta.json updates (version++, generation++, counter reset, history append)
- Anti-loop guard: max 1 evolution per invocation
- Anti-loop guard: quality counter reset post-evolution
- behavior.md rejection (FIX must not target behavior.md)
- User approval gate with diff display

### Out of Scope
- DERIVED evolution (TASK-AGT-016)
- CAPTURED evolution (TASK-AGT-016)
- Two-phase execution (TASK-AGT-016)
- Periodic health monitoring triggers (TASK-AGT-017)
- `/evolve-agent` skill UI (TASK-AGT-018)

## Key Design Decisions

1. **Orchestrator-mediated evolution (no tool access for evolution LLM)**: The orchestrator reads the target file content and passes it in the prompt to a Haiku subagent. The subagent returns SEARCH/REPLACE edits as JSON. The orchestrator applies them using the Edit tool. This is simpler and cheaper than OpenSpace's agent loop with tool access. Known limitation: the evolution LLM cannot read other files or verify its changes.

2. **SEARCH/REPLACE as JSON array**: Each edit is a `{search: "...", replace: "..."}` object. The orchestrator applies them sequentially using the Edit tool. This format is unambiguous, diff-able, and compatible with Claude Code's Edit tool pattern.

3. **behavior.md is ALWAYS rejected as FIX target**: If analysis suggests a FIX to behavior.md, it was already reclassified in TASK-AGT-014. If it somehow reaches this stage, reject with explanation and suggest `/adjust-behavior` instead.

4. **Version backup before apply**: ALWAYS copy ALL definition files to the version directory BEFORE applying any edits. This ensures rollback is possible even if the edit application partially fails.

5. **Counter reset is total_selections=0 (not total_completions)**: After evolution, all quality counters in the `quality` block reset to zero. This forces the agent to accumulate fresh data before re-evaluation. The `invocation_count` does NOT reset (it is a lifetime counter).

## Detailed Specifications

### FIX Evolution Pipeline

```
1. TRIGGER: Evolution suggestion with type=FIX from post-task analysis
   - OR: manual trigger via /evolve-agent (TASK-AGT-018)
   - OR: periodic health check trigger (TASK-AGT-017)

2. VALIDATE:
   a. Check target_file is NOT "behavior.md"
      - If behavior.md: reject, log "FIX cannot target behavior.md. Use /adjust-behavior."
      - Return without changes.
   b. Check target_file exists in agent directory
      - If not: reject, log "Target file {target_file} not found in agent definition."
   c. Check anti-loop: has this invocation already produced an evolution?
      - Track via in-memory flag per invocation (not persisted)
      - If already evolved: queue suggestion, log "Max 1 evolution per invocation. Suggestion queued for /evolve-agent."

3. PREPARE:
   a. Read target file content from .claude/agents/custom/{agent-name}/{target_file}
   b. Read the analysis that triggered this suggestion (from trace file or MemoryGraph)
   c. Read up to 3 most recent trace files for this agent (for pattern context)
   d. Read current meta.json for version/generation numbers

4. GENERATE EDITS:
   a. Assemble Haiku evolution prompt (see template below)
   b. Spawn Task("FIX evolution", "{prompt}", model: "haiku")
   c. Parse JSON response as array of SEARCH/REPLACE edits
   d. If JSON parse fails: abort, log error, no changes

5. PRESENT TO USER:
   a. Display: "Evolution suggestion (FIX) for {agent-name}/{target_file}"
   b. Display: "Trigger: {analysis summary}"
   c. Display: "Direction: {direction from suggestion}"
   d. For each edit, show unified diff:
      --- {target_file} (current)
      +++ {target_file} (proposed)
      @@ ... @@
      - {search text}
      + {replace text}
   e. Ask: "Apply this evolution? (yes/no/modify)"
   f. WAIT for explicit user approval

6. ON APPROVAL:
   a. Backup: copy ALL files from .claude/agents/custom/{agent-name}/ to
      .claude/agents/versions/{agent-name}/{current_version}/
   b. Apply edits: for each {search, replace} pair, use Edit tool on the target file
      - If any edit fails (search text not found): abort remaining edits,
        restore from backup, report error
   c. Generate content_diff: unified diff between backup and new version
   d. Update meta.json:
      - version++
      - generation++
      - quality block reset: total_selections=0, total_completions=0,
        total_fallbacks=0, applied_rate=0.0, completion_rate=0.0,
        effective_rate=0.0, fallback_rate=0.0
        NOTE: All rates set to 0.0 (not 1.0) because 0/0 is undefined.
        Rates will be computed after the first post-evolution invocation.
      - Append to evolution_history_last_10:
        {"version": new_version, "generation": new_generation, "type": "FIX",
         "date": "YYYY-MM-DD", "trigger": "{trigger_source}", "summary": "{LLM summary}"}
      - Trim history to last 10 entries
      - Atomic write
   e. Store MemoryGraph version record (see schema below)
   f. Create relationships: EVOLVED_FROM → parent version, TRIGGERED_BY → analysis record
   g. Log: "Evolution applied. {agent-name} updated to version {n}, generation {g}. Quality counters reset."

7. ON REJECTION:
   a. Log rejection in MemoryGraph:
      {"type": "agent_evolution_rejected", "agent_name": "...", "evolution_type": "FIX",
       "reason": "user_rejected", "timestamp": "..."}
   b. No file changes, no version increment
```

### Haiku Evolution Prompt Template

**System prompt:**

```
You are an agent definition editor. You produce targeted SEARCH/REPLACE edits to fix issues in agent definition files.

You will receive:
1. The current content of the file to edit
2. The analysis that identified the issue
3. Recent execution traces showing the problem in action
4. A direction describing what to fix

Produce ONLY a JSON array of SEARCH/REPLACE edit objects. Each object has:
- "search": exact text to find in the current file (must match exactly, including whitespace)
- "replace": the replacement text

Rules:
- Make minimal changes. Do not rewrite sections that are working correctly.
- Each search string must be unique in the file (appear exactly once).
- Preserve the file's existing formatting style (markdown headers, bullet styles, etc.).
- If you need to ADD new content, use a search string that matches the location where content should be inserted (e.g., the line before the insertion point) and include both the original line and the new content in the replace string.
- Do NOT modify behavioral rules — those are managed separately.

Respond with ONLY the JSON array. No markdown code fences, no explanation.
```

**User message:**

```
## File to Edit: {target_file}
## Current Content:
```
{file_content}
```

## Analysis That Triggered This Evolution:
Task completed: {task_completed}
Quality: {completion_quality}
Issues: {issues_identified as bullet list}
Direction: {direction}

## Recent Execution Context (last 3 traces, summaries):
Trace 1: Task: "{task_desc_1}" | Completed: {completed_1} | Issues: {issues_1}
Trace 2: Task: "{task_desc_2}" | Completed: {completed_2} | Issues: {issues_2}
Trace 3: Task: "{task_desc_3}" | Completed: {completed_3} | Issues: {issues_3}

## JSON Array of Edits:
```

### SEARCH/REPLACE Edit Schema

```json
[
  {
    "search": "## Data Sources\n\nQuery the SEC EDGAR API for 10-K filings.",
    "replace": "## Data Sources\n\nQuery the SEC EDGAR API for 10-K filings.\n\n### Rate Limit Handling\n\nThe EDGAR API enforces rate limits (10 requests/second for registered users).\n- Wait 100ms between consecutive requests\n- On HTTP 429: retry up to 3 times with exponential backoff (1s, 2s, 4s)\n- On HTTP 503: wait 5 seconds and retry once"
  }
]
```

Constraints:
- `search` (string, required): exact substring of the current file content. Must appear exactly once.
- `replace` (string, required): the replacement text. May be longer or shorter than search.
- Array may contain 1-5 edits. If >5, the evolution LLM is making too many changes — the orchestrator logs a warning but still presents to the user.

### Version Record Schema (MemoryGraph)

```json
{
  "name": "version_{agent-name}_v{version}",
  "type": "agent_version",
  "metadata": {
    "agent_name": "sec-filing-analyzer",
    "version": 3,
    "generation": 2,
    "evolution_type": "FIX",
    "parent_version": 2,
    "change_summary": "Added EDGAR API retry logic to context.md",
    "content_diff": "--- context.md\n+++ context.md\n@@ -5,3 +5,8 @@\n ## Data Sources\n \n Query the SEC EDGAR API for 10-K filings.\n+\n+### Rate Limit Handling\n+...",
    "snapshot_path": ".claude/agents/versions/sec-filing-analyzer/3/",
    "trigger": "post-task-analysis",
    "analysis_id": "analysis_sec-filing-analyzer_2026-03-30T10-00-00",
    "timestamp": "2026-03-30T14:30:00Z"
  },
  "tags": ["agent-version", "sec-filing-analyzer"]
}
```

Relationships:
- `EVOLVED_FROM`: source=`version_{agent-name}_v{version}`, target=`version_{agent-name}_v{parent_version}`, type=`EVOLVED_FROM`
- `TRIGGERED_BY`: source=`version_{agent-name}_v{version}`, target=`analysis_{agent-name}_{timestamp}`, type=`TRIGGERED_BY`

Note: MemoryGraph stores `content_diff` (compact string) and `snapshot_path` (reference to disk). It does NOT store full file contents. The full snapshot lives on disk at `snapshot_path`.

### Version Backup Directory Structure

```
.claude/agents/versions/
  sec-filing-analyzer/
    1/                          # Initial version (created by first evolution)
      agent.md
      context.md
      tools.md
      behavior.md
      memory-keys.json
      meta.json                 # meta.json at the time of backup
    2/
      agent.md
      context.md
      ...
    3/
      ...
```

On first evolution, version 1 (the original) is backed up. The backup includes ALL files from the agent directory, including meta.json at that point in time.

Snapshot retention: keep last 5 versions on disk. Older snapshots MAY be deleted; their `content_diff` and `change_summary` in MemoryGraph remain for lineage inspection. Deletion of old snapshots is NOT implemented in this task (future enhancement).

### Anti-Loop Guards

**Guard 1: Max 1 evolution per invocation**
```
The orchestrator tracks an in-memory flag: _evolution_applied_this_invocation = False
Before executing any evolution:
  IF _evolution_applied_this_invocation:
    Queue the suggestion (store in MemoryGraph with tag "queued-evolution")
    Log: "Evolution already applied this invocation. Suggestion queued for /evolve-agent."
    RETURN without executing
  ELSE:
    Proceed with evolution
    On successful apply: set _evolution_applied_this_invocation = True
```

**Guard 2: Quality counter reset post-evolution**
```
After evolution is applied:
  meta.quality = {
    total_selections: 0,
    total_completions: 0,
    total_fallbacks: 0,
    applied_rate: 0.0,
    completion_rate: 0.0,
    effective_rate: 0.0,
    fallback_rate: 0.0
  }
```

This means the agent needs at least 5 fresh invocations before periodic health monitoring (TASK-AGT-017) can re-evaluate it. This prevents: evolve → still bad → immediately re-evolve → infinite loop.

### behavior.md Rejection

```
IF suggestion.target_file == "behavior.md":
  Log to user: "Evolution suggestion targets behavior.md, which cannot be modified via FIX evolution. Behavioral changes must go through /adjust-behavior to maintain MemoryGraph consistency. The suggestion has been converted to a behavior adjustment proposal."
  Store suggestion in MemoryGraph with tag "behavior-adjustment-proposal"
  Do NOT execute evolution
  RETURN
```

## Files to Create

- `.claude/agents/versions/` — directory (created on first evolution, gitignored)
- Add `.claude/agents/versions/` to `.gitignore` if not already present

## Files to Modify

- `.claude/skills/run-agent.md` — Add evolution execution section (after analysis, when suggestions exist)
- `.gitignore` — Add `.claude/agents/versions/` entry

## Validation Criteria

### Unit Tests

- [ ] **FIX applied to deliberately flawed context.md**: Create agent with known issue in context.md, run analysis that produces FIX suggestion, execute evolution → verify edits applied correctly
- [ ] **Backup created before edit**: Version directory `.claude/agents/versions/{name}/{version}/` exists with all original files
- [ ] **Backup includes meta.json**: The backed-up meta.json has the pre-evolution version number
- [ ] **Version DAG record in MemoryGraph**: Record with type `agent_version` exists with correct version, generation, evolution_type, parent_version
- [ ] **EVOLVED_FROM relationship**: Relationship exists from new version to parent version
- [ ] **TRIGGERED_BY relationship**: Relationship exists from new version to analysis record
- [ ] **content_diff stored**: Version record's content_diff is a valid unified diff string
- [ ] **snapshot_path valid**: Version record's snapshot_path points to an existing directory
- [ ] **meta.json updated — version and generation**: version incremented by 1, generation incremented by 1
- [ ] **meta.json updated — quality reset**: All quality counters are 0 after evolution
- [ ] **meta.json updated — history appended**: evolution_history_last_10 has new FIX entry
- [ ] **meta.json updated — history max 10**: After 12 evolutions, history has exactly 10 entries
- [ ] **behavior.md rejected**: FIX suggestion targeting behavior.md is rejected with explanation
- [ ] **Anti-loop: second evolution blocked**: Two FIX suggestions in same invocation → first applied, second queued
- [ ] **Queued suggestion stored**: Second suggestion exists in MemoryGraph with tag "queued-evolution"
- [ ] **User rejection**: User says "no" → no files modified, rejection logged in MemoryGraph
- [ ] **Edit failure rollback**: If SEARCH text not found in file, remaining edits aborted, files restored from backup
- [ ] **Multiple edits applied sequentially**: 3 edits in one evolution all applied in order
- [ ] **Diff display format**: User sees unified diff format with --- and +++ headers
- [ ] **invocation_count NOT reset**: After evolution, invocation_count retains its value (only quality block resets)

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: Create flawed agent, invoke 3 times, verify FIX suggestion appears, approve it, verify files changed
- [ ] **OPERATIONAL READINESS**: After evolution, `mcp__memorygraph__search_memories` with query "agent_version {agent-name}" returns version record
- [ ] **VERSION INTEGRITY**: Version number in meta.json matches the latest version record in MemoryGraph
- [ ] **ROLLBACK POSSIBLE**: Files in `.claude/agents/versions/{name}/{prev_version}/` can be manually copied back to restore the agent
- [ ] **PARITY**: Version record schema matches REQ-LEARN-011 exactly
- [ ] **COST CHECK**: Evolution uses Haiku model

### Live Smoke Test

- [ ] Create agent with known flaw: `/create-agent "SEC filing analyzer"` then manually edit context.md to remove a critical instruction
- [ ] Run 3 times with tasks that expose the flaw
- [ ] Verify analysis identifies the issue and produces a FIX suggestion
- [ ] Approve the evolution
- [ ] Verify the file is fixed, backup exists, MemoryGraph has version record
- [ ] Run again — verify the agent performs better with the fix applied
- [ ] Check meta.json — quality counters are 0, version and generation incremented

## Test Commands

```bash
# Manual test flow:
# 1. Create agent and deliberately break it
/create-agent "A SEC filing risk analyzer"
# Manually edit context.md to remove key instructions

# 2. Run 3 times to trigger analysis
/run-agent sec-filing-risk-analyzer "Analyze AAPL 10-K risks"
/run-agent sec-filing-risk-analyzer "Analyze MSFT 10-K risks"
/run-agent sec-filing-risk-analyzer "Analyze GOOG 10-K risks"

# 3. If analysis produces FIX suggestion, approve it
# 4. Verify backup
ls .claude/agents/versions/sec-filing-risk-analyzer/

# 5. Verify meta.json
cat .claude/agents/custom/sec-filing-risk-analyzer/meta.json | python3 -m json.tool

# 6. Verify MemoryGraph
# (via mcp__memorygraph__search_memories with query "agent_version sec-filing-risk-analyzer")
```
