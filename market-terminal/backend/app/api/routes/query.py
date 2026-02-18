"""Query route -- natural-language and command query interface.

POST /api/query/  accepts a text query, parses it through the command
parser, dispatches via the query router, and returns structured results.

Full implementation: TASK-GOD-005
"""
from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])

_HTML_TAG_RE: re.Pattern[str] = re.compile(r"<[^>]+>")
_CONTROL_CHAR_RE: re.Pattern[str] = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


class QueryRequest(BaseModel):
    """Validated request body for the query endpoint."""

    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Query text must not be empty")
        if len(stripped) > 500:
            raise ValueError("Query text must not exceed 500 characters")
        return stripped


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sanitize_text(text: str) -> str:
    """Remove HTML tags and control characters from user input."""
    text = _HTML_TAG_RE.sub("", text)
    text = _CONTROL_CHAR_RE.sub("", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/")
async def post_query(body: QueryRequest) -> dict[str, Any]:
    """Process a query string through the command parser and router.

    Accepts structured commands (e.g. ``analyze AAPL``) as well as
    free-form text (future natural-language support).
    """
    from app.agent.query_router import route_query

    sanitized = _sanitize_text(body.text)
    result = await route_query(sanitized)

    logger.info(
        "Query [%s] action=%s success=%s duration=%dms",
        result.query_type,
        result.action,
        result.success,
        result.execution_time_ms,
    )

    return result.model_dump()


@router.post("/cancel")
async def post_cancel() -> dict[str, Any]:
    """Cancel the currently running God Agent query, if any.

    Returns ``{"cancelled": true}`` if a cancellation signal was sent,
    or ``{"cancelled": false}`` if no query was in flight.
    """
    from app.agent.god_agent_interface import cancel_current

    cancelled = await cancel_current()
    return {"cancelled": cancelled}
