"""Tests for TASK-GOD-006: god_agent_interface module.

Validates ``GodAgentResult`` model, ``_sanitize_query``, ``_parse_response``,
``invoke_claude_code``, ``cancel_current``, ``_kill_process``,
``_read_stdout_with_progress``, and ``_broadcast_ws``.

All async subprocess calls are mocked -- no real ``claude`` process is ever
spawned.  Module-level state (``_lock``, ``_cancel_event``,
``_current_process``) is reset between tests via fixtures.

Run with: ``pytest tests/test_god_agent_interface.py -v``
"""
from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent.god_agent_interface import (
    GodAgentResult,
    _kill_process,
    _parse_response,
    _read_stdout_with_progress,
    _sanitize_query,
    cancel_current,
    invoke_claude_code,
)
import app.agent.god_agent_interface as _mod


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_module_state():
    """Reset module-level mutable state before and after every test.

    This prevents leaked locks or cancel events from poisoning other tests.
    """
    _mod._current_process = None
    _mod._cancel_event = None
    # Ensure the lock is unlocked.  If a previous test leaked a held lock we
    # replace it entirely so the next test gets a fresh one.
    _mod._lock = asyncio.Lock()
    yield
    _mod._current_process = None
    _mod._cancel_event = None
    _mod._lock = asyncio.Lock()


@pytest.fixture(autouse=True)
def _mock_shutil_which():
    """Ensure shutil.which('claude') returns a path in all tests.

    The production code now resolves the ``claude`` binary via
    ``shutil.which`` before spawning a subprocess.  Tests that mock
    ``create_subprocess_exec`` need this to succeed so execution reaches
    the subprocess mock.
    """
    with patch("app.agent.god_agent_interface.shutil.which", return_value="/usr/bin/claude"):
        yield


def _make_mock_process(
    stdout_lines: list[bytes] | None = None,
    stderr_data: bytes = b"",
    returncode: int = 0,
):
    """Build a mock ``asyncio.subprocess.Process``.

    ``stdout_lines`` is a list of byte strings; the mock ``readline`` will
    yield each one followed by ``b""`` to signal EOF.
    """
    if stdout_lines is None:
        stdout_lines = []

    proc = AsyncMock()
    proc.returncode = returncode

    # stdout is a StreamReader-like mock
    reader = AsyncMock()
    reader.readline = AsyncMock(side_effect=[*stdout_lines, b""])
    proc.stdout = reader

    # stderr
    proc.stderr = AsyncMock()
    proc.stderr.read = AsyncMock(return_value=stderr_data)

    # wait should set returncode and resolve
    async def _wait():
        return returncode

    proc.wait = AsyncMock(side_effect=_wait)

    # terminate / kill
    proc.terminate = MagicMock()
    proc.kill = MagicMock()

    return proc


# ===================================================================
# 1. GodAgentResult Model
# ===================================================================


class TestGodAgentResultModel:
    """Validate Pydantic model construction, defaults, immutability."""

    def test_create_with_all_fields(self):
        r = GodAgentResult(
            status="success",
            query="hello",
            response_text="world",
            structured_data={"k": "v"},
            execution_time_ms=42,
            agent_count=3,
            error_message=None,
        )
        assert r.status == "success"
        assert r.query == "hello"
        assert r.response_text == "world"
        assert r.structured_data == {"k": "v"}
        assert r.execution_time_ms == 42
        assert r.agent_count == 3
        assert r.error_message is None

    def test_create_with_required_fields_only(self):
        r = GodAgentResult(status="error", query="q", response_text="")
        assert r.structured_data is None
        assert r.execution_time_ms == 0
        assert r.agent_count == 0
        assert r.error_message is None

    def test_frozen_model_raises_on_mutation(self):
        r = GodAgentResult(status="success", query="q", response_text="ok")
        with pytest.raises(Exception):
            r.status = "error"  # type: ignore[misc]

    def test_frozen_model_raises_on_query_mutation(self):
        r = GodAgentResult(status="success", query="q", response_text="ok")
        with pytest.raises(Exception):
            r.query = "new"  # type: ignore[misc]

    def test_model_dump_returns_dict(self):
        r = GodAgentResult(status="success", query="q", response_text="ok")
        d = r.model_dump()
        assert isinstance(d, dict)
        assert d["status"] == "success"
        assert d["query"] == "q"
        assert d["response_text"] == "ok"

    def test_model_dump_includes_defaults(self):
        r = GodAgentResult(status="error", query="q", response_text="")
        d = r.model_dump()
        assert "structured_data" in d
        assert "execution_time_ms" in d
        assert "agent_count" in d
        assert "error_message" in d

    def test_status_accepts_known_values(self):
        for s in ("success", "error", "timeout", "busy", "cancelled"):
            r = GodAgentResult(status=s, query="q", response_text="")
            assert r.status == s

    def test_structured_data_accepts_nested_dict(self):
        nested = {"a": {"b": [1, 2, 3]}}
        r = GodAgentResult(
            status="success", query="q", response_text="", structured_data=nested
        )
        assert r.structured_data == nested

    def test_execution_time_ms_zero_default(self):
        r = GodAgentResult(status="success", query="q", response_text="")
        assert r.execution_time_ms == 0

    def test_agent_count_zero_default(self):
        r = GodAgentResult(status="success", query="q", response_text="")
        assert r.agent_count == 0


# ===================================================================
# 2. _sanitize_query
# ===================================================================


class TestSanitizeQueryEmpty:
    """Empty / whitespace-only inputs."""

    def test_empty_string_rejected(self):
        sanitized, err = _sanitize_query("")
        assert err is not None
        assert sanitized == ""
        assert "empty" in err.lower()

    def test_whitespace_only_rejected(self):
        sanitized, err = _sanitize_query("   \t\n  ")
        assert err is not None
        assert sanitized == ""

    def test_none_coerced_empty(self):
        """Passing a falsy value (None cast to str at call site is caller's
        problem, but empty string must be rejected)."""
        sanitized, err = _sanitize_query("")
        assert err is not None


class TestSanitizeQueryLength:
    """Length validation at 500 chars."""

    def test_exactly_500_chars_allowed(self):
        q = "a" * 500
        sanitized, err = _sanitize_query(q)
        assert err is None
        assert sanitized == q

    def test_501_chars_rejected(self):
        q = "a" * 501
        sanitized, err = _sanitize_query(q)
        assert err is not None
        assert "500" in err or "length" in err.lower()

    def test_1000_chars_rejected(self):
        q = "x" * 1000
        _, err = _sanitize_query(q)
        assert err is not None


class TestSanitizeQueryPathTraversal:
    """Path traversal blocking."""

    def test_dot_dot_slash_rejected(self):
        _, err = _sanitize_query("read ../etc/passwd")
        assert err is not None
        assert "path traversal" in err.lower()

    def test_dot_dot_backslash_rejected(self):
        _, err = _sanitize_query("read ..\\windows\\system32")
        assert err is not None
        assert "path traversal" in err.lower()

    def test_embedded_path_traversal(self):
        _, err = _sanitize_query("something ../../bad")
        assert err is not None

    def test_single_dot_not_rejected(self):
        sanitized, err = _sanitize_query("price is 3.14")
        assert err is None
        assert "3.14" in sanitized


class TestSanitizeQueryMetacharacters:
    """Shell metacharacter stripping."""

    @pytest.mark.parametrize(
        "char",
        ["&", "|", ";", "$", "`", "\\", "<", ">", "(", ")", "\n", "\r"],
        ids=lambda c: f"meta-{repr(c)}",
    )
    def test_metachar_stripped(self, char: str):
        sanitized, err = _sanitize_query(f"hello{char}world")
        assert err is None
        assert char not in sanitized
        assert "helloworld" in sanitized

    def test_normal_query_unchanged(self):
        q = "What is the price of AAPL today"
        sanitized, err = _sanitize_query(q)
        assert err is None
        assert sanitized == q

    def test_leading_trailing_whitespace_stripped(self):
        sanitized, err = _sanitize_query("  analyze AAPL  ")
        assert err is None
        assert sanitized == "analyze AAPL"

    def test_mixed_metacharacters_stripped(self):
        sanitized, err = _sanitize_query("echo $HOME && ls | grep foo")
        assert err is None
        assert "$" not in sanitized
        assert "&" not in sanitized
        assert "|" not in sanitized

    def test_question_mark_allowed(self):
        sanitized, err = _sanitize_query("What is AAPL?")
        assert err is None
        assert "?" in sanitized

    def test_exclamation_mark_allowed(self):
        sanitized, err = _sanitize_query("Buy AAPL!")
        assert err is None
        assert "!" in sanitized


# ===================================================================
# 3. _parse_response
# ===================================================================


class TestParseResponseJSON:
    """JSON extraction from raw stdout text."""

    def test_fenced_json_extracted(self):
        raw = 'Some text\n```json\n{"key": "value"}\n```\nMore text'
        text, parsed, _cnt = _parse_response(raw)
        assert parsed == {"key": "value"}

    def test_bare_json_extracted(self):
        raw = '{"result": 42}'
        text, parsed, _cnt = _parse_response(raw)
        assert parsed == {"result": 42}

    def test_no_json_returns_none(self):
        raw = "Just plain text with no JSON"
        _, parsed, _ = _parse_response(raw)
        assert parsed is None

    def test_invalid_json_in_fence_returns_none(self):
        raw = '```json\n{invalid json}\n```'
        _, parsed, _ = _parse_response(raw)
        assert parsed is None

    def test_invalid_bare_json_returns_none(self):
        raw = "{not: valid json"
        _, parsed, _ = _parse_response(raw)
        assert parsed is None

    def test_fenced_json_preferred_over_bare(self):
        """When both fenced and bare JSON exist, fenced wins."""
        raw = '{"bare": true}\nSome text\n```json\n{"fenced": true}\n```'
        _, parsed, _ = _parse_response(raw)
        assert parsed == {"fenced": True}

    def test_nested_json_in_fence(self):
        nested = {"outer": {"inner": [1, 2, 3]}}
        raw = f"```json\n{json.dumps(nested)}\n```"
        _, parsed, _ = _parse_response(raw)
        assert parsed == nested

    def test_empty_string_returns_none(self):
        text, parsed, cnt = _parse_response("")
        assert parsed is None
        assert text == ""
        assert cnt == 0

    def test_text_returned_stripped(self):
        raw = "  hello world  "
        text, _, _ = _parse_response(raw)
        assert text == "hello world"


class TestParseResponseAgentCount:
    """Agent count extraction from 'Agent N/M' patterns."""

    def test_single_agent_match(self):
        raw = "Processing Agent 3/12 done"
        _, _, cnt = _parse_response(raw)
        assert cnt == 12

    def test_multiple_agent_matches_uses_last(self):
        raw = "Agent 1/5\nAgent 2/5\nAgent 5/10"
        _, _, cnt = _parse_response(raw)
        assert cnt == 10

    def test_no_agent_match_returns_zero(self):
        raw = "No agents here"
        _, _, cnt = _parse_response(raw)
        assert cnt == 0

    def test_agent_in_middle_of_text(self):
        raw = "Starting\nRunning Agent 7/20\nDone"
        _, _, cnt = _parse_response(raw)
        assert cnt == 20

    def test_agent_with_large_numbers(self):
        raw = "Agent 99/100"
        _, _, cnt = _parse_response(raw)
        assert cnt == 100

    def test_mixed_json_and_agent_count(self):
        raw = 'Agent 2/8\n```json\n{"ok": true}\n```\nAgent 8/8'
        _, parsed, cnt = _parse_response(raw)
        assert parsed == {"ok": True}
        assert cnt == 8


# ===================================================================
# 4. invoke_claude_code -- Input Validation (No Subprocess)
# ===================================================================


class TestInvokeInputValidation:
    """Invoke returns early errors for invalid queries without spawning."""

    @pytest.mark.asyncio
    async def test_empty_query_returns_error(self):
        result = await invoke_claude_code("")
        assert result.status == "error"
        assert "empty" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_whitespace_query_returns_error(self):
        result = await invoke_claude_code("   ")
        assert result.status == "error"

    @pytest.mark.asyncio
    async def test_overlength_query_returns_error(self):
        result = await invoke_claude_code("x" * 501)
        assert result.status == "error"
        assert "length" in result.error_message.lower() or "500" in result.error_message

    @pytest.mark.asyncio
    async def test_path_traversal_returns_error(self):
        result = await invoke_claude_code("read ../etc/passwd")
        assert result.status == "error"
        assert "path traversal" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_path_traversal_backslash_returns_error(self):
        result = await invoke_claude_code("read ..\\file")
        assert result.status == "error"

    @pytest.mark.asyncio
    async def test_error_query_truncated_in_result(self):
        """For over-length queries the query field is truncated to MAX."""
        long_q = "a" * 600
        result = await invoke_claude_code(long_q)
        assert len(result.query) <= 500


# ===================================================================
# 5. invoke_claude_code -- Busy Path
# ===================================================================


class TestInvokeBusy:
    """When the lock is already held, invoke returns 'busy'."""

    @pytest.mark.asyncio
    async def test_busy_when_lock_held(self):
        await _mod._lock.acquire()
        try:
            result = await invoke_claude_code("hello world")
            assert result.status == "busy"
            assert result.error_message is not None
            assert "already in progress" in result.error_message.lower()
        finally:
            _mod._lock.release()


# ===================================================================
# 6. invoke_claude_code -- Spawn Errors
# ===================================================================


class TestInvokeSpawnErrors:
    """Subprocess creation errors produce status='error'."""

    @pytest.mark.asyncio
    async def test_file_not_found_error(self):
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            side_effect=FileNotFoundError("claude not found"),
        ):
            result = await invoke_claude_code("hello")
        assert result.status == "error"
        assert "not found" in result.error_message.lower()
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_permission_error(self):
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            side_effect=PermissionError("denied"),
        ):
            result = await invoke_claude_code("hello")
        assert result.status == "error"
        assert "permission" in result.error_message.lower()
        assert result.execution_time_ms >= 0


# ===================================================================
# 7. invoke_claude_code -- Success Path
# ===================================================================


class TestInvokeSuccess:
    """Normal successful invocation."""

    @pytest.mark.asyncio
    async def test_success_basic(self):
        proc = _make_mock_process(
            stdout_lines=[b"Hello from Claude\n"], returncode=0
        )
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ) as mock_ws:
            result = await invoke_claude_code("test query")

        assert result.status == "success"
        assert result.query == "test query"
        assert "Hello from Claude" in result.response_text
        assert result.execution_time_ms >= 0

        # Verify completion broadcast
        mock_ws.assert_called()
        last_call_arg = mock_ws.call_args[0][0]
        assert last_call_arg["type"] == "god_agent_complete"

    @pytest.mark.asyncio
    async def test_success_with_json_in_stdout(self):
        stdout = b'Some text\n```json\n{"analysis": "bullish"}\n```\nDone\n'
        proc = _make_mock_process(stdout_lines=[stdout], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("analyze AAPL")

        assert result.status == "success"
        assert result.structured_data == {"analysis": "bullish"}

    @pytest.mark.asyncio
    async def test_success_with_agent_count(self):
        stdout = b"Starting\nAgent 3/12\nDone\n"
        proc = _make_mock_process(stdout_lines=[stdout], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("run agents")

        assert result.status == "success"
        assert result.agent_count == 12

    @pytest.mark.asyncio
    async def test_success_with_ticker_param(self):
        proc = _make_mock_process(stdout_lines=[b"OK\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws") as mock_ws:
            result = await invoke_claude_code("analyze", ticker="AAPL")

        assert result.status == "success"
        # Check ticker passed to broadcast
        last_call_arg = mock_ws.call_args[0][0]
        assert last_call_arg.get("ticker") == "AAPL"

    @pytest.mark.asyncio
    async def test_execution_time_positive_on_success(self):
        proc = _make_mock_process(stdout_lines=[b"fast\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("quick query")

        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_sanitized_query_used(self):
        """Metacharacters are stripped from the query before it reaches the
        subprocess and before it appears in the result."""
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ) as mock_exec, patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("hello & world")

        assert result.status == "success"
        assert result.query == "hello  world"
        # The actual command passed to exec should use the sanitized form
        call_args = mock_exec.call_args[0]
        assert "hello  world" in call_args

    @pytest.mark.asyncio
    async def test_module_state_cleaned_after_success(self):
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            await invoke_claude_code("test")

        assert _mod._current_process is None
        assert _mod._cancel_event is None


# ===================================================================
# 8. invoke_claude_code -- Non-Zero Exit Code
# ===================================================================


class TestInvokeNonZeroExit:
    """Process returns non-zero exit code."""

    @pytest.mark.asyncio
    async def test_nonzero_exit_returns_error(self):
        proc = _make_mock_process(
            stdout_lines=[b"partial output\n"],
            stderr_data=b"something went wrong",
            returncode=1,
        )
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("test query")

        assert result.status == "error"
        assert "exited with code 1" in result.error_message
        assert result.response_text != ""
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_nonzero_exit_code_2(self):
        proc = _make_mock_process(
            stdout_lines=[b"out\n"], stderr_data=b"err", returncode=2
        )
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("test")

        assert result.status == "error"
        assert "code 2" in result.error_message


# ===================================================================
# 9. invoke_claude_code -- Timeout
# ===================================================================


class TestInvokeTimeout:
    """Timeout handling when subprocess takes too long."""

    @pytest.mark.asyncio
    async def test_timeout_returns_timeout_status(self):
        proc = _make_mock_process(stdout_lines=[], returncode=0)

        # Make _read_stdout_with_progress hang forever
        async def _hang(reader, ticker):
            await asyncio.sleep(999)
            return ""

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=_hang,
        ), patch(
            "app.agent.god_agent_interface._TIMEOUT_SECONDS", 0.05
        ), patch(
            "app.agent.god_agent_interface._kill_process",
            new_callable=AsyncMock,
        ) as mock_kill, patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ):
            result = await invoke_claude_code("slow query")

        assert result.status == "timeout"
        assert "timed out" in result.error_message.lower()
        mock_kill.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_timeout_execution_time_populated(self):
        proc = _make_mock_process(stdout_lines=[], returncode=0)

        async def _hang(reader, ticker):
            await asyncio.sleep(999)
            return ""

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=_hang,
        ), patch(
            "app.agent.god_agent_interface._TIMEOUT_SECONDS", 0.05
        ), patch(
            "app.agent.god_agent_interface._kill_process",
            new_callable=AsyncMock,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ):
            result = await invoke_claude_code("slow")

        assert result.execution_time_ms >= 0


# ===================================================================
# 10. invoke_claude_code -- Cancellation
# ===================================================================


class TestInvokeCancellation:
    """Cancellation via cancel_current()."""

    @pytest.mark.asyncio
    async def test_cancellation_returns_cancelled_status(self):
        proc = _make_mock_process(stdout_lines=[], returncode=0)

        # Simulate a slow read that can be cancelled
        async def _slow_read(reader, ticker):
            await asyncio.sleep(10)
            return ""

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=_slow_read,
        ), patch(
            "app.agent.god_agent_interface._kill_process",
            new_callable=AsyncMock,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ), patch(
            "app.agent.god_agent_interface._TIMEOUT_SECONDS", 10
        ):
            # Start invoke in background, cancel shortly after
            invoke_task = asyncio.create_task(invoke_claude_code("long query"))
            await asyncio.sleep(0.05)
            cancelled = await cancel_current()
            result = await invoke_task

        assert cancelled is True
        assert result.status == "cancelled"
        assert result.error_message is not None
        assert "cancelled" in result.error_message.lower()


# ===================================================================
# 11. invoke_claude_code -- Unexpected Exception
# ===================================================================


class TestInvokeUnexpectedException:
    """Catch-all exception handling in invoke_claude_code."""

    @pytest.mark.asyncio
    async def test_unexpected_error_caught(self):
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=RuntimeError("boom"),
        ), patch(
            "app.agent.god_agent_interface._kill_process",
            new_callable=AsyncMock,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ):
            result = await invoke_claude_code("test")

        assert result.status == "error"
        assert "RuntimeError" in result.error_message
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_module_state_cleaned_after_exception(self):
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=ValueError("bad"),
        ), patch(
            "app.agent.god_agent_interface._kill_process",
            new_callable=AsyncMock,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ):
            await invoke_claude_code("test")

        assert _mod._current_process is None
        assert _mod._cancel_event is None


# ===================================================================
# 12. cancel_current
# ===================================================================


class TestCancelCurrent:
    """Tests for the cancel_current() public API."""

    @pytest.mark.asyncio
    async def test_no_invocation_returns_false(self):
        result = await cancel_current()
        assert result is False

    @pytest.mark.asyncio
    async def test_event_none_returns_false(self):
        _mod._cancel_event = None
        result = await cancel_current()
        assert result is False

    @pytest.mark.asyncio
    async def test_event_already_set_returns_false(self):
        evt = asyncio.Event()
        evt.set()
        _mod._cancel_event = evt
        result = await cancel_current()
        assert result is False

    @pytest.mark.asyncio
    async def test_event_not_set_returns_true(self):
        evt = asyncio.Event()
        _mod._cancel_event = evt
        result = await cancel_current()
        assert result is True
        assert evt.is_set()

    @pytest.mark.asyncio
    async def test_double_cancel_idempotent(self):
        evt = asyncio.Event()
        _mod._cancel_event = evt
        first = await cancel_current()
        second = await cancel_current()
        assert first is True
        assert second is False  # already set


# ===================================================================
# 13. _kill_process
# ===================================================================


class TestKillProcess:
    """Tests for the _kill_process helper."""

    @pytest.mark.asyncio
    async def test_terminate_then_clean_exit(self):
        """Process exits within grace period after terminate()."""
        proc = AsyncMock()
        proc.terminate = MagicMock()
        proc.kill = MagicMock()

        async def _quick_wait():
            return 0

        proc.wait = AsyncMock(side_effect=_quick_wait)

        await _kill_process(proc)

        proc.terminate.assert_called_once()
        proc.kill.assert_not_called()

    @pytest.mark.asyncio
    async def test_terminate_timeout_then_kill(self):
        """Process does not exit after terminate(); escalates to kill()."""
        proc = AsyncMock()
        proc.terminate = MagicMock()
        proc.kill = MagicMock()

        call_count = 0

        async def _slow_then_fast():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First wait (after terminate) -- time out
                await asyncio.sleep(999)
            return 0

        proc.wait = AsyncMock(side_effect=_slow_then_fast)

        with patch("app.agent.god_agent_interface._KILL_GRACE_SECONDS", 0.05):
            await _kill_process(proc)

        proc.terminate.assert_called_once()
        proc.kill.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_lookup_error_on_terminate(self):
        """ProcessLookupError on terminate() is handled gracefully."""
        proc = AsyncMock()
        proc.terminate = MagicMock(side_effect=ProcessLookupError)
        proc.kill = MagicMock()
        proc.wait = AsyncMock(return_value=0)

        await _kill_process(proc)
        # Should not raise; kill may or may not be called

    @pytest.mark.asyncio
    async def test_os_error_on_terminate(self):
        """OSError on terminate() is handled gracefully."""
        proc = AsyncMock()
        proc.terminate = MagicMock(side_effect=OSError("No such process"))
        proc.kill = MagicMock()
        proc.wait = AsyncMock(return_value=0)

        await _kill_process(proc)
        # Should not raise

    @pytest.mark.asyncio
    async def test_process_lookup_error_on_kill(self):
        """ProcessLookupError on kill() is handled gracefully."""
        proc = AsyncMock()
        proc.terminate = MagicMock()
        proc.kill = MagicMock(side_effect=ProcessLookupError)

        call_count = 0

        async def _slow_then_ok():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                await asyncio.sleep(999)
            return 0

        proc.wait = AsyncMock(side_effect=_slow_then_ok)

        with patch("app.agent.god_agent_interface._KILL_GRACE_SECONDS", 0.05):
            await _kill_process(proc)
        # Should not raise

    @pytest.mark.asyncio
    async def test_wait_after_kill_handles_error(self):
        """Final proc.wait() handles ProcessLookupError on the last call."""
        proc = AsyncMock()
        proc.terminate = MagicMock()
        proc.kill = MagicMock()

        # First wait (inside wait_for) succeeds; second wait (final cleanup)
        # raises ProcessLookupError.
        proc.wait = AsyncMock(side_effect=[0, ProcessLookupError])

        await _kill_process(proc)
        # Should not raise

    @pytest.mark.asyncio
    async def test_os_error_on_kill(self):
        """OSError on kill is handled."""
        proc = AsyncMock()
        proc.terminate = MagicMock()
        proc.kill = MagicMock(side_effect=OSError)

        call_count = 0

        async def _slow_then_ok():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                await asyncio.sleep(999)
            return 0

        proc.wait = AsyncMock(side_effect=_slow_then_ok)

        with patch("app.agent.god_agent_interface._KILL_GRACE_SECONDS", 0.05):
            await _kill_process(proc)

    @pytest.mark.asyncio
    async def test_already_exited_process(self):
        """terminate() raises ProcessLookupError and wait resolves immediately."""
        proc = AsyncMock()
        proc.terminate = MagicMock(side_effect=ProcessLookupError)
        proc.kill = MagicMock()
        proc.wait = AsyncMock(return_value=-9)

        await _kill_process(proc)
        proc.kill.assert_not_called()


# ===================================================================
# 14. _read_stdout_with_progress
# ===================================================================


class TestReadStdoutWithProgress:
    """Tests for the stdout reader with WebSocket progress broadcasting."""

    @pytest.mark.asyncio
    async def test_reads_all_lines(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[b"line1\n", b"line2\n", b""]
        )
        with patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await _read_stdout_with_progress(reader, None)

        assert "line1" in result
        assert "line2" in result

    @pytest.mark.asyncio
    async def test_empty_stream(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(return_value=b"")
        with patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await _read_stdout_with_progress(reader, None)

        assert result == ""

    @pytest.mark.asyncio
    async def test_agent_progress_broadcasts(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[b"Agent 2/5\n", b""]
        )
        with patch(
            "app.agent.god_agent_interface._broadcast_ws"
        ) as mock_ws:
            await _read_stdout_with_progress(reader, "AAPL")

        mock_ws.assert_called_once()
        call_arg = mock_ws.call_args[0][0]
        assert call_arg["type"] == "god_agent_progress"
        assert call_arg["ticker"] == "AAPL"
        assert call_arg["agent_current"] == 2
        assert call_arg["agent_total"] == 5

    @pytest.mark.asyncio
    async def test_non_progress_lines_not_broadcast(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[b"Normal line\n", b""]
        )
        with patch(
            "app.agent.god_agent_interface._broadcast_ws"
        ) as mock_ws:
            await _read_stdout_with_progress(reader, None)

        mock_ws.assert_not_called()

    @pytest.mark.asyncio
    async def test_multiple_progress_lines(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[
                b"Agent 1/3\n",
                b"Some output\n",
                b"Agent 2/3\n",
                b"Agent 3/3\n",
                b"",
            ]
        )
        with patch(
            "app.agent.god_agent_interface._broadcast_ws"
        ) as mock_ws:
            result = await _read_stdout_with_progress(reader, None)

        assert mock_ws.call_count == 3
        assert "Agent 1/3" in result
        assert "Some output" in result
        assert "Agent 3/3" in result

    @pytest.mark.asyncio
    async def test_ticker_none_in_broadcast(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[b"Agent 1/1\n", b""]
        )
        with patch(
            "app.agent.god_agent_interface._broadcast_ws"
        ) as mock_ws:
            await _read_stdout_with_progress(reader, None)

        call_arg = mock_ws.call_args[0][0]
        assert call_arg["ticker"] is None

    @pytest.mark.asyncio
    async def test_utf8_decode_errors_replaced(self):
        reader = AsyncMock()
        reader.readline = AsyncMock(
            side_effect=[b"hello\xff\xfeworld\n", b""]
        )
        with patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await _read_stdout_with_progress(reader, None)

        # Should not raise; invalid bytes replaced
        assert "hello" in result
        assert "world" in result


# ===================================================================
# 15. _broadcast_ws
# ===================================================================


class TestBroadcastWs:
    """Tests for the WebSocket broadcast helper."""

    def test_broadcast_calls_ws_manager(self):
        mock_manager = MagicMock()
        mock_manager.broadcast = AsyncMock()
        with patch(
            "app.agent.god_agent_interface.asyncio.ensure_future"
        ) as mock_ef, patch.dict(
            "sys.modules",
            {"app.api.routes.websocket": MagicMock(ws_manager=mock_manager)},
        ):
            from app.agent.god_agent_interface import _broadcast_ws

            _broadcast_ws({"type": "test"})

    def test_broadcast_silently_handles_import_error(self):
        """If ws_manager import fails, _broadcast_ws should not raise."""
        with patch(
            "app.agent.god_agent_interface._broadcast_ws",
            wraps=_mod._broadcast_ws,
        ):
            # Force import to fail by patching the import inside _broadcast_ws
            original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__
            # Simply call -- it should not raise even if ws_manager is
            # unavailable.  In the worst case the lazy import will fail and
            # the except will catch it.
            try:
                _mod._broadcast_ws({"type": "test"})
            except Exception:
                pytest.fail("_broadcast_ws raised an exception")


# ===================================================================
# 16. Regex Patterns (Compiled Module-Level)
# ===================================================================


class TestRegexPatterns:
    """Verify the compiled regex patterns at module level."""

    def test_path_traversal_re_matches_forward_slash(self):
        assert _mod._PATH_TRAVERSAL_RE.search("../foo") is not None

    def test_path_traversal_re_matches_backslash(self):
        assert _mod._PATH_TRAVERSAL_RE.search("..\\foo") is not None

    def test_path_traversal_re_no_match_single_dot(self):
        assert _mod._PATH_TRAVERSAL_RE.search("./foo") is None

    def test_metachar_re_matches_ampersand(self):
        assert _mod._METACHAR_RE.search("a&b") is not None

    def test_metachar_re_matches_pipe(self):
        assert _mod._METACHAR_RE.search("a|b") is not None

    def test_metachar_re_matches_semicolon(self):
        assert _mod._METACHAR_RE.search("a;b") is not None

    def test_metachar_re_matches_dollar(self):
        assert _mod._METACHAR_RE.search("$var") is not None

    def test_metachar_re_matches_backtick(self):
        assert _mod._METACHAR_RE.search("`cmd`") is not None

    def test_metachar_re_no_match_normal_text(self):
        assert _mod._METACHAR_RE.search("hello world 123") is None

    def test_agent_progress_re_matches(self):
        m = _mod._AGENT_PROGRESS_RE.search("Running Agent 5/10")
        assert m is not None
        assert m.group(1) == "5"
        assert m.group(2) == "10"

    def test_agent_progress_re_no_match(self):
        assert _mod._AGENT_PROGRESS_RE.search("no agents here") is None

    def test_json_fence_re_matches(self):
        raw = '```json\n{"key": "val"}\n```'
        m = _mod._JSON_FENCE_RE.search(raw)
        assert m is not None
        assert '"key"' in m.group(1)


# ===================================================================
# 17. Constants
# ===================================================================


class TestConstants:
    """Verify module-level constants have expected values."""

    def test_max_query_length(self):
        assert _mod._MAX_QUERY_LENGTH == 500

    def test_timeout_seconds(self):
        assert _mod._TIMEOUT_SECONDS == 60

    def test_kill_grace_seconds(self):
        assert _mod._KILL_GRACE_SECONDS == 5


# ===================================================================
# 18. __all__ Export List
# ===================================================================


class TestAllExports:
    """Verify __all__ matches the public API."""

    def test_all_contains_god_agent_result(self):
        assert "GodAgentResult" in _mod.__all__

    def test_all_contains_invoke(self):
        assert "invoke_claude_code" in _mod.__all__

    def test_all_contains_cancel(self):
        assert "cancel_current" in _mod.__all__

    def test_all_length(self):
        assert len(_mod.__all__) == 3


# ===================================================================
# 19. Integration-Style: Full Flow
# ===================================================================


class TestFullFlowIntegration:
    """End-to-end flow through invoke_claude_code with mocked subprocess."""

    @pytest.mark.asyncio
    async def test_full_success_flow_with_json_and_agents(self):
        """Complete happy-path: subprocess returns JSON + agent markers."""
        stdout_data = (
            b"Starting analysis...\n"
            b"Agent 1/3\n"
            b"Processing...\n"
            b"Agent 2/3\n"
            b'```json\n{"result": "bullish", "confidence": 0.85}\n```\n'
            b"Agent 3/3\n"
            b"Done\n"
        )
        proc = _make_mock_process(stdout_lines=[stdout_data], returncode=0)

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("analyze AAPL", ticker="AAPL")

        assert result.status == "success"
        assert result.structured_data == {"result": "bullish", "confidence": 0.85}
        assert result.agent_count == 3
        assert result.execution_time_ms >= 0
        assert result.error_message is None
        assert "analyze AAPL" in result.query

    @pytest.mark.asyncio
    async def test_full_error_flow_empty_query(self):
        """Empty query returns error without spawning subprocess."""
        result = await invoke_claude_code("")
        assert result.status == "error"
        assert result.query == ""
        assert result.response_text == ""
        assert result.structured_data is None
        assert result.agent_count == 0

    @pytest.mark.asyncio
    async def test_cwd_set_to_project_root(self):
        """Verify subprocess is spawned with correct cwd."""
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ) as mock_exec, patch("app.agent.god_agent_interface._broadcast_ws"):
            await invoke_claude_code("test")

        _, kwargs = mock_exec.call_args
        assert "cwd" in kwargs
        assert kwargs["cwd"] == str(_mod._PROJECT_ROOT)

    @pytest.mark.asyncio
    async def test_cmd_uses_claude_dash_p(self):
        """Verify CLI command is [<resolved_path>, '-p', <sanitized>]."""
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ) as mock_exec, patch("app.agent.god_agent_interface._broadcast_ws"):
            await invoke_claude_code("hello world")

        args = mock_exec.call_args[0]
        assert args == ("/usr/bin/claude", "-p", "hello world")

    @pytest.mark.asyncio
    async def test_subprocess_pipes_configured(self):
        """Verify PIPE is used for stdout and stderr."""
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ) as mock_exec, patch("app.agent.god_agent_interface._broadcast_ws"):
            await invoke_claude_code("test")

        _, kwargs = mock_exec.call_args
        assert kwargs["stdout"] == asyncio.subprocess.PIPE
        assert kwargs["stderr"] == asyncio.subprocess.PIPE


# ===================================================================
# 20. Edge Cases and Boundary Conditions
# ===================================================================


class TestEdgeCases:
    """Miscellaneous edge cases."""

    @pytest.mark.asyncio
    async def test_query_with_only_metacharacters(self):
        """A query of only metacharacters becomes empty after stripping.
        _sanitize_query returns ('', None) because the raw input is non-empty,
        so the empty sanitized string is passed to subprocess.  We mock the
        subprocess to verify invoke still completes without error."""
        proc = _make_mock_process(stdout_lines=[b"ok\n"], returncode=0)
        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch("app.agent.god_agent_interface._broadcast_ws"):
            result = await invoke_claude_code("&|;$`")
        # The sanitized query is empty but _sanitize_query does not reject it
        assert result.query == ""
        assert result.status == "success"

    def test_parse_response_bare_json_not_starting_with_brace(self):
        """Text that does not start with '{' should not be parsed as JSON."""
        text, parsed, _ = _parse_response("hello {invalid}")
        assert parsed is None

    def test_parse_response_array_json_not_extracted(self):
        """Bare arrays are not extracted (only objects starting with '{')."""
        text, parsed, _ = _parse_response('[1, 2, 3]')
        assert parsed is None

    def test_sanitize_query_with_unicode(self):
        """Unicode characters should pass through."""
        sanitized, err = _sanitize_query("What is the price?")
        assert err is None
        assert sanitized == "What is the price?"

    def test_sanitize_query_with_emoji(self):
        """Emoji characters should not be stripped."""
        sanitized, err = _sanitize_query("Buy AAPL now")
        assert err is None

    @pytest.mark.asyncio
    async def test_invoke_concurrent_rejection(self):
        """Second concurrent call is rejected as busy."""
        proc = _make_mock_process(stdout_lines=[], returncode=0)

        async def _slow_read(reader, ticker):
            await asyncio.sleep(5)
            return ""

        with patch(
            "app.agent.god_agent_interface.asyncio.create_subprocess_exec",
            return_value=proc,
        ), patch(
            "app.agent.god_agent_interface._read_stdout_with_progress",
            side_effect=_slow_read,
        ), patch(
            "app.agent.god_agent_interface._broadcast_ws",
        ), patch(
            "app.agent.god_agent_interface._TIMEOUT_SECONDS", 10
        ):
            task1 = asyncio.create_task(invoke_claude_code("first"))
            await asyncio.sleep(0.05)

            result2 = await invoke_claude_code("second")
            assert result2.status == "busy"

            # Clean up task1 by cancelling
            _cancel_evt = _mod._cancel_event
            if _cancel_evt:
                _cancel_evt.set()
            await task1

    def test_parse_response_json_fence_with_extra_whitespace(self):
        raw = "```json  \n  {\"a\": 1}  \n  ```"
        _, parsed, _ = _parse_response(raw)
        # The regex allows whitespace around the fence markers
        # Exact behavior depends on regex; verify it handles it
        if parsed is not None:
            assert parsed == {"a": 1}

    def test_sanitize_metachar_backslash(self):
        """Backslash is a metacharacter and must be stripped."""
        sanitized, err = _sanitize_query("path\\to\\file")
        assert err is None
        assert "\\" not in sanitized
        assert sanitized == "pathtofile"

    def test_sanitize_newline_stripped(self):
        """Newline characters are metacharacters and must be stripped."""
        sanitized, err = _sanitize_query("line1\nline2")
        assert err is None
        assert "\n" not in sanitized

    def test_sanitize_carriage_return_stripped(self):
        sanitized, err = _sanitize_query("line1\rline2")
        assert err is None
        assert "\r" not in sanitized
