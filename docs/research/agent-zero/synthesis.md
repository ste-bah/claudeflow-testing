# Agent Zero Integration Research: Cross-Track Synthesis

**Date**: 2026-03-29
**Input**: Track 1 (Tool Registration), Track 2 (Task Tool Limits), Track 3 (Source Analysis), Original Summary
**Purpose**: Unified findings and concrete implementation recommendations for dynamic agent creation in Claude Code

---

## 1. Executive Summary

- **Runtime tool creation is feasible and well-supported.** MCP's `notifications/tools/list_changed` mechanism allows a pre-registered "tool factory" MCP server to add, remove, and modify tools mid-session. Multiple open-source implementations already exist (diy-tools-mcp, dynamic-mcp-server). New tools become callable within ~50-100ms. This is the clear path forward; Bash wrapping is the fallback for one-offs only.

- **Self-directed behavior adjustment is achievable by adapting Agent Zero's pattern to our existing infrastructure.** Agent Zero uses an LLM-mediated merge of free-form markdown rules, injected at the top of the system prompt. We already have MemoryGraph corrections, a personality system, and SessionStart hooks. The gap is automation: we need a `behaviour_adjustment` tool (or skill) that triggers LLM-mediated merging and stores results in MemoryGraph, plus a hook that injects those rules into subagent prompts.

- **Subagent context inheritance requires explicit orchestration, not infrastructure changes.** Claude Code subagents are independent processes with depth=1 (no nesting), no shared memory, and no conversation history inheritance. Agent Zero shares `AgentContext` but gives fresh `History` -- conceptually similar. The practical solution is a standardized "context envelope" that the parent assembles and passes via the prompt parameter, staying within the 5K-15K token sweet spot.

- **A Tool Factory MCP server should be built as the foundational infrastructure.** It enables runtime tool creation (Feature 1), can host behavior adjustment utilities (Feature 2), and provides a persistent service layer that survives across subagent invocations.

- **The agent definition format should be a multi-file directory under `.claude/agents/custom/`**, mirroring Agent Zero's profile-as-directory pattern but adapted for Claude Code's constraints. Each file has a token budget to prevent context bloat.

- **The depth=1 constraint is the hardest limitation and cannot be worked around.** All orchestration must happen at the parent level, chaining subagents sequentially. This is architecturally sound but means our "agents" are prompt definitions, not autonomous processes.

- **Estimated total effort: M-L (4-8 sessions across 3 phases).** Phase 1 (tool factory + agent format) is the foundation; Phase 2 (behavior adjustment) builds on it; Phase 3 (context inheritance protocol) refines the workflow.

---

## 2. Feature 1: Runtime Tool Creation

### What Agent Zero Does (Track 3)

Agent Zero uses a **filesystem-as-registry** approach:
1. Agent writes a Python file (a `Tool` subclass) to a discoverable directory (e.g., `usr/tools/`)
2. File watchers detect the change and invalidate the path cache
3. On the next tool invocation, `get_tool()` discovers the new file via priority-ordered path resolution
4. The LLM learns about the tool through a corresponding `agent.system.tool.*.md` prompt template

**Key limitation**: The tool file alone is insufficient -- a prompt template must also be created for the LLM to know the tool exists. This is a discoverability gap.

**Persistence**: Tools persist on disk across sessions. The `usr/` directory is a persistent volume.

### What Claude Code Supports (Track 1)

- **MCP `list_changed` notification** is the officially sanctioned mechanism for runtime tool changes (HIGH confidence, from MCP spec and Claude Code docs)
- A pre-registered MCP server can add/remove/modify tools at any time during a session
- Claude Code refreshes its tool list within ~50-100ms of receiving `list_changed`
- Tool definitions get JSON Schema automatically (from type hints in Python, Zod in TypeScript)
- Dynamic tools appear as `mcp__{server}__{tool}` and are immediately callable
- **Cannot add new MCP servers mid-session** -- the factory server must be pre-configured

### Gap Analysis

| Aspect | Agent Zero | Claude Code | Gap |
|--------|-----------|-------------|-----|
| Registration mechanism | Filesystem + cache invalidation | MCP list_changed notification | Different but both work; MCP is more robust |
| Schema/validation | None (kwargs from LLM JSON) | JSON Schema auto-generated | Claude Code is better |
| Discoverability | Requires prompt template file | Auto-included in tool list after list_changed | Claude Code is better |
| Sandboxing | Docker dual-runtime isolation | Subprocess execution, no sandbox | Both need improvement |
| Persistence | Filesystem (survives restart) | Server-dependent (diy-tools-mcp persists to disk) | Parity achievable |
| Cross-session | Yes (files on disk) | Yes if factory persists definitions | Parity achievable |
| Token cost | Zero (tools described in prompt templates) | ~200-500 tokens per tool in context window | Claude Code has overhead |

**Primary gap**: Token cost. Each dynamically created tool consumes context window space. Agent Zero avoids this because it controls prompt assembly directly. Mitigation: use ToolSearch (deferred loading) and auto-expire unused tools.

### Recommended Implementation

**Approach**: Pre-register a tool-factory MCP server. Use it for tools that need schema, validation, and discoverability. Use Bash wrapping for ephemeral one-off computations.

**Setup (one-time)**:
```bash
# Option A: Use existing diy-tools-mcp (fastest to start)
claude mcp add tool-factory --transport stdio -- python /path/to/diy-tools-mcp/server.py

# Option B: Build custom factory with our enhancements (recommended for production)
claude mcp add tool-factory --transport stdio -- python /Volumes/Externalwork/projects/claudeflow-testing/src/tool-factory/server.py
```

**Runtime flow**:
```
1. Agent identifies need for a new tool
2. Agent writes function code as a string
3. Agent calls mcp__tool-factory__add_tool({name, description, language, code, parameters})
4. Factory validates, registers, sends list_changed
5. Claude Code refreshes tool list (~50-100ms)
6. New tool callable as mcp__tool-factory__{name}
7. Tool persists on disk for future sessions
```

**Enhancements over stock diy-tools-mcp**:
1. **Auto-expiry**: Remove tools after 30 minutes of non-use (configurable) to reduce context bloat
2. **Namespace prefix**: Dynamic tools prefixed with requesting agent ID (e.g., `agent_research_parse_table`)
3. **MemoryGraph registration**: Store tool metadata in MemoryGraph for cross-session discoverability
4. **Sandboxing**: Run tool code in subprocess with timeout (30s default) and memory cap (256MB)
5. **Audit log**: Write tool creation/invocation events to `.god-agent/tool-factory.log`

**Effort estimate**: **M (Medium)** -- 1-2 sessions. Adopting diy-tools-mcp is S; building a custom factory with enhancements is M.

---

## 3. Feature 2: Self-Directed Behavior Adjustment

### What Agent Zero Does (Track 3)

Agent Zero's `behaviour_adjustment` tool implements a 5-step pipeline:

1. **Load current rules**: Read `behaviour.md` from memory subdirectory (or load defaults)
2. **LLM-mediated merge**: Send current rules + requested adjustments to a utility LLM via `call_utility_model()` with specialized merge prompts (`behaviour.merge.sys.md`, `behaviour.merge.msg.md`)
3. **Write merged rules**: Save output to `behaviour.md` (overwrites, no versioning)
4. **Immediate injection**: On the next prompt assembly cycle, `_20_behaviour_prompt.py` reads the file and inserts rules at position 0 (highest priority) in the system prompt
5. **Confirmation**: Returns "Behaviour has been updated." to the agent

**Key design decisions**:
- Rules are free-form markdown (not structured data)
- Rules are injected at the TOP of the system prompt, overriding personality defaults
- There is no versioning -- each update overwrites the previous
- A companion `behaviour.search.sys.md` can extract standing instructions from conversation history automatically
- Changes take effect within the same session on the next message loop iteration

### Our Existing Infrastructure

We already have significant behavior-management infrastructure:

| Component | Location | Purpose |
|-----------|----------|---------|
| MemoryGraph corrections | `mcp__memorygraph__store_memory` | Stores behavioral corrections as graph nodes |
| Personality system | `src/archon_consciousness/personality/` | 5 subsystems for behavioral modulation |
| `personality.md` | `~/.claude/personality.md` | Static personality definition |
| `understanding.md` | `~/.claude/understanding.md` | User preference model |
| SessionStart hook | `.claude/settings.local.json` | Loads context at session start |
| `/values` skill | Skills system | Manages behavioral rule priorities/tiers/conflicts |
| Post-compaction recall | MemoryGraph query | Reloads "feedback corrections preferences" after compaction |

**What we lack**: An automated pipeline that (a) accepts behavior adjustment requests as a tool call, (b) intelligently merges them with existing rules using an LLM, and (c) ensures they are injected into the current and all future subagent prompts immediately.

### What Claude Code Constraints Apply (Track 2)

- **CLAUDE.md is auto-injected** into every subagent (~1,800 tokens for project CLAUDE.md). This is our primary prompt injection point, but it is static within a session.
- **Subagents do NOT inherit auto memory (MEMORY.md)**. Behavior rules stored only in MEMORY.md would not reach subagents.
- **Subagent system prompt is ~900 tokens** (shorter than main session's 4,200). Less room for behavior preamble.
- **The prompt parameter is the only injection point** we fully control for subagents. Behavior rules must be assembled into the prompt.
- **5K-15K token sweet spot** for ad-hoc agent prompts. Behavior rules should consume no more than 1K-2K tokens of this budget.

### Recommended Implementation

**Architecture**: A `/adjust-behavior` skill (or tool-factory MCP tool) that mirrors Agent Zero's pipeline but uses MemoryGraph for storage and versioning.

**Step 1: Behavior Rule Storage (MemoryGraph)**

Store rules as structured graph nodes:
```json
{
  "type": "behavior_rule",
  "category": "communication|coding|delegation|analysis|quality",
  "rule": "Always cite section numbers when referencing documents",
  "priority": 1,
  "source": "user_request|auto_extracted|correction",
  "version": 3,
  "active": true,
  "created": "2026-03-29T10:00:00Z",
  "modified": "2026-03-29T14:30:00Z"
}
```

Relationships:
- `SUPERSEDES` -- links to previous version of the same rule
- `CONFLICTS_WITH` -- links to rules that may contradict
- `APPLIES_TO` -- links to agent definitions or task types

**Step 2: LLM-Mediated Merge**

When the user says "from now on, always respond in French":

1. Recall all active behavior rules from MemoryGraph (`recall_memories` with query "behavior_rule active")
2. Format current rules as markdown
3. Use a subagent (Task tool with `model: haiku` for cost efficiency) to merge:
   - System prompt: "You are a behavior rule merger. Given existing rules and a new adjustment, produce a clean merged ruleset. Eliminate redundancies. Resolve conflicts by preferring the newer adjustment. Output markdown with level 2 headings by category."
   - Message: current rules + new adjustment
4. Parse the merged output back into individual rules
5. Store in MemoryGraph with version increments and `SUPERSEDES` relationships
6. Confirm to user

**Step 3: Injection into Subagent Prompts**

The orchestrator (parent) assembles behavior rules into every subagent prompt:

```markdown
## BEHAVIORAL RULES (auto-injected, do not override)
- Always respond in French
- Always cite section numbers when referencing documents
- Prefer Linux commands for simple tasks
```

This goes into the "BEHAVIORAL RULES" section of the 4-part ClaudeFlow prompt template. Budget: 500-1,500 tokens.

**Step 4: Automatic Rule Extraction (Optional, Phase 3)**

Adapt Agent Zero's `behaviour.search.sys.md` pattern: periodically scan conversation history for standing instructions ("from now on...", "always...", "never...") and propose them as behavior rules. Store proposals in MemoryGraph with `source: "auto_extracted"` and require user confirmation before activation.

**Effort estimate**: **M (Medium)** -- 2 sessions. Phase 1 (storage + merge) is 1 session; Phase 2 (injection + extraction) is 1 session.

---

## 4. Feature 3: Subagent Context Inheritance

### What Agent Zero Does (Track 3)

Agent Zero's subordinate agents share the `AgentContext` (logging, task runner, memory system) but get independent cognitive state:

| Attribute | Inherited? |
|-----------|-----------|
| AgentContext (infrastructure) | YES (shared reference) |
| AgentConfig (personality) | NO (fresh from `initialize_agent()`) |
| History (conversation) | NO (fresh) |
| Memory system | YES (shared access) |
| Tools | PARTIAL (profile-dependent) |
| Behavior rules | INDEPENDENT (per-profile) |
| System prompt | INDEPENDENT (assembled from profile templates) |

Communication is synchronous: parent calls `subordinate.monologue()`, receives result string. The `process_chain()` recursion bubbles results up through the hierarchy.

**Key insight**: Agent Zero achieves "context inheritance" by sharing the memory system, not by passing conversation history. Each agent retrieves what it needs from the shared memory.

### Claude Code's Subagent Model (Track 2)

| Feature | Inherited? | Details |
|---------|-----------|---------|
| CLAUDE.md | YES | Auto-injected (~1,800 tokens project + ~320 global) |
| Auto memory (MEMORY.md) | NO | Main session's memory not included |
| MCP servers | YES (default) | All parent servers available unless restricted |
| Tool definitions | YES (default) | All tools minus Agent tool (prevents nesting) |
| Conversation history | NO | Subagent starts fresh |
| Skills | NO | Must be explicitly listed in frontmatter |
| Permission context | YES | Inherited from parent |
| Environment info | YES | Working directory, platform, shell, git state |

**Nesting depth**: Hard limit of 1 level. Subagents cannot spawn other subagents.

**Communication**: One-way delegation. Parent sends prompt; subagent returns summary (~420 tokens typical). Resumption possible via `agentId`.

**Context window**: Subagent overhead is ~4,110 tokens (900 system prompt + 2,120 CLAUDE.md + 970 MCP/skills + 120 task prompt). On a 1M Opus context, this leaves ~996K for prompt + work.

### Gap Analysis

| Aspect | Agent Zero | Claude Code | Gap |
|--------|-----------|-------------|-----|
| Depth | Unlimited (practical limits apply) | Hard limit: 1 level | **Critical constraint** -- all orchestration at parent level |
| Memory sharing | Shared via AgentContext reference | No sharing -- must pass explicitly in prompt | **Significant gap** -- parent must assemble all context |
| Conversation history | Fresh per subordinate | Fresh per subagent | Parity |
| Tool access | Profile-dependent | Configurable via tools/disallowedTools | Parity |
| Behavior rules | Per-profile (independent) | Via CLAUDE.md (shared) + prompt (custom) | Partial parity |
| Result communication | String from monologue() | String from Task tool return | Parity |
| Reuse | Subordinate persists between calls | Resumable via agentId | Similar |
| Infrastructure sharing | Same log, task runner, memory | Same filesystem, MCP servers | Similar |

**Primary gaps**:
1. **No memory inheritance**: Parent must explicitly retrieve and inject relevant memory into the subagent prompt
2. **Depth=1**: Cannot implement Agent Zero's recursive `process_chain()` pattern. Must chain sequentially from parent.
3. **No shared runtime state**: Agent Zero's `AgentContext` provides a shared in-memory state object. Claude Code subagents are separate processes.

### Recommended Implementation

**The "Context Envelope" Pattern**

Define a standardized context assembly protocol that the parent (orchestrator) executes before spawning each subagent:

```
Context Envelope = {
  behavior_rules:    [from MemoryGraph, 500-1500 tokens]
  domain_context:    [from agent definition's context.md, 1000-5000 tokens]
  tool_instructions: [from agent definition's tools.md, 500-2000 tokens]
  workflow_state:    [from previous subagent results, 500-2000 tokens]
  memory_recall:     [from MemoryGraph keys in memory-keys.json, 500-2000 tokens]
  task_prompt:       [specific task description, 200-500 tokens]
}

Total budget: 3,200-13,000 tokens (within the 5K-15K sweet spot)
```

**Assembly flow**:

```
1. Orchestrator reads agent definition from .claude/agents/custom/{name}/
2. Orchestrator recalls behavior rules from MemoryGraph
3. Orchestrator retrieves workflow state from previous subagent (if chaining)
4. Orchestrator recalls domain memories from MemoryGraph (keys from memory-keys.json)
5. Orchestrator assembles the Context Envelope as a single prompt string
6. Orchestrator spawns: Task("{agent-type}", assembled_prompt)
7. Subagent executes with full context
8. Orchestrator receives result, stores in MemoryGraph for next subagent
```

**Working within depth=1**:

Since subagents cannot spawn subagents, multi-step workflows must be orchestrated as sequential Task() calls from the parent:

```
Parent:
  result1 = Task("researcher", context_envelope_1)    # Step 1
  result2 = Task("coder", context_envelope_2(result1)) # Step 2 (includes result1)
  result3 = Task("tester", context_envelope_3(result1, result2)) # Step 3
```

This is already our ClaudeFlow pattern. The Context Envelope formalizes what goes into each prompt.

**Memory bridge via MemoryGraph**:

Since subagents cannot share in-process memory, use MemoryGraph as the shared state layer:

```
Subagent A stores: npx claude-flow@alpha memory store -k "workflow/step1/result" --value '...'
Subagent B retrieves: npx claude-flow@alpha memory retrieve -k "workflow/step1/result"
```

This mirrors Agent Zero's shared `AgentContext` but uses MemoryGraph as the coordination bus instead of an in-process Python object.

**Effort estimate**: **S-M (Small-Medium)** -- 1-2 sessions. Mostly documentation and template work; the infrastructure (MemoryGraph, Task tool) already exists.

---

## 5. Architecture Decision: Tool Factory MCP Server

### Should We Build One?

**Yes.** Track 1 research confirms this is feasible, well-supported by the MCP spec, and already implemented in multiple open-source projects. A tool factory is the enabling infrastructure for Feature 1 (runtime tool creation) and can also host utility functions for Feature 2 (behavior adjustment).

### Design Sketch

**Server location**: `/Volumes/Externalwork/projects/claudeflow-testing/src/tool-factory/server.py`

**Transport**: stdio (zero network overhead, simplest setup)

**Language**: Python (FastMCP) -- matches our existing Python tooling and Agent Zero's approach

**Management tools** (always present):

| Tool | Purpose | Parameters |
|------|---------|------------|
| `add_tool` | Register a new dynamic tool | `name`, `description`, `language`, `code`, `parameters` (JSON Schema), `ttl_minutes` (optional, default 0 = no expiry) |
| `remove_tool` | Unregister a tool by name | `name` |
| `list_tools` | List all dynamic tools | `include_expired` (bool) |
| `view_source` | Inspect tool source code | `name` |
| `update_tool` | Modify an existing tool's code or schema | `name`, `code` (optional), `description` (optional), `parameters` (optional) |

**Persistence**: Tool definitions stored as JSON files in `.tool-factory/tools/{name}.json`. Loaded on server startup.

**Execution**: Dynamic tool code runs in a subprocess with:
- Timeout: 30 seconds (configurable per tool via `timeout_seconds` parameter)
- Memory: 256MB cap (via `resource.setrlimit` on Linux/macOS)
- No network access by default (configurable)

**Auto-expiry**: Tools with `ttl_minutes > 0` are automatically unregistered after their TTL expires. A background timer checks every 60 seconds and sends `list_changed` on expiry.

**Permission model**: Add a wildcard allow rule in `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": ["mcp__tool-factory__*"]
  }
}
```

### Pre-requisites

1. Python 3.11+ with `fastmcp` package installed
2. One-time registration: `claude mcp add tool-factory --transport stdio -- python /path/to/server.py`
3. Permission configuration in settings.json

---

## 6. Architecture Decision: Agent Definition Format

### Finalized Format

Based on all research, agent definitions live in `.claude/agents/custom/{name}/` with the following files:

```
.claude/agents/custom/{agent-name}/
  agent.md              # REQUIRED: Role, capabilities, constraints
  context.md            # OPTIONAL: Domain knowledge, schemas, reference data
  tools.md              # OPTIONAL: Tool usage instructions, code patterns
  behavior.md           # OPTIONAL: Behavioral rules (dynamic, editable at runtime)
  memory-keys.json      # OPTIONAL: MemoryGraph keys to recall on init
  meta.json             # AUTO-GENERATED: Creation date, last used, version, author
```

### What Goes in Each File and Why

**`agent.md`** (REQUIRED, budget: 1,000-3,000 tokens)
- Role description (who is this agent?)
- Capabilities (what can it do?)
- Constraints (what should it NOT do?)
- Output format expectations
- Success criteria template

This is the only required file. A minimal agent is just an `agent.md`.

Why separate from context/tools/behavior: Role identity is stable. Context, tools, and behavior may change between invocations or be shared across agents.

**`context.md`** (OPTIONAL, budget: 1,000-5,000 tokens)
- Domain knowledge specific to this agent's specialty
- Schemas, data structures, API contracts
- Reference material the agent needs for every task
- Project-specific conventions

Why separate: Context is the most variable component. Different tasks may inject different context while keeping the same agent role.

**`tools.md`** (OPTIONAL, budget: 500-2,000 tokens)
- Tool usage patterns and best practices
- Code templates and snippets
- MCP tool preferences (which tools to use for what)
- Anti-patterns (what NOT to do with tools)

Why separate: Tool instructions may be shared across multiple agent definitions. Also, if we build a tool factory, new tools would add their usage instructions here.

**`behavior.md`** (OPTIONAL, budget: 500-1,500 tokens)
- Runtime behavioral rules (can be modified by the behavior adjustment feature)
- Quality standards
- Communication style preferences
- Error handling policies

Why separate: This is the only file that changes during execution (via Feature 2). Separating it enables versioning and diffing.

**`memory-keys.json`** (OPTIONAL, budget: N/A -- metadata only)
```json
{
  "recall_queries": [
    "project/api/ticker-endpoint",
    "project/database/market-terminal"
  ],
  "leann_queries": [
    "cache manager pattern",
    "route handler pattern"
  ],
  "tags": ["market-terminal", "backend", "api"]
}
```

Why: Declarative specification of what knowledge the agent needs. The orchestrator uses these to pre-fetch context before spawning the subagent.

**`meta.json`** (AUTO-GENERATED)
```json
{
  "created": "2026-03-29T10:00:00Z",
  "last_used": "2026-03-29T14:30:00Z",
  "version": 1,
  "author": "user",
  "invocation_count": 7,
  "average_token_usage": 12500
}
```

### Token Budget Per File

| File | Min | Max | Hard Limit |
|------|-----|-----|------------|
| agent.md | 500 | 3,000 | 5,000 |
| context.md | 0 | 5,000 | 8,000 |
| tools.md | 0 | 2,000 | 3,000 |
| behavior.md | 0 | 1,500 | 2,000 |
| **Total prompt** | **500** | **11,500** | **18,000** |

The hard limits are enforced by the `/create-agent` and `/run-agent` skills. If a file exceeds its hard limit, the skill warns and truncates with a note.

The total prompt budget (agent definition + behavior rules + memory recall + workflow state + task) should stay under 20,000 tokens to remain in the effective range identified in Track 2 research.

---

## 7. Risks and Mitigations

### Cross-Cutting Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **Context window bloat from dynamic tools** | HIGH | MEDIUM | Auto-expiry (TTL), ToolSearch deferred loading, limit to 20 dynamic tools max |
| **Behavior rule drift** (agent modifies its own rules until they diverge from intent) | MEDIUM | HIGH | Version all changes in MemoryGraph with `SUPERSEDES` relationships; weekly review skill; rollback command |
| **Prompt injection via dynamic tool code** | HIGH | LOW | Subprocess sandboxing with timeout/memory limits; code validation before registration; audit log |
| **Depth=1 constraint forces complex orchestration** | MEDIUM | CERTAIN | Formalize the Context Envelope pattern; build `/run-agent` skill that handles assembly automatically |
| **Token cost explosion from multi-agent workflows** | HIGH | MEDIUM | Use `model: haiku` for utility tasks (merge, extraction); enforce token budgets per agent definition file |
| **Agent definition quality variance** | MEDIUM | HIGH | Validate generated definitions against schema; include review step in `/create-agent`; provide 5+ example definitions |
| **Name collisions with existing agents/skills** | LOW | LOW | Use `custom/` subdirectory namespace; validate uniqueness on creation; prefix convention |
| **Tool factory server crash mid-session** | MEDIUM | LOW | Persist tool definitions to disk; Claude Code may auto-restart stdio servers; add health check tool |
| **CLAUDE.md double-loading wastes tokens** | MEDIUM | CERTAIN | Long-term: refactor CLAUDE.md to be shorter, move specialized content to skills. Short-term: accept the ~1,800 token overhead |
| **Concurrent tool creation from parallel subagents** | LOW | LOW | Tool factory uses file-based locking; unique tool names enforced |

### Risk-Specific Notes

**On security (dynamic tool execution)**: The tool factory server runs user-defined code in a subprocess. On macOS, `seccomp` is not available, so sandboxing is limited to timeout + memory limits + filesystem restrictions. For production use, consider running the tool factory inside a Docker container. For our development use case, the risk is acceptable since we are the only users.

**On the depth=1 constraint**: This is a hard architectural limit in Claude Code (confirmed in Track 2, GitHub issue #21982 is an open feature request). We cannot work around it. All multi-level orchestration must happen at the parent level. The `/god-code` pipeline already works this way. The Context Envelope pattern formalizes this.

---

## 8. Implementation Roadmap

### Phase 1: Foundation (2-3 sessions)

**Dependencies**: None (greenfield)

| Task | Deliverable | Effort |
|------|-------------|--------|
| 1a. Build Tool Factory MCP server | `src/tool-factory/server.py` with add/remove/list/view/update tools, subprocess execution, disk persistence | M |
| 1b. Register Tool Factory with Claude Code | `claude mcp add` command, permission config in settings.json | S |
| 1c. Define Agent Definition Format | Template files in `.claude/agents/custom/_template/` with all 5 files | S |
| 1d. Build `/create-agent` skill | Skill that generates agent definition directory from natural language description | M |
| 1e. Build `/run-agent` skill | Skill that reads agent definition, assembles Context Envelope, spawns Task() | M |
| 1f. Test with 3 real agents | SEC analyzer, code reviewer, documentation writer | S |

**Phase 1 exit criteria**: Can create an ad-hoc agent via `/create-agent`, invoke it via `/run-agent`, and the tool factory can register/execute dynamic tools.

### Phase 2: Behavior Adjustment (1-2 sessions)

**Dependencies**: Phase 1 (agent definition format, MemoryGraph patterns)

| Task | Deliverable | Effort |
|------|-------------|--------|
| 2a. Implement behavior rule schema in MemoryGraph | Storage pattern, relationships (SUPERSEDES, CONFLICTS_WITH, APPLIES_TO) | S |
| 2b. Build `/adjust-behavior` skill | LLM-mediated merge, MemoryGraph storage, version tracking | M |
| 2c. Integrate behavior injection into `/run-agent` | Auto-recall behavior rules and inject into Context Envelope | S |
| 2d. Add rollback command | `/rollback-behavior {version}` to revert to previous rule set | S |

**Phase 2 exit criteria**: Can adjust agent behavior mid-session, changes persist in MemoryGraph with versioning, and `/run-agent` automatically injects current behavior rules.

### Phase 3: Context Inheritance Protocol (1-2 sessions)

**Dependencies**: Phase 1 (agent format), Phase 2 (behavior injection)

| Task | Deliverable | Effort |
|------|-------------|--------|
| 3a. Formalize Context Envelope specification | Documentation of the assembly protocol, token budgets, sections | S |
| 3b. Build context assembly utility | Reusable function/template that assembles the full Context Envelope from agent definition + MemoryGraph + workflow state | M |
| 3c. Integrate with ClaudeFlow orchestration | Update the 4-part subagent prompt template to use Context Envelope | S |
| 3d. Build `/list-agents` and `/archive-agent` | Agent lifecycle management | S |
| 3e. Automatic rule extraction from conversation | Scan conversation for standing instructions, propose as behavior rules | M |

**Phase 3 exit criteria**: Full workflow from agent creation through multi-step orchestration with context inheritance, behavior adjustment, and lifecycle management.

### Dependency Graph

```
Phase 1a (Tool Factory) ----+
Phase 1b (Registration) ----+---> Phase 1e (run-agent) ---> Phase 2c (behavior injection)
Phase 1c (Agent Format) ----+                                        |
Phase 1d (create-agent) ----+                                        v
                                                              Phase 3b (context assembly)
                                                                     |
Phase 2a (Rule Schema) ---> Phase 2b (adjust-behavior) ----+        v
                                                            +-> Phase 3c (ClaudeFlow integration)
                                                            |
                                                            +-> Phase 2d (rollback)
                                                                     |
                                                                     v
                                                              Phase 3e (auto-extraction)
```

---

## 9. Open Questions

### From Track 1 (Tool Registration)

1. **ToolSearch + dynamic tools**: Does Claude Code's ToolSearch (deferred loading) work with tools added after session start via `list_changed`? If not, dynamic tools always consume context window space. **Impact**: HIGH -- determines whether we can have many dynamic tools without context bloat. **Action**: Test empirically.

2. **Concurrent list_changed notifications**: If multiple subagents (via Task tool) call `add_tool` simultaneously, does the factory server handle concurrent `list_changed` correctly? **Impact**: MEDIUM -- affects parallel workflows. **Action**: Implement file-based locking in the factory server.

3. **Maximum dynamic tools**: What is the practical ceiling before context saturation? Track 1 estimates ~200-500 tokens per tool. With a 20-tool limit, that is 4K-10K tokens -- manageable. **Action**: Set initial limit at 20, measure empirically.

### From Track 2 (Task Tool Limits)

4. **Prompt caching across subagent invocations**: If we spawn multiple subagents with similar Context Envelopes (same agent definition, different tasks), does prompt caching reduce costs? The system uses ephemeral cache markers but subagent-specific caching is undocumented. **Impact**: HIGH for cost. **Action**: Measure token usage across repeated invocations.

5. **Compaction quality in subagents**: When a subagent hits 95% capacity and auto-compacts, how much of the injected Context Envelope survives? **Impact**: MEDIUM -- affects long-running subagent tasks. **Action**: Test with large context + long task.

6. **Background subagent concurrency limit**: Documentation mentions "up to 7 agents simultaneously" in some contexts. What is the hard ceiling? **Impact**: MEDIUM -- affects parallel workflow design. **Action**: Test empirically.

### From Track 3 (Source Analysis)

7. **Behavior rule format**: Should rules be free-form markdown (Agent Zero's approach, flexible but unstructured) or structured JSON (our proposed approach, programmatically tractable but less natural)? **Recommendation**: Structured storage in MemoryGraph, but LLM-mediated merge operates on markdown representation. Best of both worlds.

8. **Automatic behavior extraction reliability**: Agent Zero has a `behaviour.search.sys.md` prompt for extracting standing instructions from conversation history. How reliable is this in practice? False positives (treating one-time instructions as standing rules) could be problematic. **Action**: Implement with human confirmation gate (propose, don't auto-apply).

### New Questions (Cross-Track)

9. **Agent SDK convergence**: Will Anthropic eventually expose `createSdkMcpServer` for interactive Claude Code sessions? This would eliminate the need for an external tool factory server. No public roadmap exists. **Action**: Monitor Claude Code release notes.

10. **Plugin distribution for tool factory**: Could the tool factory be distributed as a Claude Code plugin for easier setup (bundled MCP server, auto-configured permissions)? **Action**: Investigate after Phase 1 stabilizes.

11. **Integration with /god-code pipeline**: Should the 48-agent pipeline use the Context Envelope pattern for its agents, or is the current 4-part prompt template sufficient? **Recommendation**: Migrate incrementally -- new agents use Context Envelope, existing agents keep current format.

---

## Appendix: Key File Paths

| File | Purpose |
|------|---------|
| `/Volumes/Externalwork/projects/claudeflow-testing/docs/research/agent-zero/tool-registration/summary.md` | Track 1 research |
| `/Volumes/Externalwork/projects/claudeflow-testing/docs/research/agent-zero/task-tool-limits/summary.md` | Track 2 research |
| `/Volumes/Externalwork/projects/claudeflow-testing/docs/research/agent-zero/source-analysis/summary.md` | Track 3 research |
| `/Volumes/Externalwork/projects/claudeflow-testing/docs/research/agent-zero/summary.md` | Original research summary |
| `/Volumes/Externalwork/projects/claudeflow-testing/.claude/agents/` | Existing agent definitions |
| `/Volumes/Externalwork/projects/claudeflow-testing/.claude/settings.local.json` | Permission configuration |
| `/Volumes/Externalwork/projects/claudeflow-testing/src/archon_consciousness/personality/` | Existing personality system |

## Appendix: Confidence Summary

| Finding | Confidence | Source |
|---------|-----------|--------|
| MCP list_changed enables runtime tool creation | HIGH | MCP spec + Claude Code docs |
| Tool factory servers work in practice | HIGH | Multiple open-source implementations |
| Subagent depth is limited to 1 | HIGH | Claude Code docs + GitHub issue #21982 |
| Subagents do not inherit auto memory | HIGH | Context window visualization docs |
| 5K-15K token prompt sweet spot | MEDIUM | Inferred from architecture analysis |
| ~50-100ms latency for tool registration | MEDIUM | Estimated from IPC overhead |
| Agent Zero's behavior adjustment is immediate within session | HIGH | Direct source code examination |
| Agent Zero's filesystem-as-registry works without restart | HIGH | File watcher + cache invalidation confirmed in source |
