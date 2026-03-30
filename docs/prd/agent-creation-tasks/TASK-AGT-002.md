# TASK-AGT-002: Tool Factory MCP Server

```
Task ID:       TASK-AGT-002
Status:        READY
Implements:    REQ-TOOL-001, REQ-TOOL-002, REQ-TOOL-003, REQ-TOOL-004, REQ-TOOL-005, REQ-TOOL-006, REQ-TOOL-007, REQ-TOOL-008, REQ-TOOL-009, REQ-TOOL-010, REQ-TOOL-011
Depends On:    None
Complexity:    High
Guardrails:    GR-002 (subprocess sandbox), GR-005 (gitignore tool factory), GR-008 (no secrets in env)
NFRs:          NFR-TOOL-001 (performance), NFR-TOOL-002 (security), NFR-TOOL-003 (reliability)
Security:      HIGH risk — executes arbitrary user-provided Python code. Mitigated by subprocess isolation, env allowlist, timeout, memory limit. Development-grade sandboxing only.
```

## Context

The Tool Factory is a persistent MCP server that allows agents (and users) to create, manage, and execute dynamic tools at runtime. It bridges the gap between the static tool set provided by Claude Code's built-in tools and the ad-hoc computation needs of specialized agents. The server is registered once with Claude Code via `claude mcp add` and runs as a stdio-transport MCP server.

Dynamic tools are Python functions with JSON Schema parameter validation, executed in sandboxed subprocesses. Tool definitions persist to disk so they survive server restarts. A TTL mechanism allows ephemeral tools that auto-expire.

## Scope

### In Scope
- FastMCP server with 5 management tools + N dynamic tools
- Subprocess sandbox executor with timeout, memory limit, env stripping
- Disk persistence for tool definitions (JSON files)
- TTL-based auto-expiry with `notifications/tools/list_changed`
- Syntax validation for Python code before registration
- Tool name collision detection against reserved words
- Logging to `.god-agent/tool-factory.log`
- Maximum active tool limit (20)

### Out of Scope
- JavaScript/TypeScript tool code (Python only in Phase 1)
- Docker containerization (development environment only)
- MemoryGraph registration of tool metadata (deferred to TASK-AGT-003 or later)
- Permission configuration in settings.local.json (TASK-AGT-003)
- The `claude mcp add` registration command (TASK-AGT-003)

## Key Design Decisions

1. **FastMCP framework**: Use `mcp[cli]` (Python MCP SDK with FastMCP convenience layer). FastMCP provides decorator-based tool registration, stdio transport, and automatic `list_changed` notifications via `server.notify_tools_list_changed()`.
2. **Python-only tool code**: Phase 1 supports only Python. The `language` parameter in `add_tool` is accepted but must be `"python"`. Other languages return an error.
3. **Subprocess per invocation**: Each tool invocation spawns a new subprocess via `asyncio.create_subprocess_exec`. No process pooling in Phase 1 — simplicity over throughput.
4. **JSON-in/JSON-out**: Tool code receives parameters as a JSON string on stdin and must write JSON to stdout. The executor wraps user code in a harness that handles serialization.
5. **Persistence format**: Each tool is a single JSON file at `.tool-factory/tools/{name}.json` containing the full definition (code, schema, metadata). On startup, the server reads all files in this directory.
6. **TTL check on invocation**: Expiry is checked both on a periodic timer (every 60 seconds) and on every tool invocation. This avoids needing a background thread while keeping expired tools from executing.

## Detailed Specifications

### Server Entry Point (`src/tool-factory/server.py`)

```python
#!/usr/bin/env python3
"""Tool Factory MCP Server — dynamic tool creation and execution."""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from .executor import SandboxExecutor
from .persistence import ToolStore

# Server setup
mcp = FastMCP("tool-factory")
logger = logging.getLogger("tool-factory")

# Globals initialized in main()
_store: ToolStore
_executor: SandboxExecutor

# --- Management Tools ---

@mcp.tool()
async def add_tool(
    name: str,
    description: str,
    code: str,
    language: str = "python",
    parameters: dict | None = None,
    ttl_minutes: int = 0,
    timeout_seconds: int = 30,
) -> str:
    """Register a new dynamic tool.

    Args:
        name: Unique tool name (lowercase, alphanumeric + hyphens, 3-50 chars).
        description: Human-readable description of what the tool does.
        code: Python source code. Receives JSON params on stdin, writes JSON to stdout.
        language: Programming language. Only "python" supported in Phase 1.
        parameters: JSON Schema for input validation. If None, tool accepts no params.
        ttl_minutes: Auto-expire after this many minutes. 0 = no expiry.
        timeout_seconds: Subprocess timeout (1-120 seconds). Default 30.

    Returns:
        Confirmation message with tool name.

    Raises:
        ValueError: If name is invalid, already exists, language unsupported,
                    code has syntax errors, or active tool limit reached.
    """
    ...

@mcp.tool()
async def remove_tool(name: str) -> str:
    """Unregister a dynamic tool and delete its persisted definition.

    Args:
        name: Name of the tool to remove.

    Returns:
        Confirmation message.

    Raises:
        ValueError: If tool does not exist.
    """
    ...

@mcp.tool()
async def list_tools(include_expired: bool = False) -> str:
    """List all registered dynamic tools.

    Args:
        include_expired: If True, also show expired tools not yet cleaned up.

    Returns:
        JSON array of tool summaries (name, description, created, last_used,
        invocation_count, ttl_remaining_minutes, expired).
    """
    ...

@mcp.tool()
async def view_source(name: str) -> str:
    """Inspect the source code of a dynamic tool.

    Args:
        name: Name of the tool to inspect.

    Returns:
        The tool's source code as a string.

    Raises:
        ValueError: If tool does not exist.
    """
    ...

@mcp.tool()
async def update_tool(
    name: str,
    code: str | None = None,
    description: str | None = None,
    parameters: dict | None = None,
) -> str:
    """Modify an existing dynamic tool's code, description, or parameters.

    Args:
        name: Name of the tool to update.
        code: New Python source code (optional).
        description: New description (optional).
        parameters: New JSON Schema for input validation (optional).

    Returns:
        Confirmation message with what was updated.

    Raises:
        ValueError: If tool does not exist or new code has syntax errors.
    """
    ...
```

### Tool Name Validation Rules

```python
import re
import keyword

TOOL_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_-]{1,48}[a-z0-9]$')
TOOL_NAME_MIN_LENGTH = 3
TOOL_NAME_MAX_LENGTH = 50

# Built-in Claude Code tool names (case-insensitive collision check)
RESERVED_TOOL_NAMES = frozenset({
    'read', 'write', 'edit', 'multiedit', 'bash', 'glob', 'grep',
    'todoread', 'todowrite', 'task', 'agent',
    'webbrowser', 'webfetch', 'websearch',
    'notebookedit', 'notebookread',
})

# Common MCP tool prefixes (warn if tool name starts with these)
MCP_TOOL_PREFIXES = frozenset({
    'mcp__', 'claude-flow', 'memorygraph', 'leann', 'git',
})

def validate_tool_name(name: str) -> tuple[list[str], list[str]]:
    """Validate a tool name. Returns (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    if not TOOL_NAME_PATTERN.match(name):
        errors.append(
            f"Tool name '{name}' is invalid. Must be 3-50 chars, lowercase "
            f"alphanumeric with hyphens/underscores, starting with a letter."
        )

    if keyword.iskeyword(name):
        errors.append(f"Tool name '{name}' is a Python reserved keyword.")

    if name.lower() in RESERVED_TOOL_NAMES:
        warnings.append(
            f"Tool name '{name}' may conflict with built-in tool '{name}'. "
            f"Consider a more specific name. (EC-TOOL-007)"
        )

    for prefix in MCP_TOOL_PREFIXES:
        if name.startswith(prefix):
            warnings.append(
                f"Tool name '{name}' starts with MCP prefix '{prefix}'. "
                f"This may cause confusion with existing MCP tools."
            )

    return errors, warnings
```

### Syntax Validation

```python
import ast

def validate_python_syntax(code: str) -> tuple[bool, str | None]:
    """Validate Python code syntax without executing it.

    Returns:
        (True, None) if valid.
        (False, error_message) if invalid, with line number and description.
    """
    try:
        ast.parse(code)
        return True, None
    except SyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.msg}"
```

### Sandbox Executor (`src/tool-factory/executor.py`)

```python
"""Subprocess sandbox for executing dynamic tool code."""

import asyncio
import json
import os
import resource
import tempfile
from dataclasses import dataclass
from pathlib import Path

# Environment variable allowlist (REQ-TOOL-004)
ENV_ALLOWLIST = frozenset({'PATH', 'HOME', 'LANG', 'PYTHONPATH'})

# Memory limit: 256MB
MEMORY_LIMIT_BYTES = 256 * 1024 * 1024

@dataclass
class ExecutionResult:
    success: bool
    output: str         # JSON string on success, error message on failure
    exit_code: int
    duration_ms: float
    stderr: str         # captured stderr for debugging

class SandboxExecutor:
    """Execute dynamic tool code in a sandboxed subprocess."""

    async def execute(
        self,
        code: str,
        parameters: dict,
        timeout_seconds: int = 30,
    ) -> ExecutionResult:
        """Execute tool code with parameters in a sandboxed subprocess.

        The code is wrapped in a harness that:
        1. Reads JSON parameters from stdin
        2. Calls the user's code with parsed parameters
        3. Writes the return value as JSON to stdout

        Sandbox constraints:
        - cwd: temporary directory (not project root)
        - env: only PATH, HOME, LANG, PYTHONPATH
        - timeout: configurable (default 30s, max 120s)
        - memory: 256MB via resource.setrlimit (best-effort on macOS)

        Args:
            code: Python source code defining a function `run(params: dict) -> dict`
            parameters: Tool parameters (already validated against JSON Schema)
            timeout_seconds: Max execution time in seconds

        Returns:
            ExecutionResult with success/failure, output, timing
        """
        ...

    def _build_harness(self, user_code: str) -> str:
        """Wrap user code in an execution harness.

        The harness:
        1. Sets memory limit via resource.setrlimit
        2. Reads JSON from stdin
        3. Defines the user's code
        4. Calls run(params) and prints JSON result to stdout
        5. Catches all exceptions and returns error JSON
        """
        return f'''
import json
import sys
import resource

# Set memory limit (best-effort)
try:
    resource.setrlimit(resource.RLIMIT_AS, ({MEMORY_LIMIT_BYTES}, {MEMORY_LIMIT_BYTES}))
except (ValueError, resource.error):
    pass  # macOS may not support RLIMIT_AS; continue without limit

# Read parameters from stdin
params = json.loads(sys.stdin.read())

# User code
{user_code}

# Execute and return result
try:
    result = run(params)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{"error": str(e), "type": type(e).__name__}}))
    sys.exit(1)
'''

    def _build_env(self) -> dict[str, str]:
        """Build sandboxed environment with only allowlisted variables."""
        return {k: v for k, v in os.environ.items() if k in ENV_ALLOWLIST}
```

### Persistence (`src/tool-factory/persistence.py`)

```python
"""Disk persistence for dynamic tool definitions."""

import json
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

TOOLS_DIR = Path('.tool-factory/tools')

@dataclass
class ToolDefinition:
    name: str
    description: str
    code: str
    language: str
    parameters: dict | None
    ttl_minutes: int
    timeout_seconds: int
    created_at: str               # ISO 8601
    last_used: str | None         # ISO 8601 or None
    invocation_count: int = 0
    code_hash: str = ''           # SHA-256 of code for logging
    expires_at: str | None = None # ISO 8601 or None (computed from created_at + ttl)

    def __post_init__(self):
        if not self.code_hash:
            self.code_hash = hashlib.sha256(self.code.encode()).hexdigest()[:16]
        if self.ttl_minutes > 0 and not self.expires_at:
            created = datetime.fromisoformat(self.created_at)
            from datetime import timedelta
            self.expires_at = (created + timedelta(minutes=self.ttl_minutes)).isoformat()

    def is_expired(self) -> bool:
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) >= datetime.fromisoformat(self.expires_at)

class ToolStore:
    """Manages tool definitions on disk."""

    def __init__(self, base_dir: Path = TOOLS_DIR):
        self._dir = base_dir
        self._tools: dict[str, ToolDefinition] = {}

    def init(self) -> int:
        """Create directory and load all persisted tools. Returns count loaded."""
        self._dir.mkdir(parents=True, exist_ok=True)
        loaded = 0
        for path in self._dir.glob('*.json'):
            try:
                data = json.loads(path.read_text())
                tool = ToolDefinition(**data)
                self._tools[tool.name] = tool
                loaded += 1
            except Exception as e:
                # EC-TOOL-003: skip corrupt file, log error
                import logging
                logging.getLogger('tool-factory').error(
                    f"Failed to load tool from {path}: {e}"
                )
        return loaded

    def save(self, tool: ToolDefinition) -> None:
        """Persist a tool definition to disk (atomic write via temp + rename)."""
        path = self._dir / f'{tool.name}.json'
        tmp_path = path.with_suffix('.json.tmp')
        tmp_path.write_text(json.dumps(asdict(tool), indent=2))
        tmp_path.rename(path)

    def delete(self, name: str) -> None:
        """Delete a tool definition from disk and memory."""
        path = self._dir / f'{name}.json'
        if path.exists():
            path.unlink()
        self._tools.pop(name, None)

    def get(self, name: str) -> ToolDefinition | None:
        """Get a tool definition by name."""
        return self._tools.get(name)

    def list_all(self, include_expired: bool = False) -> list[ToolDefinition]:
        """List all tools, optionally including expired ones."""
        if include_expired:
            return list(self._tools.values())
        return [t for t in self._tools.values() if not t.is_expired()]

    def count_active(self) -> int:
        """Count non-expired tools."""
        return sum(1 for t in self._tools.values() if not t.is_expired())

    def has(self, name: str) -> bool:
        """Check if a tool exists (expired or not)."""
        return name in self._tools
```

### Persistence Schema (`.tool-factory/tools/{name}.json`)

```json
{
  "name": "calculate-roi",
  "description": "Calculate return on investment given cost and revenue",
  "code": "def run(params):\n    cost = params['cost']\n    revenue = params['revenue']\n    roi = (revenue - cost) / cost * 100\n    return {'roi_percent': round(roi, 2)}",
  "language": "python",
  "parameters": {
    "type": "object",
    "required": ["cost", "revenue"],
    "properties": {
      "cost": { "type": "number", "description": "Initial cost" },
      "revenue": { "type": "number", "description": "Total revenue" }
    }
  },
  "ttl_minutes": 0,
  "timeout_seconds": 30,
  "created_at": "2026-03-30T10:00:00+00:00",
  "last_used": "2026-03-30T14:30:00+00:00",
  "invocation_count": 5,
  "code_hash": "a1b2c3d4e5f6g7h8",
  "expires_at": null
}
```

### Dynamic Tool Registration Flow

When `add_tool` is called:

1. Validate tool name (pattern, reserved words, collision check)
2. Check active tool count against limit (20)
3. Validate `language == "python"`
4. Validate Python syntax via `ast.parse(code)`
5. Validate `parameters` is valid JSON Schema (if provided)
6. Check for existing tool with same name — error if exists (REQ-TOOL-007)
7. Create `ToolDefinition` with timestamps
8. Persist to disk via `ToolStore.save()`
9. Register as dynamic MCP tool via `mcp.add_tool()` (FastMCP dynamic registration)
10. Send `notifications/tools/list_changed` via `await mcp.notify_tools_list_changed()`
11. Log to `.god-agent/tool-factory.log`
12. Return confirmation

### Dynamic Tool Invocation Flow

When a dynamic tool is called by Claude:

1. FastMCP routes the call to a dispatcher function
2. Dispatcher checks if tool exists and is not expired
3. If expired: remove tool, send `list_changed`, return error
4. Validate input against JSON Schema (REQ-TOOL-010)
5. Strip extra parameters not in schema (EC-TOOL-006)
6. Call `SandboxExecutor.execute(code, validated_params, timeout)`
7. Update `last_used` and `invocation_count` in ToolDefinition
8. Persist updated definition to disk
9. Return result to Claude

### TTL Expiry

```python
async def _expiry_check_loop(self):
    """Periodic check for expired tools. Runs every 60 seconds."""
    while True:
        await asyncio.sleep(60)
        expired = [t for t in _store.list_all(include_expired=True) if t.is_expired()]
        for tool in expired:
            _store.delete(tool.name)
            # Unregister from MCP
            logger.info(f"Tool '{tool.name}' expired (TTL: {tool.ttl_minutes}m)")
        if expired:
            await mcp.notify_tools_list_changed()
```

### Logging Format

Log entries to `.god-agent/tool-factory.log`:

```
2026-03-30T10:00:00Z [ADD] name=calculate-roi hash=a1b2c3d4 creator=user ttl=0
2026-03-30T10:05:00Z [INVOKE] name=calculate-roi duration_ms=45 success=true
2026-03-30T10:10:00Z [REMOVE] name=calculate-roi reason=user_request
2026-03-30T10:15:00Z [EXPIRE] name=temp-tool reason=ttl_expired ttl=60
2026-03-30T10:20:00Z [ERROR] name=bad-tool error="Syntax error at line 3: unexpected indent"
```

## Files to Create

- `src/tool-factory/__init__.py` — Package init
- `src/tool-factory/server.py` — FastMCP server with 5 management tools + dynamic tool dispatcher
- `src/tool-factory/executor.py` — `SandboxExecutor` class with subprocess sandboxing
- `src/tool-factory/persistence.py` — `ToolStore` + `ToolDefinition` dataclass
- `tests/tool-factory/__init__.py` — Empty package init
- `tests/tool-factory/test_server.py` — Tests for management tools
- `tests/tool-factory/test_executor.py` — Tests for sandbox execution
- `tests/tool-factory/test_persistence.py` — Tests for disk persistence
- `tests/tool-factory/conftest.py` — Shared fixtures (temp directories, mock tools)

## Files to Modify

- `.gitignore` — Add `.tool-factory/` entry (if not already present)

## Validation Criteria

### Unit Tests

#### test_persistence.py
- [ ] `ToolStore.init()` creates directory if missing
- [ ] `ToolStore.save()` writes valid JSON to expected path
- [ ] `ToolStore.save()` uses atomic write (temp + rename)
- [ ] `ToolStore.init()` loads previously saved tools
- [ ] `ToolStore.delete()` removes file and memory entry
- [ ] `ToolStore.get()` returns None for non-existent tool
- [ ] `ToolStore.list_all(include_expired=False)` excludes expired tools
- [ ] `ToolStore.list_all(include_expired=True)` includes expired tools
- [ ] `ToolStore.count_active()` counts only non-expired tools
- [ ] `ToolDefinition.is_expired()` returns False when no TTL
- [ ] `ToolDefinition.is_expired()` returns True when TTL exceeded
- [ ] `ToolDefinition.is_expired()` returns False when TTL not yet exceeded
- [ ] Corrupt JSON file is skipped on init with error logged (EC-TOOL-003)

#### test_executor.py
- [ ] Simple `run(params)` function executes and returns JSON
- [ ] Parameters are correctly passed via stdin
- [ ] Subprocess timeout kills process after specified seconds (EC-TOOL-001)
- [ ] Environment contains only allowlisted variables (PATH, HOME, LANG, PYTHONPATH)
- [ ] `ANTHROPIC_API_KEY` is NOT in subprocess environment
- [ ] `AWS_SECRET_ACCESS_KEY` is NOT in subprocess environment
- [ ] Subprocess cwd is a temp directory, not project root
- [ ] Code that raises exception returns error JSON with type and message
- [ ] Code that writes to stderr captures it in `ExecutionResult.stderr`
- [ ] Execution timing is recorded in `duration_ms`
- [ ] Memory-intensive code does not crash the parent process (best-effort)

#### test_server.py
- [ ] `add_tool` with valid Python code succeeds and returns confirmation
- [ ] `add_tool` with invalid Python syntax returns error with line number (EC-TOOL-004)
- [ ] `add_tool` with duplicate name returns error "Tool '{name}' already exists" (REQ-TOOL-007)
- [ ] `add_tool` with `language="javascript"` returns unsupported language error
- [ ] `add_tool` with invalid tool name pattern returns validation error
- [ ] `add_tool` with reserved name `read` returns warning about collision (REQ-TOOL-011)
- [ ] `add_tool` when 20 tools already exist returns limit error (REQ-TOOL-009)
- [ ] `remove_tool` with valid name deletes tool
- [ ] `remove_tool` with non-existent name returns error
- [ ] `list_tools` returns all active tools
- [ ] `list_tools(include_expired=True)` includes expired tools
- [ ] `view_source` returns tool code
- [ ] `view_source` with non-existent name returns error
- [ ] `update_tool` modifies code and re-validates syntax
- [ ] `update_tool` modifies description only (code unchanged)
- [ ] `update_tool` with non-existent name returns error
- [ ] TTL-expired tool is not callable (returns error)
- [ ] Dynamic tool invocation with valid params returns result
- [ ] Dynamic tool invocation with invalid params (schema violation) returns error
- [ ] Dynamic tool invocation with extra params strips them (EC-TOOL-006)
- [ ] `add_tool` with `timeout_seconds=0` returns validation error
- [ ] `add_tool` with `timeout_seconds=121` returns validation error

### Sherlock Gates
- [ ] OPERATIONAL READINESS: `python -c "from src.tool_factory.server import mcp"` imports without error
- [ ] OPERATIONAL READINESS: Server starts via `python src/tool-factory/server.py` without crashing (exits cleanly when stdin closes)
- [ ] SECURITY: Run `add_tool` with code `import os; print(os.environ)` — verify only allowlisted env vars appear in output
- [ ] SECURITY: Run `add_tool` with code that sleeps for 60 seconds — verify it is killed after timeout
- [ ] PERFORMANCE: `add_tool` registration completes in < 200ms (measure with `time.perf_counter()`)
- [ ] PERFORMANCE: Dynamic tool dispatch overhead is < 50ms (exclude user code execution time)
- [ ] PARITY: `.gitignore` contains `.tool-factory/` entry

### Live Smoke Test
1. Start the server: `python src/tool-factory/server.py` (in a test harness that simulates stdio MCP)
2. Call `add_tool(name="test-calc", description="Add two numbers", code="def run(params): return {'sum': params['a'] + params['b']}", parameters={"type": "object", "required": ["a", "b"], "properties": {"a": {"type": "number"}, "b": {"type": "number"}}})`
3. Verify `.tool-factory/tools/test-calc.json` exists on disk
4. Call the dynamic tool `test-calc` with `{"a": 3, "b": 4}` — expect `{"sum": 7}`
5. Call `list_tools` — verify `test-calc` appears
6. Call `view_source("test-calc")` — verify code is returned
7. Call `update_tool("test-calc", code="def run(params): return {'sum': params['a'] + params['b'], 'product': params['a'] * params['b']}")` — verify success
8. Call `test-calc` again — verify new behavior
9. Call `remove_tool("test-calc")` — verify tool is gone
10. Call `list_tools` — verify empty

## Test Commands

```bash
# Run all tool-factory tests
python -m pytest tests/tool-factory/ -v

# Run just executor tests
python -m pytest tests/tool-factory/test_executor.py -v

# Run just persistence tests
python -m pytest tests/tool-factory/test_persistence.py -v

# Run just server tests
python -m pytest tests/tool-factory/test_server.py -v

# Verify server imports
python -c "from src.tool_factory.server import mcp; print('OK')"

# Verify .gitignore
grep -q '.tool-factory/' .gitignore && echo "GITIGNORE OK" || echo "GITIGNORE MISSING"

# Performance benchmark (after server is testable)
python -c "
import time
from src.tool_factory.persistence import ToolStore, ToolDefinition
from datetime import datetime, timezone
store = ToolStore()
store.init()
start = time.perf_counter()
for i in range(100):
    td = ToolDefinition(name=f'bench-{i}', description='test', code='def run(p): return {}',
                        language='python', parameters=None, ttl_minutes=0, timeout_seconds=30,
                        created_at=datetime.now(timezone.utc).isoformat())
    store.save(td)
elapsed = (time.perf_counter() - start) * 1000
print(f'100 saves in {elapsed:.0f}ms ({elapsed/100:.1f}ms per save)')
for i in range(100):
    store.delete(f'bench-{i}')
"
```
