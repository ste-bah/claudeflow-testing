---
description: Generate code using the 48-Agent Coding Pipeline with stateful orchestration (ALWAYS uses full pipeline)
---

Use the Pipeline Thin CLI (delegates to pipeline daemon for zero cold-start overhead) for code generation with 48 specialized agents, RLM memory handoffs, and LEANN semantic search.

**Query**: $ARGUMENTS

---

## EXECUTION PROTOCOL

**YOU MUST use pipeline-thin-cli for orchestration (it delegates to the pipeline daemon). DO NOT use static Task() templates.**

> **CRITICAL: NEVER fall back to coding-pipeline-cli.ts. ALWAYS use pipeline-thin-cli.ts. If the daemon times out, retry the same command — do NOT switch CLIs. The daemon is always running.**

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

After the Task agent finishes, write its full response to `.god-agent/pipeline-output/<sessionId>/<agent.key>.txt` using the Write tool, then mark complete AND get the next agent in one call.

**IMPORTANT:** Write the output file IMMEDIATELY after the Task agent returns, BEFORE any other operations. This ensures the output is persisted even if context compaction occurs before the complete-and-next call. The `resume` command will automatically use this file to complete the interrupted agent.

**CRITICAL: Always use a 5-minute (300000ms) timeout for complete-and-next calls.** The daemon does quality scoring, pattern matching, LEANN indexing, and RLM storage which takes 30-120 seconds. A 30s timeout WILL fail.

```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next <sessionId> <agent.key> --file .god-agent/pipeline-output/<sessionId>/<agent.key>.txt
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
After the Task agent finishes, write its full response to `.god-agent/pipeline-output/<sessionId>/<agent.key>.txt` using the Write tool, then:
```bash
npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next <sessionId> <agent.key> --file .god-agent/pipeline-output/<sessionId>/<agent.key>.txt
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

**Auto-Complete on Resume**: If the pending agent's output file exists at `.god-agent/pipeline-output/<sessionId>/<agent.key>.txt` (written before compaction), `resume` will automatically complete that agent and return the NEXT agent. This means you can continue directly with Step 2 using the returned agent — no need to re-run the completed agent.

If no output file exists, `resume` returns the pending agent for re-execution. Continue with Step 2 onwards (Task -> complete-and-next loop).

---

## SESSION MANAGEMENT

```bash
# Check progress
npx tsx src/god-agent/cli/pipeline-thin-cli.ts status <sessionId>

# Resume interrupted session (auto-completes if output file exists, otherwise returns pending agent)
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
> Write ".god-agent/pipeline-output/abc-123/task-analyzer.txt" (agent response)
> npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next abc-123 task-analyzer --file .god-agent/pipeline-output/abc-123/task-analyzer.txt
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
> Write ".god-agent/pipeline-output/abc-123/requirement-extractor.txt" (agent response)
> npx tsx src/god-agent/cli/pipeline-thin-cli.ts complete-and-next abc-123 requirement-extractor --file .god-agent/pipeline-output/abc-123/requirement-extractor.txt

# ... repeat for all 48 agents ...

# Pipeline complete (final complete-and-next shows)
{
  "completed": { "success": true, ... },
  "next": { "status": "complete", "progress": { "completed": 48, "total": 48, "percentage": 100 } }
}
```
