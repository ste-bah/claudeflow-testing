#!/usr/bin/env python3
"""
QA Watch Daemon - Continuous health monitoring

Background process that periodically checks corpus health metrics
and raises alerts on issues.

Features:
- Configurable check intervals (default: 5 minutes)
- Checks: embedding health, coverage drift, consistency
- Alert severity levels: info, warning, critical
- Writes alerts to god-learn/alerts/active.json

Usage:
  god qa watch                   # Start in foreground
  god qa watch --daemon          # Start as background process
  god qa watch --stop            # Stop daemon
  god qa alerts                  # Show active alerts
"""

from __future__ import annotations

import argparse
import atexit
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Setup logging
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "qa_daemon.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("qa_daemon")

# Paths
PID_FILE = Path(".run/qa_daemon.pid")
ALERTS_DIR = Path("god-learn/alerts")
ACTIVE_ALERTS_FILE = ALERTS_DIR / "active.json"
ALERT_HISTORY_FILE = ALERTS_DIR / "history.jsonl"


@dataclass
class Alert:
    """A health alert."""
    id: str
    timestamp: float
    timestamp_human: str
    severity: str  # info, warning, critical
    category: str  # embedding, coverage, consistency, system
    message: str
    details: Optional[Dict[str, Any]] = None
    resolved: bool = False
    resolved_at: Optional[float] = None


class HealthChecker:
    """Performs health checks."""

    def __init__(self):
        self.checks = [
            ("embedding", self.check_embedding_health),
            ("coverage", self.check_coverage_health),
            ("consistency", self.check_consistency),
            ("system", self.check_system_health),
        ]

    def check_embedding_health(self) -> List[Alert]:
        """Check if embedding server is responsive."""
        alerts = []
        try:
            import urllib.request
            req = urllib.request.Request("http://127.0.0.1:8000/", timeout=5)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") != "online":
                    alerts.append(self._create_alert(
                        "warning", "embedding",
                        "Embedding server status not 'online'",
                        {"status": data.get("status")}
                    ))
        except Exception as e:
            alerts.append(self._create_alert(
                "critical", "embedding",
                f"Embedding server unreachable: {str(e)[:100]}",
                {"error": str(e)}
            ))
        return alerts

    def check_coverage_health(self) -> List[Alert]:
        """Check for coverage issues."""
        alerts = []

        # Check if knowledge file exists and has content
        knowledge_file = Path("god-learn/knowledge.jsonl")
        if not knowledge_file.exists():
            alerts.append(self._create_alert(
                "warning", "coverage",
                "Knowledge file does not exist",
                {"path": str(knowledge_file)}
            ))
        elif knowledge_file.stat().st_size == 0:
            alerts.append(self._create_alert(
                "warning", "coverage",
                "Knowledge file is empty",
                {"path": str(knowledge_file)}
            ))

        # Check manifest for failed ingestions
        manifest_file = Path("scripts/ingest/manifest.jsonl")
        if manifest_file.exists():
            failed_count = 0
            with manifest_file.open("r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        rec = json.loads(line)
                        if rec.get("status") == "failed":
                            failed_count += 1
                    except Exception:
                        pass

            if failed_count > 0:
                alerts.append(self._create_alert(
                    "warning", "coverage",
                    f"{failed_count} document(s) failed ingestion",
                    {"failed_count": failed_count}
                ))

        return alerts

    def check_consistency(self) -> List[Alert]:
        """Check for consistency issues."""
        alerts = []

        # Check index-knowledge sync
        index_file = Path("god-learn/index.json")
        knowledge_file = Path("god-learn/knowledge.jsonl")

        if index_file.exists() and knowledge_file.exists():
            try:
                index = json.loads(index_file.read_text())
                ku_count = sum(1 for _ in knowledge_file.open("r") if _.strip())

                if len(index) != ku_count:
                    alerts.append(self._create_alert(
                        "warning", "consistency",
                        f"Index/knowledge mismatch: {len(index)} indexed vs {ku_count} KUs",
                        {"indexed": len(index), "total_kus": ku_count}
                    ))
            except Exception as e:
                alerts.append(self._create_alert(
                    "info", "consistency",
                    f"Could not verify index consistency: {str(e)[:100]}",
                    {"error": str(e)}
                ))

        return alerts

    def check_system_health(self) -> List[Alert]:
        """Check system-level health."""
        alerts = []

        # Check disk space for vector DB
        vector_db = Path("vector_db_1536")
        if vector_db.exists():
            try:
                import shutil
                total, used, free = shutil.disk_usage(vector_db)
                free_gb = free / (1024**3)
                if free_gb < 1.0:
                    alerts.append(self._create_alert(
                        "critical", "system",
                        f"Low disk space: {free_gb:.1f} GB free",
                        {"free_gb": free_gb}
                    ))
                elif free_gb < 5.0:
                    alerts.append(self._create_alert(
                        "warning", "system",
                        f"Disk space getting low: {free_gb:.1f} GB free",
                        {"free_gb": free_gb}
                    ))
            except Exception:
                pass

        return alerts

    def _create_alert(
        self,
        severity: str,
        category: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Create an alert with generated ID."""
        import hashlib
        now = time.time()
        payload = f"{category}:{message}:{now}"
        alert_id = "alert_" + hashlib.sha256(payload.encode()).hexdigest()[:12]

        return Alert(
            id=alert_id,
            timestamp=now,
            timestamp_human=datetime.fromtimestamp(now).isoformat(),
            severity=severity,
            category=category,
            message=message,
            details=details
        )

    def run_all_checks(self) -> List[Alert]:
        """Run all health checks and return alerts."""
        all_alerts = []
        for name, check_fn in self.checks:
            try:
                alerts = check_fn()
                all_alerts.extend(alerts)
            except Exception as e:
                logger.error(f"Check '{name}' failed: {e}")
        return all_alerts


class AlertManager:
    """Manages alerts."""

    def __init__(self):
        ALERTS_DIR.mkdir(parents=True, exist_ok=True)

    def load_active_alerts(self) -> List[Alert]:
        """Load currently active alerts."""
        if not ACTIVE_ALERTS_FILE.exists():
            return []

        try:
            data = json.loads(ACTIVE_ALERTS_FILE.read_text())
            return [Alert(**a) for a in data.get("alerts", [])]
        except Exception:
            return []

    def save_active_alerts(self, alerts: List[Alert]):
        """Save active alerts."""
        data = {
            "updated": datetime.now().isoformat(),
            "alerts": [asdict(a) for a in alerts if not a.resolved]
        }
        ACTIVE_ALERTS_FILE.write_text(json.dumps(data, indent=2))

    def add_alerts(self, new_alerts: List[Alert]) -> int:
        """Add new alerts, deduplicating by message."""
        current = self.load_active_alerts()
        current_messages = {a.message for a in current}

        added = 0
        for alert in new_alerts:
            if alert.message not in current_messages:
                current.append(alert)
                current_messages.add(alert.message)
                added += 1

                # Log to history
                with ALERT_HISTORY_FILE.open("a") as f:
                    f.write(json.dumps(asdict(alert)) + "\n")

        self.save_active_alerts(current)
        return added

    def clear_alerts(self, category: Optional[str] = None):
        """Clear alerts, optionally by category."""
        current = self.load_active_alerts()

        if category:
            current = [a for a in current if a.category != category]
        else:
            current = []

        self.save_active_alerts(current)

    def get_summary(self) -> Dict[str, Any]:
        """Get alert summary."""
        alerts = self.load_active_alerts()

        by_severity = {"critical": 0, "warning": 0, "info": 0}
        for a in alerts:
            by_severity[a.severity] = by_severity.get(a.severity, 0) + 1

        return {
            "total": len(alerts),
            "by_severity": by_severity,
            "alerts": alerts
        }


class QADaemon:
    """The QA monitoring daemon."""

    def __init__(self, interval: int = 300):
        self.interval = interval  # seconds
        self.running = False
        self.checker = HealthChecker()
        self.alert_manager = AlertManager()

    def start(self):
        """Start the daemon."""
        self.running = True
        self._write_pid()

        logger.info("=" * 60)
        logger.info("QA Watch Daemon Started")
        logger.info("=" * 60)
        logger.info(f"Check interval: {self.interval} seconds")
        logger.info("Press Ctrl+C to stop")
        logger.info("")

        # Initial check
        self._run_check()

        while self.running:
            time.sleep(self.interval)
            if self.running:
                self._run_check()

    def _run_check(self):
        """Run a single health check cycle."""
        logger.info("Running health checks...")

        alerts = self.checker.run_all_checks()
        added = self.alert_manager.add_alerts(alerts)

        if alerts:
            critical = sum(1 for a in alerts if a.severity == "critical")
            warning = sum(1 for a in alerts if a.severity == "warning")
            info = sum(1 for a in alerts if a.severity == "info")

            logger.warning(f"Found {len(alerts)} issues: {critical} critical, {warning} warning, {info} info")
            for alert in alerts:
                logger.warning(f"  [{alert.severity.upper()}] {alert.category}: {alert.message}")
        else:
            logger.info("All checks passed")

    def stop(self):
        """Stop the daemon."""
        self.running = False
        self._remove_pid()
        logger.info("QA Watch Daemon stopped")

    def _write_pid(self):
        """Write PID file."""
        PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        PID_FILE.write_text(str(os.getpid()))

    def _remove_pid(self):
        """Remove PID file."""
        if PID_FILE.exists():
            PID_FILE.unlink()


def get_running_pid() -> Optional[int]:
    """Get PID of running daemon, if any."""
    if not PID_FILE.exists():
        return None

    try:
        pid = int(PID_FILE.read_text().strip())
        # Check if process exists
        os.kill(pid, 0)
        return pid
    except (ValueError, ProcessLookupError, PermissionError):
        return None


def stop_daemon() -> bool:
    """Stop the running daemon."""
    pid = get_running_pid()
    if pid is None:
        print("No daemon running")
        return False

    try:
        os.kill(pid, signal.SIGTERM)
        time.sleep(1)
        print(f"Stopped daemon (PID {pid})")
        return True
    except Exception as e:
        print(f"Failed to stop daemon: {e}")
        return False


def show_alerts() -> int:
    """Show active alerts."""
    manager = AlertManager()
    summary = manager.get_summary()

    print("Active Alerts")
    print("=" * 60)

    if summary["total"] == 0:
        print("No active alerts")
        return 0

    print(f"Total: {summary['total']}")
    print(f"  Critical: {summary['by_severity'].get('critical', 0)}")
    print(f"  Warning:  {summary['by_severity'].get('warning', 0)}")
    print(f"  Info:     {summary['by_severity'].get('info', 0)}")
    print()

    for alert in summary["alerts"]:
        dt = datetime.fromtimestamp(alert.timestamp)
        print(f"[{alert.severity.upper():8}] {alert.category}")
        print(f"  {alert.message}")
        print(f"  Time: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
        print()

    return 1 if summary["by_severity"].get("critical", 0) > 0 else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="QA Watch Daemon - Continuous health monitoring")
    ap.add_argument("--interval", type=int, default=300,
                    help="Check interval in seconds (default: 300)")
    ap.add_argument("--daemon", action="store_true",
                    help="Run as background daemon")
    ap.add_argument("--stop", action="store_true",
                    help="Stop running daemon")
    ap.add_argument("--status", action="store_true",
                    help="Show daemon status")
    ap.add_argument("--alerts", action="store_true",
                    help="Show active alerts")
    ap.add_argument("--clear-alerts", action="store_true",
                    help="Clear all alerts")
    args = ap.parse_args()

    if args.stop:
        return 0 if stop_daemon() else 1

    if args.status:
        pid = get_running_pid()
        if pid:
            print(f"Daemon running (PID {pid})")
        else:
            print("Daemon not running")
        return 0

    if args.alerts:
        return show_alerts()

    if args.clear_alerts:
        AlertManager().clear_alerts()
        print("Alerts cleared")
        return 0

    # Check if already running
    pid = get_running_pid()
    if pid:
        print(f"Daemon already running (PID {pid})")
        print("Use --stop to stop it first")
        return 1

    daemon = QADaemon(interval=args.interval)

    # Signal handlers
    def handle_signal(signum, frame):
        daemon.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    if args.daemon:
        # Fork to background
        pid = os.fork()
        if pid > 0:
            print(f"Daemon started (PID {pid})")
            return 0

        # Child process
        os.setsid()
        sys.stdout = open(LOG_DIR / "qa_daemon.log", "a")
        sys.stderr = sys.stdout

    try:
        daemon.start()
    finally:
        daemon.stop()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
