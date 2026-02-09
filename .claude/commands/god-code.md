---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Use the Coding Pipeline CLI (`coding-pipeline-cli`) for code generation with dynamic agent orchestration, RLM memory handoffs, and LEANN semantic search.

**Supports two modes:**
- Single task: `/god-code "task description"`
- Batch mode: `/god-code -batch "task1" "task2" "task3"`

**Arguments**: $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use coding-pipeline-cli for orchestration. DO NOT use static Task() templates.**

### 🚨 CRITICAL: DO NOT STOP DURING PIPELINE EXECUTION

**The user has ALREADY decided to run this pipeline by invoking /god-code. Their confirmation is the invocation itself.**

- **DO NOT** pause between batches to ask "should I continue?"
- **DO NOT** stop to present status summaries with options
- **DO NOT** say "this will take X hours, would you like to proceed?"
- **DO NOT** offer to skip, pause, or modify the pipeline mid-execution
- **DO NOT** comment on token usage, context limits, or duration estimates
- **JUST EXECUTE** the init → spawn → complete → spawn → complete loop until `status: "complete"`
- In batch mode, **JUST EXECUTE** all tasks back-to-back without stopping between them
- The ONLY reason to stop is an actual error (CLI crash, agent failure)

**Use the agent `key` field from batch JSON as the Task tool `subagent_type`. Do NOT use the `type` field.**

### Mode Detection

Check if `$ARGUMENTS` starts with `-batch`:
- **IF batch mode**: Process multiple tasks sequentially (see Batch Mode Protocol)
- **IF single mode**: Process one task (see Single Task Protocol)

---

## SINGLE TASK PROTOCOL

Use this protocol when `$ARGUMENTS` does NOT start with `-batch`.

### Step 1: Initialize Pipeline

**CRITICAL**: The init command takes 30-60 seconds due to DESC episode injection searching 1969 trajectories. DO NOT timeout. Wait for the full response.

**Bash timeout parameter**: When calling the init command, use `timeout: 180000` (3 minutes) to ensure DESC injection completes without timing out.

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$ARGUMENTS"
```

This returns:
```json
{
  "sessionId": "uuid",
  "status": "running",
  "currentPhase": "understanding",
  "batch": [
    {
      "key": "task-analyzer",
      "prompt": "...",
      "type": "code-analyzer"
    }
  ],
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}
```

**Save the `sessionId` - you need it for all subsequent commands.**

### Step 2: Execute Current Batch

From the init response JSON, the `batch` array contains agents to spawn. For each agent in the array, spawn it using the Task tool with the agent's `type`, `prompt`, and `key` fields:

```
Task(batch[0].type, batch[0].prompt, batch[0].key)
Task(batch[1].type, batch[1].prompt, batch[1].key)
# ... for all agents in batch array
```

**Wait for ALL agents in batch to complete before Step 3.**

### Step 3: Loop Until Complete

Repeat until `status: "complete"`:

#### 3a. Mark Batch Complete and Get Next

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "<sessionId>"
```

Returns:
```json
{
  "sessionId": "...",
  "status": "running",
  "currentPhase": "exploration",
  "batch": [
    {
      "key": "pattern-explorer",
      "prompt": "...",
      "type": "code-analyzer"
    }
  ],
  "progress": { "completed": 6, "total": 48, "percentage": 13 }
}
```

#### 3b. Spawn Batch Agents

From the response JSON, spawn each agent in the `batch` array using Task tool:

```
Task(batch[0].type, batch[0].prompt, batch[0].key)
Task(batch[1].type, batch[1].prompt, batch[1].key)
# ... for all agents in batch array
```

#### 3c. Wait for Completion

**Wait for ALL agents in batch to complete**, then return to 3a.

When pipeline is complete, `complete` returns:
```json
{
  "status": "complete",
  "sessionId": "...",
  "progress": { "completed": 48, "total": 48, "percentage": 100 }
}
```

### Step 4: Pipeline Complete

When `status: "complete"` is returned, report completion to user.

---

## BATCH MODE PROTOCOL

Use this protocol when `$ARGUMENTS` starts with `-batch`.

### Overview

Process multiple coding tasks sequentially by running the **SINGLE TASK PROTOCOL** for each task.

**CRITICAL**: Batch mode does NOT use a separate batch wrapper. Instead, loop over tasks using the standard init/complete/spawn cycle.

### Execution Steps

**Step 1: Extract Tasks**

Parse all task arguments after the `-batch` flag from `$ARGUMENTS`.

Example: If `$ARGUMENTS` is `-batch "Add auth" "Add logging" "Add tests"`, then:
- TASK1 = "Add auth"
- TASK2 = "Add logging"
- TASK3 = "Add tests"

**Step 2: Loop Over Tasks**

For each task, run the **SINGLE TASK PROTOCOL** (Steps 1-4 from above):

```
FOR each task in tasks:
  1. Initialize: coding-pipeline-cli.ts init "<task>"
  2. Loop: spawn batch agents → complete → get next batch
  3. Complete: when status="complete"
  4. Report: task N/M completed
```

**Step 3: Report Summary**

After all tasks complete, show summary:

```
================================================================================
BATCH SUMMARY
================================================================================
Total tasks: 3
Completed: 3
Failed: 0
Duration: X minutes
```

### Batch Mode Example

```bash
# User runs:
/god-code -batch "Add auth" "Add logging" "Add tests"

# Claude Code executes FOR EACH TASK:

# Task 1/3: Add auth
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add auth"
Task(batch[0].type, batch[0].prompt, batch[0].key)  # Spawn agents
# ... loop until complete ...

# Task 2/3: Add logging
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add logging"
Task(batch[0].type, batch[0].prompt, batch[0].key)  # Spawn agents
# ... loop until complete ...

# Task 3/3: Add tests
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add tests"
Task(batch[0].type, batch[0].prompt, batch[0].key)  # Spawn agents
# ... loop until complete ...
```

---

## Session Persistence

Sessions are stored in `.god-agent/coding-sessions/<sessionId>.json` and survive:
- Context compaction
- Claude Code restarts
- System crashes

To resume an interrupted session:
```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts resume "<sessionId>"
```

---

## Pipeline Details

**48-Agent Pipeline** (41 core + 7 Sherlock forensic reviewers):
- Phase 1 (Understanding): 6 agents
- Phase 2 (Exploration): 4 agents
- Phase 3 (Architecture): 5 agents
- Phase 4 (Implementation): 12 agents
- Phase 5 (Testing): 8 agents
- Phase 6 (Optimization): 5 agents
- Phase 7 (Delivery): 1 agent
- Sherlock Forensic: 7 agents

**The orchestrator handles:**
- Session state persistence
- RLM memory handoffs between agents
- LEANN semantic search integration
- Smart batching based on dependencies
- Learning feedback tracking

**No single-agent bypass exists. The full 48-agent pipeline is MANDATORY.**

---

## EXAMPLE EXECUTIONS

### Example 1: Single Task Mode

```bash
# User runs: /god-code "Add user authentication with JWT"

# Initialize
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add user authentication with JWT"
{
  "sessionId": "abc-123-def",
  "status": "running",
  "currentPhase": "understanding",
  "batch": [
    {
      "key": "task-analyzer",
      "prompt": "Analyze the coding task: Add user authentication with JWT...",
      "type": "code-analyzer"
    },
    {
      "key": "scope-definer",
      "prompt": "Define clear boundaries and deliverables for: Add user authentication...",
      "type": "code-analyzer"
    }
  ],
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}

# Spawn batch agents (Phase 1 has 2 agents in parallel)
> Task("code-analyzer", "Analyze the coding task: Add user authentication with JWT...", "task-analyzer")
> Task("code-analyzer", "Define clear boundaries and deliverables for: Add user authentication...", "scope-definer")

# Mark batch complete and get next
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete abc-123-def
{
  "sessionId": "abc-123-def",
  "status": "running",
  "currentPhase": "understanding",
  "batch": [
    {
      "key": "requirement-extractor",
      "prompt": "Extract functional requirements from the task analysis...",
      "type": "code-analyzer"
    }
  ],
  "progress": { "completed": 2, "total": 48, "percentage": 4 }
}

# Spawn next batch
> Task("code-analyzer", "Extract functional requirements from the task analysis...", "requirement-extractor")

# Continue loop...
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete abc-123-def
{
  "sessionId": "abc-123-def",
  "status": "running",
  "currentPhase": "exploration",
  "batch": [
    {
      "key": "codebase-analyzer",
      "prompt": "Analyze relevant codebase sections for authentication patterns...",
      "type": "code-analyzer"
    }
  ],
  "progress": { "completed": 3, "total": 48, "percentage": 6 }
}

# ... repeat for all 48 agents ...

# Final completion
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete abc-123-def
{
  "status": "complete",
  "sessionId": "abc-123-def",
  "progress": { "completed": 48, "total": 48, "percentage": 100 }
}
```

### Example 2: Batch Mode

```bash
# User runs: /god-code -batch "Add auth" "Add logging" "Add tests"

# ===== TASK 1: "Add auth" =====

# Initialize task 1
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add auth"
{
  "sessionId": "batch-001",
  "status": "running",
  "batch": [ { "key": "task-analyzer", ... } ],
  "progress": { "completed": 0, "total": 48 }
}

# Spawn batch agents
> Task("code-analyzer", "...", "task-analyzer")

# Loop complete until done
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete batch-001
# ... repeat until status: "complete" ...

{
  "status": "complete",
  "sessionId": "batch-001",
  "progress": { "completed": 48, "total": 48, "percentage": 100 }
}

# ===== TASK 2: "Add logging" =====

# Initialize task 2
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add logging"
{
  "sessionId": "batch-002",
  "status": "running",
  "batch": [ { "key": "task-analyzer", ... } ],
  "progress": { "completed": 0, "total": 48 }
}

# ... complete full pipeline for task 2 ...

# ===== TASK 3: "Add tests" =====

# Initialize task 3
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add tests"
{
  "sessionId": "batch-003",
  "status": "running",
  "batch": [ { "key": "task-analyzer", ... } ],
  "progress": { "completed": 0, "total": 48 }
}

# ... complete full pipeline for task 3 ...

# Final summary
✓ Completed 3 tasks:
  - batch-001: "Add auth" (48/48 agents)
  - batch-002: "Add logging" (48/48 agents)
  - batch-003: "Add tests" (48/48 agents)
```
