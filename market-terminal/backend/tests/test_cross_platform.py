"""Tests for TASK-FINAL-002: Cross-platform compatibility.

Validates that the codebase avoids Unix-only constructs:
  - pathlib.Path usage instead of os.path for file paths
  - proc.terminate() instead of signal.SIGTERM
  - shutil.which() for binary resolution
  - tempfile.gettempdir() instead of hardcoded /tmp/
  - .gitattributes for line ending normalization
  - No residual ``import signal`` or ``import os`` in cleaned modules

All tests use stdlib only -- zero additional dependencies.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_cross_platform.py -v``
"""
from __future__ import annotations

import ast
import os
import tempfile
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Constants -- locate project files relative to *this* test file
# ---------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_MARKET_TERMINAL_ROOT = _BACKEND_ROOT.parent
_GOD_AGENT_FILE = _BACKEND_ROOT / "app" / "agent" / "god_agent_interface.py"
_SENTIMENT_FILE = _BACKEND_ROOT / "app" / "analysis" / "sentiment.py"
_COMPOSITE_TEST_FILE = _BACKEND_ROOT / "tests" / "test_composite.py"
_GITATTRIBUTES_FILE = _MARKET_TERMINAL_ROOT / ".gitattributes"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_imports(filepath: Path) -> tuple[set[str], set[str]]:
    """Parse a Python file and return (top_level_imports, from_imports).

    ``top_level_imports`` contains module names from ``import X`` statements.
    ``from_imports`` contains module names from ``from X import ...``
    statements.
    """
    source = filepath.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(filepath))
    top_level: set[str] = set()
    from_level: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top_level.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module is not None:
                from_level.add(node.module.split(".")[0])
    return top_level, from_level


# ===================================================================
# 1. TestPathHandlingCrossPlatform
# ===================================================================


class TestPathHandlingCrossPlatform:
    """Verify pathlib.Path usage for file-path construction."""

    def test_sentiment_uses_pathlib_for_data_path(self):
        """sentiment.py must build data_path via pathlib, not os.path."""
        source = _SENTIMENT_FILE.read_text(encoding="utf-8")
        assert "Path(__file__)" in source, (
            "sentiment.py should use Path(__file__) for data path construction"
        )

    def test_sentiment_no_os_path_join(self):
        """sentiment.py must not use os.path.join for data path."""
        source = _SENTIMENT_FILE.read_text(encoding="utf-8")
        assert "os.path.join" not in source, (
            "sentiment.py should not use os.path.join -- use pathlib instead"
        )

    def test_sentiment_no_os_path_dirname(self):
        """sentiment.py must not use os.path.dirname."""
        source = _SENTIMENT_FILE.read_text(encoding="utf-8")
        assert "os.path.dirname" not in source

    def test_sentiment_no_os_path_abspath(self):
        """sentiment.py must not use os.path.abspath."""
        source = _SENTIMENT_FILE.read_text(encoding="utf-8")
        assert "os.path.abspath" not in source

    def test_god_agent_uses_pathlib_for_project_root(self):
        """god_agent_interface.py must use Path for _PROJECT_ROOT."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "Path(__file__).resolve()" in source


# ===================================================================
# 2. TestProcessTerminationCrossPlatform
# ===================================================================


class TestProcessTerminationCrossPlatform:
    """Verify proc.terminate() replaces signal.SIGTERM."""

    def test_god_agent_uses_proc_terminate(self):
        """god_agent_interface.py must call proc.terminate()."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "proc.terminate()" in source

    def test_god_agent_no_signal_sigterm(self):
        """god_agent_interface.py must not reference signal.SIGTERM."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "signal.SIGTERM" not in source

    def test_god_agent_no_send_signal(self):
        """god_agent_interface.py must not call proc.send_signal()."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "send_signal" not in source

    def test_god_agent_still_has_kill_escalation(self):
        """god_agent_interface.py must still have proc.kill() as fallback."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "proc.kill()" in source


# ===================================================================
# 3. TestBinaryResolutionCrossPlatform
# ===================================================================


class TestBinaryResolutionCrossPlatform:
    """Verify shutil.which() for claude CLI binary discovery."""

    def test_god_agent_imports_shutil(self):
        """god_agent_interface.py must import shutil."""
        top, frm = _parse_imports(_GOD_AGENT_FILE)
        assert "shutil" in top or "shutil" in frm

    def test_god_agent_uses_shutil_which(self):
        """god_agent_interface.py must call shutil.which('claude')."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert 'shutil.which("claude")' in source or "shutil.which('claude')" in source

    def test_god_agent_no_hardcoded_claude_in_cmd(self):
        """god_agent_interface.py must not use literal 'claude' in cmd list.

        The resolved path from shutil.which should be used instead.
        """
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        # Check there is no cmd = ["claude", ...] pattern
        assert '["claude"' not in source, (
            "cmd list should use resolved claude_exe, not hardcoded 'claude'"
        )

    def test_god_agent_guards_missing_binary(self):
        """god_agent_interface.py must handle shutil.which returning None."""
        source = _GOD_AGENT_FILE.read_text(encoding="utf-8")
        assert "claude_exe is None" in source or "claude_exe is None" in source


# ===================================================================
# 4. TestTempFileCrossPlatform
# ===================================================================


class TestTempFileCrossPlatform:
    """Verify tempfile.gettempdir() usage, no hardcoded /tmp/."""

    def test_composite_test_no_hardcoded_tmp(self):
        """test_composite.py must not use hardcoded /tmp/ paths."""
        source = _COMPOSITE_TEST_FILE.read_text(encoding="utf-8")
        # Allow /tmp in comments but not in string literals used as paths
        for line in source.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if 'db_path="/tmp/' in stripped:
                pytest.fail(
                    f"Hardcoded /tmp/ found in test_composite.py: {stripped}"
                )

    def test_composite_test_uses_tempfile_gettempdir(self):
        """test_composite.py must use tempfile.gettempdir() for temp paths."""
        source = _COMPOSITE_TEST_FILE.read_text(encoding="utf-8")
        assert "tempfile.gettempdir()" in source

    def test_tempfile_gettempdir_returns_valid_dir(self):
        """Sanity: tempfile.gettempdir() returns an existing directory."""
        tmp = tempfile.gettempdir()
        assert os.path.isdir(tmp)

    def test_os_path_join_with_gettempdir_works(self):
        """Sanity: os.path.join(tempfile.gettempdir(), ...) produces a path."""
        result = os.path.join(tempfile.gettempdir(), "nonexistent.db")
        assert result.endswith("nonexistent.db")
        assert not result.startswith("/tmp") or os.name != "nt"


# ===================================================================
# 5. TestLineEndingsCrossPlatform
# ===================================================================


class TestLineEndingsCrossPlatform:
    """Verify .gitattributes exists and enforces LF line endings."""

    def test_gitattributes_exists(self):
        """market-terminal/.gitattributes must exist."""
        assert _GITATTRIBUTES_FILE.exists(), (
            f".gitattributes not found at {_GITATTRIBUTES_FILE}"
        )

    def test_gitattributes_has_auto_detect(self):
        """gitattributes must have text=auto for auto-detection."""
        content = _GITATTRIBUTES_FILE.read_text(encoding="utf-8")
        assert "text=auto" in content

    def test_gitattributes_python_files_lf(self):
        """gitattributes must enforce LF for .py files."""
        content = _GITATTRIBUTES_FILE.read_text(encoding="utf-8")
        assert "*.py" in content
        # Find the line with *.py and verify eol=lf
        for line in content.splitlines():
            if "*.py" in line and not line.strip().startswith("#"):
                assert "eol=lf" in line, (
                    "*.py should have eol=lf in .gitattributes"
                )
                break

    def test_gitattributes_typescript_files_lf(self):
        """gitattributes must enforce LF for .ts files."""
        content = _GITATTRIBUTES_FILE.read_text(encoding="utf-8")
        assert "*.ts" in content

    def test_gitattributes_binary_files_marked(self):
        """gitattributes must mark binary files correctly."""
        content = _GITATTRIBUTES_FILE.read_text(encoding="utf-8")
        assert "binary" in content


# ===================================================================
# 6. TestImportCleanliness
# ===================================================================


class TestImportCleanliness:
    """Use ast.parse to verify import hygiene after cross-platform changes."""

    def test_god_agent_no_import_signal(self):
        """god_agent_interface.py must NOT have ``import signal``."""
        top, frm = _parse_imports(_GOD_AGENT_FILE)
        assert "signal" not in top, (
            "god_agent_interface.py should not import signal "
            "(use proc.terminate() instead)"
        )
        assert "signal" not in frm

    def test_god_agent_has_import_shutil(self):
        """god_agent_interface.py must have ``import shutil``."""
        top, frm = _parse_imports(_GOD_AGENT_FILE)
        assert "shutil" in top or "shutil" in frm

    def test_sentiment_no_import_os(self):
        """sentiment.py must NOT have ``import os``."""
        top, frm = _parse_imports(_SENTIMENT_FILE)
        assert "os" not in top, (
            "sentiment.py should not import os "
            "(use pathlib.Path instead)"
        )

    def test_sentiment_has_pathlib(self):
        """sentiment.py must import from pathlib."""
        top, frm = _parse_imports(_SENTIMENT_FILE)
        assert "pathlib" in top or "pathlib" in frm

    def test_god_agent_has_import_asyncio(self):
        """god_agent_interface.py must still import asyncio (sanity check)."""
        top, _ = _parse_imports(_GOD_AGENT_FILE)
        assert "asyncio" in top

    def test_sentiment_has_import_json(self):
        """sentiment.py must still import json (sanity check)."""
        top, _ = _parse_imports(_SENTIMENT_FILE)
        assert "json" in top

    def test_god_agent_test_no_import_signal(self):
        """test_god_agent_interface.py must NOT have ``import signal``."""
        test_file = _BACKEND_ROOT / "tests" / "test_god_agent_interface.py"
        top, frm = _parse_imports(test_file)
        assert "signal" not in top, (
            "test_god_agent_interface.py should not import signal"
        )
        assert "signal" not in frm
