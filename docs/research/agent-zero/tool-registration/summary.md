# Tool Registration Internals: Deep Research Summary

**Date**: 2026-03-29
**Scope**: Claude Code tool registration, MCP dynamic tools, runtime tool creation feasibility
**Confidence Legend**: HIGH = verified from official docs/spec, MEDIUM = inferred from multiple sources, LOW = educated speculation

---

## 1. Executive Summary

- **MCP is the only mechanism for extending Claude Code's tool set.** Built-in tools (Read, Write, Bash, Edit, Glob, Grep, Task, etc.) are hardcoded into the Claude Code harness; there is no plugin API or hook that can register new callable tools outside of MCP. [HIGH confidence]
- **MCP explicitly supports dynamic tool registration at runtime.** The `notifications/tools/list_changed` notification allows servers to add, remove, or modify tools after the initial handshake. Claude Code has supported this since at least v2.0.10. [HIGH confidence]
- **A "tool factory" MCP server is not only feasible but already exists** in multiple open-source implementations (diy-tools-mcp, dynamic-mcp-server, dynamic-tool-mcp-server). An agent can define a Python function, send it to the factory server's `add_tool` management tool, and the new tool becomes immediately callable. [HIGH confidence]
- **The minimum viable MCP server is approximately 7 lines of Python** using FastMCP (part of the official MCP Python SDK). A stdio-based server can be started by Claude Code and communicate over stdin/stdout with zero network overhead. [HIGH confidence]
- **Bash wrapping is the simplest alternative** but has significant limitations (no schema validation, no discoverability, output parsing burden on the model). For our use case, a persistent tool-factory MCP server is the recommended path. [HIGH confidence]

---

## 2. Claude Code Tool Architecture

### 2.1 Tool Categories

Claude Code operates with three distinct tool layers:

| Category | Examples | Registration | Modifiable at Runtime |
|----------|----------|-------------|----------------------|
| **Built-in tools** | Read, Write, Edit, Bash, Glob, Grep, Task, Skill, WebSearch, WebFetch, ToolSearch | Hardcoded in harness | No (can be enabled/disabled via `tools` option in Agent SDK) |
| **MCP tools** | Any tool from an MCP server, prefixed `mcp__{server}__{tool}` | Via MCP server connection | Yes (servers can add/remove tools via `list_changed`) |
| **Deferred tools** | Tools listed in system reminders but not yet loaded | Fetched on-demand via ToolSearch | N/A (fetched once, then behave like MCP tools) |

Source: [Claude Code Tools Reference](https://code.claude.com/docs/en/tools-reference), [Claude Code Built-in Tools](https://www.vtrivedy.com/posts/claudecode-tools-reference)

### 2.2 Tool Dispatch Architecture

The Claude Code harness uses a **permission-based dispatch map**:

1. Each tool has a unique name (built-in: `Read`, `Bash`; MCP: `mcp__server__tool`)
2. Tool definitions (name, description, JSON Schema for input) are included in the system prompt sent to the model
3. The model selects a tool and provides arguments
4. The harness validates against the permission system (`allow`/`deny` lists in settings.json)
5. PreToolUse hooks execute (can block with `{"decision": "deny"}`)
6. The tool handler executes
7. PostToolUse hooks execute
8. Result is returned to the model

There is **no public API to register a new handler** into the built-in dispatch map. The only extension point is MCP.

### 2.3 Agent SDK Custom Tools

The Claude Agent SDK (for programmatic use, not interactive Claude Code) provides `tool()` / `@tool` helpers that create tools and wrap them in an **in-process MCP server** via `createSdkMcpServer` / `create_sdk_mcp_server`. This confirms that even Anthropic's own custom tool mechanism is built on top of MCP -- there is no separate tool registration pathway.

Source: [Agent SDK Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)

---

## 3. MCP Registration Mechanisms

### 3.1 How MCP Servers Are Added to Claude Code

Three configuration methods exist:

| Method | Command | Persistence | Scope |
|--------|---------|-------------|-------|
| **CLI** | `claude mcp add <name> -- <command>` | Persisted to config | local/project/user |
| **Config file** | Edit `~/.claude.json` or `.mcp.json` directly | Persisted | Depends on file |
| **Plugin** | `.mcp.json` at plugin root | Plugin lifecycle | Plugin scope |

Configuration locations:
- `~/.claude.json` -- user-scope and local-scope servers
- `.mcp.json` at project root -- project-scope (version-controlled)
- `managed-mcp.json` -- enterprise-managed servers
- Plugin directories -- plugin-bundled servers

Source: [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)

### 3.2 MCP Server Lifecycle

```
Session Start
  |
  v
[1] Claude Code reads config (all scopes)
  |
  v
[2] For each enabled MCP server:
    - stdio: spawn process, connect via stdin/stdout
    - HTTP: connect to URL
    - SSE: connect to URL (deprecated)
  |
  v
[3] MCP Initialize handshake
    - Client sends: initialize (protocol version, capabilities)
    - Server responds: capabilities (including tools.listChanged)
  |
  v
[4] Client calls tools/list
    - Server returns all available tools with schemas
    - Tool definitions added to model context
  |
  v
[5] Session runs (tools are callable)
    - Client calls tools/call for each invocation
    - Server may send notifications/tools/list_changed
    - On list_changed: client calls tools/list again
  |
  v
[6] Session ends
    - Transport connection closed
    - stdio processes terminated
```

### 3.3 Mid-Session Server Management (v2.0.10+)

As of Claude Code 2.0.10, MCP servers can be:
- **Enabled/disabled** via the `/mcp` command or `@mention` in prompts
- **Toggled without session restart** -- the server's tool definitions are added/removed from context

However, **new MCP servers cannot be added mid-session** via `claude mcp add`. That command must be run outside Claude Code, and the server only connects on next session start (or via `/reload-plugins` for plugin-bundled servers).

Source: [GitHub Issue #6638](https://github.com/anthropics/claude-code/issues/6638)

### 3.4 The enabledMcpjsonServers Setting

The `settings.json` field `enabledMcpjsonServers` (visible in this project's config) controls which `.mcp.json` servers are active. This is a static configuration, not a runtime API.

---

## 4. Dynamic Tool Registration

### 4.1 MCP Specification Support

The MCP spec (version 2025-06-18 and 2025-11-25) **explicitly supports dynamic tool changes**:

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  }
}
```

When a server declares `listChanged: true`:
1. Server can send `notifications/tools/list_changed` at any time
2. Client (Claude Code) responds by calling `tools/list` to get the updated set
3. New tools appear in context; removed tools disappear

This is the **officially sanctioned mechanism** for runtime tool registration.

Source: [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

### 4.2 Claude Code's Support

Claude Code documentation explicitly states:

> "Claude Code supports MCP `list_changed` notifications, allowing MCP servers to dynamically update their available tools, prompts, and resources without requiring you to disconnect and reconnect."

This means a running MCP server can:
- Add new tools (agent writes a function -> server registers it -> sends list_changed -> Claude can call it)
- Remove tools (server unregisters -> sends list_changed -> tool disappears from context)
- Modify tool schemas (update description/parameters -> list_changed -> Claude sees updated schema)

**Confidence**: HIGH -- directly from official Claude Code documentation.

### 4.3 Implementation Patterns

The TypeScript MCP SDK provides `disable()` and `enable()` methods on tool objects, with automatic list_changed dispatch. The Python FastMCP SDK similarly supports runtime tool manipulation.

Source: [Speakeasy Dynamic Tool Discovery](https://www.speakeasy.com/mcp/tool-design/dynamic-tool-discovery)

---

## 5. Minimum Viable MCP Server

### 5.1 Python (FastMCP) -- 7 Lines

```python
from fastmcp import FastMCP

mcp = FastMCP("minimal")

@mcp.tool
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

Registration in Claude Code:
```bash
claude mcp add minimal-server --transport stdio -- python /path/to/server.py
```

The tool appears as `mcp__minimal-server__hello` with auto-generated JSON Schema from the type hints.

### 5.2 TypeScript -- ~15 Lines

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "minimal", version: "1.0.0" });

server.tool("hello", { name: z.string() }, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 5.3 Key Facts

- **Transport**: stdio (stdin/stdout) is simplest, zero network overhead
- **Dependencies**: `fastmcp` (Python) or `@modelcontextprotocol/sdk` (TypeScript)
- **Startup time**: Sub-second for stdio servers
- **Schema**: Auto-generated from type hints (Python) or Zod schemas (TypeScript)

Source: [FastMCP Tutorial](https://gofastmcp.com/tutorials/create-mcp-server), [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server)

---

## 6. Tool Factory Pattern

### 6.1 Concept

A "tool factory" is a single persistent MCP server that:
1. Starts with management tools (`add_tool`, `remove_tool`, `list_tools`)
2. Accepts tool definitions at runtime (name, description, code, input schema)
3. Dynamically registers new tools and sends `list_changed`
4. Executes user-defined code when Claude invokes the new tool

### 6.2 Existing Implementations

| Project | Language | Approach | Stars |
|---------|----------|----------|-------|
| [diy-tools-mcp](https://github.com/hesreallyhim/diy-tools-mcp) | Multi-lang | Inline code or file path; Python/JS/Bash/TS/Ruby | Active |
| [dynamic-mcp-server](https://github.com/scitara-cto/dynamic-mcp-server) | TypeScript | Handler package system; runtime registration | Active |
| [dynamic-tool-mcp-server](https://github.com/scitara-cto/dynamic-tool-mcp-server) | TypeScript | SSE transport; tool CRUD via management endpoints | Active |
| [mcp-tool-factory-ts](https://github.com/HeshamFS/mcp-tool-factory-ts) | TypeScript | Generates entire MCP servers from natural language | Active |

### 6.3 diy-tools-mcp Architecture (Most Relevant)

This server exposes four management tools:

- `add_tool`: Accepts `{name, description, language, code, parameters}` -- registers a new tool, persists it, sends list_changed
- `remove_tool`: Unregisters a tool by name
- `list_tools`: Returns all custom tools
- `view_source`: Inspects tool source code

**Supported languages**: Python, JavaScript, TypeScript, Bash, Ruby

**Minimum tool definition**:
```json
{
  "name": "my_calculator",
  "description": "Calculate an expression",
  "language": "python",
  "code": "def main(expression):\n    return str(eval(expression))",
  "parameters": {
    "type": "object",
    "properties": {
      "expression": {"type": "string", "description": "Math expression"}
    },
    "required": ["expression"]
  }
}
```

**Execution flow**:
1. Agent calls `add_tool` with the definition above
2. Server validates syntax, stores definition, sends `list_changed`
3. Claude Code calls `tools/list`, sees new `my_calculator` tool
4. Agent (or user) can now call `mcp__diy-tools__my_calculator`
5. Server executes the Python code in a subprocess, returns result

### 6.4 Feasibility Assessment

**Verdict: Highly feasible.** Multiple working implementations exist. The pattern is well-supported by the MCP spec and Claude Code's list_changed handling.

**Latency for new tool availability**:
- Code validation: ~10-50ms
- list_changed notification: ~1ms
- Claude Code tools/list refresh: ~10-50ms
- **Total: ~50-100ms** from `add_tool` call to tool being callable

**Confidence**: HIGH for feasibility. MEDIUM for exact latency numbers (estimated from stdio IPC overhead).

---

## 7. Alternative Approaches

### 7.1 Bash Tool Wrapping

The simplest alternative: agent writes a script to disk, then calls it via the Bash tool.

```
Agent writes: /tmp/my_tool.py
Agent calls: Bash("python /tmp/my_tool.py --arg1 value1")
```

**Advantages**:
- Zero setup, works immediately
- No MCP server needed
- No protocol overhead

**Disadvantages**:
- No tool schema -- the model must construct the Bash command string correctly
- No discoverability -- other agents/sessions cannot "see" available tools
- No input validation -- raw string arguments, easy to get wrong
- Output parsing burden -- model must parse stdout text
- No persistence across sessions
- Security: arbitrary code execution via Bash is already permitted, but lacks sandboxing

**When to use**: Quick one-off computations where schema/discoverability does not matter.

### 7.2 Agent SDK In-Process MCP Server

For programmatic (headless) Claude Code use, the Agent SDK allows defining tools via `@tool` decorator and wrapping them in `create_sdk_mcp_server`. These run **in-process** (no subprocess, no IPC overhead).

**Limitation**: Only available when using the Agent SDK programmatically (`query()` API), not in interactive Claude Code terminal sessions.

### 7.3 Plugin-Bundled MCP Server

A Claude Code plugin can bundle an MCP server in its `.mcp.json`. The server starts when the plugin is enabled.

**Advantage**: Clean distribution, automatic lifecycle management.
**Limitation**: Plugins are loaded at session start. Adding a new plugin mid-session requires `/reload-plugins`. Cannot dynamically create new tools within the plugin server without implementing list_changed.

### 7.4 Hybrid: Persistent Factory Server + Bash Bootstrap

The recommended approach combines approaches:

1. **Pre-register** a tool-factory MCP server (one-time setup via `claude mcp add`)
2. During sessions, agent uses `add_tool` management tool to create new tools dynamically
3. For quick one-offs that do not need persistence, use Bash wrapping
4. For complex tools that need schema/validation/reuse, use the factory

---

## 8. Constraints and Limitations

### 8.1 Security

- **Code execution**: A tool factory that runs arbitrary user-defined code is inherently risky. The diy-tools-mcp server runs code in subprocesses but does not sandbox them.
- **Permission model**: Claude Code's `allow`/`deny` lists in settings.json can restrict which MCP tools are callable. Dynamically created tools would need wildcard permissions (e.g., `mcp__factory__*`).
- **Human-in-the-loop**: The MCP spec requires that "there SHOULD always be a human in the loop with the ability to deny tool invocations." Claude Code enforces this via permission prompts for unapproved tools.
- **Injection risk**: Tool definitions could contain malicious code. The factory server should validate/sandbox.

### 8.2 Performance

- **Context window cost**: Every registered tool consumes tokens in the system prompt. The MCP spec warns: "Every tool in this array consumes context window space on every turn." With many dynamic tools, this becomes significant.
- **Token overhead**: A 5-server MCP setup can consume ~55K tokens before conversation starts. Each additional tool adds ~200-500 tokens for its schema.
- **ToolSearch mitigation**: Claude Code's ToolSearch tool (deferred loading) can reduce this by only loading tool schemas on demand. This is already used for the hundreds of MCP tools in this project.
- **IPC latency**: stdio transport adds minimal overhead (~11 microseconds per request at high throughput per MCP gateway benchmarks).

### 8.3 UX and Discoverability

- Dynamically created tools must have good descriptions for the model to use them correctly
- Tool names follow the `mcp__{server}__{tool}` convention -- cannot create tools with arbitrary names
- The model needs to be told about new tools (they appear in context after list_changed, but may need explicit mention in the conversation)

### 8.4 Persistence

- diy-tools-mcp persists tools to disk, surviving server restarts
- In-memory-only implementations would lose tools when the server process dies
- Claude Code may restart stdio servers if they crash (implementation-dependent)

### 8.5 Cannot Add New MCP Servers Mid-Session

While existing servers can add/remove tools dynamically, you **cannot add an entirely new MCP server** to a running Claude Code session. The `claude mcp add` command takes effect on next session start. The `/mcp` menu can enable/disable pre-configured servers, but not add new ones.

**Implication**: The tool-factory server must be pre-configured before the session starts. It can then create unlimited tools within itself.

---

## 9. Recommendation

### For Agent Zero's "Runtime Tool Creation" Use Case

**Recommended architecture**: A persistent tool-factory MCP server, pre-registered with Claude Code, that accepts tool definitions via a management tool and dynamically exposes them.

#### Setup (one-time)

```bash
# Install diy-tools-mcp or build custom factory
claude mcp add tool-factory --transport stdio -- python /path/to/tool-factory/server.py
```

#### Runtime flow

```
1. Agent identifies need for a new tool
2. Agent writes the function code as a string
3. Agent calls mcp__tool-factory__add_tool with:
   - name, description, language, code, parameters schema
4. Factory server validates, registers, sends list_changed
5. Claude Code refreshes tool list (~50-100ms)
6. New tool is immediately callable as mcp__tool-factory__{name}
7. Tool persists for the session (and optionally across sessions)
```

#### Why this over alternatives

| Approach | Schema | Discoverable | Persistent | Latency | Complexity |
|----------|--------|-------------|-----------|---------|------------|
| Tool factory MCP | Yes (JSON Schema) | Yes (in tools/list) | Yes | ~100ms | Medium |
| Bash wrapping | No | No | No | ~0ms | Low |
| Agent SDK in-process | Yes | Yes | No | ~0ms | Low (but SDK-only) |
| New MCP server per tool | Yes | Yes | Yes | Session restart | High |

#### Recommended enhancements over diy-tools-mcp

1. **Sandboxing**: Run user code in a subprocess with resource limits (timeout, memory cap)
2. **Tool namespacing**: Prefix dynamic tools with the requesting agent's ID
3. **Expiration**: Auto-remove tools after N minutes of non-use to reduce context bloat
4. **Validation**: Lint/typecheck code before registering
5. **Audit log**: Track who created which tool and when

---

## 10. Open Questions

1. **ToolSearch integration**: When a tool-factory server has many dynamic tools, does Claude Code's ToolSearch (deferred loading) work with them, or does it only apply to tools present at session start? [UNKNOWN -- needs testing]

2. **list_changed latency in practice**: While the spec supports it, how quickly does Claude Code actually refresh after receiving list_changed? Is there a debounce or delay? [UNKNOWN -- needs benchmarking]

3. **Maximum tools per server**: Is there a practical limit on how many tools a single MCP server can expose before context window saturation becomes a problem? The ToolSearch docs suggest hundreds are manageable. [MEDIUM confidence]

4. **Subprocess sandboxing**: Can we use Python's `subprocess` with `seccomp` or similar to restrict what dynamic tool code can do? This is OS-dependent and may not work on macOS. [NEEDS INVESTIGATION]

5. **Cross-session tool persistence**: If the factory server stores tools on disk, do they automatically re-appear on next session start? The MCP lifecycle (tools/list on connect) suggests yes. [HIGH confidence but untested]

6. **Concurrent tool creation**: If multiple subagents (via Task tool) try to add tools simultaneously, does the factory server handle concurrent list_changed notifications correctly? [NEEDS TESTING]

7. **Agent SDK convergence**: Will Anthropic eventually expose `createSdkMcpServer` for interactive Claude Code sessions (not just headless SDK use)? This would eliminate the need for an external factory server. [UNKNOWN -- no public roadmap]

8. **Plugin hot-reload**: The `/reload-plugins` command reconnects plugin MCP servers. Could a factory server be distributed as a plugin for easier setup? [LIKELY FEASIBLE but untested]

---

## Sources

### Official Documentation
- [MCP Tools Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Claude Agent SDK Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Claude Code Tools Reference](https://code.claude.com/docs/en/tools-reference)

### GitHub Issues and Discussions
- [Dynamic loading/unloading of MCP servers (#6638)](https://github.com/anthropics/claude-code/issues/6638) -- RESOLVED in v2.0.10
- [CLI Commands for MCP Server Enable/Disable (#10447)](https://github.com/anthropics/claude-code/issues/10447)
- [No option to uninstall/remove MCP servers (#30138)](https://github.com/anthropics/claude-code/issues/30138)

### Dynamic Tool Implementations
- [diy-tools-mcp](https://github.com/hesreallyhim/diy-tools-mcp) -- Runtime tool creation in Python/JS/Bash/TS/Ruby
- [dynamic-mcp-server](https://github.com/scitara-cto/dynamic-mcp-server) -- Handler package framework
- [dynamic-tool-mcp-server](https://github.com/scitara-cto/dynamic-tool-mcp-server) -- SSE-based dynamic tools
- [mcp-tool-factory-ts](https://github.com/HeshamFS/mcp-tool-factory-ts) -- Generate MCP servers from natural language

### Technical References
- [Speakeasy: Dynamic Tool Discovery in MCP](https://www.speakeasy.com/mcp/tool-design/dynamic-tool-discovery)
- [Spring AI Dynamic Tool Updates](https://spring.io/blog/2025/05/04/spring-ai-dynamic-tool-updates-with-mcp/)
- [FastMCP Tutorial](https://gofastmcp.com/tutorials/create-mcp-server)
- [Claude Code Internal Tools Implementation](https://gist.github.com/bgauryy/0cdb9aa337d01ae5bd0c803943aa36bd)
- [Claude Code Hidden MCP Flag (32k tokens)](https://paddo.dev/blog/claude-code-hidden-mcp-flag/)
- [MCP Tool Search and Context Optimization](https://www.atcyrus.com/stories/mcp-tool-search-claude-code-context-pollution-guide)
