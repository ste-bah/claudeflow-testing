# TASK-AGT-003: Tool Factory Registration + Permissions

```
Task ID:       TASK-AGT-003
Status:        BLOCKED
Implements:    REQ-TOOL-001 (registration)
Depends On:    TASK-AGT-002
Complexity:    Low
Guardrails:    GR-005 (gitignore tool factory), GR-008 (no secrets in env)
NFRs:          NFR-004 (Python 3.11+ compatibility)
Security:      Medium risk — modifies Claude Code permission configuration. Tool factory tools gain execution privileges. Verify permission scope is minimal.
```

## Context

TASK-AGT-002 builds the Tool Factory MCP server. This task registers it with Claude Code so it is auto-started and its tools are discoverable. It also configures the minimum permission set required for tool factory tools to operate, and ensures `.tool-factory/` is properly gitignored.

Without this task, the tool factory server exists as code but is not connected to Claude Code — users cannot invoke any of its tools.

## Scope

### In Scope
- `claude mcp add` command to register the tool factory server
- Permission rules in `.claude/settings.local.json` for tool factory tools
- `.gitignore` entry for `.tool-factory/` (may already exist from TASK-AGT-002)
- Verification that the server starts, tools are discoverable, and permissions allow execution
- Live smoke test: call `add_tool`, verify tool appears, call it

### Out of Scope
- The server implementation itself (TASK-AGT-002)
- MemoryGraph registration of tool metadata (Phase 4)
- Docker containerization
- Custom permission UI

## Key Design Decisions

1. **stdio transport**: The tool factory uses stdio transport (not SSE or HTTP). Claude Code manages the process lifecycle — starts it on first tool call, keeps it running for the session.
2. **Python path**: The `claude mcp add` command uses `python3` (not `python`) for compatibility. The server entry point is `src/tool-factory/server.py`.
3. **Minimal permissions**: Only the 5 management tools (`add_tool`, `remove_tool`, `list_tools`, `view_source`, `update_tool`) need explicit permission. Dynamic tools created at runtime are auto-permitted because they are served by the same MCP server.
4. **Permission scope**: Set to `"allow"` for the tool factory MCP prefix. Dynamic tools appear under the same server prefix, so a single permission rule covers all of them.
5. **Idempotent registration**: If the MCP server is already registered, `claude mcp add` with `--force` overwrites. The task spec includes a check-then-add pattern.

## Detailed Specifications

### Registration Command

```bash
# Register the tool factory MCP server with Claude Code
claude mcp add tool-factory \
  --transport stdio \
  -- python3 src/tool-factory/server.py
```

This command:
- Creates an entry in `.claude/settings.local.json` under `mcpServers`
- Configures stdio transport (Claude Code manages stdin/stdout)
- Sets the command to `python3 src/tool-factory/server.py`
- The server is started automatically when any `mcp__tool-factory__*` tool is invoked

### Expected `.claude/settings.local.json` Entry

After running the registration command, the settings file should contain (among other entries):

```json
{
  "mcpServers": {
    "tool-factory": {
      "command": "python3",
      "args": ["src/tool-factory/server.py"],
      "transport": "stdio"
    }
  }
}
```

### Permission Configuration

Add the following permission rules to `.claude/settings.local.json` under the `permissions` key:

```json
{
  "permissions": {
    "allow": [
      "mcp__tool-factory__add_tool",
      "mcp__tool-factory__remove_tool",
      "mcp__tool-factory__list_tools",
      "mcp__tool-factory__view_source",
      "mcp__tool-factory__update_tool"
    ]
  }
}
```

Note: Dynamic tools created via `add_tool` will appear as `mcp__tool-factory__{dynamic-name}`. These are auto-permitted by the MCP server mechanism — Claude Code permits all tools served by a registered MCP server. The explicit `allow` entries above are for the management tools themselves, which are the permanent tools of the server.

If the above is insufficient (Claude Code requires explicit per-tool permission even for dynamic tools), add a wildcard pattern:

```json
{
  "permissions": {
    "allow": [
      "mcp__tool-factory__*"
    ]
  }
}
```

The implementation should test which approach works and use the minimal sufficient permission.

### `.gitignore` Entry

Ensure `.gitignore` contains:

```
# Tool Factory — dynamic tool definitions (potentially untrusted code)
.tool-factory/

# Agent traces — contain full execution context and output (potentially sensitive)
.claude/agents/traces/

# Agent version snapshots — backups from evolution (can be large)
.claude/agents/versions/
```

This may already be partially added by TASK-AGT-002. The task should verify and add all entries if missing (idempotent).

### Verification Steps (Automated)

```python
#!/usr/bin/env python3
"""verify_tool_factory_registration.py — run after registration to verify setup."""

import json
import subprocess
import sys
from pathlib import Path

def check_settings():
    """Verify tool-factory is in settings.local.json."""
    settings_path = Path('.claude/settings.local.json')
    if not settings_path.exists():
        print("FAIL: .claude/settings.local.json not found")
        return False
    settings = json.loads(settings_path.read_text())
    servers = settings.get('mcpServers', {})
    if 'tool-factory' not in servers:
        print("FAIL: tool-factory not in mcpServers")
        return False
    tf = servers['tool-factory']
    if tf.get('command') != 'python3':
        print(f"FAIL: command is '{tf.get('command')}', expected 'python3'")
        return False
    if 'src/tool-factory/server.py' not in tf.get('args', []):
        print(f"FAIL: args missing 'src/tool-factory/server.py'")
        return False
    print("PASS: tool-factory registered in settings")
    return True

def check_gitignore():
    """Verify .tool-factory/ is in .gitignore."""
    gitignore = Path('.gitignore')
    if not gitignore.exists():
        print("FAIL: .gitignore not found")
        return False
    content = gitignore.read_text()
    if '.tool-factory/' not in content:
        print("FAIL: .tool-factory/ not in .gitignore")
        return False
    print("PASS: .tool-factory/ is gitignored")
    return True

def check_server_starts():
    """Verify the server starts without error."""
    try:
        proc = subprocess.run(
            ['python3', '-c', 'from src.tool_factory.server import mcp; print("OK")'],
            capture_output=True, text=True, timeout=10
        )
        if proc.returncode != 0:
            print(f"FAIL: server import failed: {proc.stderr}")
            return False
        print("PASS: server imports successfully")
        return True
    except subprocess.TimeoutExpired:
        print("FAIL: server import timed out")
        return False

if __name__ == '__main__':
    results = [check_settings(), check_gitignore(), check_server_starts()]
    sys.exit(0 if all(results) else 1)
```

## Files to Create

- None (registration is a command, not a file)

## Files to Modify

- `.claude/settings.local.json` — Add `tool-factory` MCP server entry and permission rules
- `.gitignore` — Add `.tool-factory/` entry (verify idempotent)

## Validation Criteria

### Unit Tests
- [ ] (No unit tests for this task — it is configuration, not code. Validation is via Sherlock gates and live smoke test.)

### Sherlock Gates
- [ ] OPERATIONAL READINESS: `.claude/settings.local.json` contains `tool-factory` under `mcpServers` with correct command and args
- [ ] OPERATIONAL READINESS: `python3 -c "from src.tool_factory.server import mcp"` succeeds
- [ ] OPERATIONAL READINESS: Permission rules in settings allow `mcp__tool-factory__*` tools
- [ ] PARITY: `.gitignore` contains `.tool-factory/` entry
- [ ] SECURITY: Permission rules do not grant blanket `*` access — only `mcp__tool-factory__*` tools are allowed

### Live Smoke Test
1. Open a fresh Claude Code session in the project directory
2. Invoke `mcp__tool-factory__list_tools` — verify it returns an empty list (server starts automatically)
3. Invoke `mcp__tool-factory__add_tool` with:
   ```json
   {
     "name": "smoke-test",
     "description": "Add two numbers",
     "code": "def run(params):\n    return {'result': params['a'] + params['b']}",
     "parameters": {
       "type": "object",
       "required": ["a", "b"],
       "properties": {
         "a": {"type": "number"},
         "b": {"type": "number"}
       }
     }
   }
   ```
4. Verify the tool appears in Claude's available tool list (Claude should mention it in context or it should be callable)
5. Invoke `mcp__tool-factory__smoke-test` with `{"a": 5, "b": 3}` — expect `{"result": 8}`
6. Invoke `mcp__tool-factory__remove_tool` with `{"name": "smoke-test"}` — verify removed
7. Verify `.tool-factory/tools/smoke-test.json` no longer exists on disk

## Test Commands

```bash
# Verify registration in settings
python3 -c "
import json
s = json.loads(open('.claude/settings.local.json').read())
tf = s.get('mcpServers', {}).get('tool-factory', {})
assert tf.get('command') == 'python3', f'Wrong command: {tf}'
assert 'src/tool-factory/server.py' in tf.get('args', []), f'Wrong args: {tf}'
print('Registration OK')
"

# Verify gitignore
grep -q '.tool-factory/' .gitignore && echo "Gitignore OK" || echo "Gitignore MISSING"

# Verify server starts
python3 -c "from src.tool_factory.server import mcp; print('Import OK')"

# Run verification script (if created)
python3 scripts/verify_tool_factory_registration.py
```
