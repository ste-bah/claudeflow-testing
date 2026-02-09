"""Custom exception types for Market Terminal API.

Defines domain-specific exceptions that are caught by the global exception
handlers in :mod:`app.main` and mapped to structured JSON error responses.

Full implementation: TASK-API-001
"""
from __future__ import annotations


class DataSourceError(Exception):
    """Raised when an upstream data source is unavailable or returns an error.

    Mapped to HTTP 502 Bad Gateway by the global exception handler.
    """

    def __init__(self, source: str, detail: str = "Data source unavailable") -> None:
        self.source = source
        self.detail = detail
        super().__init__(f"{source}: {detail}")


class RateLimitError(Exception):
    """Raised when an upstream data source rate-limits the request.

    Mapped to HTTP 429 Too Many Requests by the global exception handler.
    The ``retry_after`` value (in seconds) is included in the response
    and the ``Retry-After`` header.
    """

    def __init__(
        self, source: str, retry_after: int = 60, detail: str = "Rate limited",
    ) -> None:
        self.source = source
        self.retry_after = retry_after
        self.detail = detail
        super().__init__(f"{source}: {detail} (retry after {retry_after}s)")
