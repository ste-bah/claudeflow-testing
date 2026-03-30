# Agent Zero Integration Research

## Executive Summary

- **Agent Zero is a Python-based, prompt-driven agentic framework** (16.4k GitHub stars) that runs agents in Docker containers with full OS access, persistent memory, dynamic tool creation, and hierarchical multi-agent cooperation. It is designed as a general-purpose personal assistant that learns organically.
- **It overlaps heavily with our current setup** in core capabilities (multi-agent, memory, tools, extensions) but takes a fundamentally different architectural approach: Agent Zero is a standalone web-app runtime with its own UI, while our setup uses Claude Code as the execution substrate with MCP for coordination.
- **The valuable concept for us is not Agent Zero itself, but the agent definition format it uses** — specifically the combination of profile directories (prompts + tools + extensions) that can be created at runtime, which maps well to our "ad-hoc agent with custom point-in-time definitions" goal.
- **Direct integration is impractical and redundant.** Agent Zero would be a parallel runtime competing with Claude Code, not complementing it. The overhead of running a separate Python web server + Docker container for agent execution is not justified when Claude Code's Task tool already provides agent spawning.
- **The recommended path is to extract Agent Zero's best ideas** (profile-as-directory, dynamic prompt merging, behavior adjustment tool, SKILL.md compatibility) and implement them natively as a `/create-agent` skill within our existing Claude Code + MemoryGraph + LEANN stack.

---

## 1. What Agent Zero Is

### Architecture

Agent Zero is a **Python web application** (Flask/FastAPI backend, web UI frontend) that runs an agent loop:

1. **Message Loop**: User message arrives, system prompt is assembled from multiple markdown files, LLM is called, response is parsed for tool calls, tools execute, results feed back into the loop.
2. **Execution Environment**: The agent runs inside a Docker container (recommended) with full OS access — terminal, filesystem, network. It treats the operating system as its primary tool.
3. **Prompt Assembly**: The system prompt is composed from modular markdown files in `/prompts/` that are merged at runtime:
   - `agent.system.main.md` (hub file)
   - `agent.system.main.role.md` (role definition)
   - `agent.system.main.communication.md` (communication style)
   - `agent.system.main.solving.md` (problem-solving approach)
   - `agent.system.main.behaviour.md` (dynamic behavior rules)
   - `agent.system.main.environment.md` (runtime environment)
   - `agent.system.tools.md` (tool registry)
   - `agent.system.tool.*.md` (individual tool prompts)
4. **Extension Points**: Lifecycle hooks at 11 points (agent_init, before_main_llm_call, message_loop_start/end, monologue_start/end, reasoning_stream, response_stream, system_prompt, etc.).
5. **Web UI**: Real-time streamed output, chat management, settings panel, plugin hub.

### Agent Definition Format

Agents in Agent Zero are defined as **profile directories** under `/agents/`:

```
/agents/
  my_custom_agent/
    prompts/
      agent.system.main.role.md      # Override role
      agent.system.main.communication.md  # Override comms
      agent.system.tool.*.md         # Override/add tools
    tools/
      custom_tool.py                 # Python tool class
    extensions/
      agent_init/
        _10_custom_extension.py      # Lifecycle hook
```

Key characteristics:
- **Override-based**: Only files that differ from defaults need to be included. The framework merges custom profiles with defaults automatically.
- **Filename-based override**: When a file with the same name exists in both default and agent-specific locations, the agent-specific version wins.
- **Selected at runtime**: Agent profiles are selected via Settings in the web UI.
- **Variable placeholders**: Prompts support `{{var}}` syntax with runtime substitution (date_time, agent_name, number, tools, memory).
- **Dynamic variable loaders**: Python files with the same name as prompt files can generate variables at runtime.

### Key Features

| Feature | Details |
|---------|---------|
| **General-purpose assistant** | Not pre-programmed for specific tasks; learns from use |
| **Computer as tool** | Uses OS terminal/filesystem; creates its own tools dynamically |
| **Multi-agent hierarchy** | Superior/subordinate chain; each agent can spawn sub-agents |
| **Persistent memory** | RAG-based memory (vector DB) for storing solutions, facts, instructions |
| **Browser automation** | Built-in `_browser_agent` plugin using Playwright |
| **Plugin system** | Plugin Hub with install/security scan/update from community index |
| **SKILL.md standard** | Compatible with Claude Code, Cursor, Goose, Codex CLI, GitHub Copilot |
| **MCP support** | Can connect to MCP servers (documented in guides) |
| **A2A protocol** | Agent-to-Agent protocol support for external agent communication |
| **Projects** | Isolated workspaces with per-project memory, instructions, and secrets |
| **Dynamic behavior adjustment** | Agents can modify their own behavior rules at runtime via tool |
| **Speech-to-Text/TTS** | Built-in voice I/O |

### Technology Stack

- **Language**: Python (53.4% of codebase), JavaScript/TypeScript (frontend)
- **Runtime**: Docker (recommended), native install on macOS/Linux/Windows
- **LLM Providers**: OpenAI, Anthropic, Google Gemini, Azure, DeepSeek, Ollama, LM Studio, Groq, Hugging Face, Mistral, OpenRouter, Venice, xAI, SambaNova, GitHub Copilot
- **Memory**: Vector DB (likely ChromaDB or similar based on RAG features)
- **Web Server**: Python web framework with WebSocket support
- **Browser**: Playwright Chromium (headless)
- **Stars/Community**: 16.4k stars, 3.4k forks, 285 watchers; active development (commits within days of research date)

---

## 2. Comparison with Current Setup

| Feature | Agent Zero | Our Setup (Claude Code / Archon) | Gap / Overlap |
|---------|-----------|----------------------------------|---------------|
| **Execution model** | Standalone Python web app with agent loop | Claude Code CLI with Task tool for sub-agents | Different paradigms; not complementary |
| **LLM backbone** | Any provider via API (OpenAI-compat) | Claude Opus 4.6 (1M context) via Anthropic | We have best-in-class model; A0 is model-agnostic |
| **Agent definitions** | Profile directories (prompts + tools + extensions) | `.claude/agents/` markdown files + skills system | **A0 more structured** (separate prompt files per concern) |
| **Dynamic agent creation** | Clone/create profile dirs, select in UI | Task tool with inline prompts, no persistent definition | **Gap: we lack persistent ad-hoc agent definitions** |
| **Multi-agent** | Hierarchical superior/subordinate chains | 48-agent /god-code pipeline, Task tool spawning | Both strong; A0 is more dynamic, ours is more structured |
| **Memory** | Vector DB RAG, persistent across sessions | MemoryGraph (FalkorDB) + LanceDB + LEANN | **Our setup is superior** (graph + vector + code search) |
| **Tool creation** | Dynamic — agent writes Python tools at runtime | Tools defined in code/prompts; MCP for external tools | **A0 advantage**: runtime tool creation |
| **Extensions/Hooks** | 11 lifecycle extension points, Python classes | Hookify system, pre/post hooks, session hooks | Comparable; both support lifecycle events |
| **Plugin system** | Plugin Hub with community index, security scan | Skills system + MCP servers | A0 has better distribution; ours has deeper integration |
| **Code execution** | Full OS terminal access in Docker | Claude Code sandbox with bash tool | Both capable; A0 is less sandboxed |
| **Semantic search** | Memory RAG | LEANN (HNSW vector DB with code-specific embeddings) | **Our setup superior** for code search |
| **Web UI** | Built-in web chat interface | CLI-based (Claude Code terminal) | A0 has GUI; we are CLI-first |
| **MCP support** | Client (connects to MCP servers) | Both client and server (claude-flow MCP) | **Our MCP integration is deeper** |
| **SKILL.md** | Supported (compatible with Claude Code) | Native (our skills system originated from Anthropic) | Full overlap; interoperable |
| **Prompt system** | Modular .md files with variable substitution | CLAUDE.md + agent prompts + skill prompts | A0 is more granular (per-concern prompt files) |
| **Behavior adjustment** | Runtime behavior rules via LLM tool call | MemoryGraph corrections + personality.md | Conceptually similar; A0 is more automated |
| **Browser automation** | Built-in Playwright plugin | MCP Playwright integration available | Both capable |
| **Cost** | Open source (MIT-like license) + own API costs | Anthropic API costs + infrastructure | A0 adds additional API costs for its LLM calls |

### Where Agent Zero Adds Value We Don't Have

1. **Runtime tool creation**: Agent Zero agents can write Python tool scripts during execution and immediately use them. Our agents cannot create new MCP tools or Claude Code tools on the fly.
2. **Profile-as-directory agent definitions**: A structured, persistent, overridable agent profile format that separates role/communication/solving/behavior/tools into distinct files. Our current agents are single markdown files.
3. **Community plugin hub**: A marketplace for shareable agent capabilities with security scanning. We have no equivalent distribution mechanism for skills.
4. **Dynamic behavior adjustment tool**: An agent can modify its own behavior rules mid-conversation and persist them. Our behavior corrections go through MemoryGraph but are not as automated.

### Where Agent Zero Is Redundant

1. **Core agent execution**: We already have Task tool for sub-agent spawning with full context.
2. **Memory**: Our MemoryGraph + LanceDB + LEANN is more capable than Agent Zero's vector DB.
3. **Code execution**: Claude Code's bash tool in sandbox is sufficient and safer.
4. **Multi-agent orchestration**: Our /god-code pipeline with 48 agents is more structured and deterministic.
5. **MCP integration**: Our MCP server ecosystem is broader and deeper.

---

## 3. Integration Proposal: Ad-Hoc Agent Creation

### Concept

Instead of integrating Agent Zero as a runtime (which would mean running a separate Python web server alongside Claude Code), extract its best architectural ideas and implement a `/create-agent` skill that enables ad-hoc agent creation within our existing Claude Code environment.

The core insight from Agent Zero is: **an agent definition is a directory of override files that merge with defaults**. We can adopt this pattern.

### Agent Definition Format

Proposed format for ad-hoc agents, stored in `.claude/agents/custom/`:

```
.claude/agents/custom/
  {agent-name}/
    agent.md            # Main agent definition (role + capabilities)
    system-prompt.md    # Full system prompt override (optional)
    tools.md            # Tool instructions/constraints
    behavior.md         # Behavioral rules (dynamic, editable at runtime)
    context.md          # Domain knowledge to inject
    skills/             # Agent-specific skills (optional)
      SKILL.md
    memory-keys.json    # MemoryGraph keys this agent should recall
```

Key design decisions:
- **Markdown-first**: Consistent with our existing `.claude/agents/` convention.
- **Override-based**: An agent only needs `agent.md` at minimum; everything else is optional and merges with defaults.
- **Memory-aware**: `memory-keys.json` lists MemoryGraph keys the agent should recall on init, connecting ad-hoc agents to our persistent knowledge.
- **LEANN-aware**: Agent definitions can reference code patterns by LEANN search queries.

### Implementation Approach

#### Phase 1: `/create-agent` Skill (Minimal Viable)

A Claude Code skill that:
1. Accepts a natural language description of the desired agent.
2. Generates the agent definition files (agent.md, tools.md, behavior.md, context.md).
3. Stores the definition in `.claude/agents/custom/{name}/`.
4. Registers the agent in MemoryGraph for discoverability.
5. Returns a command to invoke the agent: `/run-agent {name} "task description"`.

#### Phase 2: `/run-agent` Skill

A companion skill that:
1. Reads the agent definition directory.
2. Assembles the system prompt from the component files.
3. Queries MemoryGraph for keys listed in `memory-keys.json`.
4. Optionally queries LEANN for relevant code context.
5. Spawns a Task tool sub-agent with the assembled prompt.
6. Captures the agent's output and stores results in MemoryGraph.

#### Phase 3: Dynamic Behavior (Optional)

Inspired by Agent Zero's behavior_adjustment tool:
1. The running agent can modify its own `behavior.md` file.
2. On next invocation, the updated rules are incorporated.
3. Behavior changes are tracked in MemoryGraph with timestamps.

### Minimal Viable Integration

The absolute minimum to achieve "create agents on the fly with custom point-in-time agent definitions":

```
/create-agent "SEC filing analyzer" --context "Analyzes 10-K and 10-Q filings for red flags" --tools "EDGAR API, financial calculations" --behavior "Always cite section numbers, flag material weaknesses"
```

This generates:

```
.claude/agents/custom/sec-filing-analyzer/
  agent.md       # Role: SEC filing analyst, capabilities, constraints
  context.md     # Domain knowledge about 10-K/10-Q structure
  tools.md       # EDGAR API patterns, financial formulas
  behavior.md    # Citation rules, flagging criteria
```

Then invoke with:

```
/run-agent sec-filing-analyzer "Analyze AAPL's latest 10-K for revenue recognition risks"
```

Which internally does:

```python
# Pseudocode for /run-agent
agent_dir = ".claude/agents/custom/sec-filing-analyzer/"
system_prompt = read("agent.md") + read("context.md") + read("tools.md") + read("behavior.md")
memory_context = memorygraph.recall(agent.memory_keys)
leann_context = leann.search(agent.code_queries) if agent.code_queries else ""
Task("sec-filing-analyzer", system_prompt + memory_context + leann_context + user_task)
```

### Architecture Diagram (Text)

```
User
  |
  v
/create-agent "description"          /run-agent {name} "task"
  |                                     |
  v                                     v
[Create Agent Skill]              [Run Agent Skill]
  |                                     |
  | generates                           | reads
  v                                     v
.claude/agents/custom/{name}/     .claude/agents/custom/{name}/
  agent.md                            agent.md
  context.md                          context.md
  tools.md                            tools.md
  behavior.md                         behavior.md
  memory-keys.json                    memory-keys.json
  |                                     |
  | registers                           | assembles prompt
  v                                     |
MemoryGraph                             | queries
  (agent registry)                      v
                                   MemoryGraph + LEANN
                                        |
                                        | spawns
                                        v
                                   Claude Code Task Tool
                                   (sub-agent with assembled prompt)
                                        |
                                        | results
                                        v
                                   MemoryGraph
                                   (stores output + learning)
```

---

## 4. Risks and Concerns

### Technical Risks

1. **Prompt bloat**: Assembling agent.md + context.md + tools.md + behavior.md + memory recall + LEANN results could consume significant context window. Mitigation: enforce size limits per file (e.g., 2000 tokens each), use summarization for memory/LEANN results.

2. **Definition drift**: If agents modify their own behavior.md, definitions could diverge from original intent over time. Mitigation: version behavior.md changes in git, store diff history in MemoryGraph.

3. **Name collisions**: Ad-hoc agents could clash with existing `.claude/agents/` definitions. Mitigation: use the `custom/` subdirectory namespace, validate uniqueness on creation.

4. **Quality variance**: LLM-generated agent definitions may be inconsistent in quality. Mitigation: validate generated definitions against a schema, include a review step.

### Architectural Risks

5. **Scope creep toward Agent Zero**: The temptation to keep adding features (plugin hub, web UI, dynamic tool creation) until we have rebuilt Agent Zero. Mitigation: strict scope — agent definitions are just structured prompts, not a separate runtime.

6. **Redundancy with existing skills**: Some ad-hoc agents may duplicate what skills already do. Mitigation: `/create-agent` should check existing skills and agents before creating new ones.

### Operational Risks

7. **Agent proliferation**: Users may create many ad-hoc agents and lose track. Mitigation: `/list-agents` command, MemoryGraph registry with last-used timestamps, auto-archive after N days of disuse.

8. **Security**: Agent definitions could contain prompt injection or unsafe instructions. Mitigation: review generated definitions before first use, never auto-execute untrusted agent definitions.

---

## 5. Recommendation

### Do NOT integrate Agent Zero as a runtime

Running Agent Zero alongside Claude Code would mean:
- A separate Python web server process
- A separate Docker container for agent execution
- A separate memory system (its vector DB vs our MemoryGraph)
- A separate UI (its web chat vs our CLI)
- Doubled API costs (Agent Zero calling its own LLM + Claude Code calling Opus)
- No meaningful interop between the two agent systems

This adds complexity without proportional value. Our Claude Code + Opus 4.6 setup already exceeds Agent Zero's capabilities for code-focused work.

### DO extract these ideas from Agent Zero

1. **Profile-as-directory pattern**: Multi-file agent definitions that separate concerns (role, communication, tools, behavior, context). Implement as `.claude/agents/custom/{name}/` directories.

2. **Override-based merging**: Agent definitions specify only what differs from defaults. A base agent template provides sensible defaults for communication style, tool usage, and behavior.

3. **Dynamic behavior adjustment**: Let running agents modify their own behavior rules (stored in behavior.md and MemoryGraph) for self-improvement across invocations.

4. **SKILL.md interoperability**: Agent Zero's adoption of the SKILL.md standard confirms it as the right format. Our ad-hoc agents should be able to reference and use SKILL.md files.

### Implementation Priority

1. **Phase 1** (1-2 sessions): Build `/create-agent` and `/run-agent` skills. Minimal format: agent.md + context.md. Test with 3-5 ad-hoc agents for real tasks.

2. **Phase 2** (1 session): Add MemoryGraph integration (memory-keys.json, agent registry, result storage). Add LEANN code context injection.

3. **Phase 3** (optional): Add dynamic behavior adjustment, agent versioning, `/list-agents` and `/archive-agent` commands.

This approach gives us the "create agents on the fly with custom point-in-time agent definitions" capability the user wants, using Agent Zero's best ideas, without the overhead of integrating a separate framework.
