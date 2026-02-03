---
description: Generate code using the 47-Agent Coding Pipeline with Sherlock forensic gates (ALWAYS uses full pipeline). Supports -batch mode for multiple tasks.
---

Generate code using the **MANDATORY 47-Agent Coding Pipeline**. This command ALWAYS executes the full pipeline with all phases and Sherlock gates. There is NO single-agent bypass mode.

**Arguments:** $ARGUMENTS

---

## ⚠️ CRITICAL: TASK CONTENT HANDLING

**YOU (the orchestrator) MUST read task files FIRST before spawning agents.**

Agents CANNOT reliably read task files - they will hallucinate paths. YOU must:
1. Use the `Read` tool to read task file content
2. Store the content in memory AND pass it directly in agent prompts
3. NEVER pass just a file path expecting agents to read it

**Available Variables:**
- `$ARGUMENTS` = Raw command line arguments (e.g., `-batch "path/to/tasks"`)
- `$TASK_CONTENT` = **YOU MUST SET THIS** by reading task files with `Read` tool
- `$TASK_FILE` = Current task file path (batch mode)
- `$TARGET_DIR` = Target directory from `--target` flag (default: current working directory)

**Variable Extraction:**
```
# Extract --target if present
if $ARGUMENTS contains "--target":
  $TARGET_DIR = value after "--target"
else:
  $TARGET_DIR = current working directory
```

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

     b. **⚠️ CRITICAL: YOU (orchestrator) MUST read task file content using Read tool:**
        Use: Read(file_path=$TASK_FILE)
        Store result in $TASK_CONTENT variable

        DO NOT use cat or expect agents to read - they will hallucinate paths!

     c. Store task content in memory for agents that need it:
        npx claude-flow@alpha memory store -k "coding/input/task" -v '"$TASK_CONTENT"'

     d. **EXECUTE FULL 47-AGENT PIPELINE** passing $TASK_CONTENT directly in prompts
        (Phase 1 through Phase 3.5 below)

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

**⚠️ CRITICAL: Before this step, YOU (the orchestrator) MUST have already:**
1. Read the task file(s) using the `Read` tool
2. Set `$TASK_CONTENT` to the actual file content
3. Set `$TARGET_DIR` from `--target` flag or current working directory

```bash
# Initialize task input with ACTUAL CONTENT (not file path!)
npx claude-flow@alpha memory store -k "coding/input/task" -v '"$TASK_CONTENT"'

# Initialize project context
npx claude-flow@alpha memory store -k "coding/context/project" -v '{"cwd": "'$(pwd)'", "targetDir": "$TARGET_DIR", "initialized": true}'

# Initialize pipeline tracking
npx claude-flow@alpha memory store -k "coding/pipeline/status" -v '{"taskFile": "$TASK_FILE", "targetDir": "$TARGET_DIR", "trajectoryId": "[trajectoryId]", "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "status": "running", "currentPhase": 1}'
```

---

### PHASE 1: UNDERSTANDING (6 agents + Sherlock gate)

Execute these agents SEQUENTIALLY, waiting for each to complete:

#### Agent 1/47: task-analyzer (CRITICAL - Pipeline Entry)
```
Task("task-analyzer", `
## YOUR TASK
Parse and structure the coding request into actionable components.

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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

**Task Content (from file - DO NOT try to Read files):**
$TASK_CONTENT

**Target Directory:** $TARGET_DIR

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
**CRITICAL**: You MUST execute actual commands and parse real output. DO NOT estimate or fabricate values.

## WORKFLOW CONTEXT
Agent #38 of 47 | Phase 5: Testing (FINAL) | CRITICAL: Quality validation
Previous: coverage-analyzer ✓ | Next: phase-5-reviewer (Sherlock gate)

**Target Directory:** $TARGET_DIR

## EXECUTION STEPS (MANDATORY)

Before computing quality metrics, you MUST execute these commands:

### Step 1: Run Test Suite
\`\`\`bash
cd $TARGET_DIR && npm test 2>&1 | tee /tmp/quality-gate-tests.txt
TEST_EXIT_CODE=$?
\`\`\`

### Step 2: Run Linter
\`\`\`bash
cd $TARGET_DIR && npm run lint 2>&1 | tee /tmp/quality-gate-lint.txt || true
\`\`\`

### Step 3: Run Type Check
\`\`\`bash
cd $TARGET_DIR && npm run typecheck 2>&1 | tee /tmp/quality-gate-types.txt || true
\`\`\`

### Step 4: Extract Coverage (if available)
\`\`\`bash
cd $TARGET_DIR && npm test -- --coverage 2>&1 | grep -E "Statements|Branches|Functions|Lines" || echo "Coverage not available"
\`\`\`

## RESULT PARSING

From test output, extract ACTUAL values:
- testsPassed: Count lines with ✓ or "passed" or "PASS"
- testsFailed: Count lines with ✗ or "failed" or "FAIL"
- testsTotal: testsPassed + testsFailed

From lint output:
- lintErrors: Count "error" occurrences (case insensitive)
- lintWarnings: Count "warning" occurrences (case insensitive)

From typecheck output:
- typeErrors: Count error lines (lines containing "error TS" or "error:")

**DO NOT ESTIMATE. PARSE FROM OUTPUT.**

## L-SCORE CALCULATION

L-Score = weighted average of ACTUAL metrics:
- Test Pass Rate (40%): testsPassed / testsTotal * 100
- Type Safety (20%): 100 - (typeErrors * 2) (min 0)
- Lint Compliance (20%): 100 - (lintErrors * 1) (min 0)
- Coverage (20%): extracted coverage % or 50 if unavailable

Formula:
\`\`\`
passRate = (testsPassed / testsTotal) * 100
typeSafety = max(0, 100 - (typeErrors * 2))
lintScore = max(0, 100 - lintErrors)
coverageScore = extractedCoverage || 50

lScore = (passRate * 0.4) + (typeSafety * 0.2) + (lintScore * 0.2) + (coverageScore * 0.2)
\`\`\`

Grade:
- A: L-Score >= 90
- B: L-Score >= 80
- C: L-Score >= 70
- D: L-Score >= 60
- F: L-Score < 60

## PASS/FAIL CRITERIA

**PASS** (all must be true):
- Test pass rate >= 80%
- Type errors <= 10
- Lint errors <= 20
- L-Score >= 70 (Grade C or better)

**FAIL** (any triggers fail):
- Test pass rate < 80%
- Type errors > 10
- Lint errors > 20
- L-Score < 70
- Tests failed to execute (npm test returned error without any test output)

## MEMORY STORAGE

Store to key "coding/testing/quality-gate-result" with ACTUAL parsed values:
\`\`\`json
{
  "testsTotal": [ACTUAL from output],
  "testsPassed": [ACTUAL from output],
  "testsFailed": [ACTUAL from output],
  "passPercentage": [CALCULATED: testsPassed/testsTotal*100],
  "lintErrors": [ACTUAL from output],
  "lintWarnings": [ACTUAL from output],
  "typeErrors": [ACTUAL from output],
  "coverage": [ACTUAL from output or null],
  "lScore": [CALCULATED],
  "grade": "[A-F]",
  "verdict": "PASS" | "FAIL",
  "executedCommands": ["npm test", "npm run lint", "npm run typecheck"],
  "rawTestOutput": "[first 3000 chars of /tmp/quality-gate-tests.txt]",
  "rawLintOutput": "[first 1000 chars of /tmp/quality-gate-lint.txt]",
  "rawTypeOutput": "[first 1000 chars of /tmp/quality-gate-types.txt]",
  "verified": true,
  "timestamp": "[ISO timestamp]"
}
\`\`\`

## OUTPUT FORMAT

After execution, report:
\`\`\`
═══════════════════════════════════════════════════════════════
QUALITY GATE RESULTS (Agent #38/47)
═══════════════════════════════════════════════════════════════

TEST RESULTS (from actual npm test output):
  Total:   [testsTotal]
  Passed:  [testsPassed]
  Failed:  [testsFailed]
  Pass %:  [passPercentage]%

LINT RESULTS (from actual npm run lint output):
  Errors:   [lintErrors]
  Warnings: [lintWarnings]

TYPE CHECK (from actual npm run typecheck output):
  Errors: [typeErrors]

COVERAGE:
  [coverage]% or "Not available"

L-SCORE BREAKDOWN:
  Test Pass Rate (40%):  [passRate] → contributes [passRate * 0.4]
  Type Safety (20%):     [typeSafety] → contributes [typeSafety * 0.2]
  Lint Compliance (20%): [lintScore] → contributes [lintScore * 0.2]
  Coverage (20%):        [coverageScore] → contributes [coverageScore * 0.2]
  ─────────────────────────────────────────
  TOTAL L-SCORE:         [lScore] (Grade: [grade])

VERDICT: [PASS/FAIL]
[If FAIL: List which criteria failed]

═══════════════════════════════════════════════════════════════
\`\`\`

## CRITICAL RULES
- MUST execute actual npm commands - no estimating
- MUST parse output from command results - no fabricating
- MUST store rawOutput for verification by phase-5-reviewer
- MUST set verified: true only after actual execution
- 80%+ test pass rate required for PASS
- No 'any' types tolerated in typecheck
`)
```

#### Self-Correction Loop (CRITICAL)

**After test-execution-verifier and quality-gate run, check for failures:**

```
IF coding/testing/verified-results shows testsFailed > 0:
  ENTER SELF-CORRECTION LOOP:

  RETRY_COUNT = 0
  MAX_RETRIES = 3

  WHILE testsFailed > 0 AND RETRY_COUNT < MAX_RETRIES:

    # Step 1: Spawn test-fixer agent
    Task("test-fixer", `
      ## YOUR TASK
      Fix the failing tests identified in verified-results.

      ## WORKFLOW CONTEXT
      Self-Correction Loop | Retry #[RETRY_COUNT + 1] of [MAX_RETRIES]

      ## MEMORY RETRIEVAL
      npx claude-flow@alpha memory retrieve -k "coding/testing/verified-results"

      Read failedTests and rawOutput, identify issues, fix the code.

      ## MEMORY STORAGE
      Store fixes to: coding/testing/fix-attempts
    `)

    # Step 2: Re-run test-execution-verifier
    Task("test-execution-verifier", `
      ## YOUR TASK
      Re-run tests after fixes applied.

      ## WORKFLOW CONTEXT
      Self-Correction Loop | Re-test after fix attempt #[RETRY_COUNT + 1]

      Execute: cd $TARGET_DIR && npm test 2>&1
      Update: coding/testing/verified-results
    `)

    # Step 3: Check results
    RETRIEVE coding/testing/verified-results
    RETRY_COUNT += 1

  END WHILE

  IF testsFailed > 0 AND RETRY_COUNT >= MAX_RETRIES:
    # Escalate - store detailed report for recovery-agent
    npx claude-flow@alpha memory store -k "coding/testing/escalation" -v '{
      "reason": "Max retries exceeded",
      "attemptsTotal": 3,
      "remainingFailures": [list],
      "fixesAttempted": [list],
      "recommendation": "Manual intervention required"
    }'
  END IF

END IF
```

#### Agent 39/47: phase-5-reviewer (SHERLOCK GATE)
```
Task("phase-5-reviewer", `
## YOUR TASK
FORENSIC REVIEW of Phase 5 Testing. Issue verdict: INNOCENT, GUILTY, or INSUFFICIENT_EVIDENCE.

**CRITICAL**: You MUST VERIFY that tests were ACTUALLY executed, not just trust memory values.

## WORKFLOW CONTEXT
Sherlock #45 | Phase 5 Gate | ALL CODE IS GUILTY UNTIL PROVEN INNOCENT
Previous: All Phase 5 agents ✓ | Next: Phase 6 (if INNOCENT)

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/testing/test-results"
npx claude-flow@alpha memory retrieve -k "coding/testing/verified-results"
npx claude-flow@alpha memory retrieve -k "coding/testing/regression-analysis"
npx claude-flow@alpha memory retrieve -k "coding/testing/coverage-report"
npx claude-flow@alpha memory retrieve -k "coding/testing/quality-gate-result"

## VERIFICATION STEPS (MANDATORY)

### Step 1: Check verified flag
- Retrieve coding/testing/verified-results
- If verified !== true → VERDICT: GUILTY (tests not actually executed)
- If key does not exist → VERDICT: INSUFFICIENT_EVIDENCE

### Step 2: Validate execution evidence
- Check rawOutput exists in verified-results
- Look for test runner patterns in rawOutput:
  - "Tests:", "PASS", "FAIL", "passed", "failed"
  - "✓", "✗", "●"
  - "test suites", "tests passed"
- If no execution evidence in rawOutput → VERDICT: GUILTY (no proof tests ran)

### Step 3: Cross-validate counts
- testsTotal must equal testsPassed + testsFailed
- If math doesn't add up → VERDICT: GUILTY (fabricated results)
- Formula: testsTotal === testsPassed + testsFailed + testsSkipped (if skipped exists)

### Step 4: Check regression analysis
- Retrieve coding/testing/regression-analysis
- If regressionDetected === true → VERDICT: GUILTY (regressions found)
- If regression analysis missing → continue (not blocking)

### Step 5: Run verification command (sanity check)
Execute in target directory:
\`\`\`bash
cd $TARGET_DIR && npm test 2>&1 | tail -30
\`\`\`
- Compare output counts with stored values
- If major discrepancy (>10% difference) → VERDICT: GUILTY

## VERDICT CRITERIA (UPDATED)

**INNOCENT** - ALL conditions must be true:
- verified === true in verified-results
- rawOutput contains test runner patterns (execution evidence)
- testsTotal === testsPassed + testsFailed (+ testsSkipped if present)
- regressionDetected === false OR regression-analysis missing
- passPercentage >= 80%
- Sanity check matches stored values (within tolerance)

**GUILTY** - ANY of these conditions:
- verified !== true (tests not actually run)
- No rawOutput or empty rawOutput (no execution evidence)
- Math doesn't validate (testsTotal != testsPassed + testsFailed)
- Regressions detected (regressionDetected === true)
- Pass rate < 80% (passPercentage < 80)
- Sanity check shows major discrepancy with stored values

**INSUFFICIENT_EVIDENCE**:
- Memory keys don't exist (agents didn't store results)
- rawOutput exists but cannot parse test counts
- Cannot run sanity check (no test command available)

## ADDITIONAL VERIFICATION (Post-Fix-Loop)

Check if self-correction loop ran:
\`\`\`bash
npx claude-flow@alpha memory retrieve -k "coding/testing/fix-attempts"
\`\`\`

If fix-attempts exists:
- Verify fixes were applied and tests re-run
- Check finalPassRate from fix-attempts
- If status === "ESCALATED" → VERDICT: INSUFFICIENT_EVIDENCE (needs user input)
- If status === "FIXED" → Continue with normal verification
- If status === "PARTIAL" → Check if remaining failures are acceptable

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-5-verdict"
Store verification details to: "coding/forensic/phase-5-verification"

Include in verification details:
- verifiedFlagCheck: true/false
- executionEvidenceFound: true/false
- mathValidated: true/false
- regressionCheckPassed: true/false
- sanityCheckPassed: true/false
- sanityCheckOutput: "[first 500 chars of test output]"
- fixLoopStatus: "[NONE|FIXED|PARTIAL|ESCALATED]"
- fixAttemptsMade: [0-3]

## ON GUILTY VERDICT
DO NOT proceed to Phase 6. Store detailed issues including:
- Which verification step failed
- Expected vs actual values
- Evidence of the failure
Trigger recovery-agent with specific remediation guidance.

## CRITICAL GATE STATUS
This verdict determines if pipeline continues to Phase 6.
Trust NO memory values without verification. Demand execution proof.
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

#### Agent 42/47: code-quality-improver (ENHANCED - AUTO-FIX)
```
Task("code-quality-improver", `
## YOUR TASK
Improve code quality AND AUTO-FIX all type/lint errors.

## WORKFLOW CONTEXT
Agent #42 of 47 | Phase 6: Optimization | ENHANCED: Auto-fix capability
Previous: performance-architect ✓ | Next: security-architect

## AUTO-FIX PROTOCOL (MANDATORY)

### Step 1: Baseline Diagnostic
\`\`\`bash
cd $TARGET_DIR && npm run typecheck 2>&1 | tee /tmp/phase6-typecheck.txt
TYPE_ERRORS=$(grep -c "error TS" /tmp/phase6-typecheck.txt || echo "0")

cd $TARGET_DIR && npm run lint 2>&1 | tee /tmp/phase6-lint.txt
LINT_ERRORS=$(grep -ci "error" /tmp/phase6-lint.txt || echo "0")
\`\`\`

### Step 2: Fix Loop (if errors > 0)
MAX_ITERATIONS = 3
WHILE (TYPE_ERRORS > 0 OR LINT_ERRORS > 0) AND ITERATION < MAX_ITERATIONS:
  - Parse error files and line numbers
  - Apply targeted fixes using Edit tool
  - Re-run typecheck/lint
  - Check progress, break if no improvement
END WHILE

### Step 3: Store Results
\`\`\`bash
npx claude-flow@alpha memory store -k "coding/optimization/type-fixes" \\
  --value '{"initialErrors": [N], "finalErrors": [M], "iterations": [I], "status": "SUCCESS|PARTIAL|FAILED"}'
\`\`\`

## SUCCESS CRITERIA
- Type errors reduced by 80%+ OR to acceptable level
- Lint errors reduced by 80%+ OR to acceptable level
- Fix loop completed within 3 iterations

## MEMORY STORAGE
Store to key "coding/optimization/quality"
Store to key "coding/optimization/type-fixes"
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

#### Agent 44/47: final-refactorer (ENHANCED - TEST VERIFICATION)
```
Task("final-refactorer", `
## YOUR TASK
Final code polish AND verify all fixes from prior agents work.

## WORKFLOW CONTEXT
Agent #44 of 47 | Phase 6: Optimization (FINAL core agent) | ENHANCED: Test verification
Previous: security-architect ✓ | Next: phase-6-reviewer

## TEST VERIFICATION PROTOCOL (MANDATORY)

### Step 1: Retrieve Prior Fix Results
\`\`\`bash
npx claude-flow@alpha memory retrieve -k "coding/optimization/type-fixes" --namespace default
\`\`\`

### Step 2: Run Full Test Suite
\`\`\`bash
cd $TARGET_DIR && npm test 2>&1 | tee /tmp/phase6-tests.txt
\`\`\`

### Step 3: Fix Loop (if tests fail)
MAX_ITERATIONS = 3
WHILE TESTS_FAILED > 0 AND ITERATION < MAX_ITERATIONS:
  - Parse failed test names and files
  - Identify mismatch (mock, type, assertion)
  - Apply targeted fix using Edit tool
  - Re-run tests
END WHILE

### Step 4: Final Verification
\`\`\`bash
npm run typecheck  # Must be 0 errors
npm run lint       # Must be 0 errors
npm test           # Must be 100% pass
\`\`\`

### Step 5: Store Results
\`\`\`bash
npx claude-flow@alpha memory store -k "coding/optimization/test-verification" \\
  --value '{"initialFailures": [N], "finalFailures": [M], "status": "ALL_PASS|PARTIAL|FAILED|ESCALATED"}'
\`\`\`

## ESCALATION
If status is ESCALATED after 3 iterations, store detailed failure report and list tests requiring manual review.

## MEMORY STORAGE
Store to key "coding/optimization/final-refactor"
Store to key "coding/optimization/test-verification"
`)
```

#### Agent 45/47: phase-6-reviewer (ENHANCED - FIX VERIFICATION GATE)
```
Task("Phase 6 Reviewer (Sherlock)", `
## YOUR TASK
FORENSIC REVIEW of Phase 6 with FIX VERIFICATION.

## WORKFLOW CONTEXT
Sherlock #46 | Phase 6 Gate | ENHANCED: Verifies fixes were actually executed

## FIX VERIFICATION PROTOCOL (MANDATORY)

### Step 1: Check Fix Loop Execution
\`\`\`bash
npx claude-flow@alpha memory retrieve -k "coding/optimization/type-fixes" --namespace default
npx claude-flow@alpha memory retrieve -k "coding/optimization/test-verification" --namespace default
\`\`\`

Verify:
- iterations > 0 if initial errors existed
- status is SUCCESS or PARTIAL, not FAILED
- Error reduction >= 50%

### Step 2: Run Independent Verification
\`\`\`bash
cd $TARGET_DIR && npm run typecheck 2>&1 | grep -c "error TS" || echo "0"
cd $TARGET_DIR && npm test 2>&1 | grep -c "FAIL" || echo "0"
\`\`\`

Compare with stored values - REJECT if mismatch >10%.

### Step 3: Verdict Rules

**APPROVED** (all must be true):
- Fix loops executed when needed
- Error reduction >= 80%
- Independent verification matches stored values

**CONDITIONAL** (any):
- Error reduction only 50-80%
- Minor mismatch in verification (<10%)

**REJECTED** (any):
- Fix loops NOT executed despite errors
- Verification mismatch >10% (tampering suspected)
- Error reduction <50%

## MEMORY STORAGE
Store verdict to: "coding/forensic/phase-6-verdict"
`)
```

---

### Phase 6 Auto-Fix Behavior (ENHANCED)

Phase 6 now includes automatic error fixing with verification:

| Agent | Enhancement | Behavior |
|-------|-------------|----------|
| code-quality-improver | AUTO-FIX | Runs fix loop for type/lint errors (max 3 iterations) |
| final-refactorer | TEST VERIFY | Runs test fix loop, verifies all fixes work |
| phase-6-reviewer | FIX GATE | Verifies fix loops ran, checks for tampering |

**Key Behaviors:**
1. **Type errors are auto-fixed** using pattern matching for common TS errors
2. **Lint errors are auto-fixed** using `--fix` flag
3. **Test failures trigger fix loop** to update mocks, types, assertions
4. **Independent verification** runs actual commands to confirm stored results
5. **Escalation** occurs if fixes fail after 3 iterations (requires manual review)

**Memory Keys Used:**
- `coding/optimization/type-fixes` - Type fix results
- `coding/optimization/test-verification` - Test verification results
- `coding/forensic/phase-6-verdict` - Final Phase 6 verdict

**Verdict Impact:**
- Phase 6 is REJECTED if fix loops didn't run when errors existed
- Phase 6 is REJECTED if verification shows result tampering
- Phase 6 is CONDITIONAL if error reduction was only partial

---

### PHASE 7: DELIVERY (1 agent + Recovery)

#### Agent 46/47: sign-off-approver (CRITICAL - FINAL APPROVAL)
```
Task("sign-off-approver", `
## YOUR TASK
Final sign-off authority. Verify all requirements met. RUN FINAL TEST SUITE. Authorize release.

## WORKFLOW CONTEXT
Agent #46 of 47 | Phase 7: Delivery | CRITICAL: Final approval gate
Previous: Phase 6 ✓ | Next: recovery-agent (only on approval or rejection)

## MEMORY RETRIEVAL
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-1-verdict"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-2-verdict"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-3-verdict"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-4-verdict"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-5-verdict"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-6-verdict"
npx claude-flow@alpha memory retrieve -k "coding/testing/verified-results"
npx claude-flow@alpha memory retrieve -k "coding/forensic/phase-5-verification"

## FINAL VERIFICATION (MANDATORY)

Before sign-off, you MUST execute the full test suite:

\`\`\`bash
cd $TARGET_DIR && npm test 2>&1 | tee /tmp/final-test-run.txt
\`\`\`

Parse the output and extract:
- Total tests (testsTotal)
- Passed tests (testsPassed)
- Failed tests (testsFailed)
- Pass percentage (passPercentage = testsPassed / testsTotal * 100)

**APPROVAL BLOCKED if:**
- Tests fail to run (exit code != 0 without test failures)
- Pass percentage < 80%
- Any critical test failures (security, auth, data integrity)

## MEMORY VALIDATION (Cross-Check)

Compare final test run with stored values from Phase 5:
1. Retrieve coding/testing/verified-results
2. Compare your testsTotal, testsPassed, testsFailed with stored values
3. Calculate difference percentage: |stored - actual| / stored * 100

**RED FLAG if values differ by more than 5%**
This indicates test instability or potential result tampering.
If discrepancy detected, store details and reject approval.

## APPROVAL CRITERIA (ALL MUST BE TRUE)

1. All 6 phase verdicts are INNOCENT
2. Final test run passes with >= 80% pass rate
3. Final test results match stored verified-results (within 5% tolerance)
4. No CRITICAL failures in test output (security, auth, data integrity tests)
5. coding/forensic/phase-5-verification shows all checks passed
6. No regressions from baseline (if baseline exists)

## REJECTION CRITERIA (ANY ONE BLOCKS APPROVAL)

- Any phase verdict is GUILTY or INSUFFICIENT_EVIDENCE
- Final test run fails or < 80% pass rate
- Test results don't match stored values (>5% discrepancy - tampering suspected)
- Critical test failures detected in output
- Phase 5 verification checks failed
- Regressions detected

## ON APPROVAL

Store to memory:
\`\`\`bash
npx claude-flow@alpha memory store -k "coding/delivery/sign-off" -v '{"approved": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "finalTestRun": {"testsTotal": [N], "testsPassed": [N], "testsFailed": [N], "passPercentage": [X]}, "memoryValidation": {"matched": true, "discrepancyPercent": [Y]}, "verdicts": {"phase1": "INNOCENT", "phase2": "INNOCENT", "phase3": "INNOCENT", "phase4": "INNOCENT", "phase5": "INNOCENT", "phase6": "INNOCENT"}}'
\`\`\`

Proceed to recovery-agent with success status.

## ON REJECTION

Output clearly:

\`\`\`
═══════════════════════════════════════════════════════════════
SIGN-OFF REJECTED
═══════════════════════════════════════════════════════════════

Reason: [specific reason - be explicit]

Final Test Results:
- Total: [N]
- Passed: [N]
- Failed: [N]
- Pass Rate: [X]%

Memory Validation:
- Stored values: [testsTotal, testsPassed, testsFailed from memory]
- Actual values: [testsTotal, testsPassed, testsFailed from test run]
- Discrepancy: [Y]%
- Status: [MATCHED / DISCREPANCY_DETECTED]

Phase Verdicts:
- Phase 1: [verdict]
- Phase 2: [verdict]
- Phase 3: [verdict]
- Phase 4: [verdict]
- Phase 5: [verdict]
- Phase 6: [verdict]

Action Required: [what needs to be fixed before re-approval]

═══════════════════════════════════════════════════════════════
\`\`\`

Store rejection to memory for debugging:
\`\`\`bash
npx claude-flow@alpha memory store -k "coding/delivery/sign-off" -v '{"approved": false, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "rejectionReason": "[reason]", "finalTestRun": {"testsTotal": [N], "testsPassed": [N], "testsFailed": [N], "passPercentage": [X]}, "memoryValidation": {"matched": [true/false], "discrepancyPercent": [Y]}, "actionRequired": "[action]"}'

npx claude-flow@alpha memory store -k "coding/delivery/rejection-details" -v '{"testOutput": "[first 2000 chars of /tmp/final-test-run.txt]", "failedTests": ["list of failed test names"], "criticalFailures": ["any security/auth/data failures"]}'
\`\`\`

DO NOT proceed to recovery-agent with success status.
Pass rejection status to recovery-agent for remediation orchestration.

## MEMORY STORAGE
Store to key "coding/delivery/sign-off" - approval or rejection status with full details

## CRITICAL
This is the FINAL approval gate. You MUST run tests yourself.
NEVER trust memory values alone - always verify with actual test execution.
If any doubt exists, REJECT and document the issue.
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
5. **CHECK**: Retrieve coding/testing/escalation (for self-correction failures)

## ESCALATION HANDLING

Check for test escalations:
\`\`\`bash
npx claude-flow@alpha memory retrieve -k "coding/testing/escalation"
\`\`\`

If escalation exists:
- Report remaining failures to user
- Provide fix suggestions based on fix-attempts history
- DO NOT mark pipeline as successful
- Request user intervention for unresolvable failures

Output format:
\`\`\`
⚠️ SELF-CORRECTION INCOMPLETE

The following tests could not be automatically fixed after 3 attempts:
1. [test name]: [failure reason]
   Attempted fixes: [list]

2. [test name]: [failure reason]
   Attempted fixes: [list]

Recommended manual actions:
- [action 1]
- [action 2]

Please fix these issues and re-run the pipeline.
\`\`\`

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

The pipeline automatically queues files for indexing via post-edit hooks. At pipeline completion:

#### 1. Read the queue file
```bash
cat .claude/runtime/leann-index-queue.json
```

This file is populated automatically by the `leann-index-file.sh` hook whenever Write/Edit/MultiEdit tools are used. The hook configuration is at `.claude/hooks/post-edit-leann.json`.

#### 2. Index files using LEANN MCP tool

**For each file in the queue**, call the LEANN index_code MCP tool:

```javascript
// Load the LEANN search tool first
ToolSearch({ query: "select:mcp__leann-search__index_code" })

// Then for each file:
mcp__leann-search__index_code({
  code: "[file content - read with Read tool]",
  filePath: "[absolute path to file]",
  repository: "[target repo name from git root]",
  replaceExisting: true
})
```

**Batch indexing for efficiency** (max 5 parallel calls):
```bash
# Get list of files to index
FILES=$(cat .claude/runtime/leann-index-queue.json | jq -r '.files[]')
FILE_COUNT=$(echo "$FILES" | wc -l)
echo "[LEANN] Found $FILE_COUNT files to index"

# For each file, the orchestrator should:
# 1. Read the file content using Read tool
# 2. Call mcp__leann-search__index_code with the content
# 3. Track success/failure counts
```

#### 3. Alternative: Use batch processor scripts

If MCP tools are unavailable, use the shell-based processor:
```bash
# Option A: Shell script (uses curl to embedder API)
.claude/hooks/leann-batch-index.sh

# Option B: TypeScript processor (uses LEANN tools directly)
npx tsx scripts/hooks/leann-process-queue.ts
```

#### 4. Clear the queue after indexing
```bash
echo '{"files":[],"lastUpdated":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .claude/runtime/leann-index-queue.json
```

#### 5. Verify indexing (sample check)
```bash
# Search for a known function from the new code to verify indexing worked
ToolSearch({ query: "select:mcp__leann-search__search_code" })

mcp__leann-search__search_code({
  query: "[function name or unique identifier from new code]",
  limit: 3
})
```

#### Supported File Types
The auto-indexing hook supports: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, `.go`, `.java`, `.c`, `.cpp`, `.cs`, `.rb`, `.php`, `.sql`

Files are automatically excluded if they match: `node_modules`, `/dist/`, `/.git/`

**WHY THIS MATTERS**: Without LEANN indexing, the context-gatherer agent in future pipeline runs cannot find code created in previous runs. This breaks the learning loop and prevents the pipeline from learning from its own output.

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
