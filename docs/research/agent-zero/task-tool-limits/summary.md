# Claude Code Task/Agent Tool: Context Limits and Architecture Research

**Date:** 2026-03-29
**Researcher:** Claude Opus 4.6 (1M context)
**Confidence levels:** HIGH = documented by Anthropic, MEDIUM = inferred from multiple sources, LOW = single source or speculation

---

## 1. Executive Summary

- **Subagents run in their own independent context window**, completely separate from the parent. The parent only sees the subagent's final text response (~420 tokens for a research task) plus a small metadata trailer.
- **Context window sizes are model-dependent**: Opus 4.6 and Sonnet 4.6 have native 1M-token context windows; Haiku 4.5 has 200K tokens. Subagents inherit the parent's model unless overridden.
- **Subagent system prompt overhead is approximately 3,790 tokens** for a general-purpose subagent (900 system prompt + 1,800 CLAUDE.md + 970 MCP/skills + 120 task prompt), based on the official context window visualization.
- **There is no documented hard limit on the `prompt` parameter size** passed to the Agent tool. The practical limit is the subagent's context window minus its system overhead (~3,790 tokens for general-purpose).
- **Subagents cannot spawn other subagents** -- this is a hard architectural constraint. The Agent tool is stripped from subagent tool lists to prevent recursion.

---

## 2. Task/Agent Tool Architecture

### How Subagents Work (Confidence: HIGH)

The Agent tool (formerly Task tool, renamed in v2.1.63; both names still work) spawns a **separate Claude Code agentic loop** with its own context window. This is not a shared-context fork; it is a fresh instance.

**Spawning flow:**
1. Parent agent calls `Agent` tool with parameters: `prompt`, `subagent_type` (optional), `model` (optional), `resume` (optional agentId)
2. System creates a new Claude instance with:
   - A specialized system prompt (shorter than the main session's)
   - Tool definitions appropriate to the subagent type
   - CLAUDE.md files (project + global)
   - MCP server connections (inherited or scoped)
   - The task prompt as the initial "user" message
3. Subagent runs its own agentic loop independently
4. Subagent returns its final text response + an `agentId` for potential resumption
5. Parent receives only this summary -- none of the subagent's file reads, tool outputs, or intermediate reasoning enter the parent's context

**Key architectural property:** The subagent is a subprocess, not a thread. It has its own token budget, its own compaction behavior, and its own transcript file stored at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.

### Communication Model (Confidence: HIGH)

- **One-way delegation**: Parent sends a task prompt; subagent returns a summary.
- **Resumption**: Parent can send a `SendMessage` with the agentId to resume a stopped subagent. The subagent retains its full conversation history.
- **No bidirectional communication**: Subagents cannot ask the parent questions (AskUserQuestion fails in background subagents). Foreground subagents can pass user questions through to the human.

**Source:** [Claude Code Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents)

---

## 3. Context Window Allocation

### What Consumes Tokens in a Subagent (Confidence: HIGH)

Based on the official context window visualization at `code.claude.com/docs/en/context-window`, a general-purpose subagent loads the following at startup:

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | ~900 | Shorter than the main session's 4,200-token system prompt |
| Project CLAUDE.md | ~1,800 | Same file as parent, loaded independently |
| Global ~/.claude/CLAUDE.md | ~320 | Loaded alongside project CLAUDE.md |
| MCP tools + skills | ~970 | Same tools as parent minus recursion-preventing exclusions |
| Task prompt from parent | ~120 | The actual delegation instruction |
| **Total startup overhead** | **~4,110** | Before the subagent does any work |

**Important caveats:**
- The main session's **auto memory (MEMORY.md) is NOT loaded** into the subagent. If the subagent has `memory:` in its frontmatter, it loads its own separate MEMORY.md.
- Built-in Explore and Plan agents **skip CLAUDE.md** for a smaller context footprint.
- The 4,200-token system prompt of the main session is replaced by a ~900-token subagent-specific prompt.

### Main Session Startup Overhead for Comparison (Confidence: HIGH)

| Component | Tokens |
|-----------|--------|
| System prompt | 4,200 |
| Auto memory (MEMORY.md) | 680 |
| Environment info | 280 |
| MCP tools (deferred names only) | 120 |
| Skill descriptions | 450 |
| Global CLAUDE.md | 320 |
| Project CLAUDE.md | 1,800 |
| **Total** | **~7,850** |

**Subagents save ~3,740 tokens** on system overhead vs. the main session, primarily by using a shorter system prompt and skipping auto memory.

**Source:** [Context Window Visualization](https://code.claude.com/docs/en/context-window)

---

## 4. Prompt Size Limits

### The `prompt` Parameter (Confidence: MEDIUM)

**There is no documented hard limit on the prompt parameter** passed to the Agent tool. The practical limit is determined by:

```
Available prompt space = Model context window - System overhead - Tool definitions - Expected work tokens
```

For a general-purpose subagent on Opus 4.6 (1M context):
```
~1,000,000 - ~4,110 (overhead) - ~N (tool definitions) - work_budget
= Theoretically up to ~995,000 tokens for the prompt parameter
```

For a general-purpose subagent on Haiku 4.5 (200K context):
```
~200,000 - ~4,110 (overhead) - ~N (tool definitions) - work_budget
= Theoretically up to ~195,000 tokens for the prompt parameter
```

**However, there are practical considerations:**

1. **The prompt parameter is a string in a tool call**. Claude Code's API client serializes it as JSON. There is no known string length limit in the API itself, but extremely large prompts (>50K tokens) would consume significant space before the subagent even starts working.

2. **Prompt caching**: Claude Code uses ephemeral cache control markers. Very large, unique prompts defeat caching and increase costs.

3. **Diminishing returns**: Anthropic's documentation warns about "context rot" -- accuracy and recall degrade as token count grows. A 50K-token prompt with a 200K context window leaves the subagent with only 150K tokens for all its work (reading files, running commands, reasoning).

### Practical Recommendation (Confidence: MEDIUM)

Based on the architecture, **a prompt of 5,000-15,000 tokens is the practical sweet spot** for ad-hoc agent definitions. This provides enough space for:
- Detailed system behavior instructions (~2,000-5,000 tokens)
- Domain-specific context/schemas (~2,000-5,000 tokens)
- Step-by-step workflow instructions (~1,000-3,000 tokens)
- Memory retrieval/storage instructions (~500-1,000 tokens)

Going beyond 15,000 tokens in the prompt parameter is technically possible but leaves less room for the subagent's actual work and risks context rot.

---

## 5. Inherited Context

### What Subagents Inherit Automatically (Confidence: HIGH)

| Feature | Inherited? | Details |
|---------|-----------|---------|
| CLAUDE.md (project + global) | YES | Loaded as system-reminder, counts against subagent's context |
| Auto memory (MEMORY.md) | NO | Main session's auto memory is not included |
| MCP server connections | YES (default) | All parent MCP servers available unless restricted via `tools` or `mcpServers` |
| Tool definitions | YES (default) | All parent tools inherited unless restricted. Agent tool excluded to prevent recursion |
| Skills | NO | Must be explicitly listed in `skills:` frontmatter |
| Permission context | YES | Inherited from parent session |
| Path-scoped rules | YES | Triggered when subagent reads matching files |
| Environment info | YES | Working directory, platform, shell, git state |
| Conversation history | NO | Subagent starts fresh |
| Hooks | PARTIAL | Subagent-specific hooks in frontmatter; parent session hooks for SubagentStart/SubagentStop |

### What Subagents Do NOT Get (Confidence: HIGH)

- Parent's conversation history or reasoning
- Parent's auto memory
- Parent's skill descriptions (unless explicitly loaded via `skills:` frontmatter)
- The Agent tool itself (prevents recursion)
- Plan mode controls (EnterPlanMode, ExitPlanMode)
- Background task tools

**Source:** [Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents), [Context Window Visualization](https://code.claude.com/docs/en/context-window)

---

## 6. Subagent Capabilities

### Tools Available (Confidence: HIGH)

By default, subagents inherit ALL tools from the parent conversation except:
- `Agent` (prevents recursive spawning)
- Plan mode controls
- Background task tools

Tools can be restricted via:
- **`tools` field (allowlist):** e.g., `tools: Read, Grep, Glob, Bash`
- **`disallowedTools` field (denylist):** e.g., `disallowedTools: Write, Edit`
- If both are set, `disallowedTools` is applied first, then `tools` resolves against remaining

### MCP Server Access (Confidence: HIGH)

- By default, subagents inherit all parent MCP server connections
- Can be scoped via `mcpServers:` frontmatter (inline definitions or references)
- Inline MCP servers are connected at subagent start and disconnected at finish
- MCP servers can be defined ONLY in a subagent (not in main session) to keep tool definitions out of parent context

### File Access (Confidence: HIGH)

- Subagents operate in the **same filesystem** as the parent
- They can read/write the same files unless tool restrictions prevent it
- With `isolation: worktree`, the subagent gets a **temporary git worktree** (isolated copy of the repository)
- Worktree is automatically cleaned up if the subagent makes no changes

### Nesting Depth (Confidence: HIGH)

**Hard limit: 1 level deep.** Subagents cannot spawn other subagents. The Agent tool is stripped from subagent tool lists. This is explicitly stated in documentation:

> "Subagents cannot spawn other subagents. If your workflow requires nested delegation, use Skills or chain subagents from the main conversation."

There is an active GitHub feature request (issue #21982) to enable hierarchical agent workflows, but as of March 2026, this restriction remains.

**Source:** [Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents), [GitHub Issue #21982](https://github.com/anthropics/claude-code/issues/21982)

---

## 7. Model-Specific Limits

### Context Windows (Confidence: HIGH)

| Model | Context Window | Max Output | Pricing (Input/Output per MTok) |
|-------|---------------|------------|--------------------------------|
| Claude Opus 4.6 | 1M tokens (native) | 128K tokens | $5 / $25 |
| Claude Sonnet 4.6 | 1M tokens (native) | 64K tokens | $3 / $15 |
| Claude Haiku 4.5 | 200K tokens | 64K tokens | $1 / $5 |
| Claude Sonnet 4.5 (legacy) | 200K (1M with beta header) | 64K tokens | $3 / $15 |
| Claude Opus 4.5 (legacy) | 200K tokens | 64K tokens | $5 / $25 |

### Subagent Model Override (Confidence: HIGH)

Model resolution order for subagents:
1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable (highest priority)
2. Per-invocation `model` parameter from parent
3. Subagent definition's `model` frontmatter
4. `inherit` (same model as main conversation, the default)

### Impact on Available Prompt Space

For a **Haiku subagent** (common for research/exploration):
- 200K context - ~4K overhead = ~196K available for prompt + work
- But Haiku's reasoning is weaker, so very large prompts may not be processed as effectively

For an **Opus subagent** with 1M context:
- 1M context - ~4K overhead = ~996K available for prompt + work
- But 1M context costs more and the "context rot" effect means quality degrades with very large contexts

**Source:** [Model Configuration](https://code.claude.com/docs/en/model-config), [Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)

---

## 8. Performance Characteristics

### Latency (Confidence: MEDIUM)

- Subagents start with a **cold context** -- they must gather context from scratch
- The built-in Explore agent uses Haiku for low latency
- General-purpose subagents inherit the parent model (often Opus), adding latency
- Prompt caching helps for repeated subagent invocations with similar system prompts
- Cache warmup requests have been observed (~13,050 input tokens for a minimal probe)

### Cost (Confidence: HIGH)

- **Multi-agent workflows use roughly 4-7x more tokens** than single-agent sessions
- **Agent Teams** (multi-session) use approximately 15x standard usage
- Background token usage for subagents is small (~$0.04/session for background processes)
- Each subagent maintains its own context window, so total token usage is roughly proportional to the number of subagents

### Compaction Behavior (Confidence: HIGH)

- Subagents support **auto-compaction** using the same logic as the main conversation
- Default trigger: ~95% capacity
- Configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (e.g., set to `50` for earlier compaction)
- Compaction events logged in subagent transcript files with `preTokens` count
- Subagent transcripts persist independently of main conversation compaction
- Transcripts cleaned up after 30 days (configurable via `cleanupPeriodDays`)

### Foreground vs Background (Confidence: HIGH)

- **Foreground**: Blocks parent until complete. Permission prompts pass through to user.
- **Background**: Runs concurrently. Permissions must be pre-approved. Clarifying questions fail silently. Press Ctrl+B to background a running task.
- Claude decides foreground vs background based on task; can be overridden.
- Set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` to disable all background tasks.

**Source:** [Manage Costs](https://code.claude.com/docs/en/costs), [Sub-agents Documentation](https://code.claude.com/docs/en/sub-agents)

---

## 9. Implications for Ad-Hoc Agent Definitions

### How Much Context Can We Inject via the Prompt Parameter?

Given the architecture, here is what happens when we pass a large prompt to an ad-hoc subagent (e.g., via `Task("agent-type", "<large prompt>")`):

**Token budget breakdown for a 1M-context Opus subagent:**

| Component | Tokens | Source |
|-----------|--------|--------|
| Subagent system prompt | ~900 | Auto-injected |
| CLAUDE.md (project + global) | ~2,120 | Auto-injected |
| MCP tools + skills | ~970 | Auto-injected |
| **Our task prompt** | **variable** | **What we control** |
| File reads during execution | variable | Subagent's work |
| Reasoning/output | variable | Subagent's work |
| **Total** | **~1,000,000** | Model limit |

**Practical allocation for ad-hoc agents:**

If we want the subagent to have ~50K tokens for file reads and reasoning:

```
Available for prompt = 1,000,000 - 3,990 (overhead) - 50,000 (work budget)
                     = ~946,000 tokens (theoretical maximum)
```

If we want the subagent to have ~200K tokens for substantial work:

```
Available for prompt = 1,000,000 - 3,990 - 200,000
                     = ~796,000 tokens
```

### What This Means for `context.md` + `tools.md` + `behavior.md` Injection

For the Agent Zero framework's ad-hoc agent definitions:

| Document | Typical Size | Fits Easily? |
|----------|-------------|-------------|
| `context.md` (domain knowledge) | 2,000-10,000 tokens | YES |
| `tools.md` (tool instructions) | 1,000-5,000 tokens | YES |
| `behavior.md` (behavioral rules) | 1,000-5,000 tokens | YES |
| Combined total | 4,000-20,000 tokens | YES |

Even with generous agent definitions of 20,000 tokens total, this consumes only ~2% of a 1M context window or ~10% of a 200K context window. **There is ample room.**

### CLAUDE.md Double-Loading Consideration

A critical consideration: **CLAUDE.md is auto-injected into every subagent**. If your CLAUDE.md is large (e.g., 5,000+ tokens), this overhead applies to every subagent invocation. The official recommendation is to keep CLAUDE.md under ~500 lines and move specialized instructions to skills.

In this project's case, CLAUDE.md is very large (the full instructions shown in the system prompt). This means every subagent in this project loads that entire CLAUDE.md, consuming significant context before the task prompt is even processed.

---

## 10. Recommendations

### Optimal Prompt Structure for Ad-Hoc Agents

Based on this research, the recommended structure for ad-hoc agent prompts is:

```markdown
## YOUR TASK
[Concise, specific task description — 200-500 tokens]

## CONTEXT
[Domain knowledge, schemas, constraints — 1,000-5,000 tokens]
[This is where context.md content goes]

## TOOLS AND PATTERNS
[Tool usage instructions, code patterns — 500-2,000 tokens]
[This is where tools.md content goes]

## BEHAVIORAL RULES
[Quality standards, output format, error handling — 500-2,000 tokens]
[This is where behavior.md content goes]

## WORKFLOW
[Step-by-step execution plan — 200-500 tokens]

## SUCCESS CRITERIA
[Verifiable completion conditions — 100-200 tokens]
```

**Total recommended prompt size: 2,500-10,200 tokens**

### Key Principles

1. **Keep prompts focused**: A 5K-10K token prompt is highly effective. Going beyond 20K tokens shows diminishing returns due to context rot.

2. **Don't duplicate CLAUDE.md content**: The subagent already gets CLAUDE.md automatically. Your prompt should supplement, not repeat.

3. **Use `model: haiku` for read-only research**: 200K context is sufficient for exploration, and Haiku is 5x cheaper than Opus.

4. **Scope MCP servers**: If a subagent doesn't need certain MCP servers, exclude them via `tools:` or `mcpServers:` to save context on tool definitions.

5. **Consider `isolation: worktree`** for write-heavy subagents working in parallel to prevent file conflicts.

6. **Use the `maxTurns` parameter** to prevent runaway subagents from consuming excessive tokens.

7. **Leverage `effort: low`** for straightforward tasks to reduce thinking token overhead.

8. **Chain subagents from parent** rather than trying to nest them. The parent sees each subagent's summary and can pass relevant context to the next.

---

## 11. Open Questions

### Definitively Unanswered

1. **Exact token limit for the `prompt` parameter**: No documentation states a hard limit. It likely maps to the model's context window minus system overhead, but this has not been empirically confirmed with very large prompts (>100K tokens).

2. **Tool definition token costs per tool**: The total MCP/skills overhead is ~970 tokens in the visualization, but we don't have per-tool breakdowns. Each MCP tool schema consumes tokens when loaded (deferred by default; loaded on demand).

3. **Compaction quality in subagents**: When a subagent hits 95% capacity and auto-compacts, how much task-relevant context survives? No quality metrics are published.

4. **Prompt caching behavior across subagent invocations**: If you spawn multiple subagents with similar prompts, does prompt caching kick in? The system uses ephemeral cache markers, but subagent-specific caching behavior is undocumented.

5. **Agent Teams vs. Subagents token efficiency**: Agent Teams (experimental) use ~15x tokens but enable bidirectional communication. The crossover point where Agent Teams become more efficient than chained subagents is unclear.

6. **Background subagent concurrency limit**: Documentation says "up to 7 agents simultaneously" for some operations, but the hard concurrency ceiling for background subagents is not specified.

7. **Impact of `effort: max` on subagent context consumption**: The `max` effort level has "no constraint on token spending" for thinking. In a subagent with limited context, this could rapidly fill the window with thinking tokens before useful work is done.

### Partially Answered

8. **What exactly is in the ~900-token subagent system prompt?** The Piebald-AI repository documents 285 tokens for "General purpose" and 494 tokens for "Explore" agent prompts. The ~900 figure from the visualization likely includes these plus environment info and basic instructions. The exact composition varies by subagent type.

9. **Can subagent prompts include structured data (JSON schemas, code examples)?** Yes -- the prompt is a plain string. Any text format works. However, very large JSON schemas should be stored as files and read by the subagent rather than injected into the prompt.

---

## Sources

- [Create Custom Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works)
- [Model Configuration](https://code.claude.com/docs/en/model-config)
- [Tools Reference](https://code.claude.com/docs/en/tools-reference)
- [Manage Costs Effectively](https://code.claude.com/docs/en/costs)
- [Explore the Context Window (Visualization)](https://code.claude.com/docs/en/context-window)
- [Context Windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Models Overview - Claude API Docs](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Claude Code System Prompts (Piebald-AI)](https://github.com/Piebald-AI/claude-code-system-prompts)
- [Tracing Claude Code's LLM Traffic (George Sung)](https://medium.com/@georgesung/tracing-claude-codes-llm-traffic-agentic-loop-sub-agents-tool-use-prompts-7796941806f5)
- [Claude Code Subagents: How the Task Tool Actually Distributes Work](https://medium.com/@neonmaxima/claude-code-subagents-how-the-task-tool-actually-distributes-work-e5fe19f48584)
- [The Task Tool: Claude Code's Agent Orchestration System (DEV.to)](https://dev.to/bhaidar/the-task-tool-claude-codes-agent-orchestration-system-4bf2)
- [Feature Request: Enable Task tool for subagents (GitHub #21982)](https://github.com/anthropics/claude-code/issues/21982)
