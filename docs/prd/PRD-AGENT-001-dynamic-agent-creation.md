# PRD-AGENT-001: Dynamic Agent Creation System

**PRD Version**: 3.0.0
**Effective Date**: 2026-03-29
**Status**: DRAFT
**Owner**: Steven Bahia
**Agent**: Archon (Claude Opus 4.6)

---

## 1. Executive Summary

Build a system that enables creating, running, managing, and **self-improving** custom AI agents on the fly within Claude Code. Agents are defined as multi-file directories (role, context, tools, behavior) that get assembled into structured prompts and executed via the Task tool. The system includes runtime tool creation via an MCP tool factory, self-directed behavior adjustment via LLM-mediated rule merging, a formalized context inheritance protocol for subagent orchestration, and an **autolearn system** (inspired by OpenSpace) that records execution traces, analyzes outcomes via LLM-as-judge, and autonomously evolves agent definitions through FIX/DERIVED/CAPTURED evolution modes.

**Business drivers**:
- Eliminate repetitive prompt engineering for recurring specialized tasks
- Enable power users to create domain-specific agents via natural language
- Build reusable, versionable agent definitions that **autonomously improve** over time through execution feedback
- Agents that fail learn from their failures; agents that succeed have their patterns captured for reuse

**Success criteria**: When tested against 3 reference agents (SEC filing analyzer, code reviewer, documentation writer), users can create an equivalent agent via `/create-agent` in under 60 seconds, invoke it via `/run-agent` in a single command, and the agent's output passes the same acceptance criteria as a manually crafted Task tool prompt, verified by blind comparison (>=7/9 preference parity across 3 agents x 3 tasks). After 15+ invocations, agents with autolearn enabled MUST show measurable improvement: effective_rate (completions/selections) > 50% (fail threshold) with a target of > 70%.

---

## 2. Problem Statement

### What pain point are we solving?

Every time we need a specialized agent (SEC filing analyzer, code reviewer with specific style preferences, documentation writer for a particular project), we manually assemble a prompt with role description, context, tool instructions, and behavioral rules. This prompt engineering is:
1. **Repetitive**: Similar patterns are rebuilt each time
2. **Non-persistent**: Prompts exist only in the conversation that created them
3. **Non-composable**: Cannot mix and match role + context + tools from different sources
4. **Non-evolvable**: Agents cannot learn from their own corrections
5. **No execution feedback**: When an agent fails, the failure is not captured or analyzed — the same mistakes repeat

### Who experiences it?

Steven Bahia (primary user) and any future Claude Code power user who runs multi-agent workflows.

### Current state

- Task tool accepts an inline prompt string — no structure, no persistence, no reuse
- Agent definitions in `.claude/agents/` are simple markdown files — single-file, no separation of concerns
- Behavioral corrections stored in MemoryGraph but not automatically injected into subagent prompts
- No mechanism for agents to create new tools at runtime
- No standardized "context envelope" for what flows parent → child

### Consequences of not solving

- Continued manual prompt assembly for every specialized task
- Behavioral corrections drift — lessons learned in one session don't reliably reach future agents
- Cannot build a library of reusable, domain-specific agents
- Runtime tool creation remains impossible, limiting agent autonomy

---

## 3. Personas and User Stories

### Personas

| Persona | Description | Goals | Usage Frequency |
|---------|-------------|-------|-----------------|
| **Power User (Steven)** | Senior engineer running multi-agent pipelines | Create domain-specific agents quickly; reuse across sessions; agents that improve over time | Daily |
| **Orchestrator (Archon)** | The AI assistant managing workflows | Assemble context for subagents efficiently; inject behavioral rules automatically; create tools when needed | Every session |
| **Ad-hoc Agent** | A spawned subagent with a specific role | Execute task with full context; access relevant tools; follow behavioral rules | Per-task |

### User Stories

US-001: As a **Power User**, I want to describe an agent in plain English and have it created automatically, so that I don't need to manually write prompt files.
- Acceptance: `/create-agent "Analyzes SEC 10-K filings for revenue recognition risks"` produces a valid agent directory with agent.md + context.md in < 60 seconds.
- Related: REQ-CREATE-001, REQ-CREATE-002, REQ-CREATE-003

US-002: As a **Power User**, I want to invoke a custom agent with a single command, so that I don't need to re-assemble prompts every time.
- Acceptance: `/run-agent sec-filing-analyzer "Analyze AAPL 10-K"` assembles context and spawns a subagent in < 10 seconds.
- Related: REQ-RUN-001, REQ-RUN-002, REQ-RUN-004

US-003: As an **Orchestrator**, I want to create tools on the fly during a session, so that agents can perform custom computations without pre-built tooling.
- Acceptance: Agent calls `add_tool` with Python code; new tool is callable within 200ms.
- Related: REQ-TOOL-001, REQ-TOOL-002, REQ-TOOL-003

US-004: As a **Power User**, I want to adjust an agent's behavior rules and have changes persist across sessions, so that agents improve over time.
- Acceptance: `/adjust-behavior sec-filing-analyzer "Always cite specific section numbers"` stores the rule in MemoryGraph; next `/run-agent` invocation includes the rule.
- Related: REQ-BEHAV-001, REQ-BEHAV-002, REQ-BEHAV-004

US-005: As a **Power User**, I want to list and archive agents I no longer use, so that my agent library stays manageable.
- Acceptance: `/list-agents` shows all agents with last-used dates; `/archive-agent old-agent` removes it from the active list.
- Related: REQ-LIST-001, REQ-ARCHIVE-001

US-006: As a **Power User**, I want my agents to automatically learn from their execution outcomes, so that they get better over time without manual prompt tuning.
- Acceptance: After 10 invocations of an agent, the system has recorded execution traces, analyzed outcomes, and proposed at least 1 evolution suggestion (FIX or DERIVED). Quality counters show effective_rate trending upward.
- Related: REQ-LEARN-001, REQ-LEARN-002, REQ-LEARN-003

US-007: As an **Orchestrator**, I want to capture successful execution patterns as new agents, so that novel approaches are preserved without manual effort.
- Acceptance: When a bare-reasoning fallback succeeds, the system proposes a CAPTURED agent definition from the execution trace. User approves, and the new agent is available via `/run-agent`.
- Related: REQ-LEARN-007, REQ-LEARN-008

---

## 4. Feature List and Functional Requirements

### Token Budget Worksheet

Before specifying features, the token budget that governs all context assembly:

```
CLAUDE.md auto-injection (unavoidable):       ~2,100 tokens
Subagent system overhead:                     ~2,010 tokens (system prompt + MCP/skills)
                                              ─────────────
Total fixed overhead:                         ~4,110 tokens

Agent definition files (controllable):
  agent.md:          max 3,000 tokens
  context.md:        max 5,000 tokens
  tools.md:          max 2,000 tokens
  behavior.md:       max 1,500 tokens
                     ─────────────
  Definition total:  max 11,500 tokens

Dynamic context (variable):
  MemoryGraph recall:    500-2,000 tokens
  Behavior rules (MG):   200-500 tokens
  Task description:       200-500 tokens
                         ─────────────
  Dynamic total:         900-3,000 tokens

GRAND TOTAL:             ~16,510-18,610 tokens (within 5K-15K sweet spot for definition + dynamic)

Hard limit for controllable prompt (definition + dynamic): 15,000 tokens
Hard limit including fixed overhead: ~19,110 tokens
```

Note: CLAUDE.md overhead (~2,100 tokens) is OUTSIDE the controllable budget — it is auto-injected and not counted against the 15,000 token limit. The 15,000 limit applies only to content we assemble: definition files + memory + behavior rules + task.

---

### Feature 1: Agent Definition Format

**Priority**: MUST

**Intent**: INT-AGENT-001 — Agents need a structured, persistent, multi-file definition format that separates concerns and enables composition.

#### Functional Requirements

REQ-DEF-001 (Priority: MUST):
- Agent definitions MUST be stored as directories under `.claude/agents/custom/{agent-name}/`
- Minimum viable agent: a single `agent.md` file
- Definition: A directory containing at least `agent.md` constitutes a valid agent definition

REQ-DEF-002 (Priority: MUST):
- Agent definitions MUST support these files, all optional except `agent.md`:
  - `agent.md` — Role, capabilities, constraints, output format (target: 1,000-3,000 tokens)
  - `context.md` — Domain knowledge, schemas, reference data (target: 1,000-5,000 tokens)
  - `tools.md` — Tool usage instructions, code patterns (target: 500-2,000 tokens)
  - `behavior.md` — Behavioral rules, dynamic, editable at runtime (target: 500-1,500 tokens)
  - `memory-keys.json` — MemoryGraph keys and optional LEANN queries to execute on init
  - `meta.json` — Auto-generated metadata (creation date, last used, version, invocation count)

REQ-DEF-003 (Priority: MUST):
- Token budgets MUST be enforced per file:
  - `agent.md`: hard limit 3,000 tokens
  - `context.md`: hard limit 5,000 tokens
  - `tools.md`: hard limit 2,000 tokens
  - `behavior.md`: hard limit 1,500 tokens
  - Total controllable prompt (all files + memory recall + behavior rules from MemoryGraph + task description): hard limit 15,000 tokens
  - Note: CLAUDE.md auto-injection (~2,100 tokens) is outside this budget

REQ-DEF-004 (Priority: COULD):
- Agent definitions COULD support override-based merging with a base template
- Deferred: merge semantics (deep merge vs. file-level replace, conflict resolution) to be defined in Phase 3 based on real usage patterns. Not implemented in Phase 1.

REQ-DEF-005 (Priority: MUST):
- `meta.json` MUST be auto-generated on creation and updated on every invocation with:
  - `created` (ISO 8601 timestamp)
  - `last_used` (ISO 8601 timestamp)
  - `version` (integer, incremented on definition file changes)
  - `author` ("user" or "auto")
  - `invocation_count` (integer)

REQ-DEF-006 (Priority: MUST):
- Agent definitions MUST be registered in MemoryGraph on creation for cross-session discoverability
- Memory type: `general`, tags: `["agent-definition", "{agent-name}"]`

REQ-DEF-007 (Priority: SHOULD):
- `memory-keys.json` MUST support both MemoryGraph recall queries and LEANN code search queries:
  ```json
  {
    "recall_queries": ["project/api/ticker-endpoint"],
    "leann_queries": ["cache manager pattern"],
    "tags": ["market-terminal", "backend"]
  }
  ```
- If LEANN is not running when `/run-agent` is invoked, LEANN queries MUST be silently skipped with a debug-level log (not a user-facing warning)

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-DEF-001 | REQ-DEF-001 | Agent name contains spaces or special characters | Sanitize to lowercase-hyphenated (e.g., "SEC Filing Analyzer" → "sec-filing-analyzer") |
| EC-DEF-002 | REQ-DEF-001 | Agent name collides with existing agent in `.claude/agents/custom/` | Error: "Agent '{name}' already exists. Use a different name or manually edit files in .claude/agents/custom/{name}/." |
| EC-DEF-003 | REQ-DEF-003 | File exceeds token hard limit | Warn user with specific count; truncate with `[TRUNCATED: {n} tokens exceeded limit of {limit}]` marker; log to MemoryGraph |
| EC-DEF-004 | REQ-DEF-007 | `memory-keys.json` contains invalid MemoryGraph keys | Warn on `/run-agent` invocation; skip invalid keys; continue with valid keys |
| EC-DEF-005 | REQ-DEF-002 | Agent directory exists but `agent.md` is missing | Error: "Invalid agent definition: {name}/agent.md not found." |
| EC-DEF-006 | REQ-DEF-007 | LEANN is not running when `/run-agent` is invoked | Skip LEANN queries silently; log at debug level; proceed with other context |

---

### Feature 2: `/create-agent` Skill

**Priority**: MUST

**Intent**: INT-AGENT-002 — Users need to create agent definitions from natural language descriptions without manually writing markdown files.

#### Functional Requirements

REQ-CREATE-001 (Priority: MUST):
- `/create-agent` MUST accept a natural language description of the desired agent
- Syntax: `/create-agent "description"` or `/create-agent --name "name" --description "description"`

REQ-CREATE-002 (Priority: MUST):
- The skill MUST generate all applicable definition files (agent.md, context.md, tools.md, behavior.md, memory-keys.json) from the description
- Files that would be empty or meaningless MUST be omitted (not created as empty files)

REQ-CREATE-003 (Priority: MUST):
- The skill MUST show the generated definition to the user and wait for explicit approval before writing to disk
- User can approve, request changes, or cancel

REQ-CREATE-004 (Priority: MUST):
- The skill MUST register the agent in MemoryGraph (per REQ-DEF-006)

REQ-CREATE-005 (Priority: SHOULD):
- The skill SHOULD check for existing agents and skills that overlap with the requested agent's capabilities
- If overlap detected, warn: "Existing agent/skill '{name}' has similar capabilities. Create anyway?"

REQ-CREATE-006 (Priority: MUST):
- The skill MUST generate `meta.json` with creation timestamp and version 1

REQ-CREATE-007 (Priority: SHOULD):
- The skill SHOULD suggest relevant `memory-keys.json` entries based on the agent's domain

REQ-CREATE-008 (Priority: SHOULD):
- The skill SHOULD validate generated agent.md and tools.md for patterns that imply subagent spawning ("Task(", "spawn agent", "delegate to sub-agent") and warn: "Custom agents run at depth=1 and cannot spawn subagents. Consider rephrasing the agent's role to perform tasks directly."

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-CREATE-001 | REQ-CREATE-001 | Description is empty or too vague ("make an agent") | Error: "Please provide a more specific description. Example: /create-agent 'Analyzes SEC 10-K filings for revenue recognition risks'" |
| EC-CREATE-002 | REQ-CREATE-003 | User says "no" to approval | Discard all generated files; confirm: "Agent creation cancelled." |
| EC-CREATE-003 | REQ-CREATE-002 | Description implies capabilities beyond Claude Code (e.g., "agent that sends emails") | Warn about capability limitations; generate agent with appropriate constraints in behavior.md |

---

### Feature 3: `/run-agent` Skill

**Priority**: MUST

**Intent**: INT-AGENT-003 — Users need a simple one-command way to invoke custom agents with full context assembly.

#### Functional Requirements

REQ-RUN-001 (Priority: MUST):
- `/run-agent {name} "task description"` MUST invoke the named agent with the specified task
- The skill MUST show the assembled context token count and ask for confirmation before spawning: "About to spawn agent '{name}' with {token_count} tokens. Proceed?"
- This confirmation step is required per the CLAUDE.md Prime Directive (no pipeline auto-execute override for `/run-agent`)

REQ-RUN-002 (Priority: MUST):
- The skill MUST assemble a Context Envelope from the agent definition:
  1. Read `agent.md` → role section
  2. Read `context.md` → domain context section (if exists)
  3. Read `tools.md` → tool instructions section (if exists)
  4. Read `behavior.md` → behavioral rules section (if exists)
  5. Recall MemoryGraph keys from `memory-keys.json` → memory context section (if exists)
  6. Execute LEANN queries from `memory-keys.json` → code context section (if LEANN running and queries defined)
  7. Append task description → task section
  8. Validate total controllable tokens against 15,000 token hard limit

REQ-RUN-003 (Priority: MUST):
- The assembled prompt MUST follow this structure:
  ```
  ## ROLE
  {contents of agent.md}

  ## DOMAIN CONTEXT
  {contents of context.md}

  ## TOOL INSTRUCTIONS
  {contents of tools.md}

  ## BEHAVIORAL RULES (auto-injected, do not override)
  {contents of behavior.md}
  {active behavior rules from MemoryGraph, sorted by priority descending}

  ## MEMORY CONTEXT
  {recalled MemoryGraph entries}
  {LEANN code context results}

  ## YOUR TASK
  {task description from user}
  ```

REQ-RUN-004 (Priority: MUST):
- The skill MUST spawn a Task tool subagent with the assembled prompt
- Default model: inherit from parent session
- Overridable via: `/run-agent sec-filing-analyzer --model haiku "task"`

REQ-RUN-005 (Priority: MUST):
- The skill MUST update `meta.json` after each successful invocation:
  - Increment `invocation_count`
  - Update `last_used` timestamp
  - Use atomic file operations (write to temp file + rename) to prevent concurrent update corruption

REQ-RUN-006 (Priority: SHOULD):
- The skill SHOULD store the agent's output summary in MemoryGraph with tag `agent-output` and relationship to the agent definition memory

REQ-RUN-007 (Priority: COULD):
- The skill COULD support chaining: `/run-agent researcher "find X" | /run-agent coder "implement based on findings"`

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-RUN-001 | REQ-RUN-001 | Agent name not found | Error: "Agent '{name}' not found. Run /list-agents to see available agents." |
| EC-RUN-002 | REQ-RUN-002 | Total controllable context exceeds 15,000 tokens | Warn user with per-section breakdown; truncate in order: LEANN results first, then memory recall, then context.md; never truncate agent.md, behavior.md, or task |
| EC-RUN-003 | REQ-RUN-002 | MemoryGraph keys in memory-keys.json return empty results | Warn: "No memories found for key '{key}'. Proceeding without memory context." |
| EC-RUN-004 | REQ-RUN-001 | Task description is empty | Error: "Please provide a task description. Example: /run-agent {name} 'your task here'" |
| EC-RUN-005 | REQ-RUN-004 | Subagent fails (timeout, error, crash) | Report error to user; do NOT update invocation count; store error in MemoryGraph with tag `agent-error` |
| EC-RUN-006 | REQ-RUN-005 | Two concurrent `/run-agent` calls update same meta.json | Atomic write (temp + rename) prevents corruption; invocation count may be approximate under concurrency |
| EC-RUN-007 | REQ-RUN-002 | behavior.md was modified outside /adjust-behavior; MemoryGraph rules differ from file | Warn: "behavior.md was modified outside /adjust-behavior. File and MemoryGraph rules may be inconsistent. Run /adjust-behavior to reconcile." Inject both (file + MemoryGraph) but flag duplicates. |

---

### Feature 4: Tool Factory MCP Server

**Priority**: MUST

**Intent**: INT-AGENT-004 — Agents need the ability to create and register new tools at runtime for tasks that require custom computation.

#### Functional Requirements

REQ-TOOL-001 (Priority: MUST):
- A persistent MCP server MUST be pre-registered with Claude Code that provides dynamic tool management
- Registration: `claude mcp add tool-factory --transport stdio -- python src/tool-factory/server.py`

REQ-TOOL-002 (Priority: MUST):
- The tool factory MUST expose these management tools:
  - `add_tool(name, description, code, language, parameters, ttl_minutes)` — Register a new tool
  - `remove_tool(name)` — Unregister a tool
  - `list_tools(include_expired)` — List all dynamic tools
  - `view_source(name)` — Inspect tool source code
  - `update_tool(name, code?, description?, parameters?)` — Modify an existing tool

REQ-TOOL-003 (Priority: MUST):
- After `add_tool` or `remove_tool`, the server MUST send MCP `notifications/tools/list_changed` so Claude Code refreshes its tool list
- Tool factory internal registration: < 100ms p95
- Tool appearing in Claude Code's callable list: < 200ms p95 after `list_changed` sent

REQ-TOOL-004 (Priority: MUST):
- Dynamic tool code MUST execute in a subprocess with:
  - Timeout: 30 seconds (configurable per tool via `timeout_seconds` parameter)
  - Memory limit: 256MB (via `resource.setrlimit` on macOS/Linux)
  - Explicit environment variable allowlist (strip all vars; pass only `PATH`, `HOME`, `LANG`, `PYTHONPATH`; never pass secrets like `ANTHROPIC_API_KEY`, `AWS_*`, etc.)
  - `cwd` set to a temp directory (not the project root)
  - Note: File access restriction beyond cwd is best-effort on macOS (no seccomp/chroot). Acceptable for development environment. For production, tool factory should run in a Docker container (out of scope for this PRD).

REQ-TOOL-005 (Priority: MUST):
- Tool definitions MUST persist to disk at `.tool-factory/tools/{name}.json`
- `.tool-factory/` MUST be added to `.gitignore` (tool code is potentially untrusted; should not enter the repo)
- On server restart, all persisted tools MUST be reloaded automatically

REQ-TOOL-006 (Priority: MUST):
- Tools with `ttl_minutes > 0` MUST be automatically unregistered after their TTL expires
- Server MUST send `list_changed` notification on expiry

REQ-TOOL-007 (Priority: MUST):
- Tool names MUST be unique within the factory. Attempting to `add_tool` with a name that already exists MUST return an error: "Tool '{name}' already exists. Use update_tool to modify it."
- To modify, use `update_tool`

REQ-TOOL-008 (Priority: SHOULD):
- Tool creation events MUST be logged to `.god-agent/tool-factory.log` with timestamp, tool name, creator context, and code hash
- Tool metadata (name, description, creation date, usage count) SHOULD be stored in MemoryGraph with tag `dynamic-tool` for cross-session discoverability

REQ-TOOL-009 (Priority: SHOULD):
- Maximum number of active dynamic tools: 20 (configurable)
- If limit reached, `add_tool` MUST return an error with list of tools and their last-used times to help user decide what to remove

REQ-TOOL-010 (Priority: MUST):
- The `parameters` field in `add_tool` MUST accept JSON Schema format for input validation
- Tool invocations with invalid input MUST return a clear error, not crash

REQ-TOOL-011 (Priority: SHOULD):
- Tool names SHOULD be validated against a reserved word list (built-in Claude Code tool names and common MCP tool prefixes)
- If a tool name matches a built-in or existing MCP tool name (case-insensitive), warn: "Tool name '{name}' may conflict with existing tool '{existing}'. Consider a more specific name." Allow override with explicit confirmation.

#### Non-Functional Requirements

NFR-TOOL-001 (Category: Performance):
- Tool registration (add_tool → callable): < 200ms p95 end-to-end
- Tool execution overhead (factory dispatch, not tool code itself): < 50ms p95

NFR-TOOL-002 (Category: Security):
- Dynamic tool code MUST execute with an explicit environment variable allowlist (see REQ-TOOL-004)
- File access restriction outside cwd: best-effort on macOS (development environment)
- Tool code MUST NOT be able to spawn persistent background processes (enforced by subprocess timeout — process tree killed on timeout)
- Security model: development-grade, not production-grade. Documented as such.

NFR-TOOL-003 (Category: Reliability):
- If the tool factory server crashes, Claude Code's other tools MUST remain functional
- On restart, the factory MUST reload all persisted tools without manual intervention

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-TOOL-001 | REQ-TOOL-004 | Tool code enters infinite loop | Kill subprocess after timeout; return error: "Tool '{name}' timed out after {timeout}s" |
| EC-TOOL-002 | REQ-TOOL-004 | Tool code attempts to import dangerous modules (os.system, subprocess) | Allow — sandboxing is via subprocess isolation + env stripping, not import restriction. Log the import. |
| EC-TOOL-003 | REQ-TOOL-005 | Persisted tool JSON is corrupted | Log error; skip corrupt tool; continue loading others; warn on next `list_tools` call |
| EC-TOOL-004 | REQ-TOOL-002 | `add_tool` called with syntactically invalid Python/JS | Validate syntax before registration; return error with line number and message |
| EC-TOOL-005 | REQ-TOOL-006 | Tool expires while a subagent is actively using it | Allow the in-progress invocation to complete; expire after it returns |
| EC-TOOL-006 | REQ-TOOL-010 | Tool invoked with extra parameters not in schema | Ignore extra parameters; pass only schema-defined ones to tool code |
| EC-TOOL-007 | REQ-TOOL-011 | Tool name collides with built-in tool (e.g., "Read", "Bash") | Warn about potential LLM confusion; require explicit confirmation to proceed |

---

### Feature 5: Self-Directed Behavior Adjustment

**Priority**: MUST

**Intent**: INT-AGENT-005 — Agents need to modify their behavioral rules during execution, with changes persisting across invocations and automatic injection into future agent runs.

#### Functional Requirements

REQ-BEHAV-001 (Priority: MUST):
- A `/adjust-behavior` skill MUST accept a natural language behavior adjustment request
- Syntax: `/adjust-behavior {agent-name} "new rule or modification"`
- If no agent specified, adjusts global behavior rules

REQ-BEHAV-002 (Priority: MUST):
- The skill MUST implement LLM-mediated merging:
  1. Recall all active behavior rules for the target agent from MemoryGraph
  2. Format current rules as markdown
  3. Spawn a Task subagent (model: haiku for cost efficiency) with merge instructions
  4. **Validation step**: Diff the merged output against inputs. Flag: (a) any rule that was removed, (b) any rule that appears new (not in inputs or adjustment), (c) any rule whose wording changed beyond cosmetic cleanup. Present the diff to the user alongside the merged result.
  5. After user approval, parse merged output back into individual rules
  6. Store in MemoryGraph with version increment and `SUPERSEDES` relationship to previous version

REQ-BEHAV-003 (Priority: MUST):
- Behavior rules in MemoryGraph MUST use this schema:
  ```json
  {
    "type": "behavior_rule",
    "category": "communication|coding|delegation|analysis|quality",
    "rule": "free-form rule text",
    "priority": 1-100,
    "source": "user_request|auto_extracted|correction",
    "version": 3,
    "active": true,
    "agent_scope": "{agent-name}|global"
  }
  ```
  - `priority`: integer 1-100, higher number = higher priority
  - Tiebreaker when two rules have the same priority: most recently modified wins

REQ-BEHAV-004 (Priority: MUST):
- When `/run-agent` assembles the Context Envelope, it MUST auto-inject active behavior rules from MemoryGraph into the BEHAVIORAL RULES section
- Rules sorted by priority descending, then by modification date descending
- Agent-specific rules take precedence over global rules at the same priority level

REQ-BEHAV-005 (Priority: MUST):
- `/adjust-behavior` MUST show the proposed merged ruleset AND the diff against current rules to the user, and wait for explicit approval before storing

REQ-BEHAV-006 (Priority: SHOULD):
- A `/rollback-behavior {agent-name} {version}` command SHOULD allow reverting to a previous rule version
- Rollback creates a new version (does not delete history)

REQ-BEHAV-007 (Priority: COULD):
- Automatic rule extraction: periodically scan conversation history for standing instructions ("from now on...", "always...", "never...") and propose them as behavior rules
- Proposals MUST require user confirmation before activation (NEVER auto-apply)

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-BEHAV-001 | REQ-BEHAV-002 | New rule contradicts existing rule | Diff validation flags the conflict; present both rules to user with recommendation |
| EC-BEHAV-002 | REQ-BEHAV-004 | Agent has 50+ active behavior rules (context bloat) | Warn: "Agent has {n} behavior rules consuming ~{tokens} tokens. Consider consolidating with /adjust-behavior." |
| EC-BEHAV-003 | REQ-BEHAV-004 | Agent-specific rules conflict with global rules | Agent-specific rules take precedence; log the conflict at debug level |
| EC-BEHAV-004 | REQ-BEHAV-006 | Rollback to version that references deprecated MemoryGraph keys | Warn about stale references; apply rollback anyway |
| EC-BEHAV-005 | REQ-BEHAV-002 | Haiku merge model hallucinates a rule not in any input | Diff validation step (REQ-BEHAV-002 step 4) catches this as "new rule not in inputs"; flagged to user for review |

---

### Feature 6: `/list-agents` and `/archive-agent` Skills

**Priority**: SHOULD

**Intent**: INT-AGENT-006 — Users need lifecycle management to prevent agent proliferation.

#### Functional Requirements

REQ-LIST-001 (Priority: SHOULD):
- `/list-agents` MUST show all agents in `.claude/agents/custom/` with:
  - Name, creation date, last used date, invocation count, file count

REQ-LIST-002 (Priority: SHOULD):
- `/list-agents --verbose` MUST also show the first 3 lines of `agent.md` (role summary)

REQ-ARCHIVE-001 (Priority: COULD):
- `/archive-agent {name}` SHALL move the agent directory to `.claude/agents/archived/{name}/`
- Update MemoryGraph registration to mark as archived
- Archived agents do not appear in `/list-agents` unless `--all` flag is used

REQ-ARCHIVE-002 (Priority: COULD):
- `/restore-agent {name}` SHALL move an archived agent back to `custom/`

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-LIST-001 | REQ-LIST-001 | No agents exist | Show: "No custom agents found. Create one with /create-agent." |
| EC-LIST-002 | REQ-LIST-001 | Agent directory exists but is corrupted (missing agent.md) | Show agent with warning flag: "{name} [INVALID: missing agent.md]" |
| EC-ARCHIVE-001 | REQ-ARCHIVE-001 | Archiving an agent that is currently being invoked by /run-agent | Warn: "Agent '{name}' has a running invocation. Archive anyway?" Proceed on confirmation; running subagent is not affected (it already has the prompt). |

---

### Feature 7: Agent Self-Improvement System (Autolearn)

**Priority**: MUST

**Intent**: INT-AGENT-007 — Agents should autonomously improve their definitions over time by recording execution outcomes, analyzing results via LLM-as-judge, and evolving their definitions through targeted edits. Inspired by OpenSpace (HKUDS).

#### 7.1 Execution Recording

REQ-LEARN-001 (Priority: MUST):
- Every `/run-agent` invocation MUST produce an execution record with two components:
  - **MemoryGraph record** (lightweight, for querying):
    ```json
    {
      "type": "agent_execution",
      "agent_name": "sec-filing-analyzer",
      "task_description": "Analyze AAPL 10-K...",
      "task_completed_heuristic": true,
      "token_usage": 12500,
      "duration_ms": 45000,
      "model": "opus",
      "trace_file": ".claude/agents/traces/sec-filing-analyzer/2026-03-30T10-00-00.json",
      "timestamp": "2026-03-30T10:00:00Z",
      "tags": ["agent-execution", "sec-filing-analyzer"]
    }
    ```
  - **Trace file on disk** (full context, for analysis):
    ```json
    {
      "context_envelope": "... full assembled prompt ...",
      "agent_output": "... full Task tool return value ...",
      "task_description": "...",
      "agent_name": "sec-filing-analyzer",
      "user_feedback": null,
      "timestamp": "2026-03-30T10:00:00Z"
    }
    ```
    Stored at `.claude/agents/traces/{agent-name}/{timestamp}.json`
  - `task_completed_heuristic`: set to `true` if the Task subagent returned output without error, `false` if it errored/timed out. This is a heuristic — the post-task analysis (REQ-LEARN-003) may override it with a more accurate judgment.
  - Trace files are NOT stored in MemoryGraph (too large). MemoryGraph stores a reference path.

REQ-LEARN-002 (Priority: MUST):
- `meta.json` MUST be expanded with quality counters (inspired by OpenSpace):
  ```json
  {
    "created": "2026-03-30T10:00:00Z",
    "last_used": "2026-03-30T14:30:00Z",
    "version": 3,
    "generation": 2,
    "author": "user",
    "_note_version_vs_generation": "version increments on ANY definition file change (manual edit or evolution). generation increments ONLY on evolution actions (FIX, DERIVED, CAPTURED). Therefore generation <= version always holds.",
    "invocation_count": 15,
    "quality": {
      "total_selections": 15,
      "total_completions": 12,
      "total_fallbacks": 3,
      "applied_rate": 1.0,
      "completion_rate": 0.80,
      "effective_rate": 0.80,
      "fallback_rate": 0.20
    },
    "evolution_history_last_10": [
      {"version": 1, "generation": 0, "type": "CREATED", "date": "2026-03-30"},
      {"version": 2, "generation": 1, "type": "FIX", "date": "2026-03-30", "trigger": "post-task-analysis", "summary": "Added retry logic for EDGAR API timeouts"},
      {"version": 3, "generation": 2, "type": "DERIVED", "date": "2026-03-30", "trigger": "metric-monitor", "summary": "Specialized variant for quarterly vs annual filings"}
    ],
    "_note_history": "meta.json retains only last 10 entries. Full history available in MemoryGraph via /agent-history."
  }
  ```

#### 7.2 Post-Task Analysis (Trigger 1)

REQ-LEARN-003 (Priority: MUST):
- After every `/run-agent` invocation where `invocation_count >= 3` (subject to warm-up exclusion in REQ-LEARN-004), the system MUST run a post-task analysis:
  1. Read the trace file from disk (Context Envelope + full agent output + user feedback)
  2. Spawn a Task subagent (model: haiku) with analysis instructions. The analysis subagent is a **prompt-in/JSON-out call** (no tool access) for Phase 4. The orchestrator passes the trace content in the prompt. This is simpler and cheaper than OpenSpace's multi-iteration agent loop with tools — a known limitation that may be upgraded in Phase 5+.
  3. The analysis LLM produces a structured judgment:
     ```json
     {
       "task_completed": true,
       "completion_quality": "full|partial|failed",
       "agent_followed_role": true,
       "agent_followed_behavior_rules": true,
       "issues_identified": ["EDGAR API returned 429, no retry logic in context.md"],
       "evolution_suggestions": [
         {
           "type": "FIX",
           "target_file": "context.md",
           "direction": "Add EDGAR API rate limit handling: wait 100ms between requests, retry 3x on 429"
         }
       ]
     }
     ```
  4. Store analysis in MemoryGraph with tag `agent-analysis` and relationship to execution record
  5. Update quality counters in `meta.json` (deferred write — see REQ-LEARN-004)
  - If the user provided explicit feedback that contradicts the heuristic `task_completed_heuristic`, the analysis judgment's `task_completed` is authoritative and overrides the heuristic in quality counters.

REQ-LEARN-004 (Priority: MUST):
- **Execution model**: Post-task analysis runs INLINE after the agent output is displayed to the user. It is NOT background — Claude Code's Task tool is synchronous. The user sees the agent output first, then the system runs analysis as a brief Haiku call (~2-5 seconds). If the user issues a new command before analysis completes, analysis is cancelled and the invocation is marked as `unanalyzed` in MemoryGraph.
- **meta.json two-write pattern**: Write 1 (immediate, after Task returns): increment `invocation_count`, update `last_used`, set `task_completed_heuristic`. Write 2 (after analysis completes): update quality counters (`total_completions` or `total_fallbacks`, recalculate rates) using the analysis judgment's authoritative `task_completed`. Both writes use atomic file operations (temp + rename).
- If the user provides explicit feedback ("that was wrong", "perfect", correction text), it MUST be appended to the trace file before analysis runs
- Cost control: analysis uses model haiku; max 1 analysis per invocation; no analysis if `invocation_count < 3` (skip the first few warm-up runs to avoid analyzing cold-start noise)

#### 7.3 Evolution Modes

REQ-LEARN-005 (Priority: MUST):
- The system MUST support 3 evolution modes:

**FIX** — In-place repair of the current agent definition:
- Triggered when analysis identifies a specific issue in a specific file
- The **orchestrator** reads the current file content and passes it (along with analysis + recent traces) in the prompt to a Haiku subagent. The evolution LLM does NOT have tool access — it receives file content in its prompt and returns SEARCH/REPLACE edits as structured output. The orchestrator applies the edits using the Edit tool. (OpenSpace uses an agent loop with tools — this is a Phase 1 simplification; tool-access evolution is a Phase 5+ enhancement.)
- Produces targeted SEARCH/REPLACE edits to the file
- New version increments `generation` in meta.json; old version preserved in version DAG
- Old definition files backed up to `.claude/agents/versions/{name}/{version}/`
- **Constraint**: FIX evolution MUST NOT modify `behavior.md` directly. Behavioral changes MUST go through the `/adjust-behavior` pathway (REQ-BEHAV-002) to maintain MemoryGraph consistency. If the analysis suggests a behavioral change, the evolution produces a behavior adjustment proposal processed via `/adjust-behavior`, not a direct file edit.

**DERIVED** — Enhanced variant of the agent:
- Triggered when analysis suggests a specialized variant (e.g., "this agent works for annual filings but fails on quarterly")
- Creates a NEW agent directory: `.claude/agents/custom/{name}-v{generation}/`
- New agent inherits parent's files but with modifications
- Both parent and derived agent remain active (coexist)
- `meta.json` records `parent_agent: "{original-name}"` and `evolution_type: "DERIVED"`

**CAPTURED** — Extract new agent from a successful bare-reasoning execution:
- Triggered during two-phase fallback (see REQ-LEARN-007) when Phase 2 (no-agent fallback) succeeds
- The evolution LLM reads the successful execution trace and extracts a reusable agent definition
- Proposes a new agent with agent.md + context.md generated from the trace
- User must approve before creation (L1 autonomy)

REQ-LEARN-006 (Priority: MUST):
- ALL evolution actions MUST require user approval before modifying agent files:
  - Show: current file content, proposed changes (as diff), analysis that triggered the suggestion, evolution type (FIX/DERIVED/CAPTURED)
  - User can: approve, modify, or reject
  - This is L1 autonomy — the system proposes, the human decides
- Anti-loop guard: an agent definition MUST NOT be evolved more than once per invocation. If multiple suggestions exist, they are queued and presented together.
- Anti-loop guard: after evolution, the agent's quality counters reset (`total_selections=0`) so it needs fresh data before re-evaluation.

#### 7.4 Two-Phase Execution

REQ-LEARN-007 (Priority: SHOULD):
- `/run-agent` SHOULD support a `--fallback` flag that enables two-phase execution:
  - **Phase 1**: Execute with full agent definition (normal `/run-agent` behavior)
  - If Phase 1 output is judged as failed (by the post-task analysis):
    - **Phase 2**: Re-execute the same task with ONLY the task description (no agent.md, no context.md, no tools.md — just the bare task)
    - Phase 2 uses the same model but with a clean prompt
  - If Phase 2 succeeds, trigger a CAPTURED evolution to extract the successful approach
- Two-phase execution MUST be opt-in (not default) to avoid doubling cost on every invocation
- The user MUST be informed before Phase 2 starts: "Agent-guided execution appears to have failed. Try bare reasoning? (This will cost an additional ~$X)"

REQ-LEARN-008 (Priority: SHOULD):
- When Phase 2 succeeds and Phase 1 failed, the CAPTURED evolution SHOULD:
  1. Read both trace files (Phase 1 and Phase 2 outputs from `.claude/agents/traces/`)
  2. Pass both to a Sonnet subagent to identify what Phase 2 did differently
  3. Generate a new agent definition (agent.md + context.md) that incorporates the Phase 2 approach
  4. Present to user for approval

#### 7.5 Periodic Health Monitoring (Triggers 2 and 3)

REQ-LEARN-009 (Priority: SHOULD):
- Every 5 invocations of any agent, the system SHOULD run a health check:
  - If `fallback_rate > 40%` and `total_selections >= 5`: flag for evolution
  - If `completion_rate < 35%` and `total_selections >= 5`: flag for evolution
  - If `effective_rate < 55%` and `total_selections >= 5`: flag for evolution
  - Present flagged agents to user: "Agent '{name}' has been underperforming (effective_rate: {n}%). Would you like to review and evolve it?"

REQ-LEARN-010 (Priority: COULD):
- Tool quality tracking: if the tool factory's dynamic tools show degraded success rates, all agent definitions that reference those tools SHOULD be flagged for review
- This is Trigger 2 from OpenSpace — tool-level degradation propagated to dependent agent definitions

#### 7.6 Version DAG

REQ-LEARN-011 (Priority: MUST):
- Every evolution (FIX, DERIVED, CAPTURED) MUST create a version record:
  - **MemoryGraph record** (lightweight, for querying and DAG traversal):
    ```json
    {
      "type": "agent_version",
      "agent_name": "sec-filing-analyzer",
      "version": 3,
      "generation": 2,
      "evolution_type": "FIX",
      "parent_version": 2,
      "change_summary": "Added EDGAR API retry logic to context.md",
      "content_diff": "--- context.md\n+++ context.md\n@@ -5,3 +5,5 @@\n+## EDGAR Rate Limits\n+...",
      "snapshot_path": ".claude/agents/versions/sec-filing-analyzer/3/",
      "trigger": "post-task-analysis",
      "analysis_id": "mem-id-of-analysis",
      "timestamp": "2026-03-30T14:30:00Z",
      "tags": ["agent-version", "sec-filing-analyzer"]
    }
    ```
  - **Full content snapshot on disk** at `.claude/agents/versions/{name}/{version}/` — copy of all definition files at that version
  - MemoryGraph stores `content_diff` (compact) and `snapshot_path` (reference), NOT the full `content_snapshot` blob. This prevents MemoryGraph storage bloat.
  - Snapshots on disk SHOULD be retained for the last 5 versions. Older snapshots MAY be deleted; their `content_diff` and `change_summary` in MemoryGraph remain for lineage inspection.
- Relationships: `EVOLVED_FROM` → parent version, `TRIGGERED_BY` → analysis record

REQ-LEARN-012 (Priority: SHOULD):
- `/agent-history {name}` skill SHOULD show the version DAG:
  - Version, generation, evolution type, trigger, change summary, date
  - Quality counters at each version
  - Allow rollback to any previous version

#### 7.7 LLM Confirmation Gate

REQ-LEARN-014 (Priority: SHOULD):
- Before executing any evolution action triggered by periodic health monitoring (Trigger 3) or tool degradation (Trigger 2), the system SHOULD ask a Haiku LLM to confirm the evolution is warranted:
  - Input: current agent definition, proposed evolution type and direction, trigger context (quality metrics, tool issues)
  - Output: `{"confirmed": true/false, "reason": "..."}`
  - If `confirmed: false`, skip the evolution and log the decision in MemoryGraph
  - This gate does NOT apply to post-task analysis suggestions (Trigger 1) since those already have the full execution context
  - This gate does NOT apply to user-initiated `/evolve-agent` calls
  - Purpose: prevent false-positive triggers from wasting LLM calls and user review time

#### 7.8 `/evolve-agent` Skill (Manual Trigger)

REQ-LEARN-013 (Priority: SHOULD):
- `/evolve-agent {name}` SHOULD allow manually triggering evolution:
  - Retrieves recent execution analyses from MemoryGraph
  - Presents suggestions with diffs
  - User approves/modifies/rejects each suggestion
  - Useful when the user notices issues but doesn't want to wait for automatic triggers

#### Edge Cases

| EC ID | Related Req | Scenario | Expected Behavior |
|-------|-------------|----------|-------------------|
| EC-LEARN-001 | REQ-LEARN-003 | Post-task analysis Haiku model hallucinates a non-existent issue | Analysis stored but evolution suggestion requires user approval (REQ-LEARN-006); user catches the hallucination |
| EC-LEARN-002 | REQ-LEARN-005 | FIX evolution produces a worse agent definition | Quality counters reset after evolution; if new version performs worse, it will be flagged by periodic health check (REQ-LEARN-009) for further evolution or rollback |
| EC-LEARN-003 | REQ-LEARN-007 | Phase 2 fallback also fails | Record both failures; do NOT trigger CAPTURED evolution; increment fallback counter; flag agent for review |
| EC-LEARN-004 | REQ-LEARN-006 | Multiple evolution suggestions from a single invocation | Queue all suggestions; present together in one review session; apply approved ones sequentially |
| EC-LEARN-005 | REQ-LEARN-005 | DERIVED evolution creates an agent name that already exists | Append incrementing suffix: `{name}-v2`, `{name}-v3`, etc. |
| EC-LEARN-006 | REQ-LEARN-011 | MemoryGraph unavailable when storing version record | Store version locally in `.claude/agents/versions/{name}/{version}/meta.json`; sync to MemoryGraph when available |
| EC-LEARN-007 | REQ-LEARN-004 | User provides contradictory feedback ("good" then "actually that was wrong") | Use the most recent feedback; log the contradiction for the analysis LLM to consider |
| EC-LEARN-008 | REQ-LEARN-009 | Agent has exactly 5 invocations, all failures — health check triggers evolution on an agent that has never succeeded | Present to user with context: "This agent has never succeeded (0/5). Consider: (a) evolve, (b) delete and recreate, (c) manually edit." |

---

## 5. Non-Functional Requirements

NFR-001 (Category: Performance):
- `/create-agent` time from invocation to generated definition presented to user for review: < 30 seconds (user review time excluded)
- `/run-agent` context assembly (file reads + MemoryGraph recall + LEANN queries + prompt assembly): < 5 seconds

NFR-002 (Category: Usability):
- The `/create-agent` skill MUST accept a natural language description as its only required input. No references to file names, directory structures, or token limits MUST appear in the primary creation flow (errors and verbose output excluded).
- Running an agent MUST be a single command with no setup beyond the initial `/create-agent`

NFR-003 (Category: Maintainability):
- All skills MUST be implemented as Claude Code skill YAML files under `.claude/skills/`
- No new daemon processes required (tool factory is an MCP server managed by Claude Code, not a standalone daemon)

NFR-004 (Category: Compatibility):
- Agent definitions MUST be compatible with the SKILL.md standard where applicable
- Tool factory MCP server MUST work with Python 3.11+

NFR-005 (Category: Cost):
- Behavior adjustment merges MUST use model: haiku to minimize API cost
- Post-task analysis MUST use model: haiku ($0.001-0.005 per analysis)
- Evolution LLM calls MUST use model: haiku for FIX/DERIVED; sonnet for CAPTURED (more complex extraction)
- Token budgets (REQ-DEF-003) exist specifically to control cost per agent invocation
- Estimated cost per `/run-agent` invocation: $0.02-0.10 (Opus, 15K input + 5K output)
- Estimated cost per `/adjust-behavior` merge: $0.001-0.005 (Haiku)
- Estimated cost per post-task analysis: $0.001-0.005 (Haiku)
- Estimated cost per evolution action: $0.005-0.02 (Haiku/Sonnet)
- Two-phase fallback doubles the invocation cost — must be opt-in

NFR-006 (Category: Resilience):
- If MemoryGraph is unavailable during `/run-agent`, the skill MUST proceed with file-based context only (agent.md, context.md, tools.md, behavior.md, task) and warn: "MemoryGraph unavailable. Running without memory context."
- If MemoryGraph is unavailable during `/create-agent`, the skill MUST create the agent directory but warn: "MemoryGraph unavailable. Agent created locally but not registered for cross-session discovery. Run /create-agent --register {name} later."

---

## 6. Scope and Non-Scope

### In Scope (this PRD)

- Agent definition format (multi-file directory)
- `/create-agent` skill (generate from natural language)
- `/run-agent` skill (context assembly + Task tool invocation with confirmation step)
- Tool Factory MCP server (add/remove/list/view/update dynamic tools)
- `/adjust-behavior` skill (LLM-mediated merge + MemoryGraph storage)
- `/list-agents` and `/archive-agent` lifecycle skills
- Context Envelope specification (formalized parent → child context flow)
- LEANN integration in `/run-agent` (optional code context queries)
- Agent self-improvement system (execution recording, LLM analysis, FIX/DERIVED/CAPTURED evolution)
- Quality counters and version DAG in MemoryGraph
- Two-phase execution with fallback (opt-in)
- Periodic health monitoring with evolution triggers

### Out of Scope

- Web UI for agent management (CLI only)
- Agent marketplace / sharing / distribution
- Multi-user agent permissions
- Automated agent testing framework (future PRD; for now, Phase 1 tests are manual with defined acceptance criteria)
- Integration with `/god-code` pipeline (future enhancement, migrate incrementally after Phase 3)
- Plugin distribution format for the tool factory
- Docker sandboxing for tool factory (development environment only; production hardening is a future concern)
- Agent composition / inheritance (deferred; REQ-DEF-004 is COULD)
- `/edit-agent` skill (users can manually edit files in `.claude/agents/custom/{name}/`; a dedicated skill is a future enhancement)

### Note on Bash Wrapping

For ephemeral one-off computations, agents may use the Bash tool directly. The tool factory is for reusable, schema-validated tools that persist across invocations. Bash wrapping is not deprecated or replaced by the tool factory.

---

## 7. Guardrails and Constraints

| Guardrail ID | Constraint | Enforcement | Rationale |
|-------------|-----------|-------------|-----------|
| GR-001 | Custom agents CANNOT spawn subagents (depth=1) | REQ-CREATE-008 validates at creation; runtime error if attempted | Claude Code hard limit |
| GR-002 | Dynamic tool code runs in sandboxed subprocess | REQ-TOOL-004 (timeout, memory limit, env stripping, temp cwd) | Prevent runaway code from affecting the session |
| GR-003 | Behavior rule changes require user approval | REQ-BEHAV-005 (show diff + merged result, wait for confirmation) | Prevent uncontrolled behavior drift |
| GR-004 | Token budgets enforced per file and total | REQ-DEF-003 (hard limits with truncation warning) | Prevent context window exhaustion |
| GR-005 | Tool factory persisted files are gitignored | REQ-TOOL-005 (.tool-factory/ in .gitignore) | Prevent untrusted code from entering repo |
| GR-006 | `/run-agent` requires confirmation before spawning | REQ-RUN-001 (confirmation step per CLAUDE.md Prime Directive) | User always controls when agents execute |
| GR-007 | Haiku merge output is diff-validated before storage | REQ-BEHAV-002 step 4 (flag removed, new, or changed rules) | Prevent LLM hallucination in behavior rules |
| GR-008 | No secrets in dynamic tool environment | REQ-TOOL-004 (explicit env allowlist) | Prevent credential leakage via tool code |
| GR-009 | All evolution requires user approval | REQ-LEARN-006 (show diff, wait for confirmation) | Prevent autonomous agent definition mutation |
| GR-010 | Anti-loop: max 1 evolution per invocation | REQ-LEARN-006 (queue multiple suggestions) | Prevent runaway evolution cycles |
| GR-011 | Anti-loop: quality counters reset after evolution | REQ-LEARN-006 (total_selections=0 post-evolution) | Ensure fresh data before re-evaluation |
| GR-012 | Two-phase fallback is opt-in only | REQ-LEARN-007 (--fallback flag required) | Prevent doubling cost on every invocation |

---

## 8. Agent Implementation Details

### Agent Capability Assumptions

- **Model**: Claude Opus 4.6 (1M context) for primary agents; Claude Haiku 4.5 (200K context) for utility tasks (behavior merge)
- **Context budget**: 15,000 tokens controllable + ~4,100 tokens fixed overhead = ~19,100 tokens total per subagent invocation
- **Tools available to subagents**: All parent tools minus the Agent tool (prevents nesting). MCP tools inherited by default.
- **File system access**: Same workspace as parent. Subagents can read/write files.
- **Cost per invocation**: ~$0.02-0.10 (Opus, depends on output length)

### Agent Tooling and Access

| Tool Category | Available to Custom Agents | Notes |
|--------------|---------------------------|-------|
| Read/Write/Edit/Glob/Grep | YES | Standard file operations |
| Bash | YES | Shell execution |
| MCP tools (MemoryGraph, LEANN, etc.) | YES | Inherited from parent |
| Tool Factory dynamic tools | YES | Via `mcp__tool-factory__*` |
| Agent/Task tool | NO | Depth=1 constraint |
| Skills | NO (unless explicitly listed in frontmatter) | Must be declared |

### Autonomy Levels

| Component | Autonomy Level | Rationale |
|-----------|---------------|-----------|
| `/create-agent` generation | L1 (Operator) | Agent generates, human always reviews before saving |
| `/run-agent` execution | L1 (Operator) | Agent assembles context, human confirms before spawning |
| Tool Factory `add_tool` | L1 (Operator) | Agent proposes tool; human reviews code before registration |
| `/adjust-behavior` merge | L1 (Operator) | Agent merges rules; human always approves diff before storing |
| `meta.json` updates | L5 (Observer) | Fully automated bookkeeping |
| MemoryGraph registration | L5 (Observer) | Fully automated metadata storage |
| LEANN query execution | L5 (Observer) | Fully automated context retrieval |
| Post-task analysis | L5 (Observer) | Fully automated background analysis |
| Evolution suggestion | L1 (Operator) | System proposes changes; human always approves |
| Quality counter updates | L5 (Observer) | Fully automated bookkeeping |
| Two-phase fallback | L1 (Operator) | System asks user before entering Phase 2 |

---

## 9. Human Oversight Checkpoints

| Checkpoint | Trigger | Action | SLA |
|-----------|---------|--------|-----|
| HO-001: Agent definition review | `/create-agent` generates files | Show full definition to user; require "approve" / "revise" / "cancel" | Before any file write |
| HO-002: Agent invocation confirmation | `/run-agent` assembles context | Show token count + agent name; require "proceed" / "cancel" | Before Task tool spawn |
| HO-003: Tool code review | `add_tool` called | Show tool name, description, code, parameters; require approval | Before tool registration |
| HO-004: Behavior merge review | `/adjust-behavior` produces merged rules | Show diff (removed/added/changed rules) + merged result; require approval | Before MemoryGraph storage |
| HO-005: Token budget exceeded | Any definition file exceeds hard limit | Show breakdown per file; user decides: truncate or revise | Before context assembly completes |
| HO-006: Security warning | Tool code imports sensitive modules | Warn about security implications; user decides: proceed or cancel | Before tool registration |
| HO-007: Evolution review | Post-task analysis suggests FIX/DERIVED/CAPTURED | Show current content, proposed diff, trigger analysis; user approves/modifies/rejects | Before any agent file modification |
| HO-008: Phase 2 fallback | Phase 1 agent execution appears to have failed | Show failure assessment + cost estimate; user decides: try bare reasoning or stop | Before Phase 2 execution |
| HO-009: Underperforming agent | Periodic health check flags agent with low effective_rate | Show quality metrics + recent analyses; user decides: evolve, delete, manual edit | Before any evolution action |

---

## 10. Success Metrics

| Metric | Target | Measurement | Pass/Fail Threshold |
|--------|--------|-------------|---------------------|
| Agent creation time | < 60 seconds (invocation to approval prompt) | Timer in `/create-agent` skill | FAIL if > 90 seconds on 3 consecutive attempts |
| Agent invocation time | < 10 seconds to first subagent token | Timer in `/run-agent` skill | FAIL if > 15 seconds |
| Context assembly overhead | < 5 seconds | Timer for file reads + MemoryGraph + LEANN + assembly | FAIL if > 8 seconds |
| Agent output quality | >=7/9 preference parity vs manual prompt | Blind comparison on 3 reference agents, 3 tasks each (9 comparisons) | FAIL if < 7/9 parity |
| Tool factory registration | < 200ms end-to-end | Timer from add_tool call to tool callable | FAIL if > 500ms |
| Behavior rule persistence | 100% of approved rules recalled in next session | MemoryGraph recall verification after session restart | FAIL if any rule lost |
| Behavior merge accuracy | 0 hallucinated rules across 10 merge operations | Diff validation step catches hallucinations | FAIL if any hallucination passes validation |
| Agent invocations without corrections | >70% of invocations require zero user corrections | Track via MemoryGraph agent-output + agent-error tags | Informational (no fail threshold) |
| Post-task analysis completion | 100% of invocations (after warm-up) produce analysis | Count agent-analysis records vs agent-execution records | FAIL if < 95% after invocation 3 |
| Evolution suggestion rate | >=1 suggestion per 5 invocations (on average) | Count evolution suggestions across all analyses | Informational |
| Evolution acceptance rate | >50% of proposed evolutions approved by user | Track approved vs rejected in MemoryGraph | Informational |
| Effective rate improvement | Agents with 10+ invocations show effective_rate > 70% | quality.effective_rate from meta.json | FAIL if < 50% after 15 invocations |
| Version DAG integrity | 100% of evolutions produce version records | Count agent-version records vs approved evolutions | FAIL if any evolution lacks a version record |

---

## 11. Technical Constraints

TC-001: Subagent nesting depth is 1 (hard Claude Code limitation). All multi-step orchestration MUST happen at the parent level via sequential Task() calls.

TC-002: New MCP servers CANNOT be added mid-session. The tool factory MUST be pre-registered before the session starts.

TC-003: CLAUDE.md is auto-injected into every subagent (~2,100 tokens). This overhead is unavoidable and is OUTSIDE the controllable token budget.

TC-004: Subagents do NOT inherit the parent's auto memory (MEMORY.md). All context must be explicitly passed via the prompt parameter.

TC-005: Recommended controllable prompt range: 5,000-15,000 tokens for optimal quality/cost balance. Hard limit: model context window minus ~4,100 tokens overhead (~996K for Opus 1M, ~196K for Haiku 200K).

TC-006: MemoryGraph is the shared state bus between subagents. All cross-agent communication MUST go through MemoryGraph or file system, not in-process memory.

---

## 12. Implementation Phases

### Phase 1: Foundation (2-3 sessions)

**Dependencies**: None

| Task ID | Description | Deliverable | Priority |
|---------|-------------|-------------|----------|
| TASK-AGENT-001 | Agent definition format + template | `.claude/agents/custom/_template/` with all files + token budget worksheet | MUST |
| TASK-AGENT-002 | Tool Factory MCP server | `src/tool-factory/server.py` with 5 management tools, subprocess sandbox, disk persistence | MUST |
| TASK-AGENT-003 | Tool Factory registration + permissions | Settings.json config, `claude mcp add`, .gitignore update | MUST |
| TASK-AGENT-004 | `/create-agent` skill | Skill YAML + implementation + depth=1 validation | MUST |
| TASK-AGENT-005 | `/run-agent` skill | Skill YAML + Context Envelope assembly + LEANN integration + confirmation step | MUST |
| TASK-AGENT-006 | Test with 3 reference agents | SEC analyzer (pass: identifies 3+ risk factors from AAPL 10-K), code reviewer (pass: finds 5+ issues in a test file), doc writer (pass: generates valid README from project structure) | MUST |

**Exit criteria**: Can create an agent via `/create-agent`, invoke via `/run-agent` (with confirmation), and tool factory can register/execute dynamic tools. All 3 reference agent acceptance criteria pass.

**Empirical tests to resolve open questions**:
- OQ-001: Test ToolSearch with dynamic tools
- OQ-003: Test concurrent background subagent limits

### Phase 2: Behavior Adjustment (1-2 sessions)

**Dependencies**: Phase 1 (agent format, MemoryGraph patterns)

| Task ID | Description | Deliverable | Priority |
|---------|-------------|-------------|----------|
| TASK-AGENT-007 | Behavior rule schema in MemoryGraph | Storage pattern + SUPERSEDES/CONFLICTS_WITH relationships + priority 1-100 spec | MUST |
| TASK-AGENT-008 | `/adjust-behavior` skill | LLM merge + diff validation + MemoryGraph storage + versioning | MUST |
| TASK-AGENT-009 | Behavior injection in `/run-agent` | Auto-recall + priority sort + inject into Context Envelope | MUST |
| TASK-AGENT-010 | `/rollback-behavior` skill | Version rollback command | SHOULD |

**Exit criteria**: Can adjust behavior mid-session, diff validation catches hallucinated rules, changes persist with versioning, `/run-agent` auto-injects rules sorted by priority.

### Phase 3: Context Inheritance + Lifecycle (1-2 sessions)

**Dependencies**: Phase 1, Phase 2

| Task ID | Description | Deliverable | Priority |
|---------|-------------|-------------|----------|
| TASK-AGENT-011 | Context Envelope specification doc | Formal assembly protocol + token budget worksheet + truncation priority | MUST |
| TASK-AGENT-012 | Context assembly utility | Reusable template for Context Envelope assembly | SHOULD |
| TASK-AGENT-013 | `/list-agents` skill | Agent listing with metadata + invalid agent warnings | SHOULD |
| TASK-AGENT-014 | `/archive-agent` + `/restore-agent` skills | Lifecycle management | COULD |
| TASK-AGENT-015 | Automatic rule extraction from conversation | Propose standing instructions as behavior rules (requires user confirmation) | COULD |

**Exit criteria**: Full workflow from creation through multi-step orchestration with context inheritance, behavior adjustment, and lifecycle management.

### Phase 4: Autolearn System (2-3 sessions)

**Dependencies**: Phase 1 (agent format, /run-agent), Phase 2 (behavior adjustment patterns, MemoryGraph patterns)

| Task ID | Description | Deliverable | Priority |
|---------|-------------|-------------|----------|
| TASK-AGENT-016 | Execution recording in /run-agent | Structured execution records in MemoryGraph + quality counters in meta.json | MUST |
| TASK-AGENT-017 | Post-task analysis (Trigger 1) | Background Haiku analysis after every invocation; structured judgments stored in MemoryGraph | MUST |
| TASK-AGENT-018 | FIX evolution mode | LLM reads analysis + current file → produces SEARCH/REPLACE edits → user approves → apply + version DAG | MUST |
| TASK-AGENT-019 | DERIVED evolution mode | Create variant agent from parent + analysis suggestions → user approves → new agent directory | SHOULD |
| TASK-AGENT-020 | CAPTURED evolution mode | Extract agent definition from successful bare-reasoning trace → user approves → new agent | SHOULD |
| TASK-AGENT-021 | Two-phase execution (--fallback) | Phase 1 agent-guided + Phase 2 bare fallback with CAPTURED trigger | SHOULD |
| TASK-AGENT-022 | Periodic health monitoring (Triggers 2 & 3) | Every 5 invocations, check quality metrics, flag underperformers | SHOULD |
| TASK-AGENT-023 | `/evolve-agent` skill | Manual evolution trigger with analysis review | SHOULD |
| TASK-AGENT-024 | `/agent-history` skill | Version DAG viewer with rollback capability | SHOULD |
| TASK-AGENT-025 | Anti-loop guards | Max 1 evolution per invocation; counter reset post-evolution; LLM confirmation gate | MUST |

**Exit criteria**: After 10 invocations of a test agent with intentionally degraded context.md, the system: (a) records all 10 executions, (b) produces analyses for invocations 3-10, (c) suggests at least 1 FIX evolution, (d) after user-approved FIX, quality counters show improvement in subsequent invocations.

---

## 13. Risks and Mitigations

| Risk ID | Risk | Severity | Likelihood | Mitigation |
|---------|------|----------|-----------|------------|
| RISK-001 | Context window bloat from dynamic tools | HIGH | MEDIUM | Auto-expiry (TTL), max 20 tools, ToolSearch deferred loading (test in OQ-001) |
| RISK-002 | Behavior rule drift (agent self-modifies until rules diverge from intent) | MEDIUM | HIGH | Diff validation on every merge; version all changes with SUPERSEDES; rollback command; weekly review |
| RISK-003 | Prompt injection via dynamic tool code | HIGH | LOW | Subprocess sandbox (timeout + memory + env stripping); syntax validation; audit log; human review at HO-003 |
| RISK-004 | Token cost explosion from multi-agent workflows | HIGH | MEDIUM | Use haiku for utility tasks; enforce token budgets per file; cost estimates in NFR-005 |
| RISK-005 | Agent definition quality variance | MEDIUM | HIGH | Schema validation; human review at HO-001; 3 reference agents as quality benchmarks |
| RISK-006 | CLAUDE.md overhead wastes tokens | MEDIUM | CERTAIN | Accept ~2,100 token overhead (outside controllable budget); long-term: refactor CLAUDE.md to be shorter |
| RISK-007 | Tool factory server crash | MEDIUM | LOW | Persist to disk; auto-reload on restart; Claude Code handles stdio server lifecycle |
| RISK-008 | Haiku model hallucinates rules during behavior merge | MEDIUM | MEDIUM | Diff validation step (REQ-BEHAV-002 step 4) catches hallucinations before storage |
| RISK-009 | MemoryGraph unavailable | LOW | LOW | NFR-006 fallback: proceed with file-based context only; warn user |
| RISK-010 | Post-task analysis hallucinations produce bad evolution suggestions | HIGH | MEDIUM | User approval gate (GR-009); diff validation; anti-loop guards (GR-010, GR-011) |
| RISK-011 | Autolearn cost accumulation (analysis + evolution per invocation) | MEDIUM | HIGH | Use haiku for analysis; skip first 3 invocations; evolution is user-triggered not automatic; cost estimates shown at HO-008 |
| RISK-012 | Runaway evolution cycles (evolve → worse → evolve → worse) | HIGH | LOW | Anti-loop: counter reset, max 1 per invocation, LLM confirmation gate, periodic health check requires 5+ selections |
| RISK-013 | CAPTURED evolution extracts low-quality agent from a one-off success | MEDIUM | MEDIUM | User approval required; generated agent starts with quality counters at 0; flagged for review after 5 invocations |
| RISK-014 | Version DAG grows unbounded | LOW | MEDIUM | Archive old versions after 20+ generations; only keep content_snapshot for last 5 versions, diff-only for older |

---

## 14. Open Questions

OQ-001: Does ToolSearch (deferred loading) work with dynamically added MCP tools? If not, every dynamic tool consumes context window space permanently. **Action**: Test empirically in Phase 1. **Impact**: HIGH.

OQ-002: Does prompt caching reduce costs when spawning multiple subagents with the same agent definition but different tasks? **Action**: Measure token usage in Phase 1 testing. **Impact**: MEDIUM.

OQ-003: What is the practical concurrency limit for background subagents? Documentation suggests ~7, but hard ceiling is undocumented. **Action**: Test in Phase 1. **Impact**: MEDIUM.

OQ-004: Will Anthropic expose `createSdkMcpServer` for interactive Claude Code sessions, eliminating the need for an external tool factory? **Action**: Monitor release notes. **Impact**: LOW (would simplify but not block).

OQ-005: Should the `/god-code` pipeline adopt the Context Envelope pattern for its 48 agents? **Recommendation**: Migrate incrementally after Phase 3 stabilizes. **Impact**: LOW (enhancement, not blocker).

---

## 15. Success Criteria for Delivery

### Phase 1 Delivery Checklist

- [ ] Agent definition template exists at `.claude/agents/custom/_template/` with all files documented
- [ ] Token budget worksheet validated with real token counts (not estimates)
- [ ] Tool Factory MCP server starts, persists tools, reloads on restart
- [ ] `add_tool` → `list_changed` → callable in < 200ms (measured)
- [ ] Tool sandbox enforces timeout and env stripping (tested with malicious tool)
- [ ] `/create-agent` generates valid agent from natural language (3 test descriptions)
- [ ] `/create-agent` shows preview and waits for approval (human verified)
- [ ] `/run-agent` assembles Context Envelope within token budget (measured)
- [ ] `/run-agent` shows confirmation prompt before spawning (human verified)
- [ ] LEANN integration works when LEANN is running; gracefully skips when not
- [ ] 3 reference agents pass their acceptance criteria:
  - SEC analyzer: identifies 3+ risk factors from AAPL 10-K
  - Code reviewer: finds 5+ issues in a test file with known problems
  - Doc writer: generates valid, accurate README from project structure

### Phase 2 Delivery Checklist

- [ ] Behavior rules stored in MemoryGraph with correct schema
- [ ] `/adjust-behavior` produces diff showing removed/added/changed rules
- [ ] Diff validation catches intentionally hallucinated test rule
- [ ] Approved rules survive session restart (MemoryGraph recall test)
- [ ] `/run-agent` injects behavior rules sorted by priority
- [ ] Agent-specific rules override global rules at same priority

### Phase 3 Delivery Checklist

- [ ] Context Envelope spec document written with examples
- [ ] `/list-agents` shows all agents with correct metadata
- [ ] `/archive-agent` moves agent and updates MemoryGraph
- [ ] Full workflow test: create → adjust behavior → run → verify rules injected → archive

### Phase 4 Delivery Checklist

- [ ] Every `/run-agent` invocation produces an `agent_execution` record in MemoryGraph
- [ ] `meta.json` quality counters update correctly (completions, fallbacks, rates)
- [ ] Post-task analysis runs automatically for invocations 3+ and stores `agent_analysis` in MemoryGraph
- [ ] Analysis produces structured judgments with `evolution_suggestions`
- [ ] FIX evolution: given a deliberately flawed context.md, analysis identifies the issue, proposes a FIX, user approves, file is updated, version DAG records the change
- [ ] DERIVED evolution: given an agent that fails on a specific task variant, system proposes a specialized variant
- [ ] Anti-loop guards verified: (a) max 1 evolution per invocation, (b) counter reset post-evolution, (c) LLM confirmation prevents false-positive triggers
- [ ] Version DAG in MemoryGraph contains all versions with content snapshots and EVOLVED_FROM relationships
- [ ] `/evolve-agent` manual trigger retrieves recent analyses and presents suggestions
- [ ] `/agent-history` shows version lineage with quality metrics per version
- [ ] Integration test: 10 invocations of test agent with degraded context → analysis identifies issue → FIX approved → subsequent invocations show improved effective_rate

---

## 16. Traceability Matrix

| Intent | Requirements | Edge Cases | NFRs | Tasks | User Stories | Guardrails | Oversight |
|--------|-------------|------------|------|-------|-------------|------------|-----------|
| INT-AGENT-001 (Agent Format) | REQ-DEF-001..007 | EC-DEF-001..006 | NFR-003, NFR-004, NFR-006 | TASK-AGENT-001 | US-001 | GR-004 | HO-005 |
| INT-AGENT-002 (Create Agent) | REQ-CREATE-001..008 | EC-CREATE-001..003 | NFR-001, NFR-002 | TASK-AGENT-004 | US-001 | GR-001 | HO-001 |
| INT-AGENT-003 (Run Agent) | REQ-RUN-001..007 | EC-RUN-001..007 | NFR-001, NFR-005, NFR-006 | TASK-AGENT-005 | US-002 | GR-004, GR-006 | HO-002, HO-005 |
| INT-AGENT-004 (Tool Factory) | REQ-TOOL-001..011 | EC-TOOL-001..007 | NFR-TOOL-001..003 | TASK-AGENT-002, 003 | US-003 | GR-002, GR-005, GR-008 | HO-003, HO-006 |
| INT-AGENT-005 (Behavior Adj) | REQ-BEHAV-001..007 | EC-BEHAV-001..005 | NFR-005 | TASK-AGENT-007..010 | US-004 | GR-003, GR-007 | HO-004 |
| INT-AGENT-006 (Lifecycle) | REQ-LIST-001..002, REQ-ARCHIVE-001..002 | EC-LIST-001..002, EC-ARCHIVE-001 | — | TASK-AGENT-013, 014 | US-005 | — | — |
| INT-AGENT-007 (Autolearn) | REQ-LEARN-001..014 | EC-LEARN-001..008 | NFR-005 | TASK-AGENT-016..025 | US-006, US-007 | GR-009..012 | HO-007..009 |

---

## 17. Research References

| Document | Location | Purpose |
|----------|----------|---------|
| Agent Zero Original Research | `docs/research/agent-zero/summary.md` | Framework comparison |
| Tool Registration Research | `docs/research/agent-zero/tool-registration/summary.md` | MCP dynamic tool findings |
| Task Tool Limits Research | `docs/research/agent-zero/task-tool-limits/summary.md` | Subagent constraints |
| Source Analysis Research | `docs/research/agent-zero/source-analysis/summary.md` | Agent Zero internals |
| Cross-Track Synthesis | `docs/research/agent-zero/synthesis.md` | Unified recommendations |
| OpenSpace Research | `docs/research/agent-zero/openspace/summary.md` | Self-evolving skill engine patterns |
| AI Agent PRD Framework | `docs2/ai-agent-prd.md` | PRD template methodology |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-29 | Initial draft |
| 2.0.0 | 2026-03-29 | Addressed 30 review issues from adversarial review round 1. Fixed token budget arithmetic, added user stories, guardrails, oversight checkpoints, delivery checklists. Changed /run-agent to L1 with confirmation. Made success criteria measurable. Promoted LEANN and Feature 5 to MUST. Added diff validation, anti-hallucination, env allowlist, tool collision detection, concurrent meta.json handling. |
| 3.0.0 | 2026-03-30 | Added Feature 7: Agent Self-Improvement System (Autolearn), inspired by OpenSpace (HKUDS). 14 new requirements (REQ-LEARN-001..014), 8 edge cases (EC-LEARN-001..008), 10 new tasks (TASK-AGENT-016..025). Added execution recording (trace files on disk + MemoryGraph refs), LLM-as-judge post-task analysis (prompt-in/JSON-out, no tool access for Phase 4), FIX/DERIVED/CAPTURED evolution modes, version DAG (diffs in MemoryGraph, snapshots on disk), two-phase execution with fallback, periodic health monitoring, anti-loop guards + LLM confirmation gate. Fixed 3 HIGH issues from round 3 review: clarified data model (traces on disk vs summaries in graph), specified analysis subagent as no-tool-access, corrected "background" to inline execution model with two-write meta.json pattern. Fixed behavior.md evolution constraint (must go through /adjust-behavior). Added Phase 4 implementation plan. |
