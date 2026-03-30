# TASK-AGT-004: `/create-agent` Skill

```
Task ID:       TASK-AGT-004
Status:        BLOCKED
Implements:    REQ-CREATE-001, REQ-CREATE-002, REQ-CREATE-003, REQ-CREATE-004, REQ-CREATE-005, REQ-CREATE-006, REQ-CREATE-007, REQ-CREATE-008
Depends On:    TASK-AGT-001
Complexity:    High
Guardrails:    GR-001 (depth=1 constraint validation), GR-004 (token budget enforcement), GR-006 (user confirmation before file writes)
NFRs:          NFR-001 (< 30s generation time), NFR-002 (natural language input only), NFR-003 (skill YAML file)
Security:      Low risk — creates files on disk, no external I/O. Verify generated agent.md does not contain hardcoded secrets or PII from the user's description.
```

## Context

The `/create-agent` skill is the primary user-facing entry point for building custom agents. It accepts a natural language description (e.g., "Analyzes SEC 10-K filings for revenue recognition risks") and generates a complete agent definition directory with all applicable files. The skill runs as the orchestrator (Archon) — it does NOT spawn a subagent for generation. Instead, it uses its own LLM capabilities to produce the agent definition, shows it to the user for approval, and writes files only after explicit confirmation.

This skill depends on TASK-AGT-001's utilities (token counting, name sanitization, validation) and template directory (for structural reference).

## Scope

### In Scope
- Skill YAML file at `.claude/skills/create-agent.md`
- Natural language → agent definition generation
- Name sanitization and collision detection
- Overlap detection with existing agents and skills
- Depth=1 validation (scan for subagent spawning patterns)
- Token budget validation before saving
- MemoryGraph registration on creation
- `meta.json` generation with creation timestamp and version 1
- `memory-keys.json` suggestion based on domain
- User approval flow (show definition, wait for confirm/revise/cancel)

### Out of Scope
- Running the agent (TASK-AGT-005)
- Behavior rule management (TASK-AGT-007+)
- Agent evolution / autolearn (Phase 4)
- GUI or web interface
- Editing existing agents (users can edit files directly)

## Key Design Decisions

1. **No subagent for generation**: The skill prompt instructs the orchestrator (Archon/Claude) to generate the agent definition inline. This avoids the overhead and complexity of spawning a generation subagent. The orchestrator has full context of the user's request and the project.
2. **Show-then-confirm pattern**: The skill generates all files as a preview (displayed to user), then waits for explicit approval. Only "yes", "proceed", "approve", "looks good" trigger file writes. "revise" loops back to generation with feedback. "cancel" aborts entirely.
3. **Smart file omission**: Files that would be empty or contain only template boilerplate are NOT created. For example, if the agent description does not imply any specific tools, `tools.md` is omitted. Only `agent.md` and `meta.json` are always created.
4. **Overlap detection via Glob + MemoryGraph**: Check `.claude/agents/custom/` for directories with similar names (Levenshtein distance <= 3 or substring match). Also check `.claude/skills/` for skills with similar trigger words. Check MemoryGraph for existing agent registrations matching tags.
5. **Depth=1 scan**: After generating agent.md and tools.md, scan for patterns that imply subagent spawning: `Task(`, `spawn agent`, `delegate to sub-agent`, `use the Agent tool`, `create a subagent`. If found, warn the user and suggest rephrasing.

## Detailed Specifications

### Skill YAML (`.claude/skills/create-agent.md`)

```yaml
---
name: create-agent
description: Create a custom agent from a natural language description. Generates agent definition files (agent.md, context.md, tools.md, behavior.md, memory-keys.json, meta.json) in .claude/agents/custom/{name}/.
triggers:
  - /create-agent
  - create agent
  - make an agent
  - new agent
arguments:
  - name: description
    description: Natural language description of the agent's purpose and capabilities
    required: true
  - name: name
    description: Optional explicit agent name (will be sanitized to lowercase-hyphenated)
    required: false
---
```

### Full Skill Prompt

The skill content (below the YAML frontmatter) contains the complete instructions for the orchestrator:

```markdown
# /create-agent — Generate a Custom Agent Definition

You are creating a custom agent definition based on the user's description. Follow these steps EXACTLY.

## Step 1: Parse Input

Extract from the user's command:
- **description**: The natural language description of the agent
- **name** (optional): If the user provided `--name "..."`, use it. Otherwise, derive a name from the description.

If the description is empty or too vague (fewer than 10 words, no specific domain or task mentioned):
- Respond with: "Please provide a more specific description. Example: `/create-agent 'Analyzes SEC 10-K filings for revenue recognition risks'`"
- STOP. Do not proceed.

## Step 2: Sanitize Name

Derive or sanitize the agent name:
1. If no explicit name: extract 2-4 key words from the description
2. Apply sanitization: lowercase, replace spaces/underscores with hyphens, strip special chars, collapse consecutive hyphens, remove leading/trailing hyphens
3. Max length: 50 characters
4. Verify the name matches pattern: `^[a-z][a-z0-9-]*[a-z0-9]$`
5. Verify the name is not reserved: `_template`, `archived`, `versions`, `traces`, `custom`

If sanitization fails, ask the user for an explicit name.

## Step 3: Check for Collisions

1. Check if `.claude/agents/custom/{name}/` already exists
   - If yes: "Agent '{name}' already exists. Use a different name or manually edit files in `.claude/agents/custom/{name}/`."
   - STOP.

2. Search for overlap with existing agents:
   - Read directory names in `.claude/agents/custom/`
   - If any existing name is a substring of the new name (or vice versa): warn
   - NOTE: Levenshtein distance was considered but dropped — unreliable when computed by the orchestrator in a prompt. Substring match is sufficient for Phase 1.
   - "Existing agent '{existing}' has a similar name. Create anyway?"

3. Search for overlap with existing skills:
   - Read `.claude/skills/` directory
   - If any skill file contains similar trigger words: warn
   - "Existing skill '{skill}' has similar capabilities. Create anyway?"

4. Search MemoryGraph for existing agent registrations:
   - Query: `recall_memories` with query "{description keywords}"
   - If matching agent-definition memories found: warn about overlap

If any warnings were raised, wait for user to confirm before proceeding.

## Step 4: Generate Agent Definition

Based on the description, generate the following files. OMIT any file that would be empty or contain only generic boilerplate with no domain-specific content.

### agent.md (ALWAYS generated — Master Prompt Framework)

The agent.md file MUST follow the Master Prompt Framework structure (from `docs2/ai_agent_prompt_guide.md`). This structure is what makes generated agents robust and self-improving — the FORBIDDEN OUTCOMES and EDGE CASES sections give the autolearn analysis LLM (Phase 4) specific criteria to evaluate against, and the WHEN IN DOUBT section prevents ambiguity-driven failures.

When generating agent.md, internally apply the 12 Principles from the guide:
1. **Specificity**: Every capability must be concrete, not vague
2. **Harm Prohibition**: FORBIDDEN OUTCOMES must list what the agent CANNOT do
3. **Scope Anchoring**: SCOPE must have both In Scope and Out of Scope
4. **Intent Declaration**: INTENT must state the goal AND the value
5. **Negative Space**: Out of Scope + FORBIDDEN cover what is NOT wanted
6. **Preserve Behavior**: CONSTRAINTS prevent overreach
7. **Quality Requirements**: OUTPUT FORMAT defines what "done" looks like
8. **Environmental Constraints**: CONSTRAINTS include technical limits (depth=1)
9. **Reversibility**: WHEN IN DOUBT prefers conservative interpretations
10. **Source Specification**: CONSTRAINTS specify data sources when relevant
11. **Cascade Prevention**: Out of Scope prevents scope creep
12. **Good Faith**: WHEN IN DOUBT is the catch-all for ambiguity

Structure:
```
# {Agent Name — Title Case}

## INTENT
{What this agent does and WHY it exists. 2-3 sentences that would let someone
decide "is this the right agent for my task?" in 5 seconds.}

## SCOPE
### In Scope
- {Capability 1}: {specific description of what the agent CAN do}
- {Capability 2}: {specific description}
- {Capability 3+}: {as needed, be concrete — "Analyze X" not "handle data"}

### Out of Scope
- {What this agent explicitly does NOT do — prevents scope creep}
- {Tasks that should be done by other agents or manually}

## CONSTRAINTS
- You run at depth=1 and CANNOT spawn subagents or use the Task/Agent tool
- You MUST complete your task directly using the tools available to you
- {Domain-specific constraint 1 — e.g., "Must cite specific section numbers"}
- {Domain-specific constraint 2 — e.g., "Must use EDGAR as primary data source"}
- {Data source constraints if applicable}

## FORBIDDEN OUTCOMES
- DO NOT {specific prohibited behavior — e.g., "fabricate filing data"}
- DO NOT {specific prohibited behavior — e.g., "present estimates as facts"}
- DO NOT echo user-provided input in error messages (XSS prevention)
- DO NOT modify files outside the scope of your task
- {Domain-specific prohibition}

## EDGE CASES
- {Edge case 1}: {expected behavior — e.g., "Filing not found: report clearly, do not fabricate"}
- {Edge case 2}: {expected behavior — e.g., "Foreign issuer (20-F): state limitation"}
- {Edge case 3}: {expected behavior — e.g., "Partial data: clearly mark as incomplete"}

## OUTPUT FORMAT
{Structured output format appropriate to the agent's role. Be specific:
- For analyzers: Summary + Findings (numbered, with severity/confidence) + Key Metrics + Assessment
- For coders: Plan + Implementation + Tests + Self-Review
- For writers: Draft + Structure Notes + Missing Information
- For reviewers: Issues (with severity) + Recommendations + Summary}

## WHEN IN DOUBT
If any part of the task is ambiguous, choose the interpretation that:
1. Is most conservative / least risky
2. Follows existing patterns in the codebase or domain
3. Produces verifiable output with citations or references
If still uncertain, state the ambiguity explicitly in your output.
```

Token budget: target 1,000-3,000 tokens. Hard limit: 3,000 tokens.

**Why this structure matters for autolearn (Phase 4)**: The FORBIDDEN OUTCOMES and EDGE CASES sections give the post-task analysis LLM concrete criteria to evaluate against. When an agent violates a FORBIDDEN outcome, the analysis can generate a targeted FIX suggestion referencing the specific rule. Without these sections, the analysis LLM has nothing to anchor its judgments to.

### context.md (generated if description implies domain knowledge)
Structure:
```
# Domain Context

## Background
{Domain-specific background the agent needs.}

## Key Concepts
- **{Concept}**: {Definition}

## Reference Data
{Schemas, formats, conventions.}

## Common Patterns
{Domain patterns to follow.}
```

Token budget: target 1,000-5,000 tokens. Hard limit: 5,000 tokens.

### tools.md (generated if description implies specific tool usage)
Structure:
```
# Tool Instructions

## Primary Tools
{Which tools are most relevant and how to use them for this domain.}

## Domain-Specific Patterns
{Tool usage patterns specific to this agent's task.}
```

Token budget: target 500-2,000 tokens. Hard limit: 2,000 tokens.

### behavior.md (generated if description implies behavioral constraints)
Structure:
```
# Behavioral Rules

## Communication
{How the agent should communicate findings.}

## Quality Standards
{Verification and accuracy requirements.}

## Process
{Step-by-step approach the agent should follow.}
```

Token budget: target 500-1,500 tokens. Hard limit: 1,500 tokens.

### memory-keys.json (generated with suggested keys)
```json
{
  "recall_queries": [{suggested MemoryGraph keys based on domain}],
  "leann_queries": [{suggested code search queries if the agent works with code}],
  "tags": ["agent-definition", "{domain-tag}"]
}
```

### meta.json (ALWAYS generated)
```json
{
  "created": "{current ISO 8601 timestamp}",
  "last_used": "{current ISO 8601 timestamp}",
  "version": 1,
  "generation": 0,
  "author": "user",
  "invocation_count": 0,
  "quality": {
    "total_selections": 0,
    "total_completions": 0,
    "total_fallbacks": 0,
    "applied_rate": 0,
    "completion_rate": 0,
    "effective_rate": 0,
    "fallback_rate": 0
  }
}
```

## Step 5: Depth=1 Validation

Scan the generated `agent.md` and `tools.md` (if generated) for patterns that imply subagent spawning:
- `Task(`
- `spawn agent`
- `delegate to sub-agent`
- `use the Agent tool`
- `create a subagent`
- `spawn a worker`

If any pattern is found:
- Warn: "Custom agents run at depth=1 and cannot spawn subagents. The following pattern was found: '{pattern}' in {file}. Consider rephrasing the agent's role to perform tasks directly."
- Suggest a rewrite that removes the subagent dependency.

## Step 6: Token Budget Validation

For each generated markdown file, estimate tokens using `ceil(length / 4)`:
- If any file exceeds its hard limit, warn with the specific count
- If total exceeds 15,000 tokens, warn with per-file breakdown
- Suggest which sections to trim

## Step 7: Present to User for Approval

Display the complete generated definition:
```
## Agent Definition: {name}

### Files to be created:
- `.claude/agents/custom/{name}/agent.md` ({N} tokens)
- `.claude/agents/custom/{name}/context.md` ({N} tokens)  [if generated]
- `.claude/agents/custom/{name}/tools.md` ({N} tokens)     [if generated]
- `.claude/agents/custom/{name}/behavior.md` ({N} tokens)  [if generated]
- `.claude/agents/custom/{name}/memory-keys.json`
- `.claude/agents/custom/{name}/meta.json`

Total controllable tokens: {N} / 15,000

### agent.md
{full content}

### context.md
{full content}

[... all generated files ...]

Would you like to:
1. **Approve** — Create the agent as shown
2. **Revise** — Tell me what to change
3. **Cancel** — Discard everything
```

Wait for EXPLICIT user approval. Only proceed on "approve", "yes", "proceed", "go ahead", "looks good", "create it", "1".

## Step 8: Write Files

On approval:
1. Create directory: `.claude/agents/custom/{name}/`
2. Write each generated file
3. Register in MemoryGraph:
   ```
   mcp__memorygraph__store_memory:
     type: "general"
     content: "Custom agent definition: {name} — {one-line description}"
     tags: ["agent-definition", "{name}"]
     metadata: {"agent_name": "{name}", "created": "{timestamp}", "version": 1}
   ```
4. Confirm: "Agent '{name}' created successfully. Run it with: `/run-agent {name} \"your task here\"`"

On "revise":
- Ask what to change
- Regenerate affected files
- Return to Step 7

On "cancel":
- Confirm: "Agent creation cancelled."
- STOP.
```

## Files to Create

- `.claude/skills/create-agent.md` — Complete skill YAML with full prompt template

## Files to Modify

- None

## Validation Criteria

### Unit Tests
- [ ] (Skills are tested via manual invocation, not unit tests. The underlying utilities from TASK-AGT-001 have their own unit tests.)

### Sherlock Gates
- [ ] OPERATIONAL READINESS: `.claude/skills/create-agent.md` exists and has valid YAML frontmatter
- [ ] OPERATIONAL READINESS: Skill has `triggers` that include `/create-agent`
- [ ] OPERATIONAL READINESS: Skill content includes all 8 steps (parse, sanitize, collisions, generate, depth-check, token-check, present, write)
- [ ] GR-001 COMPLIANCE: Depth=1 scan patterns are present in Step 5 (Task(, spawn agent, etc.)
- [ ] GR-004 COMPLIANCE: Token budget validation is present in Step 6 with correct limits (3000, 5000, 2000, 1500, 15000)
- [ ] GR-006 COMPLIANCE: Step 7 explicitly requires user approval before any file writes
- [ ] PARITY: Token limits in skill match PRD REQ-DEF-003 exactly
- [ ] PARITY: meta.json structure matches the schema defined in TASK-AGT-001

### Live Smoke Test

#### Test 1: SEC Filing Analyzer
1. Invoke: `/create-agent "Analyzes SEC 10-K filings for revenue recognition risks and flags unusual accounting practices"`
2. Verify: Agent name is suggested (e.g., `sec-filing-analyzer` or similar)
3. Verify: `agent.md` is generated with role, capabilities, constraints, output format
4. Verify: `context.md` is generated with SEC/EDGAR domain knowledge
5. Verify: `tools.md` is generated with file reading instructions for SEC filings
6. Verify: `behavior.md` is generated with analysis quality standards
7. Verify: Token counts are displayed per file and total
8. Verify: System waits for approval
9. Approve the agent
10. Verify: Files are written to `.claude/agents/custom/{name}/`
11. Verify: MemoryGraph registration via `mcp__memorygraph__recall_memories` with query "agent-definition"
12. Verify: `meta.json` has `version: 1`, `author: "user"`, `invocation_count: 0`

#### Test 2: Code Reviewer
1. Invoke: `/create-agent "Reviews Python code for security vulnerabilities, performance issues, and style violations"`
2. Verify: Agent generates with code-review-specific content
3. Verify: `tools.md` includes Grep and Read usage patterns for code analysis
4. Verify: Depth=1 constraint is in `agent.md`
5. Cancel the agent creation
6. Verify: "Agent creation cancelled." message, no files written

#### Test 3: Collision Detection
1. Create agent "test-agent" first (approve it)
2. Invoke: `/create-agent --name "test-agent" "Some other purpose"`
3. Verify: Error message about agent already existing
4. Invoke: `/create-agent --name "test-agen" "Some other purpose"` (Levenshtein distance 1)
5. Verify: Warning about similar name "test-agent"

## Test Commands

```bash
# Verify skill file exists and has valid frontmatter
test -f .claude/skills/create-agent.md && echo "Skill file exists" || echo "MISSING"

# Check YAML frontmatter is parseable (basic check)
head -20 .claude/skills/create-agent.md | grep -q "name: create-agent" && echo "Frontmatter OK" || echo "Frontmatter MISSING"

# Verify triggers
grep -q "/create-agent" .claude/skills/create-agent.md && echo "Trigger OK" || echo "Trigger MISSING"

# Verify depth=1 scan patterns are present
grep -q "Task(" .claude/skills/create-agent.md && echo "Depth-1 scan OK" || echo "Depth-1 scan MISSING"

# Verify token limits mentioned
grep -q "15,000" .claude/skills/create-agent.md && echo "Token limit OK" || echo "Token limit MISSING"

# Verify approval step
grep -q "approval\|approve\|Approve" .claude/skills/create-agent.md && echo "Approval step OK" || echo "Approval step MISSING"
```
