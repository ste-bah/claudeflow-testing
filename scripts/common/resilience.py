"""
Resilience Utilities for God-Learn Pipeline.

Provides:
- Retry decorator with exponential backoff
- Circuit breaker pattern for external services
- Timeout wrappers
- Graceful degradation utilities

Usage:
    from scripts.common.resilience import (
        retry,
        circuit_breaker,
        with_timeout,
        fallback,
    )
"""

import functools
import random
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Type, TypeVar, Union
import concurrent.futures

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common.logging_config import get_logger
from scripts.common.errors import GodLearnError

T = TypeVar("T")


# =============================================================================
# Retry Decorator
# =============================================================================

class RetryError(GodLearnError):
    """Raised when all retry attempts are exhausted."""

    def __init__(self, message: str, attempts: int, last_exception: Exception):
        super().__init__(message, {"attempts": attempts})
        self.attempts = attempts
        self.last_exception = last_exception


def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[Exception, int], None]] = None,
    logger_name: str = "retry",
):
    """
    Retry decorator with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts (default: 3)
        delay: Initial delay between retries in seconds (default: 1.0)
        backoff: Multiplier for delay after each retry (default: 2.0)
        max_delay: Maximum delay between retries (default: 60.0)
        jitter: Add random jitter to prevent thundering herd (default: True)
        exceptions: Tuple of exceptions to retry on (default: all)
        on_retry: Optional callback(exception, attempt) called before retry
        logger_name: Logger name for retry messages

    Example:
        @retry(max_attempts=3, delay=1.0, backoff=2.0)
        def fetch_embeddings(text):
            return api.embed(text)

        @retry(exceptions=(ConnectionError, TimeoutError))
        def connect_to_chroma():
            return chromadb.Client()
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            logger = get_logger(logger_name)
            current_delay = delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        logger.error(
                            f"All {max_attempts} attempts failed for {func.__name__}",
                            extra={
                                "function": func.__name__,
                                "attempts": attempt,
                                "error": str(e),
                            }
                        )
                        raise RetryError(
                            f"{func.__name__} failed after {max_attempts} attempts: {e}",
                            attempts=attempt,
                            last_exception=e,
                        ) from e

                    # Calculate delay with optional jitter
                    sleep_time = min(current_delay, max_delay)
                    if jitter:
                        sleep_time = sleep_time * (0.5 + random.random())

                    logger.warning(
                        f"Retry {attempt}/{max_attempts} for {func.__name__}",
                        extra={
                            "function": func.__name__,
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                            "delay": round(sleep_time, 2),
                            "error": str(e),
                        }
                    )

                    if on_retry:
                        on_retry(e, attempt)

                    time.sleep(sleep_time)
                    current_delay *= backoff

            # Should never reach here, but just in case
            raise RetryError(
                f"{func.__name__} failed unexpectedly",
                attempts=max_attempts,
                last_exception=last_exception or Exception("Unknown error"),
            )

        return wrapper
    return decorator


# =============================================================================
# Circuit Breaker
# =============================================================================

class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitOpenError(GodLearnError):
    """Raised when circuit breaker is open."""

    def __init__(self, service: str, reset_at: datetime):
        super().__init__(
            f"Circuit breaker open for {service}",
            {"service": service, "reset_at": reset_at.isoformat()}
        )
        self.service = service
        self.reset_at = reset_at


@dataclass
class CircuitBreakerState:
    """State for a circuit breaker."""
    name: str
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    opened_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "last_success": self.last_success_time.isoformat() if self.last_success_time else None,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
        }


class CircuitBreaker:
    """
    Circuit breaker for external service calls.

    Prevents cascading failures by stopping calls to failing services.

    States:
    - CLOSED: Normal operation, requests go through
    - OPEN: Service is failing, requests are rejected immediately
    - HALF_OPEN: Testing if service has recovered

    Example:
        chroma_breaker = CircuitBreaker("chromadb", failure_threshold=5, reset_timeout=60)

        @chroma_breaker
        def query_vectors(query):
            return chroma_client.query(query)
    """

    # Global registry of circuit breakers
    _instances: Dict[str, "CircuitBreaker"] = {}
    _lock = threading.Lock()

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        reset_timeout: float = 60.0,
        exceptions: tuple = (Exception,),
        logger_name: Optional[str] = None,
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Service name (used for logging and registry)
            failure_threshold: Failures before opening circuit
            success_threshold: Successes in half-open to close circuit
            reset_timeout: Seconds before trying half-open
            exceptions: Exceptions that count as failures
            logger_name: Logger name (default: circuit.{name})
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.reset_timeout = reset_timeout
        self.exceptions = exceptions
        self.logger = get_logger(logger_name or f"circuit.{name}")

        self._state = CircuitBreakerState(name=name)
        self._lock = threading.Lock()

        # Register globally
        with CircuitBreaker._lock:
            CircuitBreaker._instances[name] = self

    @classmethod
    def get(cls, name: str) -> Optional["CircuitBreaker"]:
        """Get a circuit breaker by name."""
        return cls._instances.get(name)

    @classmethod
    def get_all_states(cls) -> Dict[str, Dict[str, Any]]:
        """Get states of all circuit breakers."""
        return {
            name: cb._state.to_dict()
            for name, cb in cls._instances.items()
        }

    @property
    def state(self) -> CircuitState:
        """Current circuit state."""
        return self._state.state

    def _should_allow_request(self) -> bool:
        """Check if request should be allowed."""
        with self._lock:
            if self._state.state == CircuitState.CLOSED:
                return True

            if self._state.state == CircuitState.OPEN:
                # Check if reset timeout has passed
                if self._state.opened_at:
                    elapsed = (datetime.now() - self._state.opened_at).total_seconds()
                    if elapsed >= self.reset_timeout:
                        self._state.state = CircuitState.HALF_OPEN
                        self._state.success_count = 0
                        self.logger.info(
                            f"Circuit {self.name} entering half-open state",
                            extra={"elapsed": round(elapsed, 1)}
                        )
                        return True
                return False

            # HALF_OPEN - allow request to test
            return True

    def _record_success(self) -> None:
        """Record a successful call."""
        with self._lock:
            self._state.success_count += 1
            self._state.last_success_time = datetime.now()

            if self._state.state == CircuitState.HALF_OPEN:
                if self._state.success_count >= self.success_threshold:
                    self._state.state = CircuitState.CLOSED
                    self._state.failure_count = 0
                    self.logger.info(
                        f"Circuit {self.name} closed (service recovered)",
                        extra={"successes": self._state.success_count}
                    )

    def _record_failure(self, exception: Exception) -> None:
        """Record a failed call."""
        with self._lock:
            self._state.failure_count += 1
            self._state.last_failure_time = datetime.now()

            if self._state.state == CircuitState.HALF_OPEN:
                # Any failure in half-open reopens the circuit
                self._state.state = CircuitState.OPEN
                self._state.opened_at = datetime.now()
                self.logger.warning(
                    f"Circuit {self.name} reopened (test failed)",
                    extra={"error": str(exception)}
                )

            elif self._state.state == CircuitState.CLOSED:
                if self._state.failure_count >= self.failure_threshold:
                    self._state.state = CircuitState.OPEN
                    self._state.opened_at = datetime.now()
                    self.logger.error(
                        f"Circuit {self.name} opened (threshold reached)",
                        extra={
                            "failures": self._state.failure_count,
                            "threshold": self.failure_threshold,
                        }
                    )

    def reset(self) -> None:
        """Manually reset the circuit breaker."""
        with self._lock:
            self._state.state = CircuitState.CLOSED
            self._state.failure_count = 0
            self._state.success_count = 0
            self._state.opened_at = None
            self.logger.info(f"Circuit {self.name} manually reset")

    def __call__(self, func: Callable[..., T]) -> Callable[..., T]:
        """Use as decorator."""
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            if not self._should_allow_request():
                reset_at = (
                    self._state.opened_at + timedelta(seconds=self.reset_timeout)
                    if self._state.opened_at
                    else datetime.now()
                )
                raise CircuitOpenError(self.name, reset_at)

            try:
                result = func(*args, **kwargs)
                self._record_success()
                return result
            except self.exceptions as e:
                self._record_failure(e)
                raise

        return wrapper


def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    reset_timeout: float = 60.0,
    **kwargs: Any,
) -> CircuitBreaker:
    """
    Get or create a circuit breaker.

    Example:
        @circuit_breaker("embedding_api", failure_threshold=3)
        def get_embedding(text):
            return api.embed(text)
    """
    existing = CircuitBreaker.get(name)
    if existing:
        return existing
    return CircuitBreaker(name, failure_threshold=failure_threshold, reset_timeout=reset_timeout, **kwargs)


# =============================================================================
# Timeout Wrapper
# =============================================================================

class TimeoutError(GodLearnError):
    """Raised when operation times out."""
    pass


def with_timeout(
    seconds: float,
    default: Optional[T] = None,
    raise_on_timeout: bool = True,
    logger_name: str = "timeout",
) -> Callable[[Callable[..., T]], Callable[..., Optional[T]]]:
    """
    Decorator to add timeout to a function.

    Args:
        seconds: Timeout in seconds
        default: Value to return on timeout (if not raising)
        raise_on_timeout: Whether to raise TimeoutError
        logger_name: Logger name

    Example:
        @with_timeout(30, default=None)
        def slow_operation():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., Optional[T]]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Optional[T]:
            logger = get_logger(logger_name)

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(func, *args, **kwargs)

                try:
                    return future.result(timeout=seconds)
                except concurrent.futures.TimeoutError:
                    logger.warning(
                        f"Operation {func.__name__} timed out",
                        extra={
                            "function": func.__name__,
                            "timeout": seconds,
                        }
                    )

                    if raise_on_timeout:
                        raise TimeoutError(
                            f"{func.__name__} timed out after {seconds}s",
                            {"timeout": seconds}
                        )

                    return default

        return wrapper
    return decorator


# =============================================================================
# Fallback / Graceful Degradation
# =============================================================================

def fallback(
    fallback_func: Callable[..., T],
    exceptions: tuple = (Exception,),
    logger_name: str = "fallback",
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to provide fallback behavior on failure.

    Args:
        fallback_func: Function to call if primary fails
        exceptions: Exceptions that trigger fallback
        logger_name: Logger name

    Example:
        def cached_embedding(text):
            return cache.get(text)

        @fallback(cached_embedding)
        def get_embedding(text):
            return api.embed(text)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            logger = get_logger(logger_name)

            try:
                return func(*args, **kwargs)
            except exceptions as e:
                logger.warning(
                    f"Primary {func.__name__} failed, using fallback",
                    extra={
                        "function": func.__name__,
                        "fallback": fallback_func.__name__,
                        "error": str(e),
                    }
                )
                return fallback_func(*args, **kwargs)

        return wrapper
    return decorator


def with_fallback_value(
    value: T,
    exceptions: tuple = (Exception,),
    logger_name: str = "fallback",
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to return a fallback value on failure.

    Args:
        value: Value to return on failure
        exceptions: Exceptions that trigger fallback
        logger_name: Logger name

    Example:
        @with_fallback_value([])
        def fetch_optional_metadata(path):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            logger = get_logger(logger_name)

            try:
                return func(*args, **kwargs)
            except exceptions as e:
                logger.warning(
                    f"{func.__name__} failed, returning fallback value",
                    extra={
                        "function": func.__name__,
                        "error": str(e),
                    }
                )
                return value

        return wrapper
    return decorator


# =============================================================================
# Health Check Utilities
# =============================================================================

@dataclass
class ServiceHealth:
    """Health status for a service."""
    name: str
    healthy: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    last_check: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "healthy": self.healthy,
            "latency_ms": self.latency_ms,
            "error": self.error,
            "last_check": self.last_check.isoformat(),
        }


class HealthChecker:
    """
    Health checker for external services.

    Example:
        health = HealthChecker()
        health.register("chromadb", lambda: chroma.heartbeat())
        health.register("embedding_api", lambda: api.health())

        status = health.check_all()
        if not status["chromadb"].healthy:
            logger.error("ChromaDB is down!")
    """

    def __init__(self, logger_name: str = "health"):
        self._checks: Dict[str, Callable[[], bool]] = {}
        self._last_results: Dict[str, ServiceHealth] = {}
        self.logger = get_logger(logger_name)

    def register(
        self,
        name: str,
        check_func: Callable[[], bool],
    ) -> None:
        """Register a health check function."""
        self._checks[name] = check_func

    def check(self, name: str) -> ServiceHealth:
        """Run health check for a single service."""
        if name not in self._checks:
            return ServiceHealth(name=name, healthy=False, error="Unknown service")

        check_func = self._checks[name]
        start = time.time()

        try:
            result = check_func()
            latency = (time.time() - start) * 1000

            health = ServiceHealth(
                name=name,
                healthy=bool(result),
                latency_ms=round(latency, 2),
            )

        except Exception as e:
            latency = (time.time() - start) * 1000

            health = ServiceHealth(
                name=name,
                healthy=False,
                latency_ms=round(latency, 2),
                error=str(e),
            )

            self.logger.warning(
                f"Health check failed for {name}",
                extra={"service": name, "error": str(e), "latency_ms": latency}
            )

        self._last_results[name] = health
        return health

    def check_all(self) -> Dict[str, ServiceHealth]:
        """Run all health checks."""
        results = {}
        for name in self._checks:
            results[name] = self.check(name)
        return results

    def get_last_results(self) -> Dict[str, ServiceHealth]:
        """Get last health check results."""
        return self._last_results.copy()

    def is_healthy(self, name: str) -> bool:
        """Check if a service is healthy (from last check)."""
        if name in self._last_results:
            return self._last_results[name].healthy
        return self.check(name).healthy
