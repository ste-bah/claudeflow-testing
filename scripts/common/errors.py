"""
Error Handling Utilities for God-Learn Pipeline.

Provides:
- Custom exception classes for domain-specific errors
- Error context utilities
- Safe execution wrappers

Usage:
    from scripts.common.errors import (
        GodLearnError,
        IngestionError,
        RetrievalError,
        PromotionError,
        safe_execute,
    )
"""

import functools
import sys
import traceback
from pathlib import Path
from typing import Any, Callable, Optional, Type, TypeVar, Union

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import get_logger

T = TypeVar("T")


# =============================================================================
# Custom Exceptions
# =============================================================================

class GodLearnError(Exception):
    """Base exception for all God-Learn pipeline errors."""

    def __init__(self, message: str, context: Optional[dict] = None):
        super().__init__(message)
        self.message = message
        self.context = context or {}

    def __str__(self) -> str:
        if self.context:
            ctx_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
            return f"{self.message} [{ctx_str}]"
        return self.message


class IngestionError(GodLearnError):
    """Errors during document ingestion (Phases 1-3)."""
    pass


class RetrievalError(GodLearnError):
    """Errors during retrieval operations (Phases 4-5)."""
    pass


class PromotionError(GodLearnError):
    """Errors during knowledge promotion (Phase 6)."""
    pass


class ReasoningError(GodLearnError):
    """Errors during reasoning graph building (Phase 7)."""
    pass


class ValidationError(GodLearnError):
    """Errors during data validation."""
    pass


class ConfigurationError(GodLearnError):
    """Errors in configuration or setup."""
    pass


class FileOperationError(GodLearnError):
    """Errors during file read/write operations."""
    pass


# =============================================================================
# Exception Mapping
# =============================================================================

# Map standard exceptions to more specific handling
EXCEPTION_MAP = {
    # JSON parsing
    "json.JSONDecodeError": ("JSONDecodeError", "Malformed JSON data"),
    "ValueError": ("ValueError", "Invalid value or type"),

    # File operations
    "FileNotFoundError": ("FileNotFoundError", "File not found"),
    "PermissionError": ("PermissionError", "Permission denied"),
    "IsADirectoryError": ("IsADirectoryError", "Expected file, got directory"),
    "OSError": ("OSError", "OS-level error"),

    # Key/attribute access
    "KeyError": ("KeyError", "Missing required key"),
    "AttributeError": ("AttributeError", "Missing attribute"),
    "TypeError": ("TypeError", "Type mismatch"),
    "IndexError": ("IndexError", "Index out of range"),

    # Network
    "ConnectionError": ("ConnectionError", "Connection failed"),
    "TimeoutError": ("TimeoutError", "Operation timed out"),
}


def classify_exception(exc: Exception) -> tuple[str, str]:
    """
    Classify an exception into a category and description.

    Returns:
        Tuple of (exception_type, description)
    """
    exc_type = type(exc).__name__
    if exc_type in EXCEPTION_MAP:
        return EXCEPTION_MAP[exc_type]
    return (exc_type, str(exc))


# =============================================================================
# Safe Execution Wrappers
# =============================================================================

def safe_execute(
    func: Callable[..., T],
    *args: Any,
    default: Optional[T] = None,
    logger_name: str = "safe_execute",
    reraise: bool = False,
    error_class: Type[GodLearnError] = GodLearnError,
    **kwargs: Any,
) -> Optional[T]:
    """
    Execute a function with comprehensive error handling.

    Args:
        func: Function to execute
        *args: Positional arguments
        default: Default value to return on error
        logger_name: Logger name for error reporting
        reraise: Whether to reraise as GodLearnError
        error_class: Custom error class to use when reraising
        **kwargs: Keyword arguments

    Returns:
        Function result or default on error

    Example:
        result = safe_execute(
            json.loads,
            raw_data,
            default={},
            logger_name="phase6",
        )
    """
    logger = get_logger(logger_name)

    try:
        return func(*args, **kwargs)
    except Exception as e:
        exc_type, exc_desc = classify_exception(e)

        logger.warning(
            f"Operation failed: {func.__name__}",
            extra={
                "function": func.__name__,
                "exception_type": exc_type,
                "exception_desc": exc_desc,
                "error": str(e),
            }
        )

        if reraise:
            raise error_class(
                f"{func.__name__} failed: {e}",
                context={"original_exception": exc_type}
            ) from e

        return default


def with_error_context(
    operation: str,
    logger_name: str = "operation",
    reraise: bool = True,
    error_class: Type[GodLearnError] = GodLearnError,
):
    """
    Decorator to add error context to a function.

    Args:
        operation: Description of the operation
        logger_name: Logger name
        reraise: Whether to reraise exceptions
        error_class: Custom error class

    Example:
        @with_error_context("loading knowledge units", "phase6")
        def load_kus(path):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            logger = get_logger(logger_name)

            try:
                return func(*args, **kwargs)
            except GodLearnError:
                # Don't wrap our own exceptions
                raise
            except Exception as e:
                exc_type, exc_desc = classify_exception(e)

                logger.error(
                    f"Error during {operation}",
                    extra={
                        "operation": operation,
                        "function": func.__name__,
                        "exception_type": exc_type,
                        "error": str(e),
                    },
                    exc_info=True,
                )

                if reraise:
                    raise error_class(
                        f"Failed to {operation}: {e}",
                        context={
                            "function": func.__name__,
                            "original_exception": exc_type,
                        }
                    ) from e
                raise

        return wrapper
    return decorator


def log_and_continue(
    logger_name: str = "operation",
    default: Any = None,
):
    """
    Decorator to log exceptions and return default value.

    Use for non-critical operations where failure is acceptable.

    Example:
        @log_and_continue("phase6", default=[])
        def optional_enrichment(data):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., Optional[T]]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Optional[T]:
            logger = get_logger(logger_name)

            try:
                return func(*args, **kwargs)
            except Exception as e:
                exc_type, _ = classify_exception(e)

                logger.warning(
                    f"Non-critical failure in {func.__name__}",
                    extra={
                        "function": func.__name__,
                        "exception_type": exc_type,
                        "error": str(e),
                    }
                )

                return default

        return wrapper
    return decorator


# =============================================================================
# Error Formatting
# =============================================================================

def format_error_chain(exc: Exception, max_depth: int = 5) -> str:
    """
    Format an exception chain for logging.

    Returns a string showing the exception cause chain.
    """
    chain = []
    current = exc
    depth = 0

    while current and depth < max_depth:
        chain.append(f"{type(current).__name__}: {current}")
        current = current.__cause__
        depth += 1

    if current:
        chain.append("... (chain truncated)")

    return " -> ".join(chain)


def get_error_context(exc: Exception) -> dict:
    """
    Extract context from an exception for logging.
    """
    context = {
        "type": type(exc).__name__,
        "message": str(exc),
    }

    # Extract traceback info
    tb = traceback.extract_tb(exc.__traceback__)
    if tb:
        last_frame = tb[-1]
        context["file"] = last_frame.filename
        context["line"] = last_frame.lineno
        context["function"] = last_frame.name

    # Extract our custom context
    if isinstance(exc, GodLearnError):
        context["custom_context"] = exc.context

    return context
