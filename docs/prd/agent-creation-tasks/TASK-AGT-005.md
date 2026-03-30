# TASK-AGT-005: `/run-agent` Skill

```
Task ID:       TASK-AGT-005
Status:        BLOCKED
Implements:    REQ-RUN-001, REQ-RUN-002, REQ-RUN-003, REQ-RUN-004, REQ-RUN-005, REQ-RUN-006, REQ-RUN-007
Depends On:    TASK-AGT-001, TASK-AGT-003
Complexity:    High
Guardrails:    GR-004 (token budget), GR-006 (confirmation before spawning)
NFRs:          NFR-001 (< 5s context assembly), NFR-006 (resilience if MemoryGraph down)
Security:      Low risk — reads agent definition files and assembles a prompt. No external I/O beyond MemoryGraph/LEANN queries. Verify assembled prompt does not leak secrets from memory context.
```

## Context

The `/run-agent` skill is the execution entry point for custom agents. It reads an agent's definition files, assembles them into a structured Context Envelope prompt, adds memory context from MemoryGraph and LEANN, validates token budgets, asks the user for confirmation, and then spawns a Task tool subagent with the assembled prompt. After execution, it updates `meta.json` with invocation counts and timestamps.

This is the most critical skill in the system — it bridges agent definitions (static files) with agent execution (dynamic Task tool invocation). The Context Envelope assembly algorithm must be deterministic and well-documented so that future tasks (behavior injection, autolearn) can extend it reliably.

## Scope

### In Scope
- Skill YAML file at `.claude/skills/run-agent.md`
- Context Envelope assembly algorithm (8-step)
- Structured prompt template (ROLE, DOMAIN CONTEXT, TOOL INSTRUCTIONS, BEHAVIORAL RULES, MEMORY CONTEXT, YOUR TASK)
- Token counting and budget enforcement with per-section breakdown
- Truncation priority (LEANN first, then memory, then context.md — NEVER agent.md or task)
- Confirmation step before spawning ("About to spawn agent '{name}' with {tokens} tokens. Proceed?")
- LEANN integration (query if running, skip silently if not)
- `meta.json` atomic update (temp file + rename)
- `behavior.md` reconciliation check (EC-RUN-007)
- Error handling for missing agents, empty tasks, MemoryGraph unavailability

### Out of Scope
- Behavior rule injection from MemoryGraph (TASK-AGT-009 — Phase 2)
- Execution recording / trace files (TASK-AGT-013 — Phase 4)
- Post-task analysis (TASK-AGT-014 — Phase 4)
- Two-phase fallback (REQ-LEARN-007 — Phase 4)
- Agent chaining via pipe syntax (REQ-RUN-007 — deferred)
- Output summary storage in MemoryGraph (REQ-RUN-006 — SHOULD, implement if time allows)

## Key Design Decisions

1. **Context Envelope is assembled by the skill prompt itself**: The skill instructions tell the orchestrator exactly how to read files, build the prompt string, count tokens, and spawn the Task tool. No external assembler binary — the orchestrator IS the assembler.
2. **Truncation priority is hardcoded**: When total controllable tokens exceed 15,000, truncate in this order: (1) LEANN results, (2) MemoryGraph recall results, (3) context.md content. NEVER truncate agent.md, behavior.md, or the task description. This ensures the agent's core identity and behavioral rules are always intact.
3. **Confirmation is mandatory per Prime Directive**: The skill MUST show the token count and agent name, then WAIT for explicit user approval before calling the Task tool. This is not optional — it is enforced by GR-006 and the CLAUDE.md Prime Directive.
4. **Atomic meta.json updates**: Write to `meta.json.tmp`, then rename to `meta.json`. This prevents corruption if two concurrent runs update the same file (EC-RUN-006).
5. **LEANN is best-effort**: If LEANN is not running, skip silently (debug-level log only). The agent runs without code context. No user-facing warning (EC-DEF-006).
6. **Model inheritance**: By default, the subagent uses the same model as the parent session. The `--model` flag allows override (e.g., `--model haiku` for cheaper runs).

## Detailed Specifications

### Skill YAML (`.claude/skills/run-agent.md`)

```yaml
---
name: run-agent
description: Invoke a custom agent with a task description. Assembles the Context Envelope from agent definition files, memory, and LEANN, then spawns a Task tool subagent.
triggers:
  - /run-agent
  - run agent
arguments:
  - name: agent_name
    description: Name of the agent to run (must exist in .claude/agents/custom/)
    required: true
  - name: task
    description: Task description for the agent to execute
    required: true
  - name: model
    description: "Override model for the subagent (e.g., haiku, sonnet, opus). Default: inherit from parent."
    required: false
---
```

### Full Skill Prompt — Context Envelope Assembly Algorithm

```markdown
# /run-agent — Execute a Custom Agent

You are assembling and executing a custom agent. Follow these steps EXACTLY, in order.

## Step 1: Parse Input

Extract from the user's command:
- **agent_name**: The agent to run (required)
- **task**: The task description (required)
- **model**: Optional model override (default: inherit parent model)

Syntax variants:
- `/run-agent {name} "task description"`
- `/run-agent {name} --model haiku "task description"`

If agent_name is missing: "Please specify an agent name. Example: `/run-agent sec-filing-analyzer 'Analyze AAPL 10-K'`"
If task is empty: "Please provide a task description. Example: `/run-agent {name} 'your task here'`" (EC-RUN-004)

## Step 2: Validate Agent Exists

1. Check if `.claude/agents/custom/{agent_name}/` exists
   - If not: "Agent '{agent_name}' not found. Run `/list-agents` to see available agents." (EC-RUN-001)
   - STOP.

2. Check if `.claude/agents/custom/{agent_name}/agent.md` exists
   - If not: "Invalid agent definition: {agent_name}/agent.md not found." (EC-DEF-005)
   - STOP.

## Step 3: Read Definition Files

Read each file if it exists. Track which files are present:

```
agent_md     = Read(".claude/agents/custom/{name}/agent.md")        # REQUIRED
context_md   = Read(".claude/agents/custom/{name}/context.md")      # optional
tools_md     = Read(".claude/agents/custom/{name}/tools.md")        # optional
behavior_md  = Read(".claude/agents/custom/{name}/behavior.md")     # optional
memory_keys  = Read(".claude/agents/custom/{name}/memory-keys.json") # optional (parse as JSON)
meta         = Read(".claude/agents/custom/{name}/meta.json")       # optional (parse as JSON)
```

## Step 4: Recall MemoryGraph Context

If `memory_keys` exists and has `recall_queries`:
1. For each query in `recall_queries`, call `mcp__memorygraph__recall_memories` with the query
2. Collect results into `memory_context` string
3. If any query returns empty: warn (debug level): "No memories found for key '{key}'." (EC-RUN-003)
4. If MemoryGraph is unavailable: set `memory_context = ""`, warn user: "MemoryGraph unavailable. Running without memory context." (NFR-006)

## Step 5: Query LEANN Code Context

If `memory_keys` exists and has `leann_queries`:
1. Check if LEANN is running: call `mcp__leann-search__get_stats`
   - If error/unavailable: skip ALL LEANN queries silently. Do NOT warn user. (EC-DEF-006)
2. If LEANN is running: for each query in `leann_queries`, call `mcp__leann-search__search_code`
3. Collect results into `leann_context` string
4. If no results: set `leann_context = ""`

## Step 6: Check behavior.md Reconciliation

If `behavior_md` exists:
1. Check file modification time vs. last known `/adjust-behavior` run (if trackable)
2. If behavior.md appears to have been modified outside `/adjust-behavior` (heuristic: check if a MemoryGraph behavior_rule record exists for this agent that does NOT match file content):
   - Warn: "behavior.md was modified outside /adjust-behavior. File and MemoryGraph rules may be inconsistent. Run /adjust-behavior to reconcile." (EC-RUN-007)
   - Proceed anyway — inject both file content and MemoryGraph rules

Note: In Phase 1, MemoryGraph behavior rules do not exist yet (Phase 2 — TASK-AGT-009). This step is a no-op in Phase 1 but the check structure is present for forward compatibility.

## Step 7: Assemble Context Envelope

Build the prompt string in this EXACT structure (REQ-RUN-003):

```
## ROLE
{contents of agent.md}

## DOMAIN CONTEXT
{contents of context.md, or omit section if file doesn't exist}

## TOOL INSTRUCTIONS
{contents of tools.md, or omit section if file doesn't exist}

## BEHAVIORAL RULES (auto-injected, do not override)
{contents of behavior.md, or omit if file doesn't exist}
{active behavior rules from MemoryGraph, sorted by priority desc — Phase 2 placeholder}

## MEMORY CONTEXT
{recalled MemoryGraph entries, or omit section if empty}
{LEANN code context results, or omit if empty}

## YOUR TASK
{task description from user}
```

Rules:
- Omit any section that has no content (do not include empty `## SECTION` headers)
- Each section is separated by a blank line
- The ROLE section is ALWAYS present (agent.md is required)
- The YOUR TASK section is ALWAYS present (task is required)

## Step 8: Token Budget Validation and Truncation

Estimate tokens for the assembled prompt: `ceil(total_characters / 4)`

If total controllable tokens exceed 15,000 (REQ-DEF-003):
1. Show per-section breakdown:
   ```
   Token Budget Exceeded (15,000 limit):
     ROLE (agent.md):           {N} tokens  [PROTECTED]
     DOMAIN CONTEXT:            {N} tokens
     TOOL INSTRUCTIONS:         {N} tokens
     BEHAVIORAL RULES:          {N} tokens  [PROTECTED]
     MEMORY CONTEXT (MG):       {N} tokens
     MEMORY CONTEXT (LEANN):    {N} tokens
     YOUR TASK:                 {N} tokens  [PROTECTED]
     ─────────────────────────────────────
     TOTAL:                     {N} tokens (over by {overage})
   ```

2. Truncate in this priority order (EC-RUN-002):
   - First: LEANN results (remove entirely if needed)
   - Second: MemoryGraph recall results (remove entirely if needed)
   - Third: context.md content (truncate from end, add `[TRUNCATED]` marker)
   - NEVER truncate: agent.md, behavior.md, task description

3. After truncation, recalculate total and verify it's within budget.

## Step 9: Confirmation

Display to user:
```
About to spawn agent '{name}' with {total_tokens} tokens. Proceed?

Sections included:
  - ROLE: {N} tokens
  - DOMAIN CONTEXT: {N} tokens (or "omitted")
  - TOOL INSTRUCTIONS: {N} tokens (or "omitted")
  - BEHAVIORAL RULES: {N} tokens (or "omitted")
  - MEMORY CONTEXT: {N} tokens (or "omitted")
  - TASK: {N} tokens
  {- Model: {model} (if overridden)}
```

WAIT for explicit user approval. Only proceed on "yes", "proceed", "go ahead", "do it", "y".

## Step 10: Spawn Subagent

On approval:
1. Call the Task tool with the assembled Context Envelope as the prompt
2. If `--model` was specified, pass it to the Task tool
3. Wait for the subagent to complete
4. Display the subagent's output to the user

On error (timeout, crash):
- Report error: "Agent '{name}' execution failed: {error}" (EC-RUN-005)
- Do NOT update invocation count
- Store error in MemoryGraph with tag `agent-error` (if MemoryGraph available)
- STOP.

## Step 11: Update meta.json

After successful execution:
1. Read current `meta.json`
2. Increment `invocation_count`
3. Update `last_used` to current ISO 8601 timestamp
4. Write to `meta.json.tmp`
5. Rename `meta.json.tmp` to `meta.json` (atomic update — EC-RUN-006)

If `meta.json` does not exist (edge case), create it with ALL fields (including Phase 4 quality block to prevent downstream crashes):
```json
{
  "created": "{current timestamp}",
  "last_used": "{current timestamp}",
  "version": 1,
  "generation": 0,
  "author": "user",
  "invocation_count": 1,
  "quality": {
    "total_selections": 1,
    "total_completions": 0,
    "total_fallbacks": 0,
    "applied_rate": 0.0,
    "completion_rate": 0.0,
    "effective_rate": 0.0,
    "fallback_rate": 0.0
  },
  "evolution_history_last_10": []
}
```

## Step 12: Post-Execution Summary (Optional — REQ-RUN-006)

If MemoryGraph is available, store a brief output summary:
```
mcp__memorygraph__store_memory:
  type: "general"
  content: "Agent '{name}' executed task: {first 100 chars of task}. Output: {first 200 chars of output}."
  tags: ["agent-output", "{name}"]
```

Create a relationship from this memory to the agent definition memory.
```

## Files to Create

- `.claude/skills/run-agent.md` — Complete skill YAML with full Context Envelope assembly instructions

## Files to Modify

- None

## Validation Criteria

### Unit Tests
- [ ] (Skills are tested via manual invocation. The token counter and validator from TASK-AGT-001 have their own unit tests.)

### Sherlock Gates
- [ ] OPERATIONAL READINESS: `.claude/skills/run-agent.md` exists and has valid YAML frontmatter
- [ ] OPERATIONAL READINESS: Skill has `triggers` that include `/run-agent`
- [ ] OPERATIONAL READINESS: Skill content includes all 12 steps
- [ ] GR-004 COMPLIANCE: Token budget of 15,000 is referenced in Step 8
- [ ] GR-006 COMPLIANCE: Step 9 explicitly requires user confirmation before spawning
- [ ] TRUNCATION ORDER: Step 8 specifies LEANN first, then memory, then context.md — never agent.md, behavior.md, or task
- [ ] PROMPT STRUCTURE: Step 7 matches REQ-RUN-003 exactly (ROLE, DOMAIN CONTEXT, TOOL INSTRUCTIONS, BEHAVIORAL RULES, MEMORY CONTEXT, YOUR TASK)
- [ ] ATOMIC WRITE: Step 11 uses temp + rename pattern for meta.json
- [ ] LEANN SKIP: Step 5 specifies silent skip when LEANN unavailable (no user warning)
- [ ] PARITY: Context Envelope section order matches PRD REQ-RUN-002 exactly
- [ ] TOKEN BUDGET: Check that the sum of per-file limits (3000+5000+2000+1500 = 11500) plus dynamic context (up to 3500) fits within 15000

### Live Smoke Test

#### Prerequisites
- TASK-AGT-001 template directory exists
- TASK-AGT-003 tool factory is registered (for tool availability)
- At least one agent exists (create manually or via TASK-AGT-004)

#### Test 1: Basic Invocation
1. Create a test agent manually:
   ```bash
   mkdir -p .claude/agents/custom/test-echo/
   echo '# Test Echo Agent\n\n## Role\nYou are a simple echo agent. Repeat the task description back to the user, prefixed with "ECHO: ".\n\n## Constraints\n- Depth=1, no subagents\n- Simply echo the task' > .claude/agents/custom/test-echo/agent.md
   echo '{"created":"2026-03-30T00:00:00Z","last_used":"2026-03-30T00:00:00Z","version":1,"author":"user","invocation_count":0}' > .claude/agents/custom/test-echo/meta.json
   ```
2. Invoke: `/run-agent test-echo "Hello, world!"`
3. Verify: Confirmation prompt shows agent name and token count
4. Approve
5. Verify: Subagent outputs something containing "ECHO: Hello, world!" (or similar)
6. Verify: `meta.json` now shows `invocation_count: 1` and updated `last_used`

#### Test 2: Missing Agent
1. Invoke: `/run-agent nonexistent-agent "Do something"`
2. Verify: Error message "Agent 'nonexistent-agent' not found."

#### Test 3: Empty Task
1. Invoke: `/run-agent test-echo ""`
2. Verify: Error message about empty task description

#### Test 4: Token Budget Display
1. Create an agent with large context.md (10000+ characters)
2. Invoke: `/run-agent large-context-agent "Simple task"`
3. Verify: Per-section token breakdown is displayed in confirmation prompt
4. Verify: If over budget, truncation occurs in correct order

#### Test 5: Cancellation
1. Invoke: `/run-agent test-echo "Some task"`
2. When confirmation appears, respond with "no" or "cancel"
3. Verify: Agent is NOT spawned, no meta.json update

## Test Commands

```bash
# Verify skill file exists and has valid frontmatter
test -f .claude/skills/run-agent.md && echo "Skill file exists" || echo "MISSING"

# Check YAML frontmatter
head -20 .claude/skills/run-agent.md | grep -q "name: run-agent" && echo "Frontmatter OK" || echo "Frontmatter MISSING"

# Verify triggers
grep -q "/run-agent" .claude/skills/run-agent.md && echo "Trigger OK" || echo "Trigger MISSING"

# Verify confirmation step is present
grep -q "About to spawn agent" .claude/skills/run-agent.md && echo "Confirmation OK" || echo "Confirmation MISSING"

# Verify truncation order
grep -q "LEANN results" .claude/skills/run-agent.md && echo "Truncation order OK" || echo "Truncation order MISSING"

# Verify Context Envelope structure
grep -q "## ROLE" .claude/skills/run-agent.md && echo "Envelope structure OK" || echo "Envelope structure MISSING"

# Create test agent for smoke test
mkdir -p .claude/agents/custom/test-echo/
printf '# Test Echo Agent\n\n## Role\nYou echo the task back.\n\n## Constraints\n- Depth=1\n' > .claude/agents/custom/test-echo/agent.md
printf '{"created":"2026-03-30T00:00:00Z","last_used":"2026-03-30T00:00:00Z","version":1,"author":"user","invocation_count":0}' > .claude/agents/custom/test-echo/meta.json
echo "Test agent created"
```
