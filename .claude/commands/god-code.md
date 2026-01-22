---
description: Generate code using the Universal Self-Learning God Agent with DAI-001 agent selection
---

Generate code using the Universal Self-Learning God Agent with DAI-001 dynamic agent selection.

**Task:** $ARGUMENTS

---

## Phase 1: Agent Selection (CLI)

Run the God Agent CLI to get the dynamically selected agent and built prompt:

```bash
npx tsx src/god-agent/universal/cli.ts code "$ARGUMENTS" --json 2>/dev/null | awk '/__GODAGENT_JSON_START__/{found=1;next} /__GODAGENT_JSON_END__/{found=0} found'
```

The CLI returns JSON with the selected agent and complete prompt:

```json
{
  "command": "code",
  "selectedAgent": "backend-dev",
  "prompt": "[original user prompt]",
  "isPipeline": false,
  "result": {
    "builtPrompt": "## Agent: backend-dev\n\n**Description:** ...\n\n### Agent Instructions\n...\n\n### Task\n[user task]\n\n### Response Format\n...",
    "agentType": "backend-dev",
    "agentCategory": "core",
    "memoryContext": "[retrieved context from prior trajectories]"
  },
  "success": true,
  "trajectoryId": "traj_xxx_yyy"
}
```

---

## Phase 2: Task Execution (Subagent)

**CRITICAL**: You MUST spawn a Task() subagent with the CLI output. Do NOT execute the task yourself.

### Extract from JSON:
- `result.agentType` - The specialized agent type to spawn
- `result.builtPrompt` - The complete prompt with agent instructions, context, and task

### Spawn Task:

```
Task(result.agentType, result.builtPrompt)
```

**Example**: If CLI returns `agentType: "backend-dev"`, spawn:
```
Task("backend-dev", "[full builtPrompt from result]")
```

### Pipeline Mode (47-Agent Coding Pipeline)

If `isPipeline` is `true`, the task requires the **47-Agent Coding Pipeline** with 7 phases. You MUST execute this pipeline sequentially using ClaudeFlow methodology.

**Pipeline Structure:**
- **Phase 1 - Understanding** (5 agents + forensic reviewer): task-analyzer, requirement-extractor, scope-definer, context-gatherer, constraint-analyzer → phase-1-reviewer
- **Phase 2 - Exploration** (5 agents + forensic reviewer): solution-explorer, pattern-matcher, analogy-finder, prior-art-searcher, feasibility-assessor → phase-2-reviewer
- **Phase 3 - Architecture** (6 agents + forensic reviewer): architecture-designer, component-specifier, interface-designer, dependency-mapper, consistency-checker, type-system-designer → phase-3-reviewer
- **Phase 4 - Implementation** (8 agents + forensic reviewer): type-generator, algorithm-implementer, data-structure-builder, api-implementer, integration-coder, error-handler, config-generator, utility-generator → phase-4-reviewer
- **Phase 5 - Testing** (8 agents + forensic reviewer): test-planner, unit-test-writer, integration-test-writer, edge-case-tester, mock-generator, test-runner, bug-fixer, coverage-analyzer → phase-5-reviewer
- **Phase 6 - Optimization** (4 agents + forensic reviewer): performance-optimizer, refactoring-agent, security-auditor, code-quality-checker → phase-6-reviewer
- **Phase 7 - Delivery** (4 agents + recovery): documentation-writer, code-reviewer, release-preparer, sign-off-approver → recovery-agent

**Pipeline Execution Protocol:**

1. **Initialize Memory Namespace:**
```bash
npx claude-flow@alpha memory store "coding/pipeline/task" '{"task": "$ARGUMENTS", "trajectoryId": "[trajectoryId]", "startTime": "[timestamp]"}' --namespace "coding"
```

2. **Execute Each Phase SEQUENTIALLY** (ClaudeFlow 99.9% sequential rule):

For each phase, spawn agents in dependency order using Task():

```
## Phase N Execution

Task("[agent-key]", `
  ## YOUR TASK
  [Agent-specific task from pipeline definition]

  ## WORKFLOW CONTEXT
  Phase N | Agent [X] of [Y] in phase | Pipeline Stage: [phase-name]
  Previous: [completed agents/phases] | Next: [remaining agents]

  ## MEMORY RETRIEVAL
  npx claude-flow memory retrieve --key "coding/[previous-phase]/output"
  Understand: [schemas/decisions/artifacts from previous agents]

  ## MEMORY STORAGE (For Next Agents)
  Store your output: key "coding/[phase]/[agent-key]/output"
  Include: [artifacts, decisions, code, documentation]

  ## STEPS
  1. Retrieve memories from previous agents
  2. Execute your specialized task
  3. Store output to memory for next agents
  4. Verify: npx claude-flow memory retrieve --key "coding/[phase]/[agent-key]/output"

  ## SUCCESS CRITERIA
  - Task complete per agent specification
  - Memories stored and verified
  - Ready for next agent in sequence
`)
```

3. **After Each Phase - Forensic Review (CRITICAL GATE):**

```
Task("[phase-N-reviewer]", `
  ## YOUR TASK
  FORENSIC REVIEW of Phase N output. Issue verdict: INNOCENT, GUILTY, or INSUFFICIENT_EVIDENCE.

  ## WORKFLOW CONTEXT
  Sherlock Forensic Reviewer | Phase N Gate | ALL CODE IS GUILTY UNTIL PROVEN INNOCENT

  ## MEMORY RETRIEVAL
  Retrieve ALL phase N agent outputs from memory namespace "coding/[phase-name]/"

  ## VERDICT CRITERIA
  - INNOCENT: Phase passed all quality gates, proceed to next phase
  - GUILTY: Phase failed, requires remediation - trigger recovery-agent
  - INSUFFICIENT_EVIDENCE: Need more data before verdict

  ## MEMORY STORAGE
  Store verdict: key "coding/[phase]/forensic-verdict"
  Include: {verdict, evidence, issues_found, remediation_needed}

  ## ON GUILTY VERDICT
  DO NOT proceed to next phase. Store detailed issues and await recovery-agent intervention.
`)
```

4. **On Pipeline Completion:**
```bash
npx claude-flow@alpha memory store "coding/pipeline/result" '{"success": true, "phases_completed": 7, "totalAgents": 47, "trajectoryId": "[trajectoryId]"}' --namespace "coding"
```

5. **Critical Agents (Pipeline HALTS on failure):**
- #1 task-analyzer (Phase 1 entry)
- #15 consistency-checker (Phase 3 design validation)
- #40 sign-off-approver (Phase 7 final approval)
- #41-47 ALL forensic reviewers (phase gates)

**IMPORTANT**: You MUST wait for each agent to complete before spawning the next. This is the ClaudeFlow 99.9% sequential execution rule. Pipeline agents have dependencies that require outputs from previous agents.

---

## Phase 3: Present Results

After the Task() subagent completes:

1. Present the subagent's output to the user
2. Include the `trajectoryId` for feedback tracking
3. Summarize what was accomplished

---

## Phase 3.5: Auto-Feedback Submission (MANDATORY - Programmatic Enforcement)

**CRITICAL - LEARNING LOOP CLOSURE**: After the Task() subagent returns, you MUST automatically submit quality feedback. This is NOT optional. Skipping this step causes orphaned trajectories that break the learning system.

### Programmatic Feedback Command

The CLI Phase 1 output includes `result.feedbackCommand` - a pre-built command with the correct trajectoryId and agentType. Use it directly:

```bash
# Replace [TASK_OUTPUT] with the first 5000 chars of the subagent's actual output
${result.feedbackCommand}
```

### Fallback: Manual Feedback Command

If `feedbackCommand` is not present, construct manually:

```bash
npx tsx src/god-agent/universal/cli.ts code-feedback "[trajectoryId]" --output "[first 5000 chars of subagent output]" --agent "[result.agentType]" --phase 4
```

### Alternative: Simple Rating (if code-feedback unavailable)

```bash
npx tsx src/god-agent/universal/cli.ts feedback [trajectoryId] [quality_score] --trajectory --notes "Auto-assessed: [brief reason for score]"
```

### Orphan Detection

If the CLI output includes `orphanWarning`, there are orphaned trajectories from previous runs. Consider running:

```bash
npx tsx src/god-agent/universal/cli.ts auto-complete-coding
```

### Quality Assessment Guidelines

When manually assessing, use these thresholds:

| Score Range | Quality Level | Criteria |
|-------------|---------------|----------|
| **0.85-0.95** | Excellent | Full implementation with tests, docs, error handling, follows best practices |
| **0.70-0.84** | Good | Working implementation, minor gaps in tests or docs |
| **0.50-0.69** | Adequate | Partial implementation, needs refinement, some errors |
| **0.30-0.49** | Poor | Incomplete, significant errors, or wrong approach |
| **0.00-0.29** | Failed | Did not address the task or completely broken |

### Why Auto-Feedback is Mandatory

Submitting feedback after every trajectory enables:
- **Pattern Learning**: Quality outputs (>0.8) generate reusable patterns
- **Agent Selection Improvement**: DAI-001 learns which agents work best for which tasks
- **Memory Context Accumulation**: Future tasks benefit from prior successful approaches
- **SoNA Self-Learning Loop Closure**: Trajectories without feedback cannot improve the system

**IMPORTANT**: You MUST submit feedback for every trajectory, even if the quality is low. Low-quality feedback is still valuable for learning what NOT to do.

---

## Phase 4: Additional Feedback (Optional)

If the auto-feedback was insufficient or the user wants to provide manual assessment:

```bash
npx tsx src/god-agent/universal/cli.ts feedback [trajectoryId] [rating] --trajectory --notes "[optional notes]"
```

**Rating scale**: 0.0 (poor) to 1.0 (excellent)

**Example**:
```bash
npx tsx src/god-agent/universal/cli.ts feedback traj_xxx_yyy 0.9 --trajectory --notes "Agent selection was appropriate, excellent test coverage"
```

**Use this phase when**:
- Auto-feedback score seems inaccurate
- You want to add specific notes about agent performance
- The user explicitly requests a different rating

---

## Two-Phase Execution Model

This skill implements the **DAI-001 Two-Phase Execution Model**:

1. **Phase 1 (CLI)**: God Agent analyzes the task, searches 198+ agents via semantic matching, retrieves relevant memory context, and builds a specialized prompt
2. **Phase 2 (Task)**: Claude Code spawns a Task() subagent with the selected agent type and built prompt

This separation ensures:
- Optimal agent selection via AI-powered capability matching
- Context injection from prior trajectories (SoNA learning)
- Clean execution boundary between selection and implementation
- Trajectory tracking for continuous improvement
