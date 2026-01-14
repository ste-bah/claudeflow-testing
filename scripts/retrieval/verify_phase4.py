#!/usr/bin/env python3
"""
Phase 4 Verification Check

Validates Phase 4 retrieval + synthesis pipeline WITHOUT touching ingest/embeddings.

Checks:
- Retrieval JSON parses and matches expected schema
- Each result includes provenance (path_rel, page_start/page_end) and distance
- page_start/page_end are ints and page_start <= page_end
- Synthesis produces citation-locked claims:
  each claim line ends with "(..., pp. X–Y)"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


RE_CIT = re.compile(r"\(.*?,\s*pp\.\s*\d+\s*–\s*\d+\)$")
RE_PP = re.compile(r"pp\.\s*(\d+)\s*–\s*(\d+)")


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def run_cmd(cmd: List[str], cwd: Path) -> Tuple[int, str, str]:
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return p.returncode, p.stdout, p.stderr


def require(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def validate_retrieval_json(payload: Dict[str, Any], expect_k: int) -> List[Dict[str, Any]]:
    require("query" in payload, "Missing key: query")
    require("config" in payload and isinstance(payload["config"], dict), "Missing/invalid key: config")
    require("results" in payload and isinstance(payload["results"], list), "Missing/invalid key: results")

    results: List[Dict[str, Any]] = payload["results"]
    require(len(results) > 0, "No retrieval results returned")
    require(len(results) <= expect_k, f"Retrieval returned >k results unexpectedly (got {len(results)}, k={expect_k})")

    for i, r in enumerate(results, start=1):
        require(isinstance(r, dict), f"Result #{i} is not an object")
        for key in ("chunk_id", "distance", "path_rel", "page_start", "page_end"):
            require(key in r, f"Result #{i} missing key: {key}")

        require(isinstance(r["chunk_id"], str) and r["chunk_id"], f"Result #{i} invalid chunk_id")
        require(isinstance(r["path_rel"], str) and r["path_rel"], f"Result #{i} invalid path_rel")

        # distance can be int/float depending on json encoder
        require(isinstance(r["distance"], (int, float)), f"Result #{i} invalid distance type")

        require(isinstance(r["page_start"], int), f"Result #{i} page_start not int: {type(r['page_start'])}")
        require(isinstance(r["page_end"], int), f"Result #{i} page_end not int: {type(r['page_end'])}")
        require(r["page_start"] >= 1 and r["page_end"] >= 1, f"Result #{i} pages must be >= 1")
        require(r["page_start"] <= r["page_end"], f"Result #{i} page_start > page_end")

    return results


def validate_synthesis_output(text: str, expect_n: int) -> None:
    require("## Claims" in text, "Synthesis missing '## Claims' section")

    # Extract claim lines (the numbered bullets under Claims)
    lines = text.splitlines()
    claim_lines: List[str] = []
    in_claims = False
    for ln in lines:
        if ln.strip().startswith("## Claims"):
            in_claims = True
            continue
        if in_claims and ln.strip().startswith("## "):
            break
        if in_claims:
            s = ln.strip()
            if re.match(r"^\d+\.\s+", s):
                claim_lines.append(s)

    require(len(claim_lines) > 0, "No numbered claim lines found in Claims section")
    require(len(claim_lines) <= expect_n, f"Too many claim lines (got {len(claim_lines)}, expected <= {expect_n})")

    for i, ln in enumerate(claim_lines, start=1):
        require(RE_CIT.search(ln) is not None, f"Claim #{i} missing/invalid trailing citation: {ln}")
        m = RE_PP.search(ln)
        require(m is not None, f"Claim #{i} citation missing pp. X–Y: {ln}")
        ps, pe = int(m.group(1)), int(m.group(2))
        require(ps >= 1 and pe >= 1 and ps <= pe, f"Claim #{i} has invalid page range pp. {ps}–{pe}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="Query string to verify end-to-end")
    ap.add_argument("--k", type=int, default=8, help="Top-K to retrieve/synthesize")
    ap.add_argument("--overfetch", type=int, default=8, help="Overfetch multiplier used by retrieval")
    ap.add_argument("--where", default='{"collection":"rhetorical_ontology"}', help="Chroma where JSON string")
    ap.add_argument("--repo_root", default=".", help="Repo root (default: current dir)")
    ap.add_argument("--tmp_json", default="/tmp/retrieval_phase4_verify.json", help="Temp JSON output path")
    args = ap.parse_args()

    repo_root = Path(args.repo_root).resolve()
    tmp_json = Path(args.tmp_json)

    # Paths to scripts
    query_py = repo_root / "scripts/retrieval/query_chunks.py"
    synth_py = repo_root / "scripts/retrieval/synthesize_cited.py"

    require(query_py.exists(), f"Missing: {query_py}")
    require(synth_py.exists(), f"Missing: {synth_py}")

    # 1) Run retrieval -> JSON file
    cmd_retrieval = [
        sys.executable,
        str(query_py),
        args.query,
        "--k",
        str(args.k),
        "--overfetch",
        str(args.overfetch),
        "--where",
        args.where,
        "--include_docs",
        "--print_json",
    ]
    rc, out, err = run_cmd(cmd_retrieval, cwd=repo_root)
    if rc != 0:
        eprint("[FAIL] retrieval command failed")
        eprint(err.strip())
        return 2

    tmp_json.write_text(out, encoding="utf-8")

    # 2) Validate retrieval JSON schema + provenance
    try:
        payload = json.loads(out)
        results = validate_retrieval_json(payload, expect_k=args.k)
    except Exception as ex:
        eprint("[FAIL] retrieval JSON validation failed:", ex)
        return 3

    # 3) Run synthesis using the JSON file
    cmd_synth = [sys.executable, str(synth_py), str(tmp_json), "--take", str(args.k)]
    rc2, out2, err2 = run_cmd(cmd_synth, cwd=repo_root)
    if rc2 != 0:
        eprint("[FAIL] synthesis command failed")
        eprint(err2.strip())
        return 4

    # 4) Validate synthesis claims are citation-locked
    try:
        validate_synthesis_output(out2, expect_n=len(results))
    except Exception as ex:
        eprint("[FAIL] synthesis output validation failed:", ex)
        return 5

    print("[PHASE4_VERIFY_OK]")
    print(f"- query={args.query!r}")
    print(f"- retrieved={len(results)}")
    print(f"- tmp_json={tmp_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
