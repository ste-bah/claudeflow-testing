# TASK-AGT-014: Post-Task Analysis

```
Task ID:       TASK-AGT-014
Status:        BLOCKED
Implements:    REQ-LEARN-003, REQ-LEARN-004
Depends On:    TASK-AGT-013 (execution recording)
Complexity:    High
Guardrails:    GR-009 (evolution suggestions require approval — enforced downstream), GR-010 (max 1 evolution per invocation)
NFRs:          NFR-005 (cost — Haiku model, $0.001-0.005 per analysis)
Security:      LOW — analysis prompt contains user task descriptions and agent outputs. No secrets. Haiku subagent has NO tool access (prompt-in/JSON-out only).
```

## Context

After every `/run-agent` invocation (for invocations 3+), the system runs a post-task analysis using a Haiku LLM subagent. This analysis produces a structured judgment: did the task complete? Did the agent follow its role and behavioral rules? What issues were identified? What evolution suggestions should be proposed?

The analysis runs INLINE (not background) — Claude Code's Task tool is synchronous. The user sees the agent output first, then the orchestrator runs a brief Haiku analysis call (~2-5 seconds). Since the Task tool is blocking, the user CANNOT issue commands while analysis runs. The analysis either completes (normal path) or times out (if Haiku takes >30s, which is rare). There is no cancellation scenario — the user waits for the brief analysis to finish.

This task implements the two-write pattern for `meta.json`: Write 1 (from TASK-AGT-013, already done by the time analysis starts) set the heuristic-based counters. Write 2 (this task) updates counters with the authoritative `task_completed` judgment from analysis. This means Write 2 may CORRECT Write 1 — if the heuristic said "completed" but analysis says "failed", Write 2 reverses the completion counter and increments the fallback counter.

## Scope

### In Scope
- Haiku analysis subagent prompt template
- EvolutionSuggestion schema
- Analysis JSON output schema
- Warm-up exclusion (no analysis if `invocation_count < 3`)
- Two-write meta.json pattern (Write 2 — authoritative counter update)
- User feedback integration (append to trace before analysis)
- Cancellation handling (mark as unanalyzed)
- MemoryGraph analysis record storage with relationship to execution record
- Modifications to `/run-agent` skill for inline analysis

### Out of Scope
- Executing evolution suggestions (TASK-AGT-015+)
- Periodic health monitoring (TASK-AGT-017)
- User-initiated evolution (TASK-AGT-018)

## Key Design Decisions

1. **Prompt-in/JSON-out (no tool access)**: The analysis subagent is a single LLM call with structured output. It does NOT have tool access. This is simpler and cheaper than OpenSpace's multi-iteration agent loop. The full trace content (Context Envelope + output + feedback) is passed directly in the prompt. Known limitation: the analysis LLM cannot verify outcomes by re-running commands or reading files. This may be upgraded in Phase 5+.

2. **Context truncation to 12K chars**: The Context Envelope can be very large (up to 15K tokens controllable). To fit within Haiku's practical attention span for analysis, the context_envelope field is truncated to 12,000 characters in the analysis prompt. The agent_output is truncated to 8,000 characters. Task description is passed in full.

3. **Write 2 correction logic**: Write 1 (TASK-AGT-013) increments counters based on `task_completed_heuristic`. Write 2 uses the analysis judgment's `task_completed` as authoritative. If they disagree, Write 2 corrects: e.g., if heuristic=true but analysis says task_completed=false, Write 2 decrements `total_completions` and increments `total_fallbacks`.

4. **User feedback window**: After the agent output is displayed, the orchestrator checks if the user's next message is feedback (starts with "that was wrong", "good", "perfect", etc.) before running analysis. If the user's response is a new command (not feedback), analysis runs with `user_feedback: null`.

## Detailed Specifications

### Haiku Analysis Prompt Template

**System prompt:**

```
You are an agent execution analyst. You review execution traces of custom AI agents and produce structured quality assessments.

You will receive:
1. The agent's task description (what the user asked for)
2. The context envelope (the full prompt the agent received, possibly truncated)
3. The agent's output (what the agent produced)
4. User feedback (if provided)

Your job is to determine:
- Whether the task was completed successfully
- Whether the agent followed its assigned role
- Whether the agent followed its behavioral rules
- What issues occurred
- Whether the agent definition should be evolved

Respond with ONLY valid JSON matching the schema below. No markdown, no explanation, no code fences.
```

**User message:**

```
## Task Description
{task_description}

## Context Envelope (agent's full prompt, truncated to 12K chars)
{context_envelope_truncated}

## Agent Output (truncated to 8K chars)
{agent_output_truncated}

## User Feedback
{user_feedback_or_"No user feedback provided."}

## Agent Quality History
Total invocations: {total_selections}
Completion rate: {completion_rate}
Recent issues from previous analyses (last 3): {recent_issues_summary_or_"None"}

## Response Schema
{
  "task_completed": boolean,
  "completion_quality": "full" | "partial" | "failed",
  "agent_followed_role": boolean,
  "agent_followed_behavior_rules": boolean,
  "issues_identified": ["string describing each issue"],
  "evolution_suggestions": [
    {
      "type": "FIX" | "DERIVED" | "CAPTURED",
      "target_file": "context.md" | "agent.md" | "tools.md",
      "direction": "string describing what to change and why"
    }
  ]
}
```

### Analysis Output JSON Schema

```json
{
  "task_completed": true,
  "completion_quality": "full",
  "agent_followed_role": true,
  "agent_followed_behavior_rules": true,
  "issues_identified": [
    "EDGAR API returned 429 but context.md has no retry guidance"
  ],
  "evolution_suggestions": [
    {
      "type": "FIX",
      "target_file": "context.md",
      "direction": "Add EDGAR API rate limit handling: wait 100ms between requests, retry 3x on 429"
    }
  ]
}
```

Field constraints:
- `task_completed` (boolean, required): authoritative judgment on whether the task was completed. Overrides `task_completed_heuristic` from TASK-AGT-013.
- `completion_quality` (string, required): one of `"full"`, `"partial"`, `"failed"`. "partial" means the agent produced useful output but did not fully address the task.
- `agent_followed_role` (boolean, required): whether the agent stayed within its defined role in agent.md.
- `agent_followed_behavior_rules` (boolean, required): whether the agent adhered to rules in behavior.md.
- `issues_identified` (array of strings, required): may be empty. Each string describes a specific issue observed.
- `evolution_suggestions` (array of objects, required): may be empty. Each suggestion is actionable.

### EvolutionSuggestion Schema

```json
{
  "type": "FIX" | "DERIVED" | "CAPTURED",
  "target_file": "context.md" | "agent.md" | "tools.md" | "behavior.md",
  "direction": "Human-readable description of what to change and why"
}
```

Constraints:
- `type` (string, required): one of `"FIX"`, `"DERIVED"`, `"CAPTURED"`
- `target_file` (string, required for FIX): the agent definition file to modify. For FIX, this MUST be `"context.md"`, `"agent.md"`, or `"tools.md"` — NOT `"behavior.md"` (behavioral changes go through `/adjust-behavior` per REQ-LEARN-005 constraint). For DERIVED/CAPTURED, this field indicates the primary file to base the new agent on.
- `direction` (string, required): specific, actionable description. The evolution LLM (TASK-AGT-015) uses this as its primary instruction.

If the analysis LLM suggests a `target_file: "behavior.md"` with type `"FIX"`, the orchestrator MUST reclassify it: store the suggestion with a note `"_reclassified": "behavior_change_via_adjust_behavior"` and present it to the user as a behavior adjustment proposal rather than a FIX evolution.

### Two-Write meta.json Pattern

**Write 1 (TASK-AGT-013, already complete by this point):**
```
invocation_count++
quality.total_selections++
last_used = now
IF task_completed_heuristic:
  quality.total_completions++
ELSE:
  quality.total_fallbacks++
Recalculate rates.
Atomic write.
```

**Write 2 (this task, after analysis completes):**
```
Read meta.json (fresh read — Write 1 already applied)
analysis_completed = analysis.task_completed

IF task_completed_heuristic != analysis_completed:
  # Correction needed
  IF task_completed_heuristic == true AND analysis_completed == false:
    quality.total_completions--
    quality.total_fallbacks++
  ELIF task_completed_heuristic == false AND analysis_completed == true:
    quality.total_fallbacks--
    quality.total_completions++

Recalculate rates.
Atomic write (temp + rename).
```

This correction ensures that quality counters converge on the LLM judgment rather than the heuristic.

### Warm-Up Exclusion Logic

```
IF meta.invocation_count < 3:
  Skip analysis entirely.
  Log: "Skipping analysis for invocation {n} (warm-up period, analysis starts at invocation 3)"
  Do NOT store any analysis record.
  Do NOT run Write 2.
  Write 1 counters (heuristic-based) stand as-is.
```

Rationale: the first 2 invocations are "cold start" — the user is likely still calibrating the agent, and analysis of these early runs produces noise rather than signal.

### Cancellation Handling

Analysis runs inline. If the user issues a new command before the analysis Task call returns:

```
NOTE: Cancellation is not architecturally possible — Claude Code's Task tool is synchronous
and blocking. The user cannot issue commands while analysis runs. If analysis times out
(>30s, rare for Haiku), the invocation is marked as unanalyzed:
   {
     "name": "analysis_unanalyzed_{agent-name}_{timestamp}",
     "type": "agent_analysis_unanalyzed",
     "metadata": {
       "agent_name": "...",
       "execution_record_name": "exec_{agent-name}_{timestamp}",
       "reason": "analysis_timeout"
     },
     "tags": ["agent-analysis", "unanalyzed", "{agent-name}"]
   }
Write 1 counters (heuristic-based) stand. No Write 2. Add a `last_analysis_invocation`
field to meta.json to detect unanalyzed invocations for future reconciliation.
```

### User Feedback Integration

After displaying the agent output, the orchestrator asks a STRUCTURED question:

```
"Agent output above. Quick feedback? (good / bad / skip)"
```

This replaces the previous heuristic keyword detection approach, which was unreliable
(could misclassify new commands as feedback or vice versa).

```
IF user responds with feedback:
  "good", "great", "perfect", "yes" → user_feedback = "positive"
  "bad", "wrong", "incorrect", "no" → user_feedback = "negative"
  Free-text correction (e.g., "it missed the auditor's report") → user_feedback = user's message
  "skip", "" (empty), or any command starting with "/" → user_feedback = null

  1. Append user_feedback to the trace file:
     Read trace JSON → set user_feedback = user's message → atomic rewrite

  2. IF feedback is negative or a correction:
     Override task_completed_heuristic to false in the trace file

  3. Proceed with analysis (user_feedback now included in prompt)

IF user responds with "skip" or a new command:
  Proceed with analysis using user_feedback = null
```

For contradictory feedback (user says "good" then "actually that was wrong" — EC-LEARN-007):
use the MOST RECENT feedback. Log the contradiction in the trace file's user_feedback field
as: "CONTRADICTORY: first said 'good', then corrected to '{correction}'. Using correction."

### MemoryGraph Analysis Record

```json
{
  "name": "analysis_{agent-name}_{timestamp}",
  "type": "agent_analysis",
  "metadata": {
    "agent_name": "sec-filing-analyzer",
    "task_completed": true,
    "completion_quality": "full",
    "agent_followed_role": true,
    "agent_followed_behavior_rules": true,
    "issues_count": 1,
    "suggestions_count": 1,
    "suggestion_types": ["FIX"],
    "execution_record_name": "exec_sec-filing-analyzer_2026-03-30T10-00-00",
    "timestamp": "2026-03-30T10:00:05Z"
  },
  "tags": ["agent-analysis", "sec-filing-analyzer"]
}
```

After storing, create a relationship:
```
mcp__memorygraph__create_relationship:
  source: "exec_sec-filing-analyzer_2026-03-30T10-00-00"
  target: "analysis_sec-filing-analyzer_2026-03-30T10-00-00"
  relationship_type: "ANALYZED_BY"
```

The full analysis JSON (including `issues_identified` and `evolution_suggestions` with directions) is stored in the trace file as an appended `analysis` field, NOT in MemoryGraph (too large). MemoryGraph stores only the summary metadata.

### Updated Trace File After Analysis

```json
{
  "schema_version": 1,
  "agent_name": "sec-filing-analyzer",
  "task_description": "...",
  "context_envelope": "...",
  "agent_output": "...",
  "task_completed_heuristic": true,
  "user_feedback": "that was wrong, it missed the lease liability section",
  "model": "opus",
  "timestamp": "2026-03-30T10:00:00Z",
  "duration_ms": 45000,
  "invocation_number": 7,
  "analysis": {
    "task_completed": false,
    "completion_quality": "partial",
    "agent_followed_role": true,
    "agent_followed_behavior_rules": true,
    "issues_identified": ["Missed lease liability analysis despite explicit mention in task"],
    "evolution_suggestions": [
      {
        "type": "FIX",
        "target_file": "context.md",
        "direction": "Add checklist item for lease liability (ASC 842) analysis in SEC filing review"
      }
    ],
    "analyzed_at": "2026-03-30T10:00:05Z"
  }
}
```

### Modifications to /run-agent Skill

After the execution recording section (TASK-AGT-013), add:

```
## POST-TASK ANALYSIS (added by TASK-AGT-014)

After execution recording (Write 1) completes:

1. Check warm-up exclusion:
   - IF invocation_count < 3: skip analysis, log "warm-up period", DONE
   - ELSE: proceed to step 2

2. Check for user feedback:
   - After displaying agent output, if user provides feedback text:
     - Append to trace file as user_feedback field
     - If negative feedback: update task_completed_heuristic to false in trace
   - If user issues a new command: proceed with user_feedback=null

3. Build analysis prompt:
   - Read trace file from disk
   - Truncate context_envelope to 12,000 chars
   - Truncate agent_output to 8,000 chars
   - Retrieve last 3 analysis records from MemoryGraph for this agent
   - Assemble system prompt + user message per template above

4. Spawn Haiku analysis subagent:
   - Task("Post-task analysis", "{assembled prompt}", model: "haiku")
   - This is prompt-in/JSON-out — NO tool access for the subagent

5. Parse analysis output:
   - Parse JSON response
   - Validate schema (all required fields present, correct types)
   - If JSON parse fails: log warning, mark as unanalyzed, skip Write 2
   - If behavior.md target in FIX suggestion: reclassify as behavior adjustment

6. Update trace file:
   - Append analysis object to trace JSON
   - Atomic write

7. Store MemoryGraph analysis record:
   - Store summary record with tags
   - Create ANALYZED_BY relationship to execution record

8. meta.json Write 2 (authoritative counter update):
   - Read current meta.json
   - Compare task_completed_heuristic vs analysis.task_completed
   - Apply correction if they disagree
   - Recalculate rates
   - Atomic write

9. Log analysis summary to user (brief, non-intrusive):
   - "Analysis: task {completed|partially completed|failed}. {N} issue(s) found. {M} evolution suggestion(s) queued."
   - Do NOT show evolution details here (those are presented via /evolve-agent or after health check)
```

## Files to Create

None (all logic goes into the existing `/run-agent` skill modification)

## Files to Modify

- `.claude/skills/run-agent.md` — Add post-task analysis section after execution recording

## Validation Criteria

### Unit Tests

- [ ] **Analysis runs for invocation 3+**: Simulate 3 invocations; verify analysis runs on invocation 3 but NOT on invocations 1 and 2
- [ ] **Analysis skipped for invocations 1-2**: invocation_count=1 → no analysis record in MemoryGraph, no Write 2
- [ ] **Structured judgment stored**: After analysis, trace file contains `analysis` field with all required keys
- [ ] **MemoryGraph analysis record**: Record with type `agent_analysis` exists with correct metadata
- [ ] **ANALYZED_BY relationship**: Relationship from execution record to analysis record exists
- [ ] **Write 2 correction — heuristic true, analysis false**: total_completions decremented, total_fallbacks incremented, rates updated
- [ ] **Write 2 correction — heuristic false, analysis true**: total_fallbacks decremented, total_completions incremented
- [ ] **Write 2 no correction — both agree**: counters unchanged from Write 1
- [ ] **User feedback appended**: If user says "that was wrong", trace file's user_feedback field contains the message
- [ ] **Negative feedback overrides heuristic**: user_feedback starts with "that was wrong" → task_completed_heuristic set to false in trace
- [ ] **Cancellation marks unanalyzed**: If analysis is interrupted, MemoryGraph contains `agent_analysis_unanalyzed` record
- [ ] **JSON parse failure handled**: If Haiku returns invalid JSON, no crash, invocation marked unanalyzed
- [ ] **behavior.md FIX reclassified**: If analysis suggests FIX to behavior.md, it is reclassified with `_reclassified` note
- [ ] **Context truncation**: Context >12K chars is truncated; output >8K chars is truncated
- [ ] **Recent issues included**: Analysis prompt includes issues from last 3 analyses for this agent
- [ ] **Analysis summary logged**: User sees brief one-line summary after analysis completes
- [ ] **Rates accurate after mixed results**: 10 invocations (7 heuristic-success, 3 heuristic-failure, 1 correction) → rates correct

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: After 3 invocations of a test agent, the trace file for invocation 3 contains an `analysis` field
- [ ] **OPERATIONAL READINESS**: `mcp__memorygraph__search_memories` with query "agent_analysis {agent-name}" returns at least 1 record
- [ ] **COST CHECK**: Analysis uses Haiku model (verify in Task call parameters)
- [ ] **NO TOOL ACCESS**: Analysis subagent prompt does NOT include tool descriptions or MCP tool access
- [ ] **PARITY**: Analysis JSON schema matches REQ-LEARN-003 exactly
- [ ] **PARITY**: Two-write pattern matches REQ-LEARN-004 exactly

### Live Smoke Test

- [ ] Create test agent, run 3 times with simple tasks
- [ ] Verify invocations 1-2 have NO analysis in trace files
- [ ] Verify invocation 3 has analysis in trace file with all fields
- [ ] Run once with deliberately bad task (ask agent to do something outside its role)
- [ ] Verify analysis identifies `agent_followed_role: false` or `task_completed: false`
- [ ] Check meta.json quality counters match expected values
- [ ] Provide negative feedback ("that was wrong") after an invocation — verify it appears in trace and affects analysis

## Test Commands

```bash
# Manual test flow:
# 1. Create and run test agent 3 times
/create-agent "A test agent that summarizes text"
/run-agent test-summarizer "Summarize: The quick brown fox jumps over the lazy dog"
/run-agent test-summarizer "Summarize: Claude Code is an AI coding assistant"
/run-agent test-summarizer "Summarize: OpenSpace is a self-evolving skill engine"

# 2. Check trace file for invocation 3
cat .claude/agents/traces/test-summarizer/*.json | python3 -c "
import json, sys, glob
files = sorted(glob.glob('.claude/agents/traces/test-summarizer/*.json'))
for f in files:
    data = json.load(open(f))
    has_analysis = 'analysis' in data
    print(f'{f}: analysis={has_analysis}')
"

# 3. Verify meta.json
cat .claude/agents/custom/test-summarizer/meta.json | python3 -m json.tool
```
