"""
Centralized Logging Infrastructure for God-Learn Pipeline.

Features:
- Structured JSON logs for machine parsing
- Console output with color support
- File logging with rotation
- Log level configuration via environment
- Context injection (phase, operation, file)

Usage:
    from scripts.common import get_logger

    logger = get_logger("phase6")
    logger.info("Processing document", extra={"doc": "file.pdf", "page": 42})

Environment Variables:
    GOD_LEARN_LOG_LEVEL: DEBUG|INFO|WARNING|ERROR (default: INFO)
    GOD_LEARN_LOG_FILE: Path to log file (default: logs/god-learn.log)
    GOD_LEARN_LOG_JSON: true|false - Enable JSON logging (default: false)
    GOD_LEARN_LOG_MAX_SIZE: Max log file size in MB (default: 10)
    GOD_LEARN_LOG_BACKUP_COUNT: Number of backup files (default: 5)
"""

import json
import logging
import os
import sys
from datetime import datetime
from enum import Enum
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional


class LogLevel(Enum):
    """Log level enumeration."""
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


class JSONFormatter(logging.Formatter):
    """
    Structured JSON log formatter for machine parsing.

    Output format:
    {
        "timestamp": "2026-01-13T16:30:00.123456",
        "level": "INFO",
        "logger": "phase6",
        "message": "Processing document",
        "context": {"doc": "file.pdf", "page": 42},
        "source": {"file": "promote_hits.py", "line": 123, "function": "process"}
    }
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add context from extra fields
        context = {}
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "exc_info", "exc_text", "thread", "threadName",
                "message", "asctime"
            }:
                context[key] = value

        if context:
            log_entry["context"] = context

        # Add source location
        log_entry["source"] = {
            "file": record.filename,
            "line": record.lineno,
            "function": record.funcName,
        }

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


class ColorFormatter(logging.Formatter):
    """
    Colored console formatter for human readability.

    Colors:
    - DEBUG: Cyan
    - INFO: Green
    - WARNING: Yellow
    - ERROR: Red
    - CRITICAL: Red (bold)
    """

    COLORS = {
        logging.DEBUG: "\033[36m",     # Cyan
        logging.INFO: "\033[32m",      # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[1;31m", # Bold Red
    }
    RESET = "\033[0m"

    def __init__(self, use_color: bool = True):
        super().__init__(
            fmt="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%H:%M:%S"
        )
        self.use_color = use_color and sys.stdout.isatty()

    def format(self, record: logging.LogRecord) -> str:
        # Add context fields to message if present
        message = record.getMessage()

        context_fields = []
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "exc_info", "exc_text", "thread", "threadName",
                "message", "asctime"
            }:
                context_fields.append(f"{key}={value}")

        if context_fields:
            message = f"{message} [{', '.join(context_fields)}]"

        # Temporarily modify the record
        original_msg = record.msg
        record.msg = message
        record.args = ()

        formatted = super().format(record)

        # Restore original
        record.msg = original_msg

        if self.use_color:
            color = self.COLORS.get(record.levelno, "")
            return f"{color}{formatted}{self.RESET}"

        return formatted


class GodLearnLogger:
    """
    Centralized logger configuration for God-Learn pipeline.

    Manages:
    - Logger instances per module
    - Console and file handlers
    - Log rotation
    - JSON formatting option
    """

    _instance: Optional["GodLearnLogger"] = None
    _initialized: bool = False

    def __new__(cls) -> "GodLearnLogger":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if GodLearnLogger._initialized:
            return

        self.loggers: Dict[str, logging.Logger] = {}
        self.log_dir = Path(os.environ.get("GOD_LEARN_LOG_DIR", "logs"))
        self.log_file = os.environ.get("GOD_LEARN_LOG_FILE", "god-learn.log")
        self.log_level = self._get_log_level()
        self.use_json = os.environ.get("GOD_LEARN_LOG_JSON", "false").lower() == "true"
        self.max_size_mb = int(os.environ.get("GOD_LEARN_LOG_MAX_SIZE", "10"))
        self.backup_count = int(os.environ.get("GOD_LEARN_LOG_BACKUP_COUNT", "5"))

        # Ensure log directory exists
        self.log_dir.mkdir(parents=True, exist_ok=True)

        GodLearnLogger._initialized = True

    def _get_log_level(self) -> int:
        """Get log level from environment."""
        level_str = os.environ.get("GOD_LEARN_LOG_LEVEL", "INFO").upper()
        level_map = {
            "DEBUG": logging.DEBUG,
            "INFO": logging.INFO,
            "WARNING": logging.WARNING,
            "WARN": logging.WARNING,
            "ERROR": logging.ERROR,
            "CRITICAL": logging.CRITICAL,
        }
        return level_map.get(level_str, logging.INFO)

    def get_logger(self, name: str) -> logging.Logger:
        """
        Get or create a logger for the given name.

        Args:
            name: Logger name (typically module or phase name)

        Returns:
            Configured logger instance
        """
        if name in self.loggers:
            return self.loggers[name]

        logger = logging.getLogger(f"god-learn.{name}")
        logger.setLevel(self.log_level)
        logger.propagate = False

        # Console handler
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setLevel(self.log_level)

        if self.use_json:
            console_handler.setFormatter(JSONFormatter())
        else:
            console_handler.setFormatter(ColorFormatter())

        logger.addHandler(console_handler)

        # File handler with rotation
        log_path = self.log_dir / self.log_file
        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=self.max_size_mb * 1024 * 1024,
            backupCount=self.backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(self.log_level)
        file_handler.setFormatter(JSONFormatter())  # Always JSON for files

        logger.addHandler(file_handler)

        self.loggers[name] = logger
        return logger

    def set_level(self, level: LogLevel) -> None:
        """Set log level for all loggers."""
        self.log_level = level.value
        for logger in self.loggers.values():
            logger.setLevel(level.value)
            for handler in logger.handlers:
                handler.setLevel(level.value)


# Module-level convenience functions

_logger_manager: Optional[GodLearnLogger] = None


def setup_logging(
    level: Optional[LogLevel] = None,
    log_dir: Optional[str] = None,
    log_file: Optional[str] = None,
    use_json: Optional[bool] = None,
) -> GodLearnLogger:
    """
    Initialize logging configuration.

    Args:
        level: Log level (overrides environment)
        log_dir: Log directory path
        log_file: Log file name
        use_json: Enable JSON console output

    Returns:
        Logger manager instance
    """
    global _logger_manager

    # Set environment variables before initialization
    if level:
        os.environ["GOD_LEARN_LOG_LEVEL"] = level.name
    if log_dir:
        os.environ["GOD_LEARN_LOG_DIR"] = log_dir
    if log_file:
        os.environ["GOD_LEARN_LOG_FILE"] = log_file
    if use_json is not None:
        os.environ["GOD_LEARN_LOG_JSON"] = "true" if use_json else "false"

    # Reset singleton for reconfiguration
    GodLearnLogger._initialized = False
    GodLearnLogger._instance = None

    _logger_manager = GodLearnLogger()
    return _logger_manager


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for the given name.

    Args:
        name: Logger name (e.g., "phase6", "ingest", "retrieval")

    Returns:
        Configured logger instance

    Example:
        from scripts.common import get_logger

        logger = get_logger("phase6")
        logger.info("Starting promotion", extra={"query": "phantasia"})
        logger.error("Failed to process", extra={"file": "doc.pdf"}, exc_info=True)
    """
    global _logger_manager

    if _logger_manager is None:
        _logger_manager = GodLearnLogger()

    return _logger_manager.get_logger(name)


# Convenience function for quick structured logging
def log_operation(
    logger: logging.Logger,
    operation: str,
    status: str = "start",
    **context: Any
) -> None:
    """
    Log an operation with structured context.

    Args:
        logger: Logger instance
        operation: Operation name
        status: start|success|error|skip
        **context: Additional context fields

    Example:
        log_operation(logger, "promote_ku", "start", ku_id="ku-123", source="doc.pdf")
        log_operation(logger, "promote_ku", "success", ku_id="ku-123", duration=0.5)
        log_operation(logger, "promote_ku", "error", ku_id="ku-123", error="Invalid format")
    """
    level = {
        "start": logging.INFO,
        "success": logging.INFO,
        "skip": logging.DEBUG,
        "error": logging.ERROR,
    }.get(status, logging.INFO)

    message = f"[{operation}] {status}"
    logger.log(level, message, extra={"operation": operation, "status": status, **context})
