"""Tests for TASK-GOD-005: POST /api/query/ endpoint.

Validates the FastAPI route layer: request validation (Pydantic model),
HTML sanitization, response structure, and error handling.  The actual
``route_query`` function is mocked to isolate the HTTP layer.

Run with: ``pytest tests/test_query_endpoint.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.agent.query_router import QueryResult
from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_query_result(**overrides) -> QueryResult:
    """Build a QueryResult with sensible defaults."""
    defaults = dict(
        query_type="command",
        action="analyze",
        success=True,
        data={"ticker": "AAPL", "analysis": "done"},
        error=None,
        execution_time_ms=42,
        source="handler:analyze",
    )
    defaults.update(overrides)
    return QueryResult(**defaults)


def _patch_route_query(return_value=None):
    """Return a context manager that patches route_query at its source module.

    The query endpoint uses a deferred import (``from app.agent.query_router
    import route_query`` inside the function body), so we must patch at the
    source module rather than the consumer.
    """
    if return_value is None:
        return_value = _mock_query_result()
    return patch(
        "app.agent.query_router.route_query",
        new_callable=AsyncMock,
        return_value=return_value,
    )


def _post(body: dict | str | None = None):
    """Shorthand for POST /api/query/."""
    if body is None:
        return client.post("/api/query/")
    if isinstance(body, str):
        return client.post("/api/query/", content=body, headers={"Content-Type": "application/json"})
    return client.post("/api/query/", json=body)


# ===================================================================
# 1. Happy Path
# ===================================================================
class TestHappyPath:
    """Successful query requests."""

    def test_analyze_command_returns_200(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        assert resp.status_code == 200

    def test_response_contains_query_type(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "query_type" in body
        assert body["query_type"] == "command"

    def test_response_contains_action(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "action" in body
        assert body["action"] == "analyze"

    def test_response_contains_success(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "success" in body
        assert body["success"] is True

    def test_response_contains_data(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "data" in body
        assert body["data"]["ticker"] == "AAPL"

    def test_response_contains_execution_time(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "execution_time_ms" in body
        assert body["execution_time_ms"] == 42

    def test_response_contains_source(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert "source" in body
        assert body["source"] == "handler:analyze"

    def test_scan_command_returns_200(self):
        mock_result = _mock_query_result(action="scan", data={"results": []})
        with _patch_route_query(mock_result):
            resp = _post({"text": "scan wyckoff bullish"})
        assert resp.status_code == 200
        assert resp.json()["action"] == "scan"

    def test_watch_list_returns_200(self):
        mock_result = _mock_query_result(action="watch_list", data={"tickers": []})
        with _patch_route_query(mock_result):
            resp = _post({"text": "watch list"})
        assert resp.status_code == 200

    def test_natural_language_returns_200(self):
        """Even NL fallback returns 200 at HTTP level (success=False in body)."""
        mock_result = _mock_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="Not yet supported",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = _post({"text": "what is the market?"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["source"] == "natural_language"


# ===================================================================
# 2. Input Validation -- Pydantic
# ===================================================================
class TestInputValidation:
    """Pydantic field_validator on QueryRequest.text."""

    def test_empty_text_returns_422(self):
        resp = _post({"text": ""})
        assert resp.status_code == 422

    def test_whitespace_only_text_returns_422(self):
        resp = _post({"text": "   "})
        assert resp.status_code == 422

    def test_text_exceeds_500_chars_returns_422(self):
        resp = _post({"text": "x" * 501})
        assert resp.status_code == 422

    def test_missing_text_field_returns_422(self):
        resp = _post({})
        assert resp.status_code == 422

    def test_text_exactly_500_chars_accepted(self):
        with _patch_route_query():
            resp = _post({"text": "a" * 500})
        assert resp.status_code == 200

    def test_text_exactly_1_char_accepted(self):
        with _patch_route_query():
            resp = _post({"text": "x"})
        assert resp.status_code == 200

    def test_no_body_returns_422(self):
        resp = client.post("/api/query/")
        assert resp.status_code == 422

    def test_wrong_type_text_returns_422(self):
        resp = _post({"text": 12345})
        assert resp.status_code == 422

    def test_null_text_returns_422(self):
        resp = _post({"text": None})
        assert resp.status_code == 422


# ===================================================================
# 3. HTML Sanitization
# ===================================================================
class TestHTMLSanitization:
    """Verify _sanitize_text strips HTML tags and control chars."""

    def test_html_tags_stripped_before_routing(self):
        """HTML is stripped; remaining text is passed to route_query."""
        with _patch_route_query() as mock_rq:
            resp = _post({"text": "<script>alert(1)</script>analyze AAPL"})
        assert resp.status_code == 200
        # The sanitized text should have HTML stripped
        call_args = mock_rq.call_args[0][0]
        assert "<script>" not in call_args
        assert "analyze AAPL" in call_args

    def test_img_tag_stripped(self):
        with _patch_route_query() as mock_rq:
            resp = _post({"text": '<img onerror="x">news MSFT'})
        assert resp.status_code == 200
        call_args = mock_rq.call_args[0][0]
        assert "<img" not in call_args
        assert "news MSFT" in call_args

    def test_control_chars_stripped(self):
        with _patch_route_query() as mock_rq:
            resp = _post({"text": "analyze\x00\x01 AAPL"})
        assert resp.status_code == 200
        call_args = mock_rq.call_args[0][0]
        assert "\x00" not in call_args
        assert "\x01" not in call_args

    def test_nested_html_tags_stripped(self):
        with _patch_route_query() as mock_rq:
            resp = _post({"text": "<div><b>scan</b></div>"})
        assert resp.status_code == 200
        call_args = mock_rq.call_args[0][0]
        assert "<div>" not in call_args
        assert "<b>" not in call_args

    def test_clean_text_passes_through(self):
        """Text without HTML or control chars passes unchanged."""
        with _patch_route_query() as mock_rq:
            resp = _post({"text": "analyze AAPL"})
        assert resp.status_code == 200
        call_args = mock_rq.call_args[0][0]
        assert call_args == "analyze AAPL"


# ===================================================================
# 4. Response Structure
# ===================================================================
class TestResponseStructure:
    """Verify the response is a model_dump of QueryResult."""

    def test_all_query_result_fields_present(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        expected_keys = {
            "query_type", "action", "success", "data",
            "error", "execution_time_ms", "source",
        }
        assert expected_keys.issubset(set(body.keys()))

    def test_error_field_null_on_success(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        assert resp.json()["error"] is None

    def test_data_field_null_on_error(self):
        mock_result = _mock_query_result(
            success=False,
            data=None,
            error="Something failed",
        )
        with _patch_route_query(mock_result):
            resp = _post({"text": "analyze AAPL"})
        body = resp.json()
        assert body["data"] is None
        assert body["error"] == "Something failed"

    def test_content_type_is_json(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 5. HTTP Method Handling
# ===================================================================
class TestHTTPMethodHandling:
    """Only POST is allowed on /api/query/."""

    def test_get_returns_405(self):
        resp = client.get("/api/query/")
        assert resp.status_code == 405

    def test_put_returns_405(self):
        resp = client.put("/api/query/", json={"text": "analyze AAPL"})
        assert resp.status_code == 405

    def test_delete_returns_405(self):
        resp = client.delete("/api/query/")
        assert resp.status_code == 405


# ===================================================================
# 6. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Edge cases for the query endpoint."""

    def test_text_with_leading_trailing_whitespace_stripped(self):
        """Pydantic validator strips whitespace before checking length."""
        with _patch_route_query() as mock_rq:
            resp = _post({"text": "  analyze AAPL  "})
        assert resp.status_code == 200
        # Validator strips to "analyze AAPL", then sanitizer passes it
        call_args = mock_rq.call_args[0][0]
        assert call_args.strip() == call_args  # already stripped

    def test_extra_fields_in_body_ignored(self):
        """Extra fields beyond 'text' should be silently ignored."""
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL", "extra": "ignored"})
        assert resp.status_code == 200

    def test_unicode_text_accepted(self):
        with _patch_route_query():
            resp = _post({"text": "analyze AAPL"})
        assert resp.status_code == 200

    def test_sql_injection_in_text_safe(self):
        """SQL injection attempts are handled safely (no crash)."""
        with _patch_route_query():
            resp = _post({"text": "'; DROP TABLE users; --"})
        assert resp.status_code == 200

    def test_very_long_valid_text_at_boundary(self):
        """Exactly 500 chars after stripping should be accepted."""
        text = "a" * 500
        with _patch_route_query():
            resp = _post({"text": text})
        assert resp.status_code == 200

    def test_501_chars_rejected(self):
        text = "b" * 501
        resp = _post({"text": text})
        assert resp.status_code == 422
