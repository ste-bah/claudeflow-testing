---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Generate code using the **MANDATORY 48-Agent Coding Pipeline** with stateful orchestration.

**Arguments:** $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use coding-pipeline-cli for orchestration. DO NOT write code directly. DO NOT use static Task() templates. DO NOT implement anything yourself. DO NOT use "streamlined" mode.**

**THE 48-AGENT PIPELINE IS MANDATORY. NO BYPASSING. NO SHORTCUTS.**

The CLI handles ALL orchestration:
- Session state persistence (survives compaction)
- RLM memory handoffs between agents
- LEANN semantic search integration
- Smart batching based on dependencies
- Learning feedback tracking

**YOUR ONLY JOB: Execute bash commands, spawn Task() agents from batches, mark complete, repeat.**

---

## Step 1: Initialize Pipeline Session

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$ARGUMENTS"
```

**Save the `sessionId` - you need it for all subsequent commands.**

This returns:
```json
{
  "sessionId": "uuid-v4",
  "status": "running",
  "currentPhase": "Phase1Understanding",
  "batch": [
    {
      "key": "task-analyzer",
      "prompt": "[Full contextualized prompt with RLM + LEANN]",
      "type": "code-analyzer",
      "memoryWrites": ["coding/understanding/task-analysis"]
    }
  ],
  "progress": {
    "completed": 0,
    "total": 48,
    "percentage": 0
  }
}
```

---

## Step 2: Execute Current Batch

From the init response, spawn ALL agents in the batch:

```
Task("code-analyzer", "<batch[0].prompt>", "code-analyzer")
Task("code-analyzer", "<batch[1].prompt>", "code-analyzer")
...
```

**Use the exact agent.type and agent.prompt from the JSON response.**

**CRITICAL**: Wait for ALL agents to complete before Step 3. DO NOT proceed early.

---

## Step 3: Mark Batch Complete and Get Next Batch

After ALL agents finish:

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "<sessionId>"
```

**Use the exact sessionId from Step 1.**

Returns next batch:
```json
{
  "sessionId": "same-uuid",
  "status": "running",
  "currentPhase": "Phase2Exploration",
  "batch": [
    {
      "key": "pattern-explorer",
      "prompt": "[Full contextualized prompt]",
      "type": "code-analyzer",
      "memoryWrites": ["coding/exploration/patterns"]
    }
  ],
  "progress": {
    "completed": 7,
    "total": 48,
    "percentage": 15
  }
}
```

**IF `status === "complete"`**, pipeline done - go to Step 4.

**OTHERWISE**, go back to Step 2 with the new batch.

---

## Step 4: Pipeline Complete

When `status: "complete"`, the 48-agent pipeline is finished.

Report completion to user.

---

## Full Execution Pattern

```bash
# 1. Initialize session
INIT_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$ARGUMENTS")
SESSION_ID=$(echo "$INIT_JSON" | jq -r '.sessionId')
STATUS=$(echo "$INIT_JSON" | jq -r '.status')

# 2. Loop until complete
while [ "$STATUS" != "complete" ]; do
  # Get current batch
  BATCH=$(echo "$RESPONSE_JSON" | jq -c '.batch[]')

  # Execute each agent in batch (Claude Code spawns Task() for each)
  # [Claude Code executes the batch]

  # Mark batch complete and get next
  RESPONSE_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "$SESSION_ID")
  STATUS=$(echo "$RESPONSE_JSON" | jq -r '.status')
done

# 3. Done
echo "Pipeline complete: $SESSION_ID"
```

---

## What You MUST NOT Do

**DO NOT:**
- ❌ Write code yourself
- ❌ Spawn agents manually
- ❌ Store/retrieve memory
- ❌ Do LEANN searches
- ❌ Decide agent order
- ❌ Track phases
- ❌ Use "streamlined" mode

**The orchestrator does ALL of that.**

**DO:**
- ✅ Run bash commands EXACTLY as shown
- ✅ Spawn Task() with prompts from CLI
- ✅ Wait for completion
- ✅ Loop until done

---

## Session Persistence

Sessions are stored in `.god-agent/coding-sessions/[sessionId].json` and survive:
- Context compaction
- Claude Code restarts
- System crashes

To resume an interrupted session:
```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts resume "$SESSION_ID"
```

---

## CRITICAL RULES - VIOLATION = FAILURE

1. **NEVER write code yourself** - The agents do that
2. **NEVER skip batches** - Execute EVERY batch
3. **NEVER modify agent prompts** - Use EXACTLY as CLI provides
4. **NEVER proceed before batch completes** - Wait for ALL agents
5. **ALWAYS use the sessionId** - Save it from init, use in complete
6. **NO "streamlined" mode exists** - Full 48-agent pipeline ONLY

---

## Execution Model

This implements the **stateful orchestrator pattern** like PhD pipeline:
- **init**: Start session, get first batch
- **execute**: Run agents in batch
- **complete**: Mark done, get next batch
- **repeat**: Until status is "complete"

The 48-agent pipeline is MANDATORY. No single-agent bypass exists.

---

## Batch Mode: Processing Multiple Tasks

To process multiple coding tasks sequentially, use the batch mode pattern:

### Option 1: Inline Batch Processing

```bash
# Create array of tasks
TASKS=(
  "Implement user authentication with JWT"
  "Add password reset functionality"
  "Create email verification system"
)

# Process each task
for TASK in "${TASKS[@]}"; do
  echo "=== Processing: $TASK ==="

  # Initialize session
  INIT_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$TASK")
  SESSION_ID=$(echo "$INIT_JSON" | jq -r '.sessionId')
  STATUS=$(echo "$INIT_JSON" | jq -r '.status')

  # Execute batches until complete
  RESPONSE_JSON="$INIT_JSON"
  while [ "$STATUS" != "complete" ]; do
    # Get current batch
    BATCH=$(echo "$RESPONSE_JSON" | jq -c '.batch[]')

    # [Claude Code executes agents in batch via Task()]

    # Mark complete and get next batch
    RESPONSE_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "$SESSION_ID")
    STATUS=$(echo "$RESPONSE_JSON" | jq -r '.status')
  done

  echo "✓ Completed: $TASK (Session: $SESSION_ID)"
done
```

### Option 2: Task File Processing

Create a file with one task per line:

```bash
# tasks.txt
Implement user authentication with JWT
Add password reset functionality
Create email verification system
```

Then process:

```bash
while IFS= read -r TASK; do
  echo "=== Processing: $TASK ==="

  # Run full pipeline for this task
  INIT_JSON=$(npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$TASK")
  SESSION_ID=$(echo "$INIT_JSON" | jq -r '.sessionId')

  # [Execute pipeline loop...]

  echo "✓ Completed: $TASK"
done < tasks.txt
```

### Option 3: Use the Batch Wrapper Script

For convenience, use the provided batch wrapper:

```bash
# Process multiple tasks
npx tsx src/god-agent/cli/coding-pipeline-batch.ts "Task 1" "Task 2" "Task 3"

# Or from a file
npx tsx src/god-agent/cli/coding-pipeline-batch.ts --file tasks.txt
```

**Batch Mode Benefits**:
- Processes tasks sequentially with full 48-agent pipeline
- Each task gets its own session with complete persistence
- Failed tasks don't block subsequent tasks
- All sessions logged for post-analysis
