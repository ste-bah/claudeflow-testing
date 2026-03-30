# Agent Zero Source Code Analysis: Dynamic Tools, Subordinate Agents, and Behavior Adjustment

**Date**: 2026-03-29
**Repo**: github.com/agent0ai/agent-zero (main branch)
**Confidence Level**: HIGH -- based on direct source code examination of agent.py, tools/, helpers/, plugins/_memory/, extensions/, and prompts/

---

## 1. Executive Summary

- **Dynamic tool creation** in Agent Zero is filesystem-based, not API-based. Tools are Python classes in discoverable directories. The agent creates new tools mid-conversation by writing `.py` files to `usr/` directories via the code execution tool, and those files are picked up on the next tool lookup thanks to a file-watching cache invalidation system.

- **Subordinate agent spawning** uses an in-process hierarchy where a parent agent creates a child Agent instance sharing the same `AgentContext`. The child inherits the context (logging, task runner) but gets its own fresh `History`, its own agent number, and an independently configurable profile. Communication is synchronous: the parent awaits the child's `monologue()` and receives the result string directly.

- **Behavior adjustment** is implemented as a tool (`behaviour_adjustment`) in the `_memory` plugin. It reads current behavioral rules from a markdown file, sends them plus the user's requested adjustments to a utility LLM for merging, and writes the merged rules back to a file. On the next prompt assembly cycle, an extension reads this file and injects the rules into the system prompt. Changes take effect within the same session on the next message loop iteration.

- All three mechanisms share a common architectural pattern: **filesystem as the integration layer**, with file watchers invalidating caches, and a modular extension/hook system providing the glue between components.

- The prompt assembly system is the connective tissue. It is fully modular -- numbered Python extension files in `extensions/python/system_prompt/` each append a section to the system prompt list. This is how tools, behavior rules, skills, and project context all get composed into the final LLM input.

---

## 2. Dynamic Tool Creation

### 2.1 Implementation Details

**Key files:**
- `agent.py` -- `get_tool()` method (tool lookup), `process_tools()` method (tool dispatch)
- `helpers/tool.py` -- `Tool` base class, `Response` dataclass
- `helpers/extension.py` -- `_get_extension_classes()`, file watcher registration
- `helpers/subagents.py` -- `get_paths()` (multi-directory path resolution)
- `tools/unknown.py` -- fallback for unresolved tool names
- `extensions/python/system_prompt/_11_tools_prompt.py` -- tool prompt assembly

**Tool lookup flow** (`agent.py` `get_tool()`):
```python
paths = subagents.get_paths(self, "tools", name + ".py")
for path in paths:
    classes = extract_tools.load_classes_from_file(path, Tool)
    break
tool_class = classes[0] if classes else Unknown
return tool_class(agent=self, name=name, method=method, args=args, ...)
```

### 2.2 Tool Schema/Format

A tool is a Python class inheriting from `Tool`:

```python
from helpers.tool import Tool, Response

class MyTool(Tool):
    async def execute(self, **kwargs) -> Response:
        # do work
        return Response(message="result", break_loop=False)
```

The `Tool` base class provides:
- `self.agent` -- reference to the owning Agent
- `self.name`, `self.method`, `self.args`, `self.message` -- invocation metadata
- `self.loop_data` -- current LoopData context
- `before_execution()` / `after_execution()` -- lifecycle hooks (logging, history)
- `set_progress()` / `add_progress()` -- streaming progress updates

The `Response` dataclass:
- `message: str` -- text result returned to the agent's history
- `break_loop: bool` -- if True, exits the message loop (used by `response` tool)
- `additional: dict | None` -- extra metadata (e.g., hints)

There is NO formal JSON schema for tool parameters. The LLM is told about tools via markdown prompt templates (`agent.system.tool.*.md`). The tool's `execute()` receives `**kwargs` from the JSON the LLM generates. Validation is the tool's responsibility.

### 2.3 Registration Mechanism

There is no explicit "register" call. Registration is implicit via filesystem presence:

1. **Path resolution** (`subagents.get_paths(agent, "tools", "toolname.py")`) searches directories in priority order:
   - Project agent tools: `usr/projects/<project>/.a0proj/agents/<profile>/tools/`
   - Project tools: `usr/projects/<project>/.a0proj/tools/`
   - User agent tools: `usr/agents/<profile>/tools/`
   - Plugin agent tools: `plugins/<plugin>/agents/<profile>/tools/`
   - Default agent tools: `agents/<profile>/tools/`
   - User global tools: `usr/tools/`
   - Plugin tools: `plugins/<plugin>/tools/`
   - Global tools: `tools/`

2. **First match wins** -- the loop breaks on the first path that successfully loads a `Tool` subclass.

3. **Cache with file watchers** -- `subagents.get_paths()` caches results, but `extension.py` registers file system watchers (`register_extensions_watchdogs()`) that clear the cache when files change in extension/agent/plugin directories. Tool resolution shares this invalidation mechanism.

### 2.4 How Dynamic Creation Actually Works

Agent Zero does NOT have a dedicated `create_tool` API. Instead, the pattern is:

1. The agent uses the **code execution tool** to write a Python file implementing a `Tool` subclass
2. The file is saved to a discoverable directory (e.g., `usr/tools/` or a project tools directory)
3. The file watcher detects the change and clears the path cache
4. On the next tool invocation, `get_tool()` discovers the new file
5. The agent must also know about the tool -- either via memory, or by including a prompt template (`agent.system.tool.<name>.md`) that describes it to the LLM

**Critical insight**: The tool is available immediately (no restart needed) because the cache is invalidated by the file watcher. However, the LLM only knows to USE the tool if it has been described in a prompt. For truly dynamic tools, the agent would need to either (a) write a corresponding prompt template, or (b) remember the tool exists via the memory system and mention it in context.

### 2.5 Tool Discoverability for the LLM

The LLM learns about tools through the prompt assembly system:

1. `_11_tools_prompt.py` scans all prompt directories for files matching `agent.system.tool.*.md`
2. Each matching file is read and its content is concatenated
3. The combined text is injected into the system prompt via the `agent.system.tools.md` template (which has a `{{tools}}` placeholder)

This means: **a dynamically created tool is NOT automatically discoverable by the LLM unless a corresponding prompt template file is also created**. The code execution tool would need to write both the `.py` tool file AND the `.md` prompt file.

### 2.6 Sandboxing/Validation

- The Docker deployment uses dual runtimes: `/opt/venv-a0` (framework) and `/opt/venv` (execution). Code execution runs in the isolated runtime.
- Tool files loaded via `load_classes_from_file()` are imported as Python modules with no sandboxing beyond filesystem isolation.
- The `Unknown` tool class handles unrecognized tool names gracefully (returns error message, does not crash).
- MCP tools are checked first (`mcp_handler.MCPConfig.get_instance().get_tool()`), providing an alternative discovery path.

### 2.7 Persistence

Tools persist across sessions because they are files on disk. The `usr/` directory is a persistent volume in Docker deployments. Project-specific tools persist within the project's `.a0proj/` directory.

### 2.8 Lessons for Our Implementation

1. **Filesystem-as-registry is simple but effective** -- no database, no API, just file presence in known directories.
2. **Cache invalidation via file watchers** makes dynamic creation work without restarts.
3. **The LLM discoverability gap is a real problem** -- creating a tool file alone is insufficient; the agent also needs prompt awareness. We should consider a tool manifest or auto-discovery mechanism.
4. **Priority-ordered search paths** enable clean override patterns (project > user > plugin > default).
5. **The `Tool` base class is minimal** -- just `execute(**kwargs) -> Response`. This low ceremony makes it easy to create tools.

---

## 3. Subordinate Agent Spawning

### 3.1 Spawning Mechanism

**Key files:**
- `tools/call_subordinate.py` -- `Delegation` tool class
- `agent.py` -- `Agent.__init__()`, `Agent.monologue()`, `AgentContext._process_chain()`
- `helpers/subagents.py` -- agent profile loading
- `initialize.py` -- `initialize_agent()` creates default `AgentConfig`

**The spawning code** (`tools/call_subordinate.py`):
```python
class Delegation(Tool):
    async def execute(self, message="", reset="", **kwargs):
        if self.agent.get_data(Agent.DATA_NAME_SUBORDINATE) is None or reset == "true":
            config = initialize_agent()
            agent_profile = kwargs.get("profile", kwargs.get("agent_profile", ""))
            if agent_profile:
                config.profile = agent_profile
            sub = Agent(self.agent.number + 1, config, self.agent.context)
            sub.set_data(Agent.DATA_NAME_SUPERIOR, self.agent)
            self.agent.set_data(Agent.DATA_NAME_SUBORDINATE, sub)

        subordinate = self.agent.get_data(Agent.DATA_NAME_SUBORDINATE)
        subordinate.hist_add_user_message(UserMessage(message=message, attachments=[]))
        result = await subordinate.monologue()
        subordinate.history.new_topic()
        return Response(message=result, break_loop=False)
```

### 3.2 Context Inheritance Model

What the subordinate INHERITS from the parent:

| Attribute | Inherited? | Details |
|-----------|-----------|---------|
| `AgentContext` | YES (shared) | Same context object -- same log, same task runner, same ID |
| `AgentConfig` | NO (fresh) | New config from `initialize_agent()`, optionally with different profile |
| `History` | NO (fresh) | Each agent gets its own `History` instance (created in `Agent.__init__()`) |
| `Tools` | PARTIALLY | Tool availability depends on the profile; different profiles have different tool directories |
| `Memory` | SHARED (via context) | Same memory subsystem accessible (project memory, global memory) |
| `Behavior rules` | INDEPENDENT | Loaded from profile-specific or global behaviour.md -- may differ if profiles differ |
| `Agent number` | DERIVED | `parent.number + 1` |
| `System prompt` | INDEPENDENT | Assembled fresh from the subordinate's profile prompt templates |
| `Data dict` | FRESH | New empty dict, except for `DATA_NAME_SUPERIOR` pointing to parent |

**Key insight**: The subordinate shares the INFRASTRUCTURE (context, log, memory system) but gets its own COGNITIVE STATE (history, prompt, config). This is a clean separation.

### 3.3 Communication Model

**Parent to child**: The parent sends a message string via `subordinate.hist_add_user_message(UserMessage(message=message))`. This appears as a "user message" in the subordinate's history.

**Child to parent**: The subordinate runs its `monologue()` loop, which returns a string result. This string is returned as the `Response.message` from the `Delegation` tool. The parent's `after_execution()` adds it to the parent's history as a tool result with `tool_name="call_subordinate"`.

**The process chain** (`AgentContext._process_chain()`):
```python
async def _process_chain(self, agent, msg, user=True):
    msg_template = agent.hist_add_user_message(msg) if user
                   else agent.hist_add_tool_result(tool_name="call_subordinate", tool_result=msg)
    response = await agent.monologue()
    superior = agent.data.get(Agent.DATA_NAME_SUPERIOR, None)
    if superior:
        response = await self._process_chain(superior, response, False)
    return response
```

This recursive chain means: when a subordinate finishes, its response automatically bubbles up through the hierarchy. Each superior receives the result as a "call_subordinate" tool result and continues its own monologue.

### 3.4 Subordinate Lifecycle

1. **Creation**: On first `call_subordinate` invocation (or when `reset=true`), a new `Agent` instance is created
2. **Reuse**: Subsequent calls reuse the existing subordinate (`self.agent.get_data(Agent.DATA_NAME_SUBORDINATE)`)
3. **Topic sealing**: After each delegation, `subordinate.history.new_topic()` moves messages to compressed storage
4. **No explicit destruction**: Subordinates persist in the parent's `data` dict until reset or context removal
5. **Context removal**: `AgentContext.remove(id)` kills the task and removes the context, effectively destroying all agents in that context

### 3.5 Hierarchy Depth

There is NO hard-coded depth limit. Each subordinate can spawn its own subordinate (`self.agent.number + 1`). The practical limit is:
- Token/context window constraints (each level adds its own prompt overhead)
- The `process_chain` recursion (bubbles results up, could hit Python recursion limits at extreme depths)
- LLM response quality degradation at deep nesting

### 3.6 Profile-Based Specialization

The `call_subordinate` prompt (`agent.system.tool.call_sub.md`) tells the LLM it can specify a `profile` parameter (e.g., "scientist", "coder", "developer"). Each profile maps to a directory under `agents/` with its own:
- `agent.yaml` -- metadata (title, description, context)
- `prompts/` -- override prompt templates (e.g., `agent.system.main.role.md`)
- `tools/` -- profile-specific tools
- `extensions/` -- profile-specific extensions

This enables the parent to delegate to specialists without inheriting their personality/tools.

### 3.7 Lessons for Our Implementation

1. **Shared infrastructure, isolated cognition** is the right pattern. Share the coordination layer (logging, memory) but give each agent its own prompt and history.
2. **The `number` system is elegant** -- simple incrementing ID that communicates hierarchy depth.
3. **Topic sealing after delegation** is important -- it prevents context bloat from subordinate conversations leaking into subsequent interactions.
4. **Profile-based specialization** is the mechanism we should mirror with our Task tool agent types.
5. **Reuse by default, reset on demand** -- keeping the subordinate alive between calls enables multi-turn delegation without re-creating the agent.
6. **The process chain's recursive bubble-up** is clean but means each delegation level adds latency. For our Claude Code setup, this maps to: the Task tool result is passed back to the orchestrator.

---

## 4. Behavior Adjustment Tool

### 4.1 Implementation Details

**Key files:**
- `plugins/_memory/tools/behaviour_adjustment.py` -- `UpdateBehaviour` tool class, `update_behaviour()` function
- `plugins/_memory/extensions/python/system_prompt/_20_behaviour_prompt.py` -- `BehaviourPrompt` extension
- `prompts/agent.system.behaviour.md` -- template: `# Behavioral rules\n!!! {{rules}}`
- `prompts/agent.system.behaviour_default.md` -- default rule: "favor linux commands for simple tasks where possible instead of python"
- `prompts/behaviour.merge.sys.md` -- LLM system prompt for merging rule adjustments
- `prompts/behaviour.merge.msg.md` -- LLM message template for merging
- `prompts/behaviour.search.sys.md` -- LLM prompt to extract behavior instructions from conversation history
- `prompts/behaviour.updated.md` -- confirmation message: "Behaviour has been updated."

### 4.2 Behavior Rule Data Structure

A "behavior rule" is simply **markdown text**. There is no structured data model, no JSON schema, no database. The rules are free-form markdown stored in a file called `behaviour.md` within the agent's memory subdirectory.

The default rule set from `agent.system.behaviour_default.md`:
```
favor linux commands for simple tasks where possible instead of python
```

The template that wraps rules for injection into the prompt (`agent.system.behaviour.md`):
```markdown
# Behavioral rules
!!! {{rules}}
```

The `!!!` notation appears to be a priority/emphasis marker in Agent Zero's prompt rendering.

### 4.3 The Adjustment Pipeline

When the user says something like "from now on, always respond in French":

1. **Tool invocation**: The LLM calls `behaviour_adjustment` with `adjustments="always respond in French"`

2. **Current rules loaded**: `read_rules(agent)` checks for `behaviour.md` in the memory subdirectory
   - If exists: reads custom rules, wraps with `agent.system.behaviour.md` template
   - If not: reads `agent.system.behaviour_default.md`, wraps with same template

3. **LLM-based merge**: The current rules + adjustments are sent to a utility LLM:
   ```python
   adjustments_merge = await agent.call_utility_model(
       system=system,  # behaviour.merge.sys.md
       message=msg,    # behaviour.merge.msg.md with current_rules + adjustments
       callback=log_callback,
   )
   ```
   The merge prompt instructs the LLM to combine existing rules with new adjustments, using markdown with level 2 headings and bullet points, eliminating redundancies.

4. **File write**: The merged output is written to `behaviour.md`:
   ```python
   rules_file = get_custom_rules_file(agent)
   files.write_file(rules_file, adjustments_merge)
   ```

5. **Confirmation**: Returns "Behaviour has been updated." to the agent.

### 4.4 How Rules Affect the System Prompt

The `_20_behaviour_prompt.py` extension runs during system prompt assembly (the `system_prompt` extension point):

```python
class BehaviourPrompt(Extension):
    async def execute(self, system_prompt=[], loop_data=LoopData(), **kwargs):
        rules = read_rules(self.agent)
        system_prompt.insert(0, rules)  # Inserted at the BEGINNING
```

**Critical detail**: Behavior rules are inserted at position 0 in the system prompt list, making them the HIGHEST PRIORITY content in the system prompt. They appear before the main role prompt, before tool descriptions, before everything else.

### 4.5 Timing of Changes

Changes are **immediate within the same session**. Here is why:

1. The `update_behaviour()` function writes the file synchronously (from the agent's perspective)
2. On the NEXT iteration of the message loop, `prepare_prompt()` is called again
3. `_20_behaviour_prompt.py` re-reads `behaviour.md` from disk
4. The new rules are injected into the system prompt
5. The LLM sees the updated rules immediately

There is no cache that would delay this -- `read_rules()` reads from disk on every prompt assembly.

### 4.6 Persistence and Versioning

- **Persistence**: Rules persist across sessions because `behaviour.md` is in the persistent memory directory (`usr/` volume in Docker)
- **Versioning**: There is NO versioning. Each update overwrites the file. There is no undo, no history of rule changes.
- **Per-agent scope**: Rules are stored per memory subdirectory, which can be project-specific or global
- **The search prompt** (`behaviour.search.sys.md`): There is also a mechanism to EXTRACT behavior instructions from conversation history -- the LLM scans chat history for anything that looks like a standing instruction (vs. a one-time task) and returns them as a JSON array. This could be used for automatic rule discovery, but the exact trigger point is unclear from the source.

### 4.7 Interaction with Prompt Assembly

The full system prompt assembly order (based on extension numbering):

1. `_09_text_editor_config.py` (plugin) -- text editor kwargs
2. `_10_main_prompt.py` -- core role/personality from `agent.system.main.md`
3. `_11_tools_prompt.py` -- tool descriptions from `agent.system.tool.*.md`
4. `_12_mcp_prompt.py` -- MCP tool descriptions
5. `_13_secrets_prompt.py` -- secret handling rules
6. `_13_skills_prompt.py` -- skill descriptions
7. `_14_project_prompt.py` -- project context
8. `_16_promptinclude.py` (plugin) -- user includes
9. `_20_behaviour_prompt.py` (plugin) -- behavior rules **inserted at index 0**

Because behavior rules use `system_prompt.insert(0, ...)`, they end up at the TOP of the final prompt, before the main role prompt. This is intentional -- behavioral directives override personality defaults.

### 4.8 Lessons for Our Implementation

1. **LLM-mediated merging is smart** -- instead of simple append/overwrite, using an LLM to intelligently merge new rules with existing ones handles conflicts and deduplication naturally.
2. **File-based storage is fragile** -- no versioning, no undo. We should add versioning (git-based or timestamped backups).
3. **Immediate effect via prompt injection** is the right model -- rules should affect the very next LLM call.
4. **Priority positioning** (insert at index 0) is important -- behavior rules need to override default personality.
5. **The "search for behavior in history" mechanism** is clever -- automatically extracting standing instructions from conversation is something we could adapt for our MemoryGraph.
6. **Free-form markdown is both strength and weakness** -- flexible but not structured enough for programmatic reasoning about rules. A structured format (YAML with categories, priorities) might be better for our use case.

---

## 5. Cross-Cutting Patterns

### 5.1 Filesystem as Integration Layer

All three mechanisms use the filesystem as the primary state store and communication channel:
- Tools: `.py` files in discoverable directories
- Behavior: `behaviour.md` in memory directory
- Agent profiles: `agent.yaml` + `prompts/` directories

This is architecturally simple but creates tight coupling to the filesystem layout.

### 5.2 Extension Point System

The `@extensible` decorator and `Extension` base class create a powerful hook system:
- Named extension points (e.g., `system_prompt`, `tool_execute_before`, `agent_init`)
- Numbered files for ordering (`_10_`, `_11_`, `_20_`)
- Agent-specific override paths (profile > user > plugin > default)
- Async-aware execution

This is the central nervous system that connects tools, behavior, prompts, and agents.

### 5.3 Priority-Ordered Path Resolution

`subagents.get_paths()` implements a consistent search order across all subsystems:
```
project/agents/<profile>/ > project/ > usr/agents/<profile>/ > plugins/ > agents/<profile>/ > usr/ > default
```

This enables clean overriding at every level.

### 5.4 LLM as Utility Processor

Both behavior merging and knowledge search use `agent.call_utility_model()` -- a secondary LLM call for internal processing. This separates the "thinking" LLM from "utility" LLM calls, which can use cheaper/faster models.

### 5.5 How the Three Mechanisms Interact

```
Behavior rules -> modify system prompt -> affect how agent uses tools -> affect how agent delegates to subordinates
Subordinates -> can have different profiles -> different behavior rules -> different tool sets
Tools -> include behaviour_adjustment -> can modify behavior rules -> recursive self-modification
```

The behavior system can modify how the agent delegates (e.g., "always use the researcher profile for research tasks"). Subordinates inherit the context but not the behavior rules, so they can have independent personalities. And the behavior_adjustment tool itself is a regular tool, creating a clean feedback loop.

---

## 6. Adaptable Patterns for Claude Code

### 6.1 Dynamic Tool Creation

**Agent Zero pattern**: Write a Python file to a discoverable directory.
**Claude Code adaptation**: We cannot create new Claude Code tools at runtime (the tool set is fixed by the harness). However, we can:
- Use **skills** (markdown files with instructions) that the agent loads on demand
- Use **memory-stored procedures** -- instructions stored in MemoryGraph that get injected into subagent prompts
- Use the **code execution tool** to run generated scripts, effectively creating "virtual tools"
- Use **hook-based automation** (hookify rules) for pre/post processing

### 6.2 Subordinate Agent Spawning

**Agent Zero pattern**: `Agent(number+1, config, shared_context)` with `await subordinate.monologue()`.
**Claude Code adaptation**: This maps directly to the `Task()` tool:
- `Task("agent-type", "prompt with context")` = creating a subordinate
- The prompt IS the context inheritance mechanism -- we must explicitly pass what the child needs
- Results come back as the Task return value
- We should formalize a "context inheritance template" that includes: memory keys to retrieve, files to read, constraints to honor

### 6.3 Behavior Adjustment

**Agent Zero pattern**: LLM merges rules into markdown file, injected at top of system prompt.
**Claude Code adaptation**:
- Store behavior rules in **MemoryGraph** (not files)
- Use a custom skill or hook to retrieve rules at session start
- Inject rules into subagent prompts via the 4-part prompt template
- The `/values` skill already provides some of this functionality
- The SessionStart hook could load behavior rules automatically

### 6.4 Prompt Assembly

**Agent Zero pattern**: Numbered extension files, each appending to a system prompt list.
**Claude Code adaptation**:
- Our CLAUDE.md IS the static system prompt
- Dynamic sections can be injected via hooks (SessionStart, PreTask)
- Subagent prompts are composed manually -- we should create a utility function/template
- The skill system provides dynamic prompt extension

### 6.5 Specific Recommendations

1. **Create a "context inheritance" template** for Task() calls that standardizes what data flows from orchestrator to subagent (memory keys, file paths, constraints, behavior rules).

2. **Implement behavior rules in MemoryGraph** with a structured schema:
   ```json
   {
     "type": "behavior_rule",
     "category": "communication|coding|delegation|analysis",
     "rule": "always respond in French",
     "priority": 1,
     "source": "user_request",
     "created": "2026-03-29",
     "active": true
   }
   ```

3. **Add rule versioning** -- Agent Zero's overwrite-only model is fragile. Use MemoryGraph relationships to track rule history.

4. **Adopt the "utility LLM" pattern** for rule merging -- when the user requests a behavior change, use a secondary LLM call to intelligently merge with existing rules before storing.

5. **Mirror the numbered extension pattern** for our hook system -- hooks like `_10_load_behavior.sh`, `_20_inject_context.sh` provide clear ordering.

6. **Implement profile-based delegation** -- create named agent profiles (like Agent Zero's `agents/developer/`, `agents/researcher/`) that bundle specific prompts, tool permissions, and behavior rules for Task() subagents.

---

## 7. Open Questions

1. **Code execution sandboxing depth**: Agent Zero's Docker dual-runtime provides isolation, but how exactly does the code execution tool prevent the agent from modifying framework files? (The source for `code_execution_tool.py` was not fully examined -- it uses a disabled extension pattern `.py` -> `._py` for some tools.)

2. **Behavior search trigger**: The `behaviour.search.sys.md` prompt extracts behavior instructions from conversation history, but the exact trigger point (when this runs automatically vs. manually) is not clear from the files examined.

3. **Memory integration with behavior**: The behavior system lives in the `_memory` plugin but the exact relationship between behavior rules and the FAISS memory system (are rules also stored as embeddings?) is unclear.

4. **MCP tool priority vs. local tools**: The `process_tools()` method checks MCP tools FIRST, then falls back to local tools. This means an MCP server could shadow a local tool. Is this intentional? What are the security implications?

5. **Subordinate memory isolation**: Subordinates share the `AgentContext` and thus the same memory system. Can a subordinate's memory writes interfere with the parent's memory reads? The locking model is not clear.

6. **Extension caching behavior**: While file watchers clear the cache, there may be a race condition between file write and cache invalidation for dynamically created tools. The exact timing guarantees are unclear.

7. **Skill vs. Tool distinction**: Agent Zero has both tools (Python classes) and skills (SKILL.md files). Skills are loaded into "extras" (prompt context) rather than being executable. The boundary between "instruction the agent follows" (skill) and "code the agent executes" (tool) is intentionally blurry. How does the agent decide which to use?

---

## Appendix: Key Source File Map

| File | Purpose |
|------|---------|
| `agent.py` | Core Agent class, AgentContext, process_tools(), get_tool(), monologue(), prepare_prompt() |
| `helpers/tool.py` | Tool base class, Response dataclass |
| `helpers/extension.py` | @extensible decorator, Extension base class, call_extensions_async/sync |
| `helpers/subagents.py` | get_paths() multi-directory resolution, agent profile loading |
| `tools/call_subordinate.py` | Delegation tool -- subordinate creation and communication |
| `tools/response.py` | ResponseTool -- breaks the message loop |
| `tools/skills_tool.py` | SkillsTool -- list/load SKILL.md files |
| `tools/unknown.py` | Fallback for unresolved tool names |
| `plugins/_memory/tools/behaviour_adjustment.py` | UpdateBehaviour tool -- LLM-mediated rule merging |
| `plugins/_memory/extensions/python/system_prompt/_20_behaviour_prompt.py` | Injects behavior rules into system prompt |
| `extensions/python/system_prompt/_10_main_prompt.py` | Loads core personality prompt |
| `extensions/python/system_prompt/_11_tools_prompt.py` | Assembles tool descriptions for prompt |
| `prompts/agent.system.behaviour.md` | Template: `# Behavioral rules\n!!! {{rules}}` |
| `prompts/agent.system.behaviour_default.md` | Default rules |
| `prompts/behaviour.merge.sys.md` | LLM instructions for merging rules |
| `prompts/behaviour.search.sys.md` | LLM instructions for extracting rules from history |
| `prompts/agent.system.tool.call_sub.md` | Prompt teaching LLM about subordinate delegation |
| `prompts/agent.system.tool.behaviour.md` | Prompt teaching LLM about behavior adjustment |
| `agents/default/agent.yaml` | Default agent profile metadata |
| `agents/_example/tools/example_tool.py` | Minimal tool example |
| `initialize.py` | initialize_agent() -- creates AgentConfig from settings |
