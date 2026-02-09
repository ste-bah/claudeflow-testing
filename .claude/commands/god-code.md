---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Use the Coding Pipeline CLI (`coding-pipeline-cli`) for code generation with dynamic agent orchestration, RLM memory handoffs, and LEANN semantic search.

**Task**: $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use coding-pipeline-cli for orchestration. DO NOT use static Task() templates.**

### Step 1: Initialize Pipeline

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

From the init response, spawn ALL agents in the batch:

```
Task("<batch[0].type>", "<batch[0].prompt>", "<batch[0].key>")
Task("<batch[1].type>", "<batch[1].prompt>", "<batch[1].key>")
...
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

```
Task("<batch[0].type>", "<batch[0].prompt>", "<batch[0].key>")
Task("<batch[1].type>", "<batch[1].prompt>", "<batch[1].key>")
...
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

## Batch Mode: Processing Multiple Tasks

To process multiple coding tasks sequentially:

### Option 1: Batch Wrapper Script

```bash
npx tsx src/god-agent/cli/coding-pipeline-batch.ts "Task 1" "Task 2" "Task 3"

# Or from a file (one task per line)
npx tsx src/god-agent/cli/coding-pipeline-batch.ts --file tasks.txt
```

### Option 2: Manual Loop

```bash
# Array of tasks
TASKS=(
  "Implement authentication"
  "Add password reset"
  "Create email verification"
)

# Process each task
for TASK in "${TASKS[@]}"; do
  # Initialize
  INIT_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$TASK")
  SESSION_ID=$(echo "$INIT_JSON" | jq -r '.sessionId')
  STATUS=$(echo "$INIT_JSON" | jq -r '.status')

  # Execute batches until complete
  RESPONSE_JSON="$INIT_JSON"
  while [ "$STATUS" != "complete" ]; do
    # [Claude Code spawns agents from batch via Task()]

    # Mark complete and get next
    RESPONSE_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "$SESSION_ID")
    STATUS=$(echo "$RESPONSE_JSON" | jq -r '.status')
  done

  echo "✓ Completed: $TASK"
done
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
