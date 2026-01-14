"""
Common utilities for God-Learn pipeline.

Provides shared functionality across all phases:
- Logging infrastructure
- Configuration management
- Error handling utilities
"""

from .logging_config import (
    get_logger,
    setup_logging,
    LogLevel,
    JSONFormatter,
)

from .errors import (
    GodLearnError,
    IngestionError,
    RetrievalError,
    PromotionError,
    ReasoningError,
    ValidationError,
    ConfigurationError,
    FileOperationError,
    safe_execute,
    with_error_context,
    log_and_continue,
    classify_exception,
    format_error_chain,
    get_error_context,
)

from .resilience import (
    retry,
    RetryError,
    CircuitBreaker,
    circuit_breaker,
    CircuitState,
    CircuitOpenError,
    with_timeout,
    TimeoutError,
    fallback,
    with_fallback_value,
    HealthChecker,
    ServiceHealth,
)

# Import config as module (use: from scripts.common import config)
from . import config

__all__ = [
    # Logging
    "get_logger",
    "setup_logging",
    "LogLevel",
    "JSONFormatter",
    # Exceptions
    "GodLearnError",
    "IngestionError",
    "RetrievalError",
    "PromotionError",
    "ReasoningError",
    "ValidationError",
    "ConfigurationError",
    "FileOperationError",
    # Error utilities
    "safe_execute",
    "with_error_context",
    "log_and_continue",
    "classify_exception",
    "format_error_chain",
    "get_error_context",
    # Resilience
    "retry",
    "RetryError",
    "CircuitBreaker",
    "circuit_breaker",
    "CircuitState",
    "CircuitOpenError",
    "with_timeout",
    "TimeoutError",
    "fallback",
    "with_fallback_value",
    "HealthChecker",
    "ServiceHealth",
    # Configuration
    "config",
]
