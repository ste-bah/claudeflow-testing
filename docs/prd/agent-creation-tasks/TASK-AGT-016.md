# TASK-AGT-016: DERIVED + CAPTURED + Two-Phase Execution

```
Task ID:       TASK-AGT-016
Status:        BLOCKED
Implements:    REQ-LEARN-005 (DERIVED/CAPTURED), REQ-LEARN-007, REQ-LEARN-008
Depends On:    TASK-AGT-015 (FIX evolution + version DAG)
Complexity:    High
Guardrails:    GR-009 (all evolution requires user approval), GR-012 (two-phase fallback is opt-in only)
NFRs:          NFR-005 (cost — Haiku for DERIVED, Sonnet for CAPTURED, two-phase doubles invocation cost)
Security:      MEDIUM — DERIVED inherits parent files (no new security surface). CAPTURED creates new agent from execution trace (user approval required). Two-phase doubles cost — user must be informed.
```

## Context

This task implements the remaining two evolution modes (DERIVED and CAPTURED) and the two-phase execution model that triggers CAPTURED evolution.

**DERIVED** creates a new agent variant alongside the parent. Both remain active. The new agent inherits the parent's files with targeted modifications. Example: an SEC filing analyzer that struggles with quarterly filings gets a DERIVED variant specialized for quarterly filings.

**CAPTURED** extracts a brand-new agent definition from a successful bare-reasoning execution trace. This is triggered when two-phase fallback succeeds in Phase 2 (no agent context) after Phase 1 (with agent context) failed. Sonnet is used instead of Haiku because extracting a coherent agent definition from a raw execution trace is more complex than editing an existing one.

**Two-phase execution** (`--fallback` flag) runs the agent normally first, and if the post-task analysis says it failed, re-runs with no agent context. If Phase 2 succeeds, CAPTURED evolution extracts the approach.

## Scope

### In Scope
- DERIVED evolution pipeline (create new agent directory with parent lineage)
- CAPTURED evolution pipeline (extract agent.md + context.md from trace)
- `--fallback` flag in `/run-agent` for two-phase execution
- Phase 2 bare-reasoning re-execution
- Cost warning before Phase 2
- Name collision handling for DERIVED (append `-v{generation}`)
- Sonnet subagent for CAPTURED extraction
- Haiku subagent for DERIVED modification
- Version DAG records for DERIVED and CAPTURED

### Out of Scope
- FIX evolution (TASK-AGT-015, already implemented)
- Periodic health monitoring triggers (TASK-AGT-017)
- `/evolve-agent` skill (TASK-AGT-018)

## Key Design Decisions

1. **DERIVED creates a new directory, not a branch**: `.claude/agents/custom/{name}-v{generation}/` is a fully independent agent directory. It records `parent_agent` in meta.json but is otherwise self-contained. Both parent and child appear in `/list-agents`.

2. **CAPTURED uses Sonnet (not Haiku)**: Extracting a coherent agent definition from a raw execution trace requires stronger reasoning than editing an existing definition. This is the only evolution mode that uses Sonnet. Estimated cost: $0.01-0.05 per CAPTURED extraction.

3. **Two-phase is opt-in via `--fallback` flag**: Default `/run-agent` behavior is unchanged. The `--fallback` flag enables Phase 2 on failure. This prevents doubling cost on every invocation (GR-012).

4. **Phase 2 confirmation gate**: Before running Phase 2, the user must explicitly approve. The system shows: estimated additional cost, failure assessment from Phase 1, and explains that Phase 2 runs without agent context.

5. **CAPTURED only triggers on Phase 2 SUCCESS**: If Phase 2 also fails, no CAPTURED evolution. Both failures are recorded but no new agent is proposed (EC-LEARN-003).

## Detailed Specifications

### DERIVED Evolution Pipeline

```
1. TRIGGER: Evolution suggestion with type=DERIVED from:
   - Post-task analysis (TASK-AGT-014)
   - /evolve-agent manual trigger (TASK-AGT-018)
   - Periodic health check (TASK-AGT-017)

2. DETERMINE NEW AGENT NAME:
   parent_name = current agent name
   parent_generation = current meta.generation
   candidate_name = "{parent_name}-v{parent_generation + 1}"

   WHILE directory .claude/agents/custom/{candidate_name}/ exists:
     Increment suffix: candidate_name = "{parent_name}-v{next_number}"
   # This handles EC-LEARN-005 (name collision)

3. GENERATE MODIFICATIONS:
   a. Read ALL parent files: agent.md, context.md, tools.md, behavior.md, memory-keys.json
   b. Read the analysis that triggered this suggestion
   c. Read up to 3 recent traces for pattern context
   d. Assemble Haiku prompt (see DERIVED prompt template below)
   e. Spawn Task("DERIVED evolution", "{prompt}", model: "haiku")
   f. Parse response: JSON object with per-file modifications

4. PRESENT TO USER:
   a. Display: "DERIVED evolution: Create new agent '{candidate_name}' based on '{parent_name}'"
   b. Display: "Direction: {direction from suggestion}"
   c. For each modified file, show unified diff between parent and proposed
   d. Show files that are inherited unchanged
   e. Ask: "Create derived agent '{candidate_name}'? (yes/no/modify)"
   f. WAIT for explicit user approval

5. ON APPROVAL:
   a. Create directory .claude/agents/custom/{candidate_name}/
   b. Copy ALL parent files to new directory
   c. Apply modifications (SEARCH/REPLACE edits per file, same format as FIX)
   d. Generate new meta.json for derived agent:
      {
        "created": "{now}",
        "last_used": null,
        "version": 1,
        "generation": 1,
        "author": "evolution",
        "parent_agent": "{parent_name}",
        "evolution_type": "DERIVED",
        "invocation_count": 0,
        "quality": {
          "total_selections": 0, "total_completions": 0, "total_fallbacks": 0,
          "applied_rate": 1.0, "completion_rate": 0.0,
          "effective_rate": 0.0, "fallback_rate": 0.0
        },
        "evolution_history_last_10": [
          {"version": 1, "generation": 1, "type": "DERIVED",
           "date": "YYYY-MM-DD", "trigger": "{trigger_source}",
           "summary": "Derived from {parent_name}: {direction summary}"}
        ]
      }
   e. Register in MemoryGraph (same pattern as /create-agent registration)
   f. Store version record in MemoryGraph (see schema below)
   g. Create relationships:
      - DERIVED_FROM: new agent → parent agent
      - TRIGGERED_BY: version record → analysis record
   h. Log: "Created derived agent '{candidate_name}' from '{parent_name}'."
   i. Parent agent is UNCHANGED — no version bump, no counter reset

6. ON REJECTION:
   a. Log rejection in MemoryGraph
   b. No files created
```

### DERIVED Haiku Prompt Template

**System prompt:**

```
You are an agent definition editor specializing in creating derived agent variants. You will modify an existing agent's definition files to create a specialized variant.

You will receive:
1. The parent agent's complete definition files
2. The analysis that triggered this derivation
3. A direction describing what specialization to make

For each file that needs changes, produce a JSON object with the filename as key and an array of SEARCH/REPLACE edits as value. Files that need no changes should be omitted.

Rules:
- The derived agent should be a SPECIALIZATION, not a general improvement (use FIX for general improvements)
- Preserve the parent's structure and style
- Update the role description in agent.md to reflect the specialization
- Update context.md with specialized instructions
- tools.md and behavior.md usually remain unchanged in DERIVED (only change if the specialization demands it)

Respond with ONLY a JSON object. No markdown code fences, no explanation.
```

**User message:**

```
## Parent Agent: {parent_name}

### agent.md:
```
{agent_md_content}
```

### context.md:
```
{context_md_content}
```

### tools.md:
```
{tools_md_content}
```

### behavior.md:
```
{behavior_md_content}
```

## Analysis That Triggered Derivation:
{analysis_summary}

## Direction:
{direction}

## Produce a JSON object with modifications:
Example: {"agent.md": [{"search": "...", "replace": "..."}], "context.md": [{"search": "...", "replace": "..."}]}
```

### DERIVED Response Schema

```json
{
  "agent.md": [
    {"search": "You are a SEC filing analyst.", "replace": "You are a SEC quarterly filing analyst specializing in 10-Q filings."}
  ],
  "context.md": [
    {"search": "## Filing Types\n\nAnalyze 10-K annual filings.", "replace": "## Filing Types\n\nAnalyze 10-Q quarterly filings. Focus on quarter-over-quarter changes and seasonal patterns."}
  ]
}
```

### CAPTURED Evolution Pipeline

```
1. TRIGGER: Two-phase execution where Phase 1 failed and Phase 2 succeeded.
   - ONLY triggered via the two-phase fallback flow (not manually)
   - Both trace files (Phase 1 and Phase 2) must exist

2. EXTRACT AGENT DEFINITION:
   a. Read Phase 1 trace (failed execution with agent context)
   b. Read Phase 2 trace (successful execution without agent context)
   c. Assemble Sonnet extraction prompt (see CAPTURED prompt template below)
   d. Spawn Task("CAPTURED extraction", "{prompt}", model: "sonnet")
   e. Parse response: JSON object with agent.md and context.md content

3. DETERMINE AGENT NAME:
   a. Sonnet suggests a name in its response
   b. Sanitize: lowercase, replace spaces with hyphens, max 50 chars
   c. IF name exists: append "-captured-{N}" suffix

4. PRESENT TO USER:
   a. Display: "CAPTURED evolution: New agent '{proposed_name}' extracted from successful bare-reasoning execution"
   b. Display: "Phase 1 (with agent) FAILED. Phase 2 (bare reasoning) SUCCEEDED."
   c. Display: "The Phase 2 approach has been extracted as a reusable agent definition."
   d. Show proposed agent.md and context.md (full content, not diff — these are new files)
   e. Ask: "Create this agent? (yes/no/modify)"
   f. WAIT for explicit user approval

5. ON APPROVAL:
   a. Create directory .claude/agents/custom/{name}/
   b. Write agent.md (from Sonnet output)
   c. Write context.md (from Sonnet output)
   d. Write tools.md (empty template: "## Tools\n\nNo specialized tools required.")
   e. Write behavior.md (empty template: "## Behavioral Rules\n\nNo rules defined yet.")
   f. Write memory-keys.json (empty: {"keys": [], "leann_queries": []})
   g. Generate meta.json:
      {
        "created": "{now}",
        "last_used": null,
        "version": 1,
        "generation": 0,
        "author": "captured",
        "evolution_type": "CAPTURED",
        "parent_agent": null,
        "invocation_count": 0,
        "quality": {zeros},
        "evolution_history_last_10": [
          {"version": 1, "generation": 0, "type": "CAPTURED",
           "date": "YYYY-MM-DD", "trigger": "two-phase-fallback",
           "summary": "Captured from successful bare-reasoning execution"}
        ]
      }
   h. Register in MemoryGraph
   i. Store version record (generation=0 since CAPTURED is a root node)
   j. Log: "Captured agent '{name}' created. Run /run-agent {name} to test."

6. ON REJECTION:
   a. Log rejection in MemoryGraph
   b. No files created
```

### CAPTURED Sonnet Prompt Template

**System prompt:**

```
You are an agent definition extractor. You analyze execution traces and extract reusable agent definitions.

You will receive two execution traces:
1. Phase 1: A FAILED execution that used an existing agent's context
2. Phase 2: A SUCCESSFUL execution that used NO agent context (bare reasoning)

Your job is to understand WHY Phase 2 succeeded where Phase 1 failed, and extract the successful approach as a reusable agent definition.

Produce a JSON object with:
- "suggested_name": a kebab-case name for the agent (max 50 chars)
- "agent_md": the full content of agent.md (role description, expertise, approach)
- "context_md": the full content of context.md (domain knowledge, procedures, data sources)

Rules:
- The agent definition should be REUSABLE across similar tasks, not specific to this one task
- Extract general patterns, not task-specific details
- Include any error handling or recovery strategies that Phase 2 used
- agent.md should be 200-500 words describing the role
- context.md should be 500-2000 words with structured instructions

Respond with ONLY a JSON object. No markdown code fences, no explanation.
```

**User message:**

```
## Original Task Description:
{task_description}

## Phase 1 Trace (FAILED — with agent context):
### Agent used: {agent_name}
### Agent output (truncated to 8K chars):
{phase1_output}
### Analysis judgment: task_completed=false, issues: {phase1_issues}

## Phase 2 Trace (SUCCEEDED — bare reasoning, no agent context):
### Output (truncated to 12K chars):
{phase2_output}

## What approach did Phase 2 use that Phase 1 missed?
Extract the successful approach as a reusable agent definition.
```

### CAPTURED Response Schema

```json
{
  "suggested_name": "quarterly-filing-risk-analyzer",
  "agent_md": "# Quarterly Filing Risk Analyzer\n\nYou are a financial analyst specializing in...\n\n## Expertise\n...\n\n## Approach\n...",
  "context_md": "# Context\n\n## Filing Analysis Procedure\n\n1. Download the 10-Q filing...\n2. Extract quarterly revenue figures...\n\n## Risk Categories\n...\n\n## Data Sources\n..."
}
```

### Two-Phase Execution (`--fallback` flag)

```
1. PARSE FLAG:
   User invokes: /run-agent {name} --fallback "{task description}"
   OR: /run-agent {name} "{task description}" --fallback
   The --fallback flag enables two-phase execution for this invocation.

2. PHASE 1 (normal execution):
   Execute /run-agent as normal (context assembly, Task invocation, recording, analysis)
   Display output to user.

3. CHECK PHASE 1 RESULT:
   After analysis completes (TASK-AGT-014):
   IF analysis.task_completed == true:
     DONE. No Phase 2 needed.
   IF analysis.task_completed == false:
     Proceed to Phase 2 confirmation.

4. PHASE 2 CONFIRMATION:
   Display to user:
   "---"
   "Agent-guided execution appears to have failed."
   "Analysis: {brief failure summary from analysis.issues_identified[0]}"
   ""
   "Phase 2 (bare reasoning) will re-run the same task WITHOUT the agent's"
   "context, relying on pure model reasoning. This costs an additional"
   "~$0.02-0.10 depending on output length."
   ""
   "Try bare reasoning? (yes/no)"
   WAIT for explicit user approval.

   IF user says no:
     Record Phase 1 failure. DONE.
   IF user says yes:
     Proceed to Phase 2.

5. PHASE 2 (bare reasoning):
   a. Assemble minimal prompt:
      "## Task\n\n{original_task_description}\n\nComplete this task using your best judgment."
      NO agent.md, NO context.md, NO tools.md, NO behavior.md injected.
      Model: same as Phase 1 (Opus by default).
   b. Spawn Task("Phase 2 bare reasoning", "{minimal prompt}")
   c. Display output to user.
   d. Record Phase 2 trace (same schema as Phase 1 but with
      agent_name="{original_agent_name}_phase2", context_envelope=minimal prompt)
   e. Run post-task analysis on Phase 2 output.

6. EVALUATE PHASE 2:
   IF Phase 2 analysis.task_completed == true:
     Log: "Phase 2 succeeded. Proposing CAPTURED evolution."
     Trigger CAPTURED evolution pipeline (step 2 above) with both traces.
   IF Phase 2 analysis.task_completed == false:
     Log: "Both phases failed. Recording dual failure. No evolution triggered."
     Record: MemoryGraph record with type "agent_dual_failure"
     Increment parent agent's total_fallbacks (already done by Phase 1 recording)
     Do NOT trigger CAPTURED evolution (EC-LEARN-003)
```

### Version DAG Records for DERIVED and CAPTURED

**DERIVED version record:**

```json
{
  "name": "version_{derived-name}_v1",
  "type": "agent_version",
  "metadata": {
    "agent_name": "{derived-name}",
    "version": 1,
    "generation": 1,
    "evolution_type": "DERIVED",
    "parent_version": null,
    "parent_agent": "{parent-name}",
    "parent_agent_version": 3,
    "change_summary": "Specialized variant for quarterly filings",
    "content_diff": "--- parent: agent.md\n+++ derived: agent.md\n...",
    "snapshot_path": ".claude/agents/custom/{derived-name}/",
    "trigger": "post-task-analysis",
    "analysis_id": "analysis_{parent-name}_{timestamp}",
    "timestamp": "..."
  },
  "tags": ["agent-version", "{derived-name}", "derived-from-{parent-name}"]
}
```

**CAPTURED version record:**

```json
{
  "name": "version_{captured-name}_v1",
  "type": "agent_version",
  "metadata": {
    "agent_name": "{captured-name}",
    "version": 1,
    "generation": 0,
    "evolution_type": "CAPTURED",
    "parent_version": null,
    "parent_agent": null,
    "change_summary": "Extracted from successful bare-reasoning execution",
    "content_diff": "",
    "snapshot_path": ".claude/agents/custom/{captured-name}/",
    "trigger": "two-phase-fallback",
    "phase1_agent": "{original-agent-name}",
    "phase1_trace": ".claude/agents/traces/{agent-name}/{timestamp}.json",
    "phase2_trace": ".claude/agents/traces/{agent-name}_phase2/{timestamp}.json",
    "timestamp": "..."
  },
  "tags": ["agent-version", "{captured-name}", "captured"]
}
```

## Files to Create

- None (DERIVED and CAPTURED create agent directories at runtime)

## Files to Modify

- `.claude/skills/run-agent.md` — Add `--fallback` flag parsing and two-phase execution logic

## Validation Criteria

### Unit Tests

- [ ] **DERIVED creates new directory**: After approved DERIVED, `.claude/agents/custom/{name}-v{N}/` exists with all files
- [ ] **DERIVED inherits parent files**: Files not modified by evolution are identical to parent
- [ ] **DERIVED meta.json has parent_agent**: meta.json contains `parent_agent: "{parent-name}"`
- [ ] **DERIVED meta.json has evolution_type**: meta.json contains `evolution_type: "DERIVED"`
- [ ] **DERIVED version record in MemoryGraph**: Record with type `agent_version`, evolution_type `DERIVED`
- [ ] **DERIVED_FROM relationship**: Relationship from derived agent to parent agent exists
- [ ] **DERIVED name collision handled**: If `{name}-v2` exists, creates `{name}-v3`
- [ ] **DERIVED parent unchanged**: Parent agent's meta.json, files, and version are unmodified
- [ ] **CAPTURED extracts from bare trace**: Given Phase 1 failure + Phase 2 success traces, produces agent.md + context.md
- [ ] **CAPTURED creates new directory**: After approved CAPTURED, new agent directory exists
- [ ] **CAPTURED meta.json has no parent**: parent_agent is null, generation is 0
- [ ] **CAPTURED uses Sonnet**: Task call for extraction specifies model "sonnet"
- [ ] **CAPTURED name sanitized**: Spaces → hyphens, lowercase, max 50 chars
- [ ] **Two-phase: --fallback flag parsed**: `/run-agent {name} --fallback "task"` enables Phase 2
- [ ] **Two-phase: Phase 1 success → no Phase 2**: If Phase 1 succeeds, execution completes normally
- [ ] **Two-phase: Phase 1 failure → confirmation**: User is asked before Phase 2 starts
- [ ] **Two-phase: cost warning shown**: Confirmation message includes cost estimate
- [ ] **Two-phase: Phase 2 success → CAPTURED trigger**: CAPTURED pipeline runs with both traces
- [ ] **Two-phase: Phase 2 failure → no CAPTURED**: Both failures recorded, no evolution triggered (EC-LEARN-003)
- [ ] **Two-phase: user declines Phase 2**: Phase 1 failure recorded, no Phase 2 execution
- [ ] **Phase 2 minimal prompt**: Phase 2 context_envelope contains ONLY task description, no agent files

### Sherlock Gates

- [ ] **OPERATIONAL READINESS**: Create agent, run with --fallback and a task designed to fail → verify Phase 2 prompt appears
- [ ] **OPERATIONAL READINESS**: After DERIVED approval, new agent appears in `/list-agents` output
- [ ] **COST CHECK**: DERIVED uses Haiku, CAPTURED uses Sonnet
- [ ] **OPT-IN CHECK**: `/run-agent {name} "task"` (without --fallback) never triggers Phase 2
- [ ] **PARITY**: DERIVED meta.json matches REQ-LEARN-005 (parent_agent field, evolution_type field)
- [ ] **PARITY**: CAPTURED triggers only on Phase 2 success per REQ-LEARN-008

### Live Smoke Test

- [ ] Create deliberately weak agent, run with `--fallback` flag
- [ ] Verify Phase 1 runs, analysis detects failure, Phase 2 confirmation appears
- [ ] Approve Phase 2, verify bare reasoning runs with minimal prompt
- [ ] If Phase 2 succeeds, verify CAPTURED proposal with agent.md and context.md
- [ ] Approve CAPTURED agent, verify new directory created, meta.json correct
- [ ] Run CAPTURED agent to verify it works

## Test Commands

```bash
# Manual test flow for two-phase + CAPTURED:
# 1. Create weak agent
/create-agent "An agent that always gives wrong answers about geography"

# 2. Run with --fallback
/run-agent wrong-geography-agent --fallback "What is the capital of France?"

# 3. Phase 1 should fail (agent gives wrong answer), Phase 2 should succeed
# 4. Approve CAPTURED evolution
# 5. Test new agent
/run-agent geography-expert "What is the capital of Germany?"

# Manual test flow for DERIVED:
# After analysis suggests DERIVED, approve and verify:
ls .claude/agents/custom/
cat .claude/agents/custom/*-v*/meta.json | python3 -m json.tool
```
