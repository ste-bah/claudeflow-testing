"""God Agent interface -- async subprocess bridge to Claude Code CLI.

Spawns ``claude -p <query>`` as an async subprocess, streams progress over
WebSocket, enforces a 60-second timeout, and supports cancellation.  Returns
structured ``GodAgentResult`` objects.  Never raises -- all errors are
captured in the result model.

Full implementation: TASK-GOD-006
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import time
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_MAX_QUERY_LENGTH: int = 500
_TIMEOUT_SECONDS: int = 60
_KILL_GRACE_SECONDS: int = 5
_MAX_OUTPUT_BYTES: int = 10 * 1024 * 1024  # 10 MB stdout cap

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Compiled regex patterns (module-level for performance)
# ---------------------------------------------------------------------------
_PATH_TRAVERSAL_RE: re.Pattern[str] = re.compile(r"\.\.[/\\]|(?:^|\s)\.\.$")
_METACHAR_RE: re.Pattern[str] = re.compile(r"[&|;$`\\<>()\n\r]")
_AGENT_PROGRESS_RE: re.Pattern[str] = re.compile(r"Agent\s+(\d+)/(\d+)")
_JSON_FENCE_RE: re.Pattern[str] = re.compile(
    r"```json\s*\n(.*?)\n\s*```", re.DOTALL,
)

# ---------------------------------------------------------------------------
# Project root (market-terminal/backend)
# ---------------------------------------------------------------------------
_PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------
class GodAgentResult(BaseModel):
    """Immutable structured result from a God Agent invocation.

    Attributes:
        status: One of ``"success"``, ``"error"``, ``"timeout"``,
            ``"busy"``, or ``"cancelled"``.
        query: The original (sanitized) query string.
        response_text: Raw stdout text from the CLI process.
        structured_data: Parsed JSON from the response, if any.
        execution_time_ms: Wall-clock duration in milliseconds.
        agent_count: Number of agents reported (from "Agent N/M" lines).
        error_message: Human-readable error description, if applicable.
    """

    model_config = ConfigDict(frozen=True)

    status: str
    query: str
    response_text: str
    structured_data: dict[str, Any] | None = None
    execution_time_ms: int = 0
    agent_count: int = 0
    error_message: str | None = None


# ---------------------------------------------------------------------------
# Input sanitization
# ---------------------------------------------------------------------------
def _sanitize_query(raw: str) -> tuple[str, str | None]:
    r"""Validate and sanitize a raw user query string.

    Four-stage validation:
      1. Length check (max 500 characters).
      2. Path traversal block (``../``, ``..\``, and bare ``..``).
      3. Metacharacter strip (``&|;$`\\<>()\n\r``).
      4. Re-validate path traversal (metachar strip can create new patterns).

    Returns:
        A tuple of ``(sanitized_query, error_message)``.  If
        ``error_message`` is not ``None``, the query was rejected.
    """
    if not raw or not raw.strip():
        return "", "Query must not be empty"

    stripped = raw.strip()

    # Stage 1: length
    if len(stripped) > _MAX_QUERY_LENGTH:
        return "", f"Query exceeds maximum length of {_MAX_QUERY_LENGTH} characters"

    # Stage 2: path traversal
    if _PATH_TRAVERSAL_RE.search(stripped):
        return "", "Query contains disallowed path traversal sequence"

    # Stage 3: metacharacter strip
    sanitized = _METACHAR_RE.sub("", stripped)

    # Stage 4: re-validate path traversal after metachar strip
    # (stripping metachars could create new ".." sequences)
    if _PATH_TRAVERSAL_RE.search(sanitized):
        return "", "Query contains disallowed path traversal sequence"

    return sanitized, None


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------
def _parse_response(raw_stdout: str) -> tuple[str, dict[str, Any] | None, int]:
    """Extract structured data and agent count from raw CLI output.

    Extracts JSON from fenced ``json`` code blocks (preferred) or bare
    top-level JSON objects.  Extracts agent count from the last
    ``Agent N/M`` match in the output.

    Returns:
        A tuple of ``(text, parsed_json, agent_count)``.
    """
    text = raw_stdout.strip()
    parsed_json: dict[str, Any] | None = None
    agent_count = 0

    # Try fenced ```json blocks first
    fence_match = _JSON_FENCE_RE.search(raw_stdout)
    if fence_match is not None:
        try:
            parsed_json = json.loads(fence_match.group(1))
        except (json.JSONDecodeError, ValueError):
            pass

    # Fall back to bare top-level JSON
    if parsed_json is None and text.startswith("{"):
        try:
            parsed_json = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            pass

    # Extract agent count from last "Agent N/M" match
    agent_matches = _AGENT_PROGRESS_RE.findall(raw_stdout)
    if agent_matches:
        last_current, last_total = agent_matches[-1]
        try:
            agent_count = int(last_total)
        except (ValueError, TypeError):
            pass

    return text, parsed_json, agent_count


# ---------------------------------------------------------------------------
# Stdout reader with progress broadcasting
# ---------------------------------------------------------------------------
async def _read_stdout_with_progress(
    reader: asyncio.StreamReader,
    ticker: str | None,
) -> str:
    """Read stdout line-by-line, broadcasting progress over WebSocket.

    Lines matching ``Agent N/M`` are sent to connected WebSocket clients
    as progress updates.  All lines are accumulated and returned as a
    single string.  Output is capped at ``_MAX_OUTPUT_BYTES`` to prevent
    unbounded memory growth.

    Args:
        reader: The stdout stream reader from the subprocess.
        ticker: Optional ticker symbol for context in broadcasts.

    Returns:
        The complete stdout output as a string.
    """
    lines: list[str] = []
    total_bytes = 0

    while True:
        line_bytes = await reader.readline()
        if not line_bytes:
            break

        total_bytes += len(line_bytes)
        if total_bytes > _MAX_OUTPUT_BYTES:
            lines.append("[output truncated -- exceeded 10 MB limit]")
            break

        line = line_bytes.decode("utf-8", errors="replace").rstrip("\n\r")
        lines.append(line)

        # Broadcast agent progress lines
        progress_match = _AGENT_PROGRESS_RE.search(line)
        if progress_match is not None:
            current = progress_match.group(1)
            total = progress_match.group(2)
            _broadcast_ws({
                "type": "god_agent_progress",
                "ticker": ticker,
                "agent_current": int(current),
                "agent_total": int(total),
                "message": line,
            })

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Process termination
# ---------------------------------------------------------------------------
async def _kill_process(proc: asyncio.subprocess.Process) -> None:
    """Terminate a subprocess gracefully, escalating to kill if needed.

    Calls ``proc.terminate()`` first, waits up to 5 seconds, then calls
    ``proc.kill()`` if the process has not exited.  Handles
    ``ProcessLookupError`` and ``OSError`` for already-exited processes.
    """
    try:
        proc.terminate()
    except (ProcessLookupError, OSError):
        # Process already exited
        pass

    try:
        await asyncio.wait_for(proc.wait(), timeout=_KILL_GRACE_SECONDS)
    except asyncio.TimeoutError:
        # Escalate to SIGKILL
        try:
            proc.kill()
        except (ProcessLookupError, OSError):
            pass

    # Always wait for final cleanup
    try:
        await proc.wait()
    except (ProcessLookupError, OSError):
        pass


# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------
_lock = asyncio.Lock()
_current_process: asyncio.subprocess.Process | None = None
_cancel_event: asyncio.Event | None = None


def _broadcast_ws(message: dict[str, Any]) -> None:
    """Broadcast a message to all connected WebSocket clients.

    Lazily imports ``ws_manager`` to avoid circular imports.  Silently
    ignores all errors so callers are never disrupted.
    """
    try:
        from app.api.routes.websocket import ws_manager

        asyncio.ensure_future(ws_manager.broadcast(message))
    except Exception:
        logger.debug("WebSocket broadcast failed", exc_info=True)


def _broadcast_completion(result: GodAgentResult, ticker: str | None) -> None:
    """Broadcast a ``god_agent_complete`` message for any terminal result.

    Fire-and-forget -- delegates to :func:`_broadcast_ws` at every exit path
    of :func:`invoke_claude_code` so clients always get a completion event.
    """
    _broadcast_ws({
        "type": "god_agent_complete",
        "ticker": ticker,
        "status": result.status,
        "execution_time_ms": result.execution_time_ms,
        "agent_count": result.agent_count,
    })


# ---------------------------------------------------------------------------
# Public API: invoke
# ---------------------------------------------------------------------------
async def invoke_claude_code(
    query: str,
    *,
    ticker: str | None = None,
) -> GodAgentResult:
    """Invoke Claude Code CLI with *query* and return a structured result.

    Runs ``claude -p <sanitized_query>`` as an async subprocess with a
    60-second timeout.  Supports concurrent-call rejection (returns
    ``"busy"``) and cancellation via :func:`cancel_current`.

    This function **never raises**.  All error conditions are captured in
    the returned :class:`GodAgentResult`.

    Args:
        query: The natural-language query to send to Claude Code.
        ticker: Optional ticker symbol for WebSocket progress context.

    Returns:
        A :class:`GodAgentResult` with status, response text, and any
        parsed structured data.
    """
    global _current_process, _cancel_event

    t0 = time.monotonic()

    # Stage 1: sanitize
    sanitized, error_msg = _sanitize_query(query)
    if error_msg is not None:
        result = GodAgentResult(
            status="error",
            query=query[:_MAX_QUERY_LENGTH],
            response_text="",
            error_message=error_msg,
        )
        _broadcast_completion(result, ticker)
        return result

    # Stage 2: busy check
    if _lock.locked():
        result = GodAgentResult(
            status="busy",
            query=sanitized,
            response_text="",
            error_message="Another query is already in progress",
        )
        _broadcast_completion(result, ticker)
        return result

    async with _lock:
        cancel_evt = asyncio.Event()
        _cancel_event = cancel_evt
        proc: asyncio.subprocess.Process | None = None

        try:
            # Stage 3: resolve CLI binary
            claude_exe = shutil.which("claude")
            if claude_exe is None:
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="error",
                    query=sanitized,
                    response_text="",
                    execution_time_ms=elapsed,
                    error_message="Claude CLI not found -- is 'claude' installed and on PATH?",
                )
                _broadcast_completion(result, ticker)
                return result

            cmd = [claude_exe, "-p", sanitized]

            # Stage 4: spawn subprocess
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(_PROJECT_ROOT),
                )
            except FileNotFoundError:
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="error",
                    query=sanitized,
                    response_text="",
                    execution_time_ms=elapsed,
                    error_message="Claude CLI not found -- is 'claude' installed and on PATH?",
                )
                _broadcast_completion(result, ticker)
                return result
            except PermissionError:
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="error",
                    query=sanitized,
                    response_text="",
                    execution_time_ms=elapsed,
                    error_message="Permission denied when launching Claude CLI",
                )
                _broadcast_completion(result, ticker)
                return result

            _current_process = proc

            # Stage 5: wait with timeout + cancellation
            assert proc.stdout is not None  # guaranteed by PIPE
            read_task = asyncio.create_task(
                _read_stdout_with_progress(proc.stdout, ticker),
            )
            cancel_task = asyncio.create_task(cancel_evt.wait())

            done, pending = await asyncio.wait(
                {read_task, cancel_task},
                timeout=_TIMEOUT_SECONDS,
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Stage 6: handle outcome
            stdout_text = ""

            if cancel_task in done:
                # Cancelled
                for task in pending:
                    task.cancel()
                await _kill_process(proc)
                if read_task in done:
                    stdout_text = read_task.result()
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="cancelled",
                    query=sanitized,
                    response_text=stdout_text,
                    execution_time_ms=elapsed,
                    error_message="Query was cancelled",
                )
                _broadcast_completion(result, ticker)
                return result

            if not done:
                # Timeout -- neither task completed
                for task in pending:
                    task.cancel()
                await _kill_process(proc)
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="timeout",
                    query=sanitized,
                    response_text="",
                    execution_time_ms=elapsed,
                    error_message=f"Query timed out after {_TIMEOUT_SECONDS} seconds",
                )
                _broadcast_completion(result, ticker)
                return result

            # read_task completed -- cancel the cancel_task
            cancel_task.cancel()
            stdout_text = read_task.result()

            # Wait for process to fully exit
            await proc.wait()

            # Check exit code
            if proc.returncode != 0:
                stderr_bytes = await proc.stderr.read() if proc.stderr else b""
                stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()
                logger.warning(
                    "Claude CLI exited with code %d: %s",
                    proc.returncode,
                    stderr_text[:200],
                )
                elapsed = int((time.monotonic() - t0) * 1000)
                result = GodAgentResult(
                    status="error",
                    query=sanitized,
                    response_text=stdout_text,
                    execution_time_ms=elapsed,
                    error_message=f"Claude CLI exited with code {proc.returncode}",
                )
                _broadcast_completion(result, ticker)
                return result

            # Stage 7: parse response
            text, structured, agent_count = _parse_response(stdout_text)

            elapsed = int((time.monotonic() - t0) * 1000)

            result = GodAgentResult(
                status="success",
                query=sanitized,
                response_text=text,
                structured_data=structured,
                execution_time_ms=elapsed,
                agent_count=agent_count,
            )

            # Stage 8: broadcast completion
            _broadcast_completion(result, ticker)

            return result

        except Exception as exc:
            # Catch-all: never let invoke_claude_code raise
            logger.exception("Unexpected error in invoke_claude_code")
            elapsed = int((time.monotonic() - t0) * 1000)
            if proc is not None:
                await _kill_process(proc)
            result = GodAgentResult(
                status="error",
                query=sanitized,
                response_text="",
                execution_time_ms=elapsed,
                error_message=f"Unexpected error: {type(exc).__name__}",
            )
            _broadcast_completion(result, ticker)
            return result
        finally:
            _current_process = None
            _cancel_event = None


# ---------------------------------------------------------------------------
# Public API: cancel
# ---------------------------------------------------------------------------
async def cancel_current() -> bool:
    """Cancel the currently running God Agent query, if any.

    Returns ``True`` if a cancellation signal was sent, ``False`` if no
    query was in flight.
    """
    evt = _cancel_event
    if evt is not None and not evt.is_set():
        evt.set()
        logger.info("Cancellation signal sent to running query")
        return True
    return False


__all__ = ["GodAgentResult", "invoke_claude_code", "cancel_current"]
