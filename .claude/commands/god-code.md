---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Generate code using the **MANDATORY 48-Agent Coding Pipeline** with stateful orchestration.

**Arguments:** $ARGUMENTS

---

## Pipeline Execution

The 48-agent coding pipeline is orchestrated through a stateful CLI that:
- Manages session state with disk persistence (survives context compaction)
- Handles RLM memory handoffs between agents
- Integrates LEANN semantic search for code context
- Computes smart batching based on agent dependencies
- Tracks learning feedback for continuous improvement

**ALL pipeline orchestration is handled by the CLI - you just execute batches.**

---

## Step 1: Initialize Pipeline Session

Run the init command to start a new pipeline session:

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "$ARGUMENTS"
```

This returns JSON with:
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

For each agent in the `batch` array, spawn a Task:

```javascript
// Parse the JSON response
const response = JSON.parse(initOutput);
const { sessionId, batch } = response;

// Execute each agent in the batch
for (const agent of batch) {
  Task(agent.type, agent.prompt);
}
```

**CRITICAL**: Wait for ALL agents in the current batch to complete before proceeding to Step 3.

---

## Step 3: Mark Batch Complete and Get Next Batch

After all agents in the current batch finish:

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete "$sessionId"
```

This returns the NEXT batch:
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

**IF `status === "complete"`**, the pipeline is done. Proceed to Step 4.

**OTHERWISE**, return to Step 2 with the new batch.

---

## Step 4: Pipeline Complete

When the `complete` command returns `status: "complete"`, the 48-agent pipeline has finished.

Present results to the user and report completion.

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

## What the Orchestrator Handles

You do NOT need to:
- ❌ Know the 48 agent names or order
- ❌ Write memory store/retrieve commands
- ❌ Handle LEANN semantic search
- ❌ Compute agent dependencies
- ❌ Track phase transitions
- ❌ Manage checkpoints

The orchestrator does ALL of that. You just:
- ✅ Call `init` to start
- ✅ Execute the returned batch of agents
- ✅ Call `complete` to get next batch
- ✅ Repeat until done

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

## Critical Rules

1. **ALWAYS execute batches sequentially** - Wait for current batch to complete before calling `complete`
2. **NEVER skip batches** - You must execute every batch returned by the orchestrator
3. **NEVER modify agent prompts** - The orchestrator builds prompts with RLM + LEANN context
4. **ALWAYS use the sessionId** - Required for state tracking across batches

---

## Execution Model

This implements the **stateful orchestrator pattern** like PhD pipeline:
- **init**: Start session, get first batch
- **execute**: Run agents in batch
- **complete**: Mark done, get next batch
- **repeat**: Until status is "complete"

The 48-agent pipeline is MANDATORY. No single-agent bypass exists.
