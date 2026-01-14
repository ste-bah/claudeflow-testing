#!/usr/bin/env python3
"""
Unified god-learn compiler front-end (Phase 1–6 wrapper).

Design:
- Shell out to the already-verified phase scripts to minimize risk.
- Deterministically generate a hits JSON for Phase 6 promotion.
- Optional run directory (logs + /tmp snapshot) for reproducibility.

Phase 8 closure refactor:
- god-learn compile: Phase 1–3 substrate ONLY (ingest/audit/verify), NO QUERY.
- god-learn update --query: requires query at argparse level; still compiles first, then does query-conditioned steps.
- Automatic post-promotion normalization: if strict ordering verification fails, normalize knowledge.jsonl ordering
  and rebuild index.json offsets, then re-verify.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple


# ----------------------------
# Paths / helpers
# ----------------------------

def repo_root() -> Path:
    # scripts/god_learn/god_learn.py -> scripts/god_learn -> scripts -> repo
    return Path(__file__).resolve().parents[2]


def make_run_dir(base: Optional[Path] = None) -> Path:
    rr = repo_root()
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = (base or (rr / "god-learn" / "runs")) / ts
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def assembly_exists(out_dir: str) -> bool:
    rr = repo_root()
    draft = rr / out_dir / "draft.md"
    trace = rr / out_dir / "trace.jsonl"
    return draft.exists() and trace.exists()


def tee_run(
    cmd: List[str],
    *,
    cwd: Optional[Path],
    log_path: Optional[Path],
    stdout_to: Optional[Path] = None,
) -> None:
    """
    Run a command, streaming stdout/stderr to terminal.
    If log_path is provided, append everything to that log file.
    If stdout_to is provided, also write stdout to that file (for --print_json style tools).
    """
    line = f"[god-learn] $ {' '.join(cmd)}"
    print(line, flush=True)

    log_f = None
    out_f = None
    try:
        if log_path is not None:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_f = log_path.open("a", encoding="utf-8")
            log_f.write(line + "\n")
            log_f.flush()

        if stdout_to is not None:
            stdout_to.parent.mkdir(parents=True, exist_ok=True)
            out_f = stdout_to.open("w", encoding="utf-8")

        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True,
        )
        assert proc.stdout is not None
        for out_line in proc.stdout:
            print(out_line, end="")
            if log_f is not None:
                log_f.write(out_line)
            if out_f is not None:
                out_f.write(out_line)

        rc = proc.wait()
        if log_f is not None:
            log_f.flush()
        if out_f is not None:
            out_f.flush()

        if rc != 0:
            raise subprocess.CalledProcessError(rc, cmd)
    finally:
        if log_f is not None:
            log_f.close()
        if out_f is not None:
            out_f.close()


def copy_if_exists(src: Path, dst: Path) -> None:
    try:
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    except Exception:
        # convenience only; never fail pipeline on snapshot issues
        pass


def snapshot_tmp_artifacts(run_dir: Path) -> None:
    tmp = Path("/tmp")
    out = run_dir / "tmp_snapshot"
    out.mkdir(parents=True, exist_ok=True)

    candidates = [
        "retrieval.json",
        "retrieval_phase4_verify.json",
        "phase4_hits.json",
        "no_hl.txt",
        "with_hl.txt",
    ]
    for name in candidates:
        copy_if_exists(tmp / name, out / name)


def infer_query_from_hits_json(p: Path) -> Optional[str]:
    """
    Best-effort: if a hits JSON includes a top-level 'query', use it.
    Otherwise return None.
    """
    try:
        obj = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(obj, dict) and isinstance(obj.get("query"), str) and obj["query"].strip():
            return obj["query"].strip()
    except Exception:
        pass
    return None


def setup_run_logging(
    *,
    rr: Path,
    no_run_dir: bool,
    run_dir_base: Optional[str],
    meta_pairs: List[Tuple[str, str]],
) -> Tuple[Optional[Path], Optional[Path]]:
    """
    Shared run-dir + log setup for compile/update.

    Returns: (run_dir, log_path)
    """
    run_dir: Optional[Path] = None
    log_path: Optional[Path] = None

    if no_run_dir:
        return (None, None)

    base = Path(run_dir_base).resolve() if run_dir_base else None
    run_dir = make_run_dir(base=base)
    log_path = run_dir / "run.log"
    (run_dir / "meta").mkdir(parents=True, exist_ok=True)

    for name, value in meta_pairs:
        (run_dir / "meta" / name).write_text(value + "\n", encoding="utf-8")

    print("[god-learn] run_dir =", run_dir)
    return (run_dir, log_path)


def run_compile_substrate(*, rr: Path, root: Path, log_path: Optional[Path]) -> None:
    """
    Phase 1–3 substrate: ingest + audit + verify.
    Intentionally NO query and NO retrieval/promotion.
    """
    tee_run(["python3", "scripts/ingest/run_ingest_phase2.py", "--root", str(root)], cwd=rr, log_path=log_path)
    tee_run(["python3", "scripts/ingest/audit_ingest.py", "--root", str(root)], cwd=rr, log_path=log_path)
    tee_run(["python3", "scripts/ingest/verify_ingest.py", "--root", str(root)], cwd=rr, log_path=log_path)


def normalize_knowledge_store(*, rr: Path, log_path: Optional[Path]) -> None:
    """
    Normalize god-learn/knowledge.jsonl into strict deterministic order and rebuild index.json
    with correct byte offsets.

    This is a Phase 8 closure safety valve:
    - verify_knowledge.py --strict_order expects a stable ordering and matching offsets.
    - promotion may append, breaking strict order.
    """
    knowledge_path = rr / "god-learn" / "knowledge.jsonl"
    index_path = rr / "god-learn" / "index.json"

    if not knowledge_path.exists():
        print("[god-learn] normalize: knowledge.jsonl missing; nothing to normalize.")
        return

    # Read all rows
    rows: List[dict] = []
    with knowledge_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))

    def row_id(o: dict) -> str:
        # Prefer explicit knowledge_id; fallback to id
        if isinstance(o.get("knowledge_id"), str):
            return o["knowledge_id"]
        if isinstance(o.get("id"), str):
            return o["id"]
        # Last resort: stable repr
        return json.dumps(o, sort_keys=True)

    rows.sort(key=row_id)

    # Rewrite knowledge.jsonl in sorted order (newline-terminated)
    tmp_path = knowledge_path.with_suffix(".jsonl.tmp")
    with tmp_path.open("w", encoding="utf-8") as out:
        for o in rows:
            out.write(json.dumps(o, ensure_ascii=False) + "\n")
    tmp_path.replace(knowledge_path)

    # Rebuild index.json offsets
    offsets: dict = {}
    offset = 0
    with knowledge_path.open("rb") as f:
        while True:
            line = f.readline()
            if not line:
                break
            # Record offset at start of this line
            try:
                obj = json.loads(line.decode("utf-8"))
            except Exception:
                # If this ever happens, let verify_knowledge catch it. Keep going.
                offset += len(line)
                continue
            kid = None
            if isinstance(obj.get("knowledge_id"), str):
                kid = obj["knowledge_id"]
            elif isinstance(obj.get("id"), str):
                kid = obj["id"]
            if kid:
                offsets[kid] = offset
            offset += len(line)

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(offsets, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    msg = f"[god-learn] normalize: sorted {len(rows)} KUs and rebuilt index ({len(offsets)} offsets)"
    print(msg)
    if log_path is not None:
        with log_path.open("a", encoding="utf-8") as lf:
            lf.write(msg + "\n")


def verify_knowledge_strict_with_autofix(*, rr: Path, log_path: Optional[Path]) -> None:
    """
    Run verify_knowledge --strict_order.
    If it fails, normalize knowledge store + rebuild index, then retry once.
    """
    try:
        tee_run(["python3", "scripts/learn/verify_knowledge.py", "--strict_order"], cwd=rr, log_path=log_path)
        return
    except subprocess.CalledProcessError:
        print("[god-learn] verify_knowledge --strict_order failed; attempting normalize+rebuild index then retry...")
        normalize_knowledge_store(rr=rr, log_path=log_path)
        tee_run(["python3", "scripts/learn/verify_knowledge.py", "--strict_order"], cwd=rr, log_path=log_path)


# ----------------------------
# Commands
# ----------------------------

def cmd_status(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    rr = repo_root()

    print("[god-learn:status] repo_root =", rr)
    print("[god-learn:status] corpus_root =", root)

    paths = [
        ("corpus", root),
        ("vector_db_1536", rr / "vector_db_1536"),
        ("god-learn/knowledge.jsonl", rr / "god-learn" / "knowledge.jsonl"),
        ("god-learn/index.json", rr / "god-learn" / "index.json"),
        ("god-reason/reasoning.jsonl", rr / "god-reason" / "reasoning.jsonl"),
    ]
    for name, p in paths:
        exists = "OK" if p.exists() else "MISSING"
        print(f"[god-learn:status] {name}: {exists} ({p})")

    ku_path = rr / "god-learn" / "knowledge.jsonl"
    if ku_path.exists():
        n = sum(1 for _ in ku_path.open("r", encoding="utf-8"))
        print(f"[god-learn:status] knowledge_units = {n}")

    rg_path = rr / "god-reason" / "reasoning.jsonl"
    if rg_path.exists():
        n = sum(1 for _ in rg_path.open("r", encoding="utf-8"))
        print(f"[god-learn:status] reasoning_edges = {n}")


def cmd_compile(args: argparse.Namespace) -> None:
    rr = repo_root()
    root = Path(args.root).resolve()
    verbose = getattr(args, 'verbose', False) and not getattr(args, 'quiet', False)
    quiet = getattr(args, 'quiet', False)

    if not quiet:
        if args.no_run_dir:
            print("[god-learn:compile] no-run-dir enabled (no run folder/log).")

    log_path = None
    if not args.no_run_dir:
        _, log_path = setup_run_logging(
            rr=rr,
            no_run_dir=False,
            run_dir_base=args.run_dir,
            meta_pairs=[
                ("mode.txt", "compile"),
                ("corpus_root.txt", str(root)),
            ],
        )

    start_time = datetime.now()
    print_phase_header("Phase 1-3", "Compiling corpus substrate", verbose)

    run_compile_substrate(rr=rr, root=root, log_path=log_path)

    print_phase_complete("Phase 1-3 Compile", verbose)

    if verbose:
        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"[god-learn:compile] Total time: {elapsed:.1f}s")

    if not quiet:
        print("[god-learn:compile] OK")


def cmd_update(args: argparse.Namespace) -> None:
    rr = repo_root()
    root = Path(args.root).resolve()
    verbose = getattr(args, 'verbose', False) and not getattr(args, 'quiet', False)
    quiet = getattr(args, 'quiet', False)

    query = (args.query or "").strip()
    if not query:
        print("[god-learn:update] ERROR: --query is required.", file=sys.stderr)
        raise SystemExit(2)

    hits_json: Optional[Path] = Path(args.hits_json).resolve() if args.hits_json else None

    if args.hits_json:
        assert hits_json is not None
        if not hits_json.exists():
            print(f"[god-learn:update] ERROR: --hits-json not found: {hits_json}", file=sys.stderr)
            raise SystemExit(2)
    else:
        hits_json = Path("/tmp/phase4_hits.json")

    run_dir = None
    log_path = None
    if args.no_run_dir:
        if not quiet:
            print("[god-learn:update] no-run-dir enabled (no run folder/log/tmp snapshot).")
    else:
        run_dir, log_path = setup_run_logging(
            rr=rr,
            no_run_dir=False,
            run_dir_base=args.run_dir,
            meta_pairs=[
                ("mode.txt", "update"),
                ("query.txt", query),
                ("corpus_root.txt", str(root)),
                ("hits_json.txt", str(hits_json)),
            ],
        )
        if not quiet:
            print("[god-learn:update] run_dir =", run_dir)

    start_time = datetime.now()

    # Phase 1–3: compile substrate first
    print_phase_header("Phase 1-3", "Compiling corpus substrate (ingest/audit/verify)", verbose)
    run_compile_substrate(rr=rr, root=root, log_path=log_path)
    print_phase_complete("Phase 1-3", verbose)

    # Generate hits JSON if needed (Phase 4: Retrieval)
    print_phase_header("Phase 4", "Running retrieval query", verbose)
    if not args.hits_json:
        cmd = [
            "python3",
            "scripts/retrieval/query_chunks.py",
            query,
            "--k", str(args.k),
            "--overfetch", str(args.overfetch),
            "--include_docs",
            "--print_json",
        ]
        if args.where:
            cmd += ["--where", args.where]

        assert hits_json is not None
        tee_run(cmd, cwd=rr, log_path=log_path, stdout_to=hits_json)

        if not hits_json.exists() or hits_json.stat().st_size == 0:
            print(f"[god-learn:update] ERROR: failed to generate hits JSON at {hits_json}", file=sys.stderr)
            raise SystemExit(2)
    else:
        assert hits_json is not None
        q2 = infer_query_from_hits_json(hits_json)
        if q2 and q2.strip() != query:
            print(
                "[god-learn:update] WARNING: --hits-json contains a different top-level query than --query.\n"
                f"  hits_json.query={q2!r}\n"
                f"  --query       ={query!r}\n"
                "Proceeding with --query as the authoritative query.",
                file=sys.stderr,
            )

    # Phase 4 verification gate
    tee_run(["python3", "scripts/retrieval/verify_phase4.py", query], cwd=rr, log_path=log_path)
    print_phase_complete("Phase 4 Retrieval", verbose)

    # Phase 5 diagnostic (optional)
    if not args.skip_phase5:
        print_phase_header("Phase 5", "Highlight diagnostics", verbose)
        sh = rr / "scripts" / "highlights" / "phase5check.sh"
        if sh.exists():
            tee_run(["bash", "scripts/highlights/phase5check.sh"], cwd=rr, log_path=log_path)
        print_phase_complete("Phase 5 Highlights", verbose)

    # Phase 6 promote
    print_phase_header("Phase 6", "Promoting retrieval hits to Knowledge Units", verbose)
    assert hits_json is not None
    tee_run(
        ["python3", "scripts/learn/promote_hits.py", "--hits_json", str(hits_json), "--query", query],
        cwd=rr,
        log_path=log_path,
    )

    # STRICT verify with autofix normalization if needed
    verify_knowledge_strict_with_autofix(rr=rr, log_path=log_path)
    print_phase_complete("Phase 6 Promotion", verbose)

    if run_dir is not None:
        snapshot_tmp_artifacts(run_dir)

    if verbose:
        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"\n[god-learn:update] Total time: {elapsed:.1f}s")

    if not quiet:
        print("[god-learn:update] OK")


def cmd_verify(args: argparse.Namespace) -> None:
    rr = repo_root()
    root = Path(args.root).resolve()

    log_path = Path(args.log).resolve() if args.log else None

    tee_run(["python3", "scripts/ingest/audit_ingest.py", "--root", str(root)], cwd=rr, log_path=log_path)
    tee_run(["python3", "scripts/ingest/verify_ingest.py", "--root", str(root)], cwd=rr, log_path=log_path)
    verify_knowledge_strict_with_autofix(rr=rr, log_path=log_path)

    out_dir = args.assemble_out or "god-assemble-"
    p8 = rr / "scripts" / "assemble" / "verify_phase8.py"
    if p8.exists():
        if args.verify_assemble or assembly_exists(out_dir):
            tee_run(["python3", "scripts/assemble/verify_phase8.py", "--out", out_dir], cwd=rr, log_path=log_path)
        else:
            print(f"[god-learn:verify] Phase8 assembly not found at {rr/out_dir} (skipping).")


def print_phase_header(phase: str, description: str, verbose: bool = True) -> None:
    """Print a phase header with timestamp."""
    if not verbose:
        return
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"[{ts}] {phase}: {description}")
    print(f"{'='*60}\n", flush=True)


def print_phase_complete(phase: str, verbose: bool = True) -> None:
    """Print phase completion marker."""
    if not verbose:
        return
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n[{ts}] ✓ {phase} complete\n", flush=True)


def main() -> int:
    rr = repo_root()

    p = argparse.ArgumentParser(prog="god-learn", add_help=True)
    p.add_argument("--root", default=str(rr / "corpus"), help="Corpus root directory")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="Show detailed progress with timestamps")
    p.add_argument("--quiet", "-q", action="store_true",
                   help="Suppress non-error output")

    sub = p.add_subparsers(dest="cmd", required=True)

    ps = sub.add_parser("status", help="Show artifact state")
    ps.add_argument("--verbose", "-v", action="store_true", help="Show detailed progress")
    ps.add_argument("--quiet", "-q", action="store_true", help="Suppress non-error output")
    ps.set_defaults(func=cmd_status)

    pc = sub.add_parser("compile", help="Compile corpus substrate only (Phase 1–3: ingest/audit/verify)")
    pc.add_argument("--run-dir", help="Base directory for run logs (default: <repo>/god-learn/runs/)")
    pc.add_argument("--no-run-dir", action="store_true", help="Do not create a run folder/log")
    pc.add_argument("--verbose", "-v", action="store_true", help="Show detailed progress with timestamps")
    pc.add_argument("--quiet", "-q", action="store_true", help="Suppress non-error output")
    pc.set_defaults(func=cmd_compile)

    pu = sub.add_parser("update", help="Compile + query-conditioned retrieval/promotion (Phase 1–6 wrapper)")
    pu.add_argument("--query", required=True, help="Query string used to drive retrieval/promotion")
    pu.add_argument("--hits-json", dest="hits_json", help="Path to hits JSON (if omitted, generated to /tmp/phase4_hits.json)")
    pu.add_argument("--skip-phase5", action="store_true", help="Skip phase5check.sh diagnostic step")
    pu.add_argument("--run-dir", help="Base directory for run logs (default: <repo>/god-learn/runs/)")
    pu.add_argument("--no-run-dir", action="store_true", help="Do not create a run folder/log/tmp snapshot")
    pu.add_argument("--k", type=int, default=8, help="Top-k for query_chunks when generating hits JSON (default: 8)")
    pu.add_argument("--overfetch", type=int, default=8, help="Overfetch for query_chunks when generating hits JSON (default: 8)")
    pu.add_argument("--where", default=None, help="Optional Chroma where JSON (string) passed to query_chunks.py")
    pu.add_argument("--verbose", "-v", action="store_true", help="Show detailed progress with timestamps")
    pu.add_argument("--quiet", "-q", action="store_true", help="Suppress non-error output")
    pu.set_defaults(func=cmd_update)

    pv = sub.add_parser("verify", help="Run verification gates (Phase 3/6/8)")
    pv.add_argument("--verify-assemble", action="store_true",
                    help="Fail if Phase 8 assembly outputs are missing; otherwise auto-skip.")
    pv.add_argument("--assemble-out", default="god-assemble-",
                    help="Assembly output folder name (default: god-assemble-)")
    pv.add_argument("--log", help="Optional log file path for verify output (otherwise prints only)")
    pv.add_argument("--verbose", "-v", action="store_true", help="Show detailed progress")
    pv.add_argument("--quiet", "-q", action="store_true", help="Suppress non-error output")
    pv.set_defaults(func=cmd_verify)

    args = p.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
