#!/usr/bin/env python3
"""
Minimal LLM runner via an external command (read-only wrapper).

You provide the command via:
  - --llm_cmd "claude -p"
or environment:
  - GOD_LEARN_LLM_CMD="claude -p"

Contract:
- Sends the prompt on STDIN
- Reads model output from STDOUT
"""

from __future__ import annotations

import os
import shlex
import subprocess
from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class LLMResult:
    stdout: str
    stderr: str
    returncode: int


def get_llm_cmd(cli_llm_cmd: Optional[str]) -> List[str]:
    raw = (cli_llm_cmd or os.environ.get("GOD_LEARN_LLM_CMD") or "").strip()
    if not raw:
        return []
    return shlex.split(raw)


def run_llm_cmd(prompt: str, *, llm_cmd: List[str], timeout_s: int = 120) -> LLMResult:
    if not llm_cmd:
        raise RuntimeError("No LLM command provided. Set --llm_cmd or GOD_LEARN_LLM_CMD.")

    try:
        p = subprocess.run(
            llm_cmd,
            input=prompt,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=int(timeout_s),
            check=False,
            text=True,              # <-- important
        )
    except subprocess.TimeoutExpired as e:
        out = ""
        err = ""
        # TimeoutExpired may carry partial output in newer Pythons
        if getattr(e, "output", None):
            out = (e.output or "") if isinstance(e.output, str) else ""
        if getattr(e, "stderr", None):
            err = (e.stderr or "") if isinstance(e.stderr, str) else ""
        raise RuntimeError(
            f"LLM command timed out after {timeout_s}s. "
            f"cmd={' '.join(llm_cmd)} "
            f"partial_stdout_head={out[:300]!r} "
            f"partial_stderr_head={err[:300]!r}"
        ) from e


    return LLMResult(
        stdout=p.stdout or "",
        stderr=p.stderr or "",
        returncode=p.returncode,
    )

