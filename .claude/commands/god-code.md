---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Use the Pipeline Thin CLI (delegates to pipeline daemon for zero cold-start overhead) for code generation with 48 specialized agents, RLM memory handoffs, and LEANN semantic search.

**Query**: $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use pipeline-thin-cli for orchestration (it delegates to the pipeline daemon). DO NOT use static Task() templates.**

> **Debug fallback**: If the daemon won't start, replace `pipeline-thin-cli.ts` with `coding-pipeline-cli.ts` in all commands below.

### CRITICAL: DO NOT STOP DURING PIPELINE EXECUTION

**The user has ALREADY decided to run this pipeline by invoking /god-code. Their confirmation is the invocation itself.**

- **DO NOT** pause between agents to ask "should I continue?"
- **DO NOT** stop to present status summaries with options
- **DO NOT** say "this will take a long time, would you like to proceed?"
- **DO NOT** offer to skip, pause, or modify the pipeline mid-execution
- **DO NOT** comment on token usage, context limits, or duration estimates
- **JUST EXECUTE** the init -> Task -> complete-and-next -> Task -> complete-and-next loop until `status: "complete"`
- The ONLY reason to stop is an actual error (CLI crash, agent failure)

### Step 1: Initialize Pipeline

```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts init "$ARGUMENTS"
```

This returns:
```json
{
  "sessionId": "uuid",
  "status": "running",
  "currentPhase": "understanding",
  "agent": { "key": "task-analyzer", "prompt": "...", "model": "sonnet" },
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}
```

**Save the `sessionId` - you need it for all subsequent commands.**

### Step 2: Execute First Agent

From the init response, spawn the first agent using the `model` field from the response:

```
Task("<agent.key>", "<agent.prompt>", "<agent.key>", model: "<agent.model>")
```

**CRITICAL: Always pass `model: "<agent.model>"` to the Task tool.** The pipeline specifies the correct model per agent (sonnet for design/implementation/testing, haiku for reviewers/checkers). Do NOT override or omit this.

After the Task agent finishes, write its full response to `/tmp/pipeline-agent-output.txt` using the Write tool, then mark complete AND get the next agent in one call:
```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next <sessionId> <agent.key> --file /tmp/pipeline-agent-output.txt
```

This returns both quality/XP data and the next agent:
```json
{
  "completed": { "success": true, "quality": { "score": 0.82, "tier": "B+" }, "xp": { "earned": 255 } },
  "next": {
    "status": "running",
    "agent": { "key": "requirement-extractor", "prompt": "...", "model": "sonnet" },
    "progress": { "completed": 1, "total": 48, "percentage": 2 }
  }
}
```

### Step 3: Loop Until Complete

Repeat until `next.status: "complete"`:

#### 3a. Spawn Next Agent
From the `complete-and-next` response's `next` field:
```
Task("<next.agent.key>", "<next.agent.prompt>", "<next.agent.key>", model: "<next.agent.model>")
```

#### 3b. Complete-and-Next
After the Task agent finishes, write its full response to `/tmp/pipeline-agent-output.txt` using the Write tool, then:
```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next <sessionId> <agent.key> --file /tmp/pipeline-agent-output.txt
```

When pipeline is complete, `complete-and-next` returns:
```json
{
  "completed": { "success": true, "quality": {...}, "xp": {...} },
  "next": { "status": "complete", "progress": { "completed": 48, "total": 48, "percentage": 100 } }
}
```

---

## BATCH MODE

When `$ARGUMENTS` starts with `-batch`, extract all tasks after the flag and run the **above protocol** for each task sequentially:

```
FOR each task in tasks:
  1. init "<task>"
  2. Loop: Task -> complete-and-next -> Task -> complete-and-next ...
  3. Until next.status: "complete"
```

Do NOT stop between tasks. Run all tasks back-to-back.

---

## RESUME MODE

When `$ARGUMENTS` starts with `-resume`, extract the session ID and use `resume` instead of `init`:

```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts resume <sessionId>
```

Then continue with Step 2 onwards (Task -> complete -> next loop).

---

## SESSION MANAGEMENT

```bash
# Check progress
npx tsx src/god-agent/cli/pipeline-thin-cli.ts status <sessionId>

# Resume interrupted session (returns current agent without advancing)
npx tsx src/god-agent/cli/pipeline-thin-cli.ts resume <sessionId>
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
> npx tsx src/god-agent/cli/pipeline-thin-cli.ts init "Add user authentication with JWT"
{
  "sessionId": "abc-123",
  "status": "running",
  "agent": { "key": "task-analyzer", "prompt": "...", "model": "sonnet" },
  "progress": { "completed": 0, "total": 48, "percentage": 0 }
}

# Spawn agent 1 (using model from response)
> Task("task-analyzer", "<prompt>", "task-analyzer", model: "sonnet")

# Write output, then complete-and-next (marks complete + gets agent 2 in one call)
> Write "/tmp/pipeline-agent-output.txt" (agent response)
> npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next abc-123 task-analyzer --file /tmp/pipeline-agent-output.txt
{
  "completed": { "success": true, "quality": { "score": 0.82, "tier": "B+" }, "xp": { "earned": 255 } },
  "next": {
    "status": "running",
    "agent": { "key": "requirement-extractor", "prompt": "...", "model": "sonnet" },
    "progress": { "completed": 1, "total": 48, "percentage": 2 }
  }
}

# Spawn agent 2 (from next field above)
> Task("requirement-extractor", "<prompt>", "requirement-extractor", model: "sonnet")

# Write output, then complete-and-next again
> Write "/tmp/pipeline-agent-output.txt" (agent response)
> npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next abc-123 requirement-extractor --file /tmp/pipeline-agent-output.txt

# ... repeat for all 48 agents ...

# Pipeline complete (final complete-and-next shows)
{
  "completed": { "success": true, ... },
  "next": { "status": "complete", "progress": { "completed": 48, "total": 48, "percentage": 100 } }
}
```
