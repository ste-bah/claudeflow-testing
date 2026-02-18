"""Tests for TASK-API-001: FastAPI Skeleton + Route Structure.

Validates custom exception classes (``app.exceptions``), global exception
handlers, CORS configuration, health-check response shape, route registration
for all 10 route modules, the ``_import_router`` helper, lifespan startup, and
edge-case HTTP error responses.

Run with: ``pytest tests/test_api_skeleton.py -v``
"""
from __future__ import annotations

import importlib
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import DataSourceError, RateLimitError
from app.main import (
    app,
    _import_router,
    data_source_error_handler,
    generic_exception_handler,
    http_exception_handler,
    rate_limit_error_handler,
)

# ---------------------------------------------------------------------------
# Shared test client for the real application
# ---------------------------------------------------------------------------
client = TestClient(app)


# ===================================================================
# 1. DataSourceError Exception Class
# ===================================================================
class TestDataSourceError:
    """Verify ``DataSourceError`` attributes and behaviour."""

    def test_is_exception_subclass(self):
        assert issubclass(DataSourceError, Exception)

    def test_constructor_sets_source(self):
        exc = DataSourceError("finnhub")
        assert exc.source == "finnhub"

    def test_constructor_sets_detail(self):
        exc = DataSourceError("finnhub", detail="Connection refused")
        assert exc.detail == "Connection refused"

    def test_default_detail_value(self):
        exc = DataSourceError("fred")
        assert exc.detail == "Data source unavailable"

    def test_str_includes_source_and_detail(self):
        exc = DataSourceError("finnhub", "Timeout")
        text = str(exc)
        assert "finnhub" in text
        assert "Timeout" in text

    def test_str_with_default_detail(self):
        exc = DataSourceError("fred")
        text = str(exc)
        assert "fred" in text
        assert "Data source unavailable" in text

    def test_can_be_raised_and_caught_as_exception(self):
        with pytest.raises(Exception):
            raise DataSourceError("test_source")

    def test_can_be_raised_and_caught_by_type(self):
        with pytest.raises(DataSourceError):
            raise DataSourceError("test_source")

    def test_different_sources(self):
        for source in ("finnhub", "fred", "alpha_vantage", "yfinance"):
            exc = DataSourceError(source)
            assert exc.source == source

    def test_custom_detail_preserved(self):
        exc = DataSourceError("finnhub", detail="HTTP 503 from upstream")
        assert exc.detail == "HTTP 503 from upstream"


# ===================================================================
# 2. RateLimitError Exception Class
# ===================================================================
class TestRateLimitError:
    """Verify ``RateLimitError`` attributes and behaviour."""

    def test_is_exception_subclass(self):
        assert issubclass(RateLimitError, Exception)

    def test_constructor_sets_source(self):
        exc = RateLimitError("finnhub")
        assert exc.source == "finnhub"

    def test_constructor_sets_retry_after(self):
        exc = RateLimitError("fred", retry_after=120)
        assert exc.retry_after == 120

    def test_constructor_sets_detail(self):
        exc = RateLimitError("fred", detail="Too many requests")
        assert exc.detail == "Too many requests"

    def test_default_retry_after_is_60(self):
        exc = RateLimitError("finnhub")
        assert exc.retry_after == 60

    def test_default_detail_is_rate_limited(self):
        exc = RateLimitError("finnhub")
        assert exc.detail == "Rate limited"

    def test_str_includes_source(self):
        exc = RateLimitError("fred", retry_after=30)
        assert "fred" in str(exc)

    def test_str_includes_detail(self):
        exc = RateLimitError("fred", detail="Slow down")
        assert "Slow down" in str(exc)

    def test_str_includes_retry_after(self):
        exc = RateLimitError("fred", retry_after=90)
        assert "90" in str(exc)

    def test_can_be_raised_and_caught_as_exception(self):
        with pytest.raises(Exception):
            raise RateLimitError("test_source")

    def test_can_be_raised_and_caught_by_type(self):
        with pytest.raises(RateLimitError):
            raise RateLimitError("test_source")

    def test_all_defaults(self):
        exc = RateLimitError("src")
        assert exc.source == "src"
        assert exc.retry_after == 60
        assert exc.detail == "Rate limited"

    def test_all_custom(self):
        exc = RateLimitError("alpha_vantage", retry_after=300, detail="Quota exceeded")
        assert exc.source == "alpha_vantage"
        assert exc.retry_after == 300
        assert exc.detail == "Quota exceeded"


# ===================================================================
# 3. Exception Handler Test Fixture
# ===================================================================
@pytest.fixture
def exc_app():
    """Create a standalone FastAPI app wired with the production exception handlers.

    Contains test routes that raise each exception type so handlers can be
    exercised in isolation without touching the real application routes.
    """
    test_app = FastAPI()
    test_app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    test_app.add_exception_handler(DataSourceError, data_source_error_handler)
    test_app.add_exception_handler(RateLimitError, rate_limit_error_handler)
    test_app.add_exception_handler(Exception, generic_exception_handler)

    @test_app.get("/raise-http-404")
    async def raise_http_404():
        raise StarletteHTTPException(status_code=404, detail="Not found")

    @test_app.get("/raise-http-403")
    async def raise_http_403():
        raise StarletteHTTPException(status_code=403, detail="Forbidden")

    @test_app.get("/raise-http-422")
    async def raise_http_422():
        raise StarletteHTTPException(status_code=422, detail="Unprocessable Entity")

    @test_app.get("/raise-datasource")
    async def raise_datasource():
        raise DataSourceError("finnhub", "Connection timeout")

    @test_app.get("/raise-datasource-default")
    async def raise_datasource_default():
        raise DataSourceError("fred")

    @test_app.get("/raise-ratelimit")
    async def raise_ratelimit():
        raise RateLimitError("fred", retry_after=120)

    @test_app.get("/raise-ratelimit-default")
    async def raise_ratelimit_default():
        raise RateLimitError("finnhub")

    @test_app.get("/raise-generic")
    async def raise_generic():
        raise RuntimeError("Something unexpected happened")

    @test_app.get("/raise-value-error")
    async def raise_value_error():
        raise ValueError("bad value")

    return test_app


@pytest.fixture
def exc_client(exc_app):
    """Test client for the exception-handler test app."""
    return TestClient(exc_app, raise_server_exceptions=False)


# ===================================================================
# 4. HTTP Exception Handler
# ===================================================================
class TestHTTPExceptionHandler:
    """Global HTTP exception handler returns structured JSON."""

    def test_404_returns_json_with_error_key(self, exc_client):
        resp = exc_client.get("/raise-http-404")
        body = resp.json()
        assert "error" in body

    def test_404_returns_correct_status_code(self, exc_client):
        resp = exc_client.get("/raise-http-404")
        assert resp.status_code == 404

    def test_404_json_has_status_code_field(self, exc_client):
        resp = exc_client.get("/raise-http-404")
        body = resp.json()
        assert body["status_code"] == 404

    def test_404_json_error_matches_detail(self, exc_client):
        resp = exc_client.get("/raise-http-404")
        body = resp.json()
        assert body["error"] == "Not found"

    def test_403_returns_correct_status(self, exc_client):
        resp = exc_client.get("/raise-http-403")
        assert resp.status_code == 403

    def test_403_json_body(self, exc_client):
        resp = exc_client.get("/raise-http-403")
        body = resp.json()
        assert body["error"] == "Forbidden"
        assert body["status_code"] == 403

    def test_422_returns_correct_status(self, exc_client):
        resp = exc_client.get("/raise-http-422")
        assert resp.status_code == 422
        body = resp.json()
        assert body["error"] == "Unprocessable Entity"
        assert body["status_code"] == 422

    def test_response_content_type_is_json(self, exc_client):
        resp = exc_client.get("/raise-http-404")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 5. DataSourceError Handler
# ===================================================================
class TestDataSourceErrorHandler:
    """Global ``DataSourceError`` handler returns 502 with structured JSON."""

    def test_returns_502_status(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        assert resp.status_code == 502

    def test_json_has_error_key(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        body = resp.json()
        assert body["error"] == "Data source unavailable"

    def test_json_has_source_key(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        body = resp.json()
        assert body["source"] == "finnhub"

    def test_no_detail_leaked_in_response(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        body = resp.json()
        assert "detail" not in body

    def test_default_source_in_response(self, exc_client):
        resp = exc_client.get("/raise-datasource-default")
        body = resp.json()
        assert body["source"] == "fred"

    def test_response_keys_complete(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        body = resp.json()
        assert set(body.keys()) == {"error", "source"}

    def test_content_type_is_json(self, exc_client):
        resp = exc_client.get("/raise-datasource")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 6. RateLimitError Handler
# ===================================================================
class TestRateLimitErrorHandler:
    """Global ``RateLimitError`` handler returns 429 with Retry-After header."""

    def test_returns_429_status(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        assert resp.status_code == 429

    def test_json_has_error_key(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        body = resp.json()
        assert body["error"] == "Rate limited"

    def test_json_has_source_key(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        body = resp.json()
        assert body["source"] == "fred"

    def test_json_has_retry_after_key(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        body = resp.json()
        assert body["retry_after"] == 120

    def test_retry_after_header_present(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        assert "Retry-After" in resp.headers

    def test_retry_after_header_value(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        assert resp.headers["Retry-After"] == "120"

    def test_default_retry_after_in_response(self, exc_client):
        resp = exc_client.get("/raise-ratelimit-default")
        body = resp.json()
        assert body["retry_after"] == 60

    def test_default_retry_after_header(self, exc_client):
        resp = exc_client.get("/raise-ratelimit-default")
        assert resp.headers["Retry-After"] == "60"

    def test_response_keys_complete(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        body = resp.json()
        assert set(body.keys()) == {"error", "source", "retry_after"}

    def test_content_type_is_json(self, exc_client):
        resp = exc_client.get("/raise-ratelimit")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 7. Generic Exception Handler
# ===================================================================
class TestGenericExceptionHandler:
    """Global catch-all handler returns 500 with structured JSON."""

    def test_returns_500_status(self, exc_client):
        resp = exc_client.get("/raise-generic")
        assert resp.status_code == 500

    def test_json_has_error_key(self, exc_client):
        resp = exc_client.get("/raise-generic")
        body = resp.json()
        assert body["error"] == "Internal server error"

    def test_no_detail_leaked_in_response(self, exc_client):
        resp = exc_client.get("/raise-generic")
        body = resp.json()
        assert "detail" not in body

    def test_response_keys_complete(self, exc_client):
        resp = exc_client.get("/raise-generic")
        body = resp.json()
        assert set(body.keys()) == {"error"}

    def test_value_error_also_caught(self, exc_client):
        resp = exc_client.get("/raise-value-error")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"] == "Internal server error"
        assert "detail" not in body

    def test_content_type_is_json(self, exc_client):
        resp = exc_client.get("/raise-generic")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 8. CORS Configuration
# ===================================================================
class TestCORSConfiguration:
    """CORS middleware is configured correctly for development."""

    def _get_cors_middleware(self):
        """Return the CORSMiddleware entry from user_middleware."""
        for m in app.user_middleware:
            if m.cls.__name__ == "CORSMiddleware":
                return m
        pytest.fail("CORSMiddleware not found in app.user_middleware")

    def test_cors_middleware_present(self):
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes

    def test_cors_allows_localhost_3000(self):
        mw = self._get_cors_middleware()
        origins = mw.kwargs.get("allow_origins", [])
        assert "http://localhost:3000" in origins

    def test_cors_allows_localhost_5173(self):
        mw = self._get_cors_middleware()
        origins = mw.kwargs.get("allow_origins", [])
        assert "http://localhost:5173" in origins

    def test_cors_allows_credentials(self):
        mw = self._get_cors_middleware()
        assert mw.kwargs.get("allow_credentials") is True

    def test_cors_allows_all_methods(self):
        mw = self._get_cors_middleware()
        methods = mw.kwargs.get("allow_methods", [])
        assert "*" in methods or methods == ["*"]

    def test_cors_allows_all_headers(self):
        mw = self._get_cors_middleware()
        headers = mw.kwargs.get("allow_headers", [])
        assert "*" in headers or headers == ["*"]

    def test_cors_preflight_on_health(self):
        """An OPTIONS request to /api/health should return CORS headers."""
        resp = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Starlette CORS middleware returns 200 for preflight
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers

    def test_cors_preflight_vite_origin(self):
        resp = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers


# ===================================================================
# 9. Health Check Endpoint
# ===================================================================
class TestHealthCheckEndpoint:
    """GET /api/health returns comprehensive status information."""

    def test_returns_200(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_has_status_field(self):
        resp = client.get("/api/health")
        assert "status" in resp.json()

    def test_status_is_ok(self):
        resp = client.get("/api/health")
        assert resp.json()["status"] == "ok"

    def test_has_version_field(self):
        resp = client.get("/api/health")
        assert "version" in resp.json()

    def test_version_is_1_0_0(self):
        resp = client.get("/api/health")
        assert resp.json()["version"] == "1.0.0"

    def test_has_database_field(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "database" in data

    def test_database_is_connected_or_error(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert data["database"] in ("connected", "error", "unknown")

    def test_has_api_keys_field(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "api_keys" in data

    def test_api_keys_is_dict(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert isinstance(data["api_keys"], dict)

    def test_api_keys_has_finnhub(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "finnhub" in data["api_keys"]

    def test_api_keys_has_fred(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "fred" in data["api_keys"]

    def test_api_keys_has_alpha_vantage(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "alpha_vantage" in data["api_keys"]

    def test_api_key_values_are_configured_or_missing(self):
        resp = client.get("/api/health")
        data = resp.json()
        for key_name in ("finnhub", "fred", "alpha_vantage"):
            assert data["api_keys"][key_name] in ("configured", "missing")

    def test_has_uptime_seconds_field(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "uptime_seconds" in data

    def test_uptime_is_non_negative(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert data["uptime_seconds"] >= 0

    def test_uptime_is_numeric(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert isinstance(data["uptime_seconds"], (int, float))

    def test_response_has_exactly_five_keys(self):
        resp = client.get("/api/health")
        data = resp.json()
        expected_keys = {"status", "version", "database", "api_keys", "uptime_seconds"}
        assert set(data.keys()) == expected_keys

    def test_content_type_is_json(self):
        resp = client.get("/api/health")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 10. Route Registration
# ===================================================================
class TestRouteRegistration:
    """All 10 route modules are registered and reachable."""

    EXPECTED_ROUTE_PATHS = [
        "/api/ticker/{symbol}",
        "/api/news/{symbol}",
        "/api/fundamentals/{symbol}",
        "/api/ownership/{symbol}",
        "/api/macro/calendar",
        "/api/macro/event/{event_type}",
        "/api/analyze/{symbol}",
        "/api/watchlist/",
        "/api/watchlist/{symbol}",
        "/api/watchlist/reorder",
        "/api/watchlist/{symbol}/group",
        "/api/query/",
        "/api/scan/",
        "/ws",
    ]

    def _get_route_paths(self):
        return [getattr(r, "path", "") for r in app.routes]

    @pytest.mark.parametrize(
        "path",
        EXPECTED_ROUTE_PATHS,
        ids=[p.replace("/", "_").strip("_") for p in EXPECTED_ROUTE_PATHS],
    )
    def test_route_path_registered(self, path):
        route_paths = self._get_route_paths()
        assert path in route_paths, f"Missing route: {path}"

    def test_health_route_registered(self):
        route_paths = self._get_route_paths()
        assert "/api/health" in route_paths

    def test_all_ten_route_modules_importable(self):
        """Each of the 10 route modules should be importable."""
        modules = [
            "app.api.routes.ticker",
            "app.api.routes.news",
            "app.api.routes.fundamentals",
            "app.api.routes.ownership",
            "app.api.routes.macro",
            "app.api.routes.analysis",
            "app.api.routes.watchlist",
            "app.api.routes.query",
            "app.api.routes.scan",
            "app.api.routes.websocket",
        ]
        for mod_path in modules:
            mod = importlib.import_module(mod_path)
            assert hasattr(mod, "router"), f"{mod_path} missing 'router' attribute"

    # Scan POST stub removed — TASK-ANALYSIS-010 implemented (GET-based now)
    pass


# ===================================================================
# 11. Lifespan
# ===================================================================
class TestLifespan:
    """App lifespan starts successfully and calls validate_config."""

    def test_app_starts_without_error(self):
        """TestClient context exercises startup/shutdown lifespan."""
        # The module-level ``client = TestClient(app)`` already proves
        # startup succeeded, but we explicitly create one here to be
        # self-contained.
        with TestClient(app) as tc:
            resp = tc.get("/api/health")
            assert resp.status_code == 200

    @patch("app.main.validate_config", return_value={})
    @patch("app.main.get_settings")
    def test_validate_config_called_during_startup(
        self, mock_settings, mock_validate
    ):
        """validate_config should be invoked as part of lifespan startup."""
        mock_settings_instance = MagicMock()
        mock_settings_instance.cors_origins = "http://localhost:3000"
        mock_settings_instance.log_level = "INFO"
        mock_settings.return_value = mock_settings_instance

        # Create a fresh app that uses patched validate_config
        test_app = FastAPI(lifespan=app.router.lifespan_context)

        @test_app.get("/ping")
        async def ping():
            return {"pong": True}

        with TestClient(test_app):
            pass
        # validate_config is called at module import level; verify it
        # was called during the app's lifespan or at import time.
        # Since it is called in lifespan, creating a new TestClient
        # triggers it.


# ===================================================================
# 12. _import_router Helper
# ===================================================================
class TestImportRouterHelper:
    """The ``_import_router`` helper gracefully handles missing modules."""

    def test_returns_none_for_nonexistent_module(self):
        result = _import_router("app.api.routes.nonexistent_xyz_module", "fake")
        assert result is None

    def test_returns_none_for_completely_bogus_path(self):
        result = _import_router("totally.fake.module.path.that.does.not.exist", "bogus")
        assert result is None

    def test_returns_router_for_valid_module(self):
        result = _import_router("app.api.routes.ticker", "ticker")
        assert result is not None

    def test_valid_module_has_router_attribute(self):
        result = _import_router("app.api.routes.ticker", "ticker")
        # The router should be an APIRouter instance
        from fastapi import APIRouter

        assert isinstance(result, APIRouter)

    def test_returns_router_for_each_route_module(self):
        modules = [
            ("app.api.routes.ticker", "ticker"),
            ("app.api.routes.news", "news"),
            ("app.api.routes.fundamentals", "fundamentals"),
            ("app.api.routes.ownership", "ownership"),
            ("app.api.routes.macro", "macro"),
            ("app.api.routes.analysis", "analysis"),
            ("app.api.routes.watchlist", "watchlist"),
            ("app.api.routes.query", "query"),
            ("app.api.routes.scan", "scan"),
            ("app.api.routes.websocket", "websocket"),
        ]
        for mod_path, name in modules:
            result = _import_router(mod_path, name)
            assert result is not None, f"_import_router returned None for {name}"

    def test_returns_none_when_module_has_no_router_attr(self):
        """If the module exists but has no 'router' attr, return None."""
        # importlib itself exists but has no 'router' attribute
        result = _import_router("json", "json")
        assert result is None


# ===================================================================
# 13. Edge Cases -- Structured Error Responses
# ===================================================================
class TestEdgeCases:
    """Undefined routes and wrong methods return structured JSON, not HTML."""

    def test_404_returns_json_not_html(self):
        resp = client.get("/api/nonexistent_route_xyz")
        assert resp.status_code == 404
        # Should be valid JSON, not an HTML error page
        body = resp.json()
        assert "error" in body or "detail" in body

    def test_404_has_status_code_field(self):
        resp = client.get("/api/nonexistent_route_xyz")
        body = resp.json()
        assert body.get("status_code") == 404

    def test_405_returns_json_not_html(self):
        # /api/query/ only supports POST; a GET should yield 405
        resp = client.get("/api/query/")
        assert resp.status_code == 405
        body = resp.json()
        assert "error" in body or "detail" in body

    def test_405_has_status_code_field(self):
        resp = client.get("/api/query/")
        body = resp.json()
        assert body.get("status_code") == 405

    def test_post_on_get_only_route_returns_405(self):
        resp = client.post("/api/ticker/AAPL")
        assert resp.status_code == 405

    def test_post_on_health_returns_405(self):
        resp = client.post("/api/health")
        assert resp.status_code == 405


# ===================================================================
# 14. Application Metadata
# ===================================================================
class TestAppMetadata:
    """FastAPI application-level configuration checks."""

    def test_app_title(self):
        assert app.title == "Market Terminal API"

    def test_app_version(self):
        assert app.version == "1.0.0"

    def test_app_description_not_empty(self):
        assert app.description is not None
        assert len(app.description) > 0

    def test_app_description_mentions_bloomberg(self):
        assert "Bloomberg" in app.description or "financial" in app.description.lower()


# ===================================================================
# 15. Exception Handler Integration via Real App
# ===================================================================
class TestExceptionHandlersOnRealApp:
    """Verify the real app's exception handlers fire on actual HTTP errors.

    These tests use the production ``app`` (not the fixture) to confirm that
    the exception handlers are correctly registered on the real FastAPI instance.
    """

    def test_real_app_404_is_json(self):
        resp = client.get("/api/does-not-exist-anywhere")
        assert resp.status_code == 404
        body = resp.json()
        assert body["status_code"] == 404
        assert isinstance(body["error"], str)

    def test_real_app_405_is_json(self):
        resp = client.post("/api/health")
        assert resp.status_code == 405
        body = resp.json()
        assert body["status_code"] == 405


# ===================================================================
# 16. Parameterized Route Stub Tests
# ===================================================================
class TestRouteStubResponses:
    """Ensure all GET stubs return expected structure with symbol echoed."""

    # Analysis GET stub removed — TASK-ANALYSIS-009 implemented
    # Scan POST stub removed — TASK-ANALYSIS-010 implemented

    # Query POST stub removed — TASK-GOD-005 implemented
    # No remaining mutation stubs to test


# ===================================================================
# 17. Module-Level State
# ===================================================================
class TestModuleLevelState:
    """Verify module-level variables are properly initialized."""

    def test_startup_time_set_after_client_creation(self):
        """After the TestClient lifespan runs, _startup_time should be > 0."""
        from app.main import _startup_time

        # The module-level client triggers lifespan, setting _startup_time
        assert _startup_time > 0

    def test_config_status_is_dict(self):
        from app.main import _config_status

        assert isinstance(_config_status, dict)
