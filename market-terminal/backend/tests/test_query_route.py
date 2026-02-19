"""Tests for TASK-GOD-005: POST /api/query/ endpoint (query route).

Integration tests for the query route at ``app/api/routes/query.py``.
Uses ``TestClient`` against the real FastAPI app with ``route_query``
mocked to isolate the HTTP layer.

Run with: ``pytest tests/test_query_route.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
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

_NO_DATA = object()


def _make_query_result(
    query_type: str = "command",
    action: str = "analyze",
    success: bool = True,
    data: dict | None | object = _NO_DATA,
    error: str | None = None,
    execution_time_ms: int = 42,
    source: str = "handler:analyze",
) -> QueryResult:
    """Build a QueryResult for mock returns.

    Pass ``data=None`` explicitly to set data to None (e.g. for error
    results).  Omit ``data`` to get default sample data.
    """
    resolved_data: dict | None
    if data is _NO_DATA:
        resolved_data = {"ticker": "AAPL", "result": "ok"}
    else:
        resolved_data = data  # type: ignore[assignment]
    return QueryResult(
        query_type=query_type,
        action=action,
        success=success,
        data=resolved_data,
        error=error,
        execution_time_ms=execution_time_ms,
        source=source,
    )


def _patch_route_query(return_value=None):
    """Patch ``route_query`` at its source module (lazy import in endpoint)."""
    rv = return_value or _make_query_result()
    return patch(
        "app.agent.query_router.route_query",
        new_callable=AsyncMock,
        return_value=rv,
    )


# ===================================================================
# 1. Success Cases
# ===================================================================
class TestSuccessCases:
    """POST /api/query/ with valid structured commands."""

    def test_analyze_aapl_returns_200(self):
        mock_result = _make_query_result(action="analyze")
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})
            mock_fn.assert_awaited_once()

        assert resp.status_code == 200
        body = resp.json()
        assert body["query_type"] == "command"
        assert body["action"] == "analyze"
        assert body["success"] is True

    def test_natural_language_returns_200(self):
        mock_result = _make_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="Natural language queries are not yet supported.",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = client.post("/api/query/", json={"text": "what stocks?"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["query_type"] == "natural_language"
        assert body["success"] is False

    def test_response_has_all_expected_keys(self):
        with _patch_route_query():
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        body = resp.json()
        expected_keys = {
            "query_type", "action", "success", "data",
            "error", "execution_time_ms", "source",
        }
        assert set(body.keys()) == expected_keys

    def test_response_data_is_dict(self):
        with _patch_route_query():
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert isinstance(resp.json()["data"], dict)

    def test_execution_time_ms_in_response(self):
        with _patch_route_query():
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert resp.json()["execution_time_ms"] == 42

    def test_content_type_is_json(self):
        with _patch_route_query():
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 2. Validation Errors
# ===================================================================
class TestValidationErrors:
    """POST /api/query/ with invalid request bodies returns 422."""

    def test_empty_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": ""})
        assert resp.status_code == 422

    def test_whitespace_only_returns_422(self):
        resp = client.post("/api/query/", json={"text": "   "})
        assert resp.status_code == 422

    def test_text_too_long_returns_422(self):
        resp = client.post("/api/query/", json={"text": "x" * 501})
        assert resp.status_code == 422

    def test_missing_text_field_returns_422(self):
        resp = client.post("/api/query/", json={})
        assert resp.status_code == 422

    def test_null_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": None})
        assert resp.status_code == 422

    def test_numeric_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": 12345})
        assert resp.status_code == 422

    def test_empty_body_returns_422(self):
        resp = client.post(
            "/api/query/",
            content=b"",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422

    def test_text_exactly_500_chars_accepted(self):
        """500 characters is at the boundary and should be accepted."""
        mock_result = _make_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="not supported",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = client.post("/api/query/", json={"text": "a" * 500})
        assert resp.status_code == 200


# ===================================================================
# 3. Input Sanitization
# ===================================================================
class TestInputSanitization:
    """HTML tags and control characters are stripped before routing."""

    def test_html_tags_stripped(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": "<script>alert('xss')</script>analyze AAPL"},
            )
            # Verify the sanitized text was passed to route_query
            call_args = mock_fn.call_args[0][0]
            assert "<script>" not in call_args
            assert "</" not in call_args

        assert resp.status_code == 200

    def test_control_chars_stripped(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": "analyze\x00AAPL"},
            )
            call_args = mock_fn.call_args[0][0]
            assert "\x00" not in call_args

        assert resp.status_code == 200

    def test_multiple_html_tags_stripped(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": "<b>bold</b> <i>italic</i> analyze AAPL"},
            )
            call_args = mock_fn.call_args[0][0]
            assert "<b>" not in call_args
            assert "<i>" not in call_args

        assert resp.status_code == 200

    def test_img_tag_stripped(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": '<img onerror="alert(1)">analyze AAPL'},
            )
            call_args = mock_fn.call_args[0][0]
            assert "<img" not in call_args

        assert resp.status_code == 200

    def test_null_bytes_stripped(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": "news\x00\x01\x02AAPL"},
            )
            call_args = mock_fn.call_args[0][0]
            assert "\x00" not in call_args
            assert "\x01" not in call_args
            assert "\x02" not in call_args

        assert resp.status_code == 200


# ===================================================================
# 4. HTTP Method Enforcement
# ===================================================================
class TestHTTPMethods:
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

    def test_patch_returns_405(self):
        resp = client.patch("/api/query/", json={"text": "analyze AAPL"})
        assert resp.status_code == 405


# ===================================================================
# 5. Route Registration
# ===================================================================
class TestRouteRegistration:
    """Verify the query route is registered correctly."""

    def test_route_is_registered(self):
        route_paths = [getattr(r, "path", "") for r in app.routes]
        assert "/api/query/" in route_paths

    def test_query_router_has_correct_prefix(self):
        from app.api.routes.query import router
        assert router.prefix == "/api/query"

    def test_query_router_has_correct_tag(self):
        from app.api.routes.query import router
        assert "query" in router.tags


# ===================================================================
# 6. Sanitize Function Unit Tests
# ===================================================================
class TestSanitizeFunction:
    """Unit tests for the _sanitize_text helper."""

    def test_removes_html_tags(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("<b>hello</b>")
        assert result == "hello"

    def test_removes_control_chars(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("hello\x00world")
        assert result == "helloworld"

    def test_strips_whitespace(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("  hello  ")
        assert result == "hello"

    def test_empty_after_sanitize(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("<script></script>")
        assert result == ""

    def test_preserves_normal_text(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("analyze AAPL")
        assert result == "analyze AAPL"

    def test_mixed_html_and_text(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("before <br/> after")
        assert result == "before  after"

    def test_nested_tags(self):
        from app.api.routes.query import _sanitize_text
        result = _sanitize_text("<div><span>text</span></div>")
        assert result == "text"

    def test_control_char_range(self):
        """All control chars 0x00-0x08, 0x0b, 0x0c, 0x0e-0x1f, 0x7f are removed."""
        from app.api.routes.query import _sanitize_text
        # Build a string with every control char in the stripped range
        control_chars = "".join(chr(c) for c in range(0x00, 0x09))  # 0x00-0x08
        control_chars += chr(0x0B) + chr(0x0C)  # 0x0b, 0x0c
        control_chars += "".join(chr(c) for c in range(0x0E, 0x20))  # 0x0e-0x1f
        control_chars += chr(0x7F)
        result = _sanitize_text(f"a{control_chars}b")
        assert result == "ab"


# ===================================================================
# 7. QueryRequest Validator
# ===================================================================
class TestQueryRequestValidator:
    """Unit tests for the QueryRequest Pydantic model."""

    def test_valid_text_accepted(self):
        from app.api.routes.query import QueryRequest
        req = QueryRequest(text="analyze AAPL")
        assert req.text == "analyze AAPL"

    def test_text_is_stripped(self):
        from app.api.routes.query import QueryRequest
        req = QueryRequest(text="  analyze AAPL  ")
        assert req.text == "analyze AAPL"

    def test_empty_text_rejected(self):
        from app.api.routes.query import QueryRequest
        with pytest.raises(Exception):
            QueryRequest(text="")

    def test_whitespace_text_rejected(self):
        from app.api.routes.query import QueryRequest
        with pytest.raises(Exception):
            QueryRequest(text="   ")

    def test_text_over_500_rejected(self):
        from app.api.routes.query import QueryRequest
        with pytest.raises(Exception):
            QueryRequest(text="x" * 501)

    def test_text_exactly_500_accepted(self):
        from app.api.routes.query import QueryRequest
        req = QueryRequest(text="a" * 500)
        assert len(req.text) == 500


# ===================================================================
# 8. Response Envelope Structure
# ===================================================================
class TestResponseEnvelopeStructure:
    """Verify the full response envelope from the endpoint."""

    def test_command_success_envelope(self):
        mock_result = _make_query_result(
            query_type="command",
            action="analyze",
            success=True,
            data={"ticker": "AAPL"},
            execution_time_ms=15,
            source="handler:analyze",
        )
        with _patch_route_query(mock_result):
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        body = resp.json()
        assert body["query_type"] == "command"
        assert body["action"] == "analyze"
        assert body["success"] is True
        assert body["data"] == {"ticker": "AAPL"}
        assert body["error"] is None
        assert body["execution_time_ms"] == 15
        assert body["source"] == "handler:analyze"

    def test_error_envelope(self):
        mock_result = _make_query_result(
            query_type="command",
            action="analyze",
            success=False,
            data=None,
            error="Price data unavailable",
            execution_time_ms=5,
            source="handler:analyze",
        )
        with _patch_route_query(mock_result):
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        body = resp.json()
        assert body["success"] is False
        assert body["error"] == "Price data unavailable"
        assert body["data"] is None


# ===================================================================
# 9. Route Query Integration
# ===================================================================
class TestRouteQueryIntegration:
    """Verify that the route calls route_query with sanitized text."""

    def test_sanitized_text_passed_to_route_query(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            client.post(
                "/api/query/",
                json={"text": "  <b>analyze</b> AAPL  "},
            )
            # The validator strips outer whitespace, then sanitizer removes HTML
            call_args = mock_fn.call_args[0][0]
            assert "analyze" in call_args
            assert "AAPL" in call_args
            assert "<b>" not in call_args

    def test_route_query_called_exactly_once(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            client.post("/api/query/", json={"text": "scan"})
            assert mock_fn.await_count == 1


# ===================================================================
# 10. Extra Fields Ignored
# ===================================================================
class TestExtraFields:
    """Extra fields in the request body should be ignored by Pydantic."""

    def test_extra_fields_ignored(self):
        mock_result = _make_query_result()
        with _patch_route_query(mock_result):
            resp = client.post(
                "/api/query/",
                json={"text": "analyze AAPL", "extra_field": "ignored"},
            )
        assert resp.status_code == 200


# ===================================================================
# 11. Security Edge Cases
# ===================================================================
class TestSecurityEdgeCases:
    """Security-related edge cases for the query endpoint."""

    def test_sql_injection_in_text(self):
        mock_result = _make_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="not supported",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = client.post(
                "/api/query/",
                json={"text": "'; DROP TABLE users; --"},
            )
        assert resp.status_code == 200

    def test_xss_payload_sanitized(self):
        """HTML tags are stripped; text content between tags is preserved."""
        mock_result = _make_query_result()
        with _patch_route_query(mock_result) as mock_fn:
            resp = client.post(
                "/api/query/",
                json={"text": "<script>document.cookie</script>analyze AAPL"},
            )
            call_args = mock_fn.call_args[0][0]
            assert "<script>" not in call_args
            assert "</script>" not in call_args

        assert resp.status_code == 200

    def test_unicode_text_accepted(self):
        mock_result = _make_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="not supported",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = client.post(
                "/api/query/",
                json={"text": "analyze AAPL \u00e9\u00e8\u00ea"},
            )
        assert resp.status_code == 200

    def test_very_long_text_at_limit(self):
        """Text at exactly 500 chars should pass validation."""
        mock_result = _make_query_result(
            query_type="natural_language",
            action="natural_language",
            success=False,
            data=None,
            error="not supported",
            source="natural_language",
        )
        with _patch_route_query(mock_result):
            resp = client.post("/api/query/", json={"text": "a" * 500})
        assert resp.status_code == 200

    def test_text_at_501_chars_rejected(self):
        resp = client.post("/api/query/", json={"text": "a" * 501})
        assert resp.status_code == 422
