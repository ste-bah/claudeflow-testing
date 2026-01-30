---
description: Generate code using the 47-Agent Coding Pipeline with Sherlock forensic gates (ALWAYS uses full pipeline). Supports -batch mode for multiple tasks.
---

Generate code using the **MANDATORY 47-Agent Coding Pipeline**. This command ALWAYS executes the full pipeline with all phases and Sherlock gates. There is NO single-agent bypass mode.

**Arguments:** $ARGUMENTS

---

## Phase 0: Batch Mode Detection

**Check if `-batch` flag is present in arguments.**

### Batch Mode Syntax

```bash
# Comma-separated task files
/god-code -batch "TASK-INFRA-002.md,TASK-INFRA-003.md,TASK-INFRA-004.md"

# Directory path (process all .md files alphabetically)
/god-code -batch docs/pipeline-prompts/phase-1-infrastructure/

# Glob pattern
/god-code -batch "docs/pipeline-prompts/*/TASK-*.md"

# Resume interrupted batch from last incomplete task
/god-code -batch -resume

# Combine: resume with specific directory
/god-code -batch -resume docs/pipeline-prompts/phase-1-infrastructure/
```

### Batch Detection Logic

**IF `$ARGUMENTS` starts with `-batch`:**

1. **Parse batch arguments:**
   ```bash
   BATCH_ARG="${ARGUMENTS#-batch }"  # Remove "-batch " prefix
   IS_RESUME=false

   # Check for -resume flag
   if [[ "$BATCH_ARG" == -resume* ]]; then
     IS_RESUME=true
     BATCH_ARG="${BATCH_ARG#-resume }"  # Remove "-resume " prefix
   fi
   ```

2. **Discover tasks based on argument type:**

   **If comma-separated list:**
   ```bash
   # Input: "TASK-001.md,TASK-002.md,TASK-003.md"
   TASK_FILES=(${BATCH_ARG//,/ })
   ```

   **If directory path (ends with /):**
   ```bash
   # Input: docs/pipeline-prompts/phase-1-infrastructure/
   TASK_FILES=($(ls -1 "${BATCH_ARG}"*.md 2>/dev/null | sort))
   ```

   **If glob pattern:**
   ```bash
   # Input: "docs/pipeline-prompts/*/TASK-*.md"
   TASK_FILES=($(ls -1 ${BATCH_ARG} 2>/dev/null | sort))
   ```

3. **Initialize or restore batch state:**

   **If `-resume` flag AND batch state exists:**
   ```bash
   npx claude-flow@alpha memory retrieve -k "coding/batch/status"
   # Restore: TASK_FILES, COMPLETED_TASKS, CURRENT_INDEX
   ```

   **Otherwise, initialize fresh batch:**
   ```bash
   npx claude-flow@alpha memory store -k "coding/batch/status" -v '{"mode":"batch","totalTasks":'${#TASK_FILES[@]}',"completedCount":0,"currentIndex":0,"startTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","status":"running"}'

   npx claude-flow@alpha memory store -k "coding/batch/task-list" -v '"'${TASK_FILES[*]}'"'
   npx claude-flow@alpha memory store -k "coding/batch/completed" -v '[]'
   ```

4. **Execute batch loop:**
   ```
   FOR each TASK_FILE in TASK_FILES (starting from CURRENT_INDEX):

     a. Update current task in memory:
        npx claude-flow@alpha memory store -k "coding/batch/current-task" -v '"'$TASK_FILE'"'

     b. Read task content:
        TASK_CONTENT=$(cat "$TASK_FILE")

     c. Store task as pipeline input:
        npx claude-flow@alpha memory store -k "coding/input/task" -v '"Implement: '$TASK_FILE' - '$TASK_CONTENT'"'

     d. **EXECUTE FULL 47-AGENT PIPELINE** (Phase 1 through Phase 3.5 below)

     e. On pipeline completion, update batch progress:
        - Add task to completed list
        - Increment currentIndex
        - Update completedCount
        - Store updated batch/status

     f. Report progress:
        "✓ Completed [N]/[TOTAL]: $TASK_FILE"

   END FOR
   ```

5. **On batch completion:**
   ```bash
   npx claude-flow@alpha memory store -k "coding/batch/status" -v '{"mode":"batch","totalTasks":'${#TASK_FILES[@]}',"completedCount":'${#TASK_FILES[@]}',"currentIndex":'${#TASK_FILES[@]}',"startTime":"[original]","endTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","status":"completed"}'
   ```

   **Report final summary:**
   ```
   ═══════════════════════════════════════════════════
   BATCH COMPLETE: [TOTAL] tasks processed
   ═══════════════════════════════════════════════════
   ✓ Task 1: TASK-INFRA-002.md - SUCCESS
   ✓ Task 2: TASK-INFRA-003.md - SUCCESS
   ✓ Task 3: TASK-INFRA-004.md - SUCCESS
   ═══════════════════════════════════════════════════
   ```

**IF `$ARGUMENTS` does NOT start with `-batch`:**
- Continue to Phase 1 with single task mode
- Task = $ARGUMENTS

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

## Phase 2: Task Execution - MANDATORY 47-AGENT PIPELINE

**CRITICAL RULE**: When `/god-code` is invoked, you MUST ALWAYS execute the full 47-agent pipeline below. There is NO single-agent mode. The `isPipeline` value from CLI is IGNORED - pipeline execution is MANDATORY.

**DO NOT**:
- Skip the pipeline based on `isPipeline: false`
- Use single-agent mode
- Implement directly without spawning pipeline agents
- Override this behavior for any reason

**ALWAYS**:
- Execute all 47 agents in sequence
- Use ClaudeFlow memory coordination
- Pass through all Sherlock gates
- Complete feedback loop

---

## 47-AGENT CODING PIPELINE ORCHESTRATION

Execute this complete pipeline sequentially using ClaudeFlow methodology. NO EXCEPTIONS.

### Pipeline Overview

| Phase | Name | Agents | Sherlock Gate |
|-------|------|--------|---------------|
| 1 | Understanding | 6 agents | phase-1-reviewer |
| 2 | Exploration | 4 agents | phase-2-reviewer |
| 3 | Architecture | 5 agents | phase-3-reviewer |
| 4 | Implementation | 12 agents | phase-4-reviewer |
| 5 | Testing | 7 agents | phase-5-reviewer |
| 6 | Optimization | 5 agents | phase-6-reviewer |
| 7 | Delivery | 1 agent | recovery-agent |
| **TOTAL** | | **40 core + 7 Sherlock = 47** | |

### Step 0: Initialize Pipeline Memory

```bash
# Initialize task input (CRITICAL: task-analyzer reads from coding/input/task)
npx claude-flow@alpha memory store -k "coding/input/task" -v '"$ARGUMENTS"'

# Initialize project context (if available)
npx claude-flow@alpha memory store -k "coding/context/project" -v '{"cwd": "'$(pwd)'", "initialized": true}'

# Initialize pipeline tracking
npx claude-flow@alpha memory store -k "coding/pipeline/status" -v '{"task": "$ARGUMENTS", "trajectoryId": "[trajectoryId]", "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "status": "running", "currentPhase": 1}'
```

---

### PHASE 1: UNDERSTANDING (6 agents + Sherlock gate)

Execute these agents SEQUENTIALLY, waiting for each to complete:

#### Agent 1/47: task-analyzer (CRITICAL - Pipeline Entry)
```
Task("task-analyzer", `
## YOUR TASK
Parse and structure the coding request into actionable components.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #1 of 47 | Phase 1: Understanding | CRITICAL: Pipeline entry point
Previous: None (pipeline entry) | Next: requirement-extractor, requirement-prioritizer, scope-definer, context-gatherer, feasibility-analyzer

## MEMORY RETRIEVAL
No prior memories - you are the entry point.

## MEMORY STORAGE (For Next Agents)
1. Store to key "coding/understanding/task-analysis" - parsed task structure
2. Store to key "coding/understanding/parsed-intent" - extracted intent

## SUCCESS CRITERIA
- Four outputs: parsed_task, acceptance_criteria, task_type, complexity_estimate
- Task type is one of: feature, bugfix, refactor, test, documentation
- Complexity is: simple, medium, complex, very_complex
`)
```

#### Agent 2/47: requirement-extractor
```
Task("requirement-extractor", `
## YOUR TASK
Extract functional and non-functional requirements from the parsed task analysis.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #2 of 47 | Phase 1: Understanding
Previous: task-analyzer ✓ | Next: requirement-prioritizer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/task-analysis"

## MEMORY STORAGE
Store to key "coding/understanding/requirements" - extracted requirements
Store to key "coding/understanding/functional-requirements" - functional requirements list

## SUCCESS CRITERIA
- Functional requirements extracted and categorized
- Non-functional requirements identified (performance, security, etc.)
`)
```

#### Agent 3/47: requirement-prioritizer
```
Task("requirement-prioritizer", `
## YOUR TASK
Apply MoSCoW prioritization to requirements.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #3 of 47 | Phase 1: Understanding
Previous: requirement-extractor ✓ | Next: scope-definer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/requirements"

## MEMORY STORAGE
Store to key "coding/understanding/prioritized-requirements" - MoSCoW prioritized list

## SUCCESS CRITERIA
- Requirements classified as Must/Should/Could/Won't
- Priorities justified
`)
```

#### Agent 4/47: scope-definer
```
Task("scope-definer", `
## YOUR TASK
Define clear boundaries, deliverables, and milestones.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #4 of 47 | Phase 1: Understanding
Previous: requirement-prioritizer ✓ | Next: context-gatherer, feasibility-analyzer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/prioritized-requirements"

## MEMORY STORAGE
Store to key "coding/understanding/scope" - project scope definition
Store to key "coding/understanding/boundaries" - explicit in/out of scope

## SUCCESS CRITERIA
- Scope boundaries clearly defined
- Deliverables listed
- Milestones identified
`)
```

#### Agent 5/47: context-gatherer
```
Task("context-gatherer", `
## YOUR TASK
Gather codebase context via semantic search using LEANN.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #5 of 47 | Phase 1: Understanding
Previous: task-analyzer ✓ | Next: feasibility-analyzer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/task-analysis"

## MEMORY STORAGE
Store to key "coding/understanding/context" - codebase context
Store to key "coding/understanding/existing-code" - relevant existing code

## SUCCESS CRITERIA
- Relevant code sections identified
- Integration points documented
- Existing patterns noted
`)
```

#### Agent 6/47: feasibility-analyzer
```
Task("feasibility-analyzer", `
## YOUR TASK
Assess technical, resource, and timeline feasibility.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #6 of 47 | Phase 1: Understanding (FINAL core agent in phase)
Previous: scope-definer ✓, context-gatherer ✓ | Next: phase-1-reviewer (Sherlock gate)

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/scope"
npx claude-flow@alpha memory retrieve -k "coding/understanding/context"

## MEMORY STORAGE
Store to key "coding/understanding/feasibility" - feasibility assessment
Store to key "coding/understanding/constraints" - identified constraints

## SUCCESS CRITERIA
- Technical feasibility assessed
- Resource requirements estimated
- Risk factors identified
`)
```

#### Agent 7/47: phase-1-reviewer (SHERLOCK GATE - CRITICAL)
```
Task("phase-1-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 1 Understanding. Issue verdict: INNOCENT, GUILTY, or INSUFFICIENT_EVIDENCE.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Sherlock #41 | Phase 1 Gate | ALL CODE IS GUILTY UNTIL PROVEN INNOCENT
Previous: All Phase 1 agents ✓ | Next: Phase 2 (if INNOCENT)

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/task-analysis"
npx claude-flow@alpha memory retrieve -k "coding/understanding/requirements"
npx claude-flow@alpha memory retrieve -k "coding/understanding/scope"
npx claude-flow@alpha memory retrieve -k "coding/understanding/context"
npx claude-flow@alpha memory retrieve -k "coding/understanding/feasibility"

## VERDICT CRITERIA
- **INNOCENT**: All requirements extracted, scope clear, feasibility confirmed → Proceed to Phase 2
- **GUILTY**: Missing requirements, unclear scope, feasibility issues → HALT for remediation
- **INSUFFICIENT_EVIDENCE**: Need more analysis before verdict

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-1-verdict"

## ON GUILTY VERDICT
DO NOT proceed to Phase 2. Store detailed issues. Trigger recovery-agent.

## CRITICAL GATE STATUS
This verdict determines if pipeline continues to Phase 2.
`)
```

**STOP AND CHECK VERDICT**: If phase-1-reviewer returns GUILTY, do NOT proceed. Trigger recovery-agent.

---

### PHASE 2: EXPLORATION (4 agents + Sherlock gate)

**Only proceed if Phase 1 verdict is INNOCENT.**

#### Agent 8/47: pattern-explorer
```
Task("pattern-explorer", `
## YOUR TASK
Explore existing code patterns that can guide implementation.

**Original Task:** $ARGUMENTS

## WORKFLOW CONTEXT
Agent #8 of 47 | Phase 2: Exploration
Previous: Phase 1 ✓ | Next: technology-scout, research-planner

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/understanding/requirements"
npx claude-flow@alpha memory retrieve -k "coding/understanding/constraints"

## MEMORY STORAGE
Store to key "coding/exploration/patterns" - identified patterns
Store to key "coding/exploration/best-practices" - applicable best practices
`)
```

#### Agent 9/47: technology-scout
```
Task("technology-scout", `
## YOUR TASK
Evaluate technology options and external solutions.

## WORKFLOW CONTEXT
Agent #9 of 47 | Phase 2: Exploration
Previous: pattern-explorer ✓ | Next: codebase-analyzer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/exploration/patterns"

## MEMORY STORAGE
Store to key "coding/exploration/technologies" - technology evaluation
Store to key "coding/exploration/recommendations" - recommended stack
`)
```

#### Agent 10/47: research-planner
```
Task("research-planner", `
## YOUR TASK
Create structured research plan for unknowns.

## WORKFLOW CONTEXT
Agent #10 of 47 | Phase 2: Exploration
Previous: pattern-explorer ✓ | Next: codebase-analyzer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/exploration/patterns"
npx claude-flow@alpha memory retrieve -k "coding/understanding/scope"

## MEMORY STORAGE
Store to key "coding/exploration/research-plan"
Store to key "coding/exploration/unknowns"
`)
```

#### Agent 11/47: codebase-analyzer
```
Task("codebase-analyzer", `
## YOUR TASK
Deep analysis of relevant code sections for implementation context.

## WORKFLOW CONTEXT
Agent #11 of 47 | Phase 2: Exploration (FINAL core agent)
Previous: technology-scout ✓, research-planner ✓ | Next: phase-2-reviewer

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/exploration/technologies"
npx claude-flow@alpha memory retrieve -k "coding/understanding/context"

## MEMORY STORAGE
Store to key "coding/exploration/codebase-analysis"
Store to key "coding/exploration/integration-points"
`)
```

#### Agent 12/47: phase-2-reviewer (SHERLOCK GATE)
```
Task("phase-2-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 2 Exploration. Issue verdict.

## WORKFLOW CONTEXT
Sherlock #42 | Phase 2 Gate

## MEMORY RETRIEVAL
Retrieve all coding/exploration/* keys

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-2-verdict"

## ON GUILTY VERDICT
HALT pipeline. Trigger recovery-agent.
`)
```

---

### PHASE 3: ARCHITECTURE (5 agents + Sherlock gate)

#### Agent 13/47: system-designer
```
Task("system-designer", `
## YOUR TASK
Design high-level system architecture, module boundaries, component relationships.

## WORKFLOW CONTEXT
Agent #13 of 47 | Phase 3: Architecture

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/exploration/codebase-analysis"
npx claude-flow@alpha memory retrieve -k "coding/understanding/requirements"

## MEMORY STORAGE
Store to key "coding/architecture/design"
Store to key "coding/architecture/structure"
`)
```

#### Agent 14/47: component-designer
```
Task("component-designer", `
## YOUR TASK
Design internal component structure, class hierarchies.

## WORKFLOW CONTEXT
Agent #14 of 47 | Phase 3: Architecture

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/architecture/design"

## MEMORY STORAGE
Store to key "coding/architecture/components"
Store to key "coding/architecture/modules"
`)
```

#### Agent 15/47: interface-designer (CRITICAL)
```
Task("interface-designer", `
## YOUR TASK
Design API contracts, type definitions, interface specifications.

## WORKFLOW CONTEXT
Agent #15 of 47 | Phase 3: Architecture | CRITICAL: API contracts

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/architecture/components"

## MEMORY STORAGE
Store to key "coding/architecture/interfaces"
Store to key "coding/architecture/contracts"

## CRITICAL
API contracts MUST be complete. No 'any' types. Full type safety required.
`)
```

#### Agent 16/47: data-architect
```
Task("data-architect", `
## YOUR TASK
Design data models, database schemas, persistence strategies.

## WORKFLOW CONTEXT
Agent #16 of 47 | Phase 3: Architecture

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/architecture/components"
npx claude-flow@alpha memory retrieve -k "coding/architecture/interfaces"

## MEMORY STORAGE
Store to key "coding/architecture/data-models"
Store to key "coding/architecture/schemas"
`)
```

#### Agent 17/47: integration-architect
```
Task("integration-architect", `
## YOUR TASK
Design integration patterns, external API connections, interoperability.

## WORKFLOW CONTEXT
Agent #17 of 47 | Phase 3: Architecture (FINAL core agent)

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/architecture/interfaces"
npx claude-flow@alpha memory retrieve -k "coding/architecture/data-models"

## MEMORY STORAGE
Store to key "coding/architecture/integrations"
Store to key "coding/architecture/dependencies"
`)
```

#### Agent 18/47: phase-3-reviewer (SHERLOCK GATE)
```
Task("phase-3-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 3 Architecture. Issue verdict.

## WORKFLOW CONTEXT
Sherlock #43 | Phase 3 Gate

## MEMORY RETRIEVAL
Retrieve all coding/architecture/* keys

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-3-verdict"
`)
```

---

### PHASE 4: IMPLEMENTATION (12 agents + Sherlock gate)

#### Agent 19/47: code-generator
```
Task("code-generator", `
## YOUR TASK
Generate clean, production-ready code following architecture specifications.

## WORKFLOW CONTEXT
Agent #19 of 47 | Phase 4: Implementation

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/architecture/design"
npx claude-flow@alpha memory retrieve -k "coding/architecture/interfaces"

## MEMORY STORAGE
Store to key "coding/implementation/generated-code"
`)
```

#### Agent 20/47: type-implementer
```
Task("type-implementer", `
## YOUR TASK
Implement TypeScript type definitions, interfaces, generics.

## MEMORY STORAGE
Store to key "coding/implementation/types"
`)
```

#### Agent 21/47: unit-implementer
```
Task("unit-implementer", `
## YOUR TASK
Implement domain entities, value objects, core logic units.

## MEMORY STORAGE
Store to key "coding/implementation/units"
`)
```

#### Agent 22/47: service-implementer
```
Task("service-implementer", `
## YOUR TASK
Implement domain services, business logic, use cases.

## MEMORY STORAGE
Store to key "coding/implementation/services"
`)
```

#### Agent 23/47: data-layer-implementer
```
Task("data-layer-implementer", `
## YOUR TASK
Implement repositories, database access, data persistence.

## MEMORY STORAGE
Store to key "coding/implementation/data-layer"
`)
```

#### Agent 24/47: api-implementer
```
Task("api-implementer", `
## YOUR TASK
Implement REST/GraphQL endpoints, controllers, validation.

## MEMORY STORAGE
Store to key "coding/implementation/api"
`)
```

#### Agent 25/47: frontend-implementer
```
Task("frontend-implementer", `
## YOUR TASK
Implement UI components, pages, state management.

## MEMORY STORAGE
Store to key "coding/implementation/frontend"
`)
```

#### Agent 26/47: error-handler-implementer
```
Task("error-handler-implementer", `
## YOUR TASK
Implement error handling, recovery mechanisms, error reporting.

## MEMORY STORAGE
Store to key "coding/implementation/error-handling"
`)
```

#### Agent 27/47: config-implementer
```
Task("config-implementer", `
## YOUR TASK
Implement configuration management, environment handling.

## MEMORY STORAGE
Store to key "coding/implementation/config"
`)
```

#### Agent 28/47: logger-implementer
```
Task("logger-implementer", `
## YOUR TASK
Implement logging infrastructure, observability patterns.

## MEMORY STORAGE
Store to key "coding/implementation/logging"
`)
```

#### Agent 29/47: dependency-manager
```
Task("dependency-manager", `
## YOUR TASK
Manage package dependencies, version resolution, imports.

## MEMORY STORAGE
Store to key "coding/implementation/dependencies"
`)
```

#### Agent 30/47: implementation-coordinator
```
Task("implementation-coordinator", `
## YOUR TASK
Coordinate implementation, ensure consistency, manage dependencies.

## WORKFLOW CONTEXT
Agent #30 of 47 | Phase 4: Implementation (FINAL core agent)

## MEMORY STORAGE
Store to key "coding/implementation/coordination-report"
`)
```

#### Agent 31/47: phase-4-reviewer (SHERLOCK GATE)
```
Task("phase-4-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 4 Implementation. Issue verdict.

## WORKFLOW CONTEXT
Sherlock #44 | Phase 4 Gate

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-4-verdict"
`)
```

---

### PHASE 5: TESTING (7 agents + Sherlock gate)

#### Agent 32/47: test-generator
```
Task("test-generator", `
## YOUR TASK
Generate comprehensive unit, integration, e2e tests with 80%+ coverage.

## MEMORY STORAGE
Store to key "coding/testing/generated-tests"
`)
```

#### Agent 33/47: test-runner
```
Task("test-runner", `
## YOUR TASK
Execute test suites, manage test lifecycle, report results.

## MEMORY STORAGE
Store to key "coding/testing/test-results"
`)
```

#### Agent 34/47: integration-tester
```
Task("integration-tester", `
## YOUR TASK
Create and execute integration tests for component interactions.

## MEMORY STORAGE
Store to key "coding/testing/integration-tests"
`)
```

#### Agent 35/47: regression-tester
```
Task("regression-tester", `
## YOUR TASK
Run regression tests to prevent unintended changes.

## MEMORY STORAGE
Store to key "coding/testing/regression-results"
`)
```

#### Agent 36/47: security-tester
```
Task("security-tester", `
## YOUR TASK
Security testing, vulnerability scanning, compliance verification.

## MEMORY STORAGE
Store to key "coding/testing/security-results"
`)
```

#### Agent 37/47: coverage-analyzer
```
Task("coverage-analyzer", `
## YOUR TASK
Analyze test coverage, identify gaps.

## MEMORY STORAGE
Store to key "coding/testing/coverage-report"
`)
```

#### Agent 38/47: quality-gate (CRITICAL)
```
Task("quality-gate", `
## YOUR TASK
Validate L-Scores, compute quality metrics, verify phase completion.

## WORKFLOW CONTEXT
Agent #38 of 47 | Phase 5: Testing (FINAL) | CRITICAL: Quality validation

## MEMORY STORAGE
Store to key "coding/testing/quality-gate-result"

## CRITICAL
Must pass all quality gates. No 'any' types. 80%+ coverage required.
`)
```

#### Agent 39/47: phase-5-reviewer (SHERLOCK GATE)
```
Task("phase-5-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 5 Testing. Issue verdict.

## WORKFLOW CONTEXT
Sherlock #45 | Phase 5 Gate

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-5-verdict"
`)
```

---

### PHASE 6: OPTIMIZATION (5 agents + Sherlock gate)

#### Agent 40/47: performance-optimizer
```
Task("performance-optimizer", `
## YOUR TASK
Identify and optimize performance bottlenecks.

## MEMORY STORAGE
Store to key "coding/optimization/performance"
`)
```

#### Agent 41/47: performance-architect
```
Task("performance-architect", `
## YOUR TASK
Design performance architecture, optimization strategies.

## MEMORY STORAGE
Store to key "coding/optimization/architecture"
`)
```

#### Agent 42/47: code-quality-improver
```
Task("code-quality-improver", `
## YOUR TASK
Improve code quality, reduce technical debt.

## MEMORY STORAGE
Store to key "coding/optimization/quality"
`)
```

#### Agent 43/47: security-architect
```
Task("security-architect", `
## YOUR TASK
Design security architecture, threat mitigation.

## MEMORY STORAGE
Store to key "coding/optimization/security"
`)
```

#### Agent 44/47: final-refactorer
```
Task("final-refactorer", `
## YOUR TASK
Final code polish, consistency checks, delivery preparation.

## WORKFLOW CONTEXT
Agent #44 of 47 | Phase 6: Optimization (FINAL core agent)

## MEMORY STORAGE
Store to key "coding/optimization/final-refactor"
`)
```

#### Agent 45/47: phase-6-reviewer (SHERLOCK GATE)
```
Task("phase-6-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 6 Optimization. Issue verdict.

## WORKFLOW CONTEXT
Sherlock #46 | Phase 6 Gate

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-6-verdict"
`)
```

---

### PHASE 7: DELIVERY (1 agent + Recovery)

#### Agent 46/47: sign-off-approver (CRITICAL - FINAL APPROVAL)
```
Task("sign-off-approver", `
## YOUR TASK
Final sign-off authority. Verify all requirements met. Authorize release.

## WORKFLOW CONTEXT
Agent #46 of 47 | Phase 7: Delivery | CRITICAL: Final approval gate

## MEMORY RETRIEVAL
Retrieve ALL forensic verdicts: coding/forensic/phase-*-verdict
Retrieve ALL phase outputs

## MEMORY STORAGE
Store to key "coding/delivery/sign-off"

## CRITICAL
This is the FINAL approval. Only sign off if ALL phases passed.
If any issues remain, trigger recovery-agent.
`)
```

#### Agent 47/47: recovery-agent (SHERLOCK RECOVERY + FEEDBACK GATE)
```
Task("recovery-agent", `
## YOUR TASK
1. Diagnose any failures, orchestrate recovery, learn from patterns
2. **MANDATORY**: Enforce feedback verification gate before pipeline completion

## WORKFLOW CONTEXT
Agent #47 of 47 | Sherlock Recovery | FINAL AGENT | FEEDBACK GATE ENFORCER

## MEMORY RETRIEVAL (CRITICAL ORDER)
1. Retrieve all forensic verdicts: coding/forensic/phase-*-verdict
2. Retrieve any GUILTY findings
3. **MANDATORY**: Retrieve coding/pipeline/feedback-status
4. **MANDATORY**: Retrieve coding/pipeline/status (for trajectoryId)

## FEEDBACK GATE VERIFICATION (MANDATORY)
Before allowing pipeline completion, MUST verify:
- [ ] coding/pipeline/feedback-status EXISTS
- [ ] feedbackSubmitted === true
- [ ] verified === true
- [ ] quality is valid number (0.0-1.0)
- [ ] trajectoryId matches pipeline trajectoryId

**IF FEEDBACK GATE FAILS:**
- Store failure to: coding/forensic/feedback-gate-failure
- DO NOT store success to coding/pipeline/final-result
- Return verdict: GUILTY with reason "FEEDBACK_NOT_SUBMITTED"
- Pipeline CANNOT complete without feedback

## MEMORY STORAGE
Store to key "coding/forensic/recovery-report"
Store to key "coding/forensic/feedback-gate-result" (MANDATORY)
Store to key "coding/pipeline/final-result" (ONLY if feedback gate passed)

## ON PIPELINE SUCCESS (feedback verified)
Record successful completion with:
- Full XP tally
- feedbackVerified: true
- quality score from feedback
- Learning loop status: CLOSED

## ON PIPELINE FAILURE
Document failure points, remediation needed, rollback status.
If failure is due to missing feedback, provide remediation steps.

## CRITICAL GATE RULE
This agent is the FINAL GATE. It enforces:
1. All Sherlock verdicts are INNOCENT
2. Feedback was submitted and verified (learning loop closed)
3. Only then can pipeline be marked successful
`)
```

---

### Step Final: Pipeline Completion

```bash
npx claude-flow@alpha memory store -k "coding/pipeline/result" -v '{"success":true,"phases_completed":7,"totalAgents":47,"trajectoryId":"[trajectoryId]","endTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

### Step Final.1: LEANN Index Update (MANDATORY)

**Index all created/modified files into LEANN semantic search for future context-gathering.**

1. **Read the queue file**:
```bash
cat .claude/runtime/leann-index-queue.json
```

2. **For each file in the queue**, call LEANN index_code MCP tool in parallel batches (max 5 at a time):
```
mcp__leann-search__index_code({
  code: [file content],
  filePath: [absolute path],
  repository: [target repo name],
  replaceExisting: true
})
```

3. **Clear the queue after indexing**:
```bash
echo '{"files":[],"lastUpdated":""}' > .claude/runtime/leann-index-queue.json
```

**WHY THIS MATTERS**: Without LEANN indexing, the context-gatherer agent in future pipeline runs cannot find code created in previous runs. This breaks the learning loop.

---

## Phase 3: Present Results

After execution completes:

1. Present the final output to the user
2. Include the `trajectoryId` for feedback tracking
3. Summarize what was accomplished
4. Report XP earned (if applicable)

---

## Phase 3.5: Auto-Feedback Submission (MANDATORY GATE)

**CRITICAL - LEARNING LOOP CLOSURE**: Pipeline CANNOT complete without feedback submission.

### Step 1: Execute Feedback Command

```bash
# Use the pre-built feedback command from CLI if available
${result.feedbackCommand}

# OR Fallback: Manual Feedback
npx tsx src/god-agent/universal/cli.ts code-feedback "[trajectoryId]" --output "[first 5000 chars of output]" --agent "[agentType]" --phase 4
```

### Step 2: Verify Feedback Was Stored (MANDATORY)

```bash
# Verify feedback exists in learning.db - THIS MUST SUCCEED
npx tsx src/god-agent/universal/cli.ts verify-feedback "[trajectoryId]" 2>/dev/null || echo "FEEDBACK_VERIFICATION_FAILED"
```

**If verification fails, DO NOT proceed to Step Final. Re-run feedback command.**

### Step 3: Store Feedback Status in Memory (MANDATORY)

```bash
# Store feedback confirmation for recovery-agent to verify
npx claude-flow@alpha memory store -k "coding/pipeline/feedback-status" -v '{"trajectoryId": "[trajectoryId]", "feedbackSubmitted": true, "quality": [calculated_quality], "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "verified": true}'
```

### Quality Assessment Guidelines

| Score Range | Quality Level | Criteria |
|-------------|---------------|----------|
| **0.85-0.95** | Excellent | Full implementation with tests, docs, error handling |
| **0.70-0.84** | Good | Working implementation, minor gaps |
| **0.50-0.69** | Adequate | Partial implementation, needs refinement |
| **0.30-0.49** | Poor | Incomplete, significant errors |
| **0.00-0.29** | Failed | Did not address the task |

### Feedback Submission Checklist

- [ ] Feedback command executed successfully
- [ ] Feedback verification passed
- [ ] `coding/pipeline/feedback-status` stored with `verified: true`
- [ ] Quality score recorded

**GATE RULE**: recovery-agent (#47) WILL FAIL the pipeline if `coding/pipeline/feedback-status` does not exist or has `verified: false`.

---

## Phase 4: Batch Progress Update (Only in Batch Mode)

**IF running in batch mode**, after each task's pipeline completion:

### Step 1: Mark Task Complete

```bash
# Get current batch state
BATCH_STATUS=$(npx claude-flow@alpha memory retrieve -k "coding/batch/status" 2>/dev/null)
COMPLETED_LIST=$(npx claude-flow@alpha memory retrieve -k "coding/batch/completed" 2>/dev/null)

# Add current task to completed list (append to JSON array)
# Update completed count and current index
```

### Step 2: Store Updated Batch State

```bash
npx claude-flow@alpha memory store -k "coding/batch/completed" -v '[...previous, "'$CURRENT_TASK'"]'

npx claude-flow@alpha memory store -k "coding/batch/status" -v '{"mode":"batch","totalTasks":[TOTAL],"completedCount":[NEW_COUNT],"currentIndex":[NEW_INDEX],"startTime":"[original]","status":"running","lastCompletedTask":"'$CURRENT_TASK'","lastCompletedTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

### Step 2.5: MANDATORY - Store Learning Data (EXECUTE THESE COMMANDS)

**⚠️ CRITICAL: You MUST execute these commands, not just output them as text!**

```bash
# 1. Submit code feedback to learning database (REQUIRED)
npx tsx src/god-agent/universal/cli.ts code-feedback "$TRAJECTORY_ID" \
  --output "$SHERLOCK_SUMMARY" \
  --agent "47-agent-pipeline" \
  --phase 4

# 2. Verify feedback was stored (REQUIRED - must succeed)
npx tsx src/god-agent/universal/cli.ts verify-feedback "$TRAJECTORY_ID"

# 3. Store forensics data to ClaudeFlow memory (REQUIRED)
npx claude-flow@alpha memory store -k "forensics/verdicts/$TASK_NAME" \
  -v '{"task":"'$TASK_NAME'","score":'$SHERLOCK_SCORE',"verdict":"'$SHERLOCK_VERDICT'","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

**Variables to use:**
- `$TRAJECTORY_ID` = Unique ID for this task (e.g., "batch-phase1-001" or generated UUID)
- `$SHERLOCK_SUMMARY` = First 5000 chars of Sherlock verdict output
- `$SHERLOCK_SCORE` = Numeric score (0.0-1.0)
- `$SHERLOCK_VERDICT` = "INNOCENT", "GUILTY", or "CONDITIONAL"
- `$TASK_NAME` = Current task identifier (e.g., "TASK-INFRA-001")

**If any command fails, log the error but continue to next task.**

### Step 3: Report Progress

```
══════════════════════════════════════════════════════════════
✓ BATCH PROGRESS: Completed [N]/[TOTAL] tasks
══════════════════════════════════════════════════════════════
  Just completed: $CURRENT_TASK
  Remaining: [TOTAL - N] tasks
  Next: $NEXT_TASK (or "BATCH COMPLETE" if done)
══════════════════════════════════════════════════════════════
```

### Step 4: Clear Task-Specific Memory (Prepare for Next Task)

```bash
# Clear task-specific memory keys to avoid contamination
npx claude-flow@alpha memory store -k "coding/input/task" -v '""'
npx claude-flow@alpha memory store -k "coding/understanding/task-analysis" -v '{}'
# ... clear other task-specific keys as needed

# Keep batch state and cross-task learnings
```

### Step 5: Continue Loop or Complete Batch

**IF more tasks remain:**
- Return to Phase 0 Step 4 (batch loop) for next task

**IF all tasks complete:**
```bash
npx claude-flow@alpha memory store -k "coding/batch/status" -v '{"mode":"batch","totalTasks":[TOTAL],"completedCount":[TOTAL],"currentIndex":[TOTAL],"startTime":"[original]","endTime":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","status":"completed","allTasksSuccessful":true}'
```

**Final Batch Summary:**
```
╔══════════════════════════════════════════════════════════════╗
║              BATCH EXECUTION COMPLETE                        ║
╠══════════════════════════════════════════════════════════════╣
║  Total Tasks:     [TOTAL]                                    ║
║  Successful:      [SUCCESS_COUNT]                            ║
║  Failed:          [FAIL_COUNT]                               ║
║  Duration:        [END_TIME - START_TIME]                    ║
╠══════════════════════════════════════════════════════════════╣
║  TASK RESULTS:                                               ║
║  ✓ TASK-INFRA-002.md - Row-Level Security                   ║
║  ✓ TASK-INFRA-003.md - Application Roles                    ║
║  ✓ TASK-INFRA-004.md - Connection Pooling                   ║
╚══════════════════════════════════════════════════════════════╝
```

### Step 6: MANDATORY - Store Batch Learning Summary (EXECUTE THIS)

**⚠️ CRITICAL: Execute these commands at batch completion!**

```bash
# 1. Store batch execution summary to ClaudeFlow memory
npx claude-flow@alpha memory store -k "forensics/batch-execution/$BATCH_ID" \
  -v '{"batch_id":"'$BATCH_ID'","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tasks_executed":'$TOTAL',"tasks_passed":'$SUCCESS_COUNT',"sherlock_verdicts":'$VERDICTS_JSON',"phase_complete":true}'

# 2. Store any fix patterns learned (if Sherlock caught issues)
# For each issue type caught and fixed:
npx claude-flow@alpha memory store -k "learning/patterns/$PATTERN_TYPE" \
  -v '{"pattern_id":"'$PATTERN_ID'","source_task":"'$TASK_NAME'","description":"'$ISSUE_DESCRIPTION'","fix":"'$FIX_APPLIED'","prevention":"'$PREVENTION_ADVICE'"}'

# 3. Verify learning data count increased
echo "Learning data verification:"
npx tsx src/god-agent/universal/cli.ts status --json 2>/dev/null | grep -E "(trajectories|feedback)"
```

**BATCH_ID format:** `phase[N]-[type]-batch-[timestamp]` (e.g., `phase1-infra-batch-001`)

---

## Critical Agents Reference

These agents HALT the pipeline on failure:

| # | Agent | Phase | Role |
|---|-------|-------|------|
| 1 | task-analyzer | 1 | Pipeline entry point |
| 15 | interface-designer | 3 | API contract validation |
| 38 | quality-gate | 5 | L-Score validation |
| 46 | sign-off-approver | 7 | Final approval |
| 7,12,18,31,39,45 | phase-N-reviewer | All | Sherlock gates |
| 47 | recovery-agent | 7 | Recovery orchestration |

---

## Agent File Location

All 47 agents are defined in: `.claude/agents/coding-pipeline/*.md`

Agent-to-file mapping: `agentKey` → `.claude/agents/coding-pipeline/${agentKey}.md`

---

## Execution Model

This skill implements the **DAI-001 Pipeline Execution Model**:

1. **Phase 1 (CLI)**: God Agent initializes trajectory tracking and retrieves learning context
2. **Phase 2 (Pipeline)**: Execute FULL 47-agent pipeline - ALWAYS, NO EXCEPTIONS

**MANDATORY RULES**:
- `/god-code` ALWAYS executes the full 47-agent pipeline
- There is NO single-agent bypass mode
- ALL 47 agents must run in sequence
- Do NOT skip agents. Do NOT parallelize (ClaudeFlow 99.9% sequential rule)
- Ignoring the pipeline and implementing directly is a CRITICAL FAILURE

---

## Batch Mode Quick Reference

### Usage Examples

```bash
# Process multiple specific tasks
/god-code -batch "docs/pipeline-prompts/phase-1-infrastructure/TASK-INFRA-002.md,docs/pipeline-prompts/phase-1-infrastructure/TASK-INFRA-003.md"

# Process all tasks in a directory (alphabetically)
/god-code -batch docs/pipeline-prompts/phase-1-infrastructure/

# Process with glob pattern
/god-code -batch "docs/pipeline-prompts/phase-*/TASK-*.md"

# Resume an interrupted batch
/god-code -batch -resume

# Resume with explicit directory (in case memory was cleared)
/god-code -batch -resume docs/pipeline-prompts/phase-1-infrastructure/
```

### Batch Memory Keys

| Key | Purpose |
|-----|---------|
| `coding/batch/status` | Overall batch state (total, completed, current index) |
| `coding/batch/task-list` | Full list of tasks to process |
| `coding/batch/completed` | Array of completed task files |
| `coding/batch/current-task` | Currently executing task file |

### Batch Behavior

1. Each task runs through the FULL 47-agent pipeline
2. Progress is saved after each task (resumable)
3. Memory is cleared between tasks (no contamination)
4. Cross-task learnings are preserved
5. Final summary shows all results

### Error Handling

- If a task fails (Sherlock GUILTY verdict), batch continues to next task
- Failed tasks are marked in batch status
- Use `-resume` to retry failed tasks after fixing issues
