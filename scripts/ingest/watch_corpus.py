#!/usr/bin/env python3
"""
Phase 1-2 Watch Mode - Auto-ingest new PDFs

Monitors corpus directory for new/modified files and automatically
triggers ingestion pipeline (Phase 1 extract + Phase 2 embed).

Features:
- Filesystem monitoring via watchdog
- Debouncing (5 second window for rapid changes)
- Graceful shutdown on SIGINT/SIGTERM
- Activity logging to logs/watch.log

Usage:
  python scripts/ingest/watch_corpus.py --root corpus/
  god ingest watch --root corpus/
"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, Set

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent

# Setup logging
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "watch.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("watch_corpus")

# Configuration
ALLOWED_EXTS = {".pdf", ".md", ".txt"}
DEBOUNCE_SECONDS = 5.0
SCRIPTS_DIR = Path(__file__).parent


class CorpusEventHandler(FileSystemEventHandler):
    """Handle filesystem events for corpus directory."""

    def __init__(self, root: Path, dry_run: bool = False):
        super().__init__()
        self.root = root.resolve()
        self.dry_run = dry_run
        self.pending: Dict[str, float] = {}  # path -> timestamp
        self.lock = threading.Lock()
        self.processing: Set[str] = set()

        # Start debounce processor thread
        self.running = True
        self.processor_thread = threading.Thread(target=self._process_pending, daemon=True)
        self.processor_thread.start()

    def _is_allowed(self, path: str) -> bool:
        """Check if file extension is allowed."""
        return Path(path).suffix.lower() in ALLOWED_EXTS

    def _is_in_corpus(self, path: str) -> bool:
        """Check if path is within corpus root."""
        try:
            Path(path).resolve().relative_to(self.root)
            return True
        except ValueError:
            return False

    def on_created(self, event):
        if event.is_directory:
            return
        if self._is_allowed(event.src_path) and self._is_in_corpus(event.src_path):
            self._queue_file(event.src_path, "created")

    def on_modified(self, event):
        if event.is_directory:
            return
        if self._is_allowed(event.src_path) and self._is_in_corpus(event.src_path):
            self._queue_file(event.src_path, "modified")

    def _queue_file(self, path: str, event_type: str):
        """Queue file for processing with debouncing."""
        with self.lock:
            self.pending[path] = time.time()
            logger.info(f"Queued ({event_type}): {path}")

    def _process_pending(self):
        """Background thread to process debounced files."""
        while self.running:
            time.sleep(1.0)

            to_process = []
            now = time.time()

            with self.lock:
                expired = [
                    p for p, ts in self.pending.items()
                    if (now - ts) >= DEBOUNCE_SECONDS and p not in self.processing
                ]
                for p in expired:
                    del self.pending[p]
                    self.processing.add(p)
                    to_process.append(p)

            for path in to_process:
                self._ingest_file(path)
                with self.lock:
                    self.processing.discard(path)

    def _ingest_file(self, path: str):
        """Run ingestion pipeline for a single file."""
        logger.info(f"Processing: {path}")

        if self.dry_run:
            logger.info(f"[DRY RUN] Would ingest: {path}")
            return

        try:
            # Phase 1: Extract text and chunk
            phase1_cmd = [
                sys.executable,
                str(SCRIPTS_DIR / "run_ingest.py"),
                "--root", str(self.root)
            ]
            logger.info(f"Running Phase 1: {' '.join(phase1_cmd)}")
            result1 = subprocess.run(phase1_cmd, capture_output=True, text=True)

            if result1.returncode != 0:
                logger.error(f"Phase 1 failed for {path}: {result1.stderr[:500]}")
                return

            # Phase 2: Embed chunks
            phase2_cmd = [
                sys.executable,
                str(SCRIPTS_DIR / "run_ingest_phase2.py"),
                "--root", str(self.root)
            ]
            logger.info(f"Running Phase 2: {' '.join(phase2_cmd)}")
            result2 = subprocess.run(phase2_cmd, capture_output=True, text=True)

            if result2.returncode != 0:
                logger.error(f"Phase 2 failed for {path}: {result2.stderr[:500]}")
                return

            logger.info(f"Successfully ingested: {path}")

        except Exception as e:
            logger.error(f"Ingestion error for {path}: {e}")

    def stop(self):
        """Stop the processor thread."""
        self.running = False
        if self.processor_thread.is_alive():
            self.processor_thread.join(timeout=2.0)


def main() -> int:
    global DEBOUNCE_SECONDS

    ap = argparse.ArgumentParser(description="Watch corpus directory for new files and auto-ingest.")
    ap.add_argument("--root", default="corpus", help="Corpus root directory to watch (default: corpus)")
    ap.add_argument("--debounce", type=float, default=5.0,
                    help="Debounce window in seconds (default: 5.0)")
    ap.add_argument("--recursive", action="store_true", default=True,
                    help="Watch subdirectories recursively (default: True)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Log what would be processed without actually processing")
    ap.add_argument("--no-log-file", action="store_true",
                    help="Disable file logging (console only)")
    args = ap.parse_args()

    DEBOUNCE_SECONDS = args.debounce

    # Reconfigure logging if --no-log-file
    if args.no_log_file:
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
            handlers=[logging.StreamHandler(sys.stdout)]
        )

    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        logger.error(f"Corpus root does not exist or is not a directory: {root}")
        return 2

    logger.info("=" * 60)
    logger.info("God-Learn Watch Mode")
    logger.info("=" * 60)
    logger.info(f"Watching: {root}")
    logger.info(f"Debounce: {DEBOUNCE_SECONDS}s")
    logger.info(f"Extensions: {', '.join(sorted(ALLOWED_EXTS))}")
    if args.dry_run:
        logger.info("[DRY RUN MODE - no files will be processed]")
    logger.info("Press Ctrl+C to stop")
    logger.info("")

    event_handler = CorpusEventHandler(root, dry_run=args.dry_run)
    observer = Observer()
    observer.schedule(event_handler, str(root), recursive=args.recursive)

    # Graceful shutdown handler
    shutdown_event = threading.Event()

    def signal_handler(signum, frame):
        logger.info("Shutdown signal received...")
        shutdown_event.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    observer.start()

    try:
        while not shutdown_event.is_set():
            time.sleep(1)
    finally:
        logger.info("Stopping watch mode...")
        observer.stop()
        event_handler.stop()
        observer.join(timeout=5.0)
        logger.info("Watch mode stopped.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
