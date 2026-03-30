# TASK-AGT-013: Execution Recording + Quality Counters

```
Task ID:       TASK-AGT-013
Status:        BLOCKED
Implements:    REQ-LEARN-001, REQ-LEARN-002
Depends On:    TASK-AGT-005 (/run-agent skill)
Complexity:    Medium
Guardrails:    GR-006 (confirmation before spawning), GR-009 (all evolution requires approval)
NFRs:          NFR-005 (cost), NFR-006 (resilience — MemoryGraph unavailable fallback)
Security:      LOW — trace files contain full prompts/outputs which may include user data. Trace directory is gitignored. No secrets stored in trace files (Context Envelope already excludes secrets per REQ-RUN-002).
```

## Context

Every `/run-agent` invocation must produce a two-part execution record: a lightweight MemoryGraph entry (for querying) and a full trace file on disk (for post-task analysis in TASK-AGT-014). Additionally, `meta.json` must be expanded with quality counters that track agent effectiveness over time. These counters are the foundation for all autolearn features — post-task analysis updates them, periodic health monitoring reads them, and evolution resets them.

This task modifies the existing `/run-agent` skill (`.claude/skills/run-agent.md`) to add recording logic AFTER the Task tool returns and BEFORE any analysis runs. It also creates a trace file writer utility that handles atomic writes and directory creation.

## Scope

### In Scope
- Trace file writer utility (directory creation, atomic write, JSON serialization)
- MemoryGraph execution record creation (lightweight reference)
- `meta.json` expansion with `quality` block, `generation` field, and `evolution_history_last_10` array
- `task_completed_heuristic` logic
- Atomic write pattern for `meta.json` (temp file + rename)
- Version vs generation semantics enforcement
- Modifications to `/run-agent` skill to call recording after Task returns

### Out of Scope
- Post-task analysis (TASK-AGT-014)
- Quality counter updates from analysis (TASK-AGT-014 — Write 2)
- Evolution logic (TASK-AGT-015+)
- User feedback capture (TASK-AGT-014 — integrated with analysis)

## Key Design Decisions

1. **Two-component record**: MemoryGraph stores a lightweight queryable reference; disk stores the full trace. This prevents MemoryGraph bloat while enabling rich analysis. The trace file path in MemoryGraph is the link between the two.

2. **Trace file naming**: `{timestamp}.json` where timestamp is ISO 8601 with colons replaced by hyphens for filesystem safety: `2026-03-30T10-00-00.json`. This ensures chronological sorting via filename.

3. **meta.json Write 1 (this task) vs Write 2 (TASK-AGT-014)**: This task implements Write 1 only — the immediate post-invocation write that increments `invocation_count`, updates `last_used`, and sets `task_completed_heuristic`. Write 2 (quality counter update from analysis) is implemented in TASK-AGT-014.

4. **Version vs generation**: `version` increments on ANY change to definition files (manual edit, evolution, behavior adjustment). `generation` increments ONLY on evolution actions (FIX, DERIVED, CAPTURED). Invariant: `generation <= version`. This task initializes both to the values from the existing meta.json (or defaults: version=1, generation=0 for pre-existing agents).

5. **Backward compatibility**: Existing agents created before this task will have a `meta.json` without the `quality` block. The recording logic MUST handle this gracefully by initializing missing fields with defaults on first invocation.

## Detailed Specifications

### Trace File JSON Schema

Location: `.claude/agents/traces/{agent-name}/{timestamp}.json`

```json
{
  "schema_version": 1,
  "agent_name": "sec-filing-analyzer",
  "task_description": "Analyze AAPL 10-K for revenue recognition risks",
  "context_envelope": "## ROLE\nYou are a SEC filing analyst...\n## CONTEXT\n...\n## TOOLS\n...\n## BEHAVIORAL RULES\n...\n## TASK\nAnalyze AAPL 10-K...",
  "agent_output": "Based on my analysis of Apple's 10-K filing...",
  "task_completed_heuristic": true,
  "user_feedback": null,
  "model": "opus",
  "timestamp": "2026-03-30T10:00:00Z",
  "duration_ms": 45000,
  "invocation_number": 7
}
```

Field constraints:
- `schema_version`: always `1` (for future migration)
- `agent_name`: non-empty string matching the agent directory name
- `task_description`: non-empty string, the user's original task text
- `context_envelope`: full assembled prompt passed to Task tool. MAY be truncated to 50,000 chars if longer (with `"[TRUNCATED]"` appended)
- `agent_output`: full Task tool return value. MAY be truncated to 50,000 chars
- `task_completed_heuristic`: boolean — see heuristic logic below
- `user_feedback`: null initially; TASK-AGT-014 may append feedback before analysis
- `model`: string, the model used for the Task call (e.g., "opus", "sonnet")
- `timestamp`: ISO 8601 with timezone
- `duration_ms`: integer, wall-clock milliseconds from Task call start to return
- `invocation_number`: integer, the invocation_count value at the time of this invocation

### task_completed_heuristic Logic

```
IF Task tool returned output (non-empty string, no error/exception):
  task_completed_heuristic = true
ELSE IF Task tool threw an error, timed out, or returned empty/null:
  task_completed_heuristic = false
```

This is a coarse heuristic. The post-task analysis (TASK-AGT-014) may override it with a more accurate LLM-based judgment. The heuristic exists so that Write 1 can immediately update `meta.json` without waiting for analysis.

### MemoryGraph Execution Record Schema

```json
{
  "name": "exec_sec-filing-analyzer_2026-03-30T10-00-00",
  "type": "agent_execution",
  "metadata": {
    "agent_name": "sec-filing-analyzer",
    "task_description": "Analyze AAPL 10-K for revenue recognition risks",
    "task_completed_heuristic": true,
    "duration_ms": 45000,
    "model": "opus",
    "trace_file": ".claude/agents/traces/sec-filing-analyzer/2026-03-30T10-00-00.json",
    "invocation_number": 7,
    "timestamp": "2026-03-30T10:00:00Z"
  },
  "tags": ["agent-execution", "sec-filing-analyzer"]
}
```

The `name` field uses format `exec_{agent-name}_{timestamp}` for unique identification. Relationships: none initially (TASK-AGT-014 adds `ANALYZED_BY` relationship to analysis record).

### Expanded meta.json Schema

```json
{
  "created": "2026-03-30T10:00:00Z",
  "last_used": "2026-03-30T14:30:00Z",
  "version": 3,
  "generation": 2,
  "author": "user",
  "_note_version_vs_generation": "version increments on ANY definition file change (manual edit or evolution). generation increments ONLY on evolution actions (FIX, DERIVED, CAPTURED). Invariant: generation <= version.",
  "invocation_count": 15,
  "quality": {
    "total_selections": 15,
    "total_completions": 12,
    "total_fallbacks": 3,
    "applied_rate": 1.0,
    "completion_rate": 0.80,
    "effective_rate": 0.80,
    "fallback_rate": 0.20
  },
  "evolution_history_last_10": [
    {
      "version": 1,
      "generation": 0,
      "type": "CREATED",
      "date": "2026-03-30",
      "trigger": null,
      "summary": "Initial creation via /create-agent"
    }
  ],
  "_note_history": "meta.json retains only last 10 entries. Full history available in MemoryGraph via /agent-history."
}
```

**Quality counter definitions**:
- `total_selections`: incremented on every `/run-agent` invocation (same as `invocation_count` in Phase 4 — all invocations are "selections" since there is no skill-matching step)
- `total_completions`: incremented when analysis confirms `task_completed=true` (Write 2, TASK-AGT-014). For Write 1, this field uses the heuristic and is updated authoritatively in Write 2.
- `total_fallbacks`: incremented when analysis confirms `task_completed=false` (Write 2, TASK-AGT-014). Heuristic-based for Write 1.
- `applied_rate`: always 1.0 (the agent is always "applied" when selected — this metric exists for OpenSpace parity but is trivially 1.0 in our system)
- `completion_rate`: `total_completions / max(total_selections, 1)`
- `effective_rate`: `total_completions / max(total_selections, 1)` (same as completion_rate when applied_rate=1.0)
- `fallback_rate`: `total_fallbacks / max(total_selections, 1)`

**Rate recalculation**: rates are recalculated on every write to `meta.json`. They are derived values, not independently tracked.

**evolution_history_last_10**: array of the last 10 version events, most recent last. Each entry has:
- `version` (int): the version number at this event
- `generation` (int): the generation number at this event
- `type` (string): one of `"CREATED"`, `"FIX"`, `"DERIVED"`, `"CAPTURED"`, `"MANUAL_EDIT"`
- `date` (string): ISO 8601 date only (YYYY-MM-DD)
- `trigger` (string|null): what triggered the event (`"post-task-analysis"`, `"metric-monitor"`, `"user-manual"`, `"tool-degradation"`, null for CREATED)
- `summary` (string): human-readable summary of the change

When the array exceeds 10 entries, the oldest entry is removed (FIFO).

### Atomic Write Pattern for meta.json

```
1. Read current meta.json → parse as JSON
2. Apply updates (increment counters, update timestamps, recalculate rates)
3. Serialize updated JSON with 2-space indent
4. Write to temporary file: {agent-dir}/meta.json.tmp
5. Atomic rename: meta.json.tmp → meta.json
```

This prevents corruption from concurrent writes (EC-RUN-006). On macOS/Linux, `os.rename()` is atomic within the same filesystem.

### Backward Compatibility Initialization

When reading `meta.json` from a pre-Phase-4 agent (no `quality` block):

```
IF "quality" NOT in meta:
  meta["quality"] = {
    "total_selections": meta.get("invocation_count", 0),
    "total_completions": 0,
    "total_fallbacks": 0,
    "applied_rate": 1.0,
    "completion_rate": 0.0,
    "effective_rate": 0.0,
    "fallback_rate": 0.0
  }
IF "generation" NOT in meta:
  meta["generation"] = 0
IF "evolution_history_last_10" NOT in meta:
  meta["evolution_history_last_10"] = [
    {"version": meta.get("version", 1), "generation": 0, "type": "CREATED", "date": meta.get("created", "")[0:10], "trigger": null, "summary": "Pre-autolearn agent"}
  ]
```

### Trace Directory Structure

```
.claude/agents/traces/
  sec-filing-analyzer/
    2026-03-30T10-00-00.json
    2026-03-30T14-30-00.json
  code-reviewer/
    2026-03-30T11-15-00.json
```

The trace writer MUST create the `traces/{agent-name}/` directory if it does not exist (using `mkdir -p` equivalent).

### Modifications to /run-agent Skill

After the existing Task tool invocation and output display, add the following steps:

```
## EXECUTION RECORDING (added by TASK-AGT-013)

After the Task tool returns and the output is displayed to the user:

1. Compute task_completed_heuristic:
   - true if Task returned non-empty output without error
   - false if Task errored, timed out, or returned empty

2. Write trace file:
   - Create directory .claude/agents/traces/{agent-name}/ if needed
   - Generate timestamp: current UTC time, format YYYY-MM-DDTHH-MM-SS
   - Write trace JSON to .claude/agents/traces/{agent-name}/{timestamp}.json
   - Include: context_envelope, agent_output, task_description, agent_name,
     user_feedback (null), model, timestamp (ISO 8601), duration_ms, invocation_number

3. Store MemoryGraph execution record:
   - Call mcp__memorygraph__store_memory with the execution record schema
   - Tags: ["agent-execution", "{agent-name}"]
   - If MemoryGraph unavailable: log warning, continue (trace file is the primary record)

4. Update meta.json (Write 1 — immediate):
   - Read current meta.json
   - Initialize quality block if missing (backward compat)
   - Increment invocation_count
   - Increment quality.total_selections
   - Update last_used to current ISO 8601 timestamp
   - IF task_completed_heuristic is true: increment quality.total_completions
   - ELSE: increment quality.total_fallbacks
   - Recalculate all rates
   - Atomic write (temp + rename)

5. Proceed to post-task analysis (TASK-AGT-014 — not implemented in this task)
```

## Files to Create

- `.claude/agents/traces/` — empty directory (created on first invocation, gitignored)
- Add `.claude/agents/traces/` to `.gitignore` if not already present

## Files to Modify

- `.claude/skills/run-agent.md` — Add execution recording section after Task invocation
- `.gitignore` — Add `.claude/agents/traces/` entry

## Validation Criteria

### Unit Tests

- [ ] **Trace file written**: After a simulated `/run-agent` invocation, a trace file exists at `.claude/agents/traces/{agent-name}/{timestamp}.json` with all required fields
- [ ] **Trace file schema**: All fields present, correct types (string, bool, int, null), no extra fields
- [ ] **Trace file truncation**: Context envelope >50,000 chars is truncated with `[TRUNCATED]` suffix
- [ ] **Timestamp format**: Filename uses `YYYY-MM-DDTHH-MM-SS` (hyphens, not colons), JSON body uses full ISO 8601 with timezone
- [ ] **MemoryGraph record exists**: After invocation, a record with type `agent_execution` and correct agent_name exists in MemoryGraph
- [ ] **MemoryGraph record fields**: All metadata fields match the trace file (agent_name, task_description, task_completed_heuristic, trace_file path)
- [ ] **MemoryGraph unavailable fallback**: If MemoryGraph is down, trace file is still written, warning logged, no crash
- [ ] **Quality counters increment — success case**: invocation_count++ and total_selections++ and total_completions++ when heuristic=true
- [ ] **Quality counters increment — failure case**: invocation_count++ and total_selections++ and total_fallbacks++ when heuristic=false
- [ ] **Rates recalculated**: After 10 invocations (7 success, 3 failure), completion_rate=0.70, fallback_rate=0.30, effective_rate=0.70
- [ ] **Backward compatibility**: Pre-Phase-4 meta.json (no quality block) gets initialized with correct defaults on first invocation
- [ ] **Atomic write**: meta.json.tmp is created and renamed; if process crashes after tmp write but before rename, original meta.json is intact
- [ ] **Version/generation unchanged**: Recording does NOT modify version or generation (those are only changed by evolution)
- [ ] **evolution_history_last_10 initialized**: Pre-Phase-4 agent gets a single CREATED entry in history
- [ ] **evolution_history_last_10 max size**: After 12 history entries, only the last 10 are retained
- [ ] **task_completed_heuristic=true**: Task returned non-empty string → true
- [ ] **task_completed_heuristic=false**: Task threw error → false
- [ ] **task_completed_heuristic=false**: Task returned empty string → false
- [ ] **Trace directory auto-creation**: First invocation for a new agent creates the traces subdirectory
- [ ] **invocation_number in trace**: Matches the invocation_count after increment

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: Run `/run-agent {test-agent} "hello world"` → verify trace file exists on disk at expected path
- [ ] **OPERATIONAL READINESS**: After invocation, `mcp__memorygraph__search_memories` with query "agent_execution {agent-name}" returns the record
- [ ] **OPERATIONAL READINESS**: `meta.json` has quality block with correct counts after 2 invocations
- [ ] **PARITY**: meta.json schema matches REQ-LEARN-002 exactly (field names, types, structure)
- [ ] **PARITY**: MemoryGraph record schema matches REQ-LEARN-001 exactly
- [ ] **GITIGNORE**: `.claude/agents/traces/` is in `.gitignore`

### Live Smoke Test

- [ ] Create a test agent via `/create-agent "simple echo agent"`
- [ ] Run `/run-agent simple-echo-agent "say hello"` — verify output displayed
- [ ] Check `.claude/agents/traces/simple-echo-agent/` contains exactly 1 JSON file
- [ ] Read the trace file — verify `context_envelope` contains the assembled prompt, `agent_output` contains the response
- [ ] Check `meta.json` — verify `invocation_count: 1`, `quality.total_selections: 1`, `quality.total_completions: 1`
- [ ] Run again with a deliberately broken task (e.g., reference nonexistent file) — verify `total_fallbacks` increments if task fails

## Test Commands

```bash
# After implementing, manually test:
# 1. Create test agent
/create-agent "A simple test agent that echoes back the task description"

# 2. Run and verify trace
/run-agent simple-test-agent "Hello world"

# 3. Check trace file
cat .claude/agents/traces/simple-test-agent/*.json | python3 -m json.tool

# 4. Check meta.json
cat .claude/agents/custom/simple-test-agent/meta.json | python3 -m json.tool

# 5. Verify MemoryGraph
# (via mcp__memorygraph__search_memories with query "agent_execution simple-test-agent")
```
