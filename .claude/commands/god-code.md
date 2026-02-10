---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Use the Coding Pipeline CLI (`coding-pipeline-cli`) for code generation with 48 specialized agents, RLM memory handoffs, and LEANN semantic search.

**Query**: $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use coding-pipeline-cli for orchestration. DO NOT use static Task() templates.**

### CRITICAL: DO NOT STOP DURING PIPELINE EXECUTION

**The user has ALREADY decided to run this pipeline by invoking /god-code. Their confirmation is the invocation itself.**

- **DO NOT** pause between agents to ask "should I continue?"
- **DO NOT** stop to present status summaries with options
- **DO NOT** say "this will take a long time, would you like to proceed?"
- **DO NOT** offer to skip, pause, or modify the pipeline mid-execution
- **DO NOT** comment on token usage, context limits, or duration estimates
- **JUST EXECUTE** the init -> Task -> complete -> next -> Task -> complete -> next loop until `status: "complete"`
- The ONLY reason to stop is an actual error (CLI crash, agent failure)

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
  "agent": { "key": "task-analyzer", "prompt": "..." },
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}
```

**Save the `sessionId` - you need it for all subsequent commands.**

### Step 2: Execute First Agent

From the init response, spawn the first agent:

```
Task("<agent.key>", "<agent.prompt>", "<agent.key>")
```

Then mark complete:
```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete <sessionId> <agent.key>
```

### Step 3: Loop Until Complete

Repeat until `status: "complete"`:

#### 3a. Get Next Agent
```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts next <sessionId>
```

Returns:
```json
{
  "sessionId": "...",
  "status": "running",
  "currentPhase": "exploration",
  "agent": { "key": "pattern-explorer", "prompt": "..." },
  "progress": { "completed": 6, "total": 48, "percentage": 13 }
}
```

#### 3b. Spawn Agent
```
Task("<agent.key>", "<agent.prompt>", "<agent.key>")
```

#### 3c. Mark Complete
```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete <sessionId> <agent.key>
```

When pipeline is complete, `next` returns:
```json
{
  "status": "complete",
  "progress": { "completed": 48, "total": 48, "percentage": 100 }
}
```

---

## BATCH MODE

When `$ARGUMENTS` starts with `-batch`, extract all tasks after the flag and run the **above protocol** for each task sequentially:

```
FOR each task in tasks:
  1. init "<task>"
  2. Loop: Task -> complete -> next -> Task -> complete -> next ...
  3. Until status: "complete"
```

Do NOT stop between tasks. Run all tasks back-to-back.

---

## RESUME MODE

When `$ARGUMENTS` starts with `-resume`, extract the session ID and use `resume` instead of `init`:

```bash
npx tsx src/god-agent/cli/coding-pipeline-cli.ts resume <sessionId>
```

Then continue with Step 2 onwards (Task -> complete -> next loop).

---

## SESSION MANAGEMENT

```bash
# Check progress
npx tsx src/god-agent/cli/coding-pipeline-cli.ts status <sessionId>

# Resume interrupted session (returns current agent without advancing)
npx tsx src/god-agent/cli/coding-pipeline-cli.ts resume <sessionId>
```

---

## PIPELINE PHASES (48 Agents)

| Phase | Name | Agents | Count |
|-------|------|--------|-------|
| 1 | Understanding | task-analyzer -> feasibility-analyzer + phase-1-reviewer | 7 |
| 2 | Exploration | pattern-explorer -> codebase-analyzer + phase-2-reviewer | 5 |
| 3 | Architecture | system-designer -> integration-architect + phase-3-reviewer | 6 |
| 4 | Implementation | code-generator -> implementation-coordinator + phase-4-reviewer | 13 |
| 5 | Testing | test-generator -> test-fixer + phase-5-reviewer | 9 |
| 6 | Optimization | performance-optimizer -> final-refactorer + phase-6-reviewer | 6 |
| 7 | Delivery | sign-off-approver + recovery-agent | 2 |

**No single-agent bypass exists. The full 48-agent pipeline is MANDATORY.**

---

## EXAMPLE EXECUTION

```
# Initialize
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts init "Add user authentication with JWT"
{
  "sessionId": "abc-123",
  "status": "running",
  "agent": { "key": "task-analyzer", "prompt": "..." },
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}

# Spawn agent 1
> Task("task-analyzer", "<prompt>", "task-analyzer")

# Complete agent 1
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete abc-123 task-analyzer
{ "success": true, "agentKey": "task-analyzer" }

# Get agent 2
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts next abc-123
{
  "status": "running",
  "agent": { "key": "requirement-extractor", "prompt": "..." },
  "progress": { "completed": 1, "total": 48, "percentage": 2 }
}

# Spawn agent 2
> Task("requirement-extractor", "<prompt>", "requirement-extractor")

# Complete agent 2
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts complete abc-123 requirement-extractor

# ... repeat for all 48 agents ...

# Pipeline complete
> npx tsx src/god-agent/cli/coding-pipeline-cli.ts next abc-123
{ "status": "complete", "progress": { "completed": 48, "total": 48, "percentage": 100 } }
```
