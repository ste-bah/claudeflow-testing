"""Tests for TASK-SETUP-001: Python Backend Project Scaffolding.

Validates all 17 scaffolding files: app structure, route stubs, WebSocket,
CORS configuration, health check, requirements, setup.py, and __init__.py files.

Run with: ``pytest tests/test_scaffolding.py -v``
"""
import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app)

# Root of the backend package (one level up from tests/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent


# ===================================================================
# 1. Health Check
# ===================================================================
class TestHealthCheck:
    """GET /api/health must return status ok and the app version."""

    def test_health_returns_200(self):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_response_body(self):
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"

    def test_health_response_has_expected_keys(self):
        response = client.get("/api/health")
        data = response.json()
        assert set(data.keys()) == {"status", "version", "database", "api_keys", "uptime_seconds"}


# ===================================================================
# 2. App Metadata
# ===================================================================
class TestAppMetadata:
    """FastAPI application-level configuration checks."""

    def test_app_title(self):
        assert app.title == "Market Terminal API"

    def test_app_version(self):
        assert app.version == "1.0.0"

    def test_cors_middleware_present(self):
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes

    def test_cors_allows_localhost_3000(self):
        for m in app.user_middleware:
            if m.cls.__name__ == "CORSMiddleware":
                origins = m.kwargs.get("allow_origins", [])
                assert "http://localhost:3000" in origins
                break
        else:
            pytest.fail("CORSMiddleware not found")

    def test_cors_allows_localhost_5173(self):
        for m in app.user_middleware:
            if m.cls.__name__ == "CORSMiddleware":
                origins = m.kwargs.get("allow_origins", [])
                assert "http://localhost:5173" in origins
                break
        else:
            pytest.fail("CORSMiddleware not found")


# ===================================================================
# 3. HTTP Route Stubs (GET endpoints)
# ===================================================================
class TestRouteStubsGET:
    """All GET route stubs return 200 with status=not_implemented."""

    # Analysis GET stub removed — TASK-ANALYSIS-009 implemented
    pass


# ===================================================================
# 4. HTTP Route Stubs (POST / DELETE endpoints)
# ===================================================================
class TestRouteStubsMutations:
    """POST and DELETE route stubs return 200 with status=not_implemented."""

    # Scan POST stub removed — TASK-ANALYSIS-010 implemented

    # Query POST stub removed — TASK-GOD-005 implemented


# ===================================================================
# 5. WebSocket — Full implementation (TASK-API-008)
# ===================================================================
class TestWebSocket:
    """WebSocket /ws connects and sends welcome message (TASK-API-008)."""

    def test_websocket_connect_receives_welcome(self):
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connected"
            assert "client_id" in data
            assert "server_time" in data

    def test_websocket_ping_pong(self):
        with client.websocket_connect("/ws") as websocket:
            _welcome = websocket.receive_json()
            websocket.send_json({"action": "ping"})
            data = websocket.receive_json()
            assert data["type"] == "pong"


# ===================================================================
# 6. Router Registration
# ===================================================================
class TestRouterRegistration:
    """Verify all 8 routers are registered and their routes are reachable."""

    def test_all_route_paths_registered(self):
        """Every expected route path must appear in the app's route list."""
        route_paths = [getattr(r, "path", "") for r in app.routes]
        expected = [
            "/api/health",
            "/api/ticker/{symbol}",
            "/api/news/{symbol}",
            "/api/fundamentals/{symbol}",
            "/api/ownership/{symbol}",
            "/api/macro/calendar",
            "/api/macro/event/{event_type}",
            "/api/macro/reaction/{symbol}/{event_type}",
            "/api/analyze/{symbol}",
            "/api/watchlist/",
            "/api/watchlist/{symbol}",
            "/api/watchlist/reorder",
            "/api/watchlist/{symbol}/group",
            "/api/query/",
            "/api/scan/",
            "/ws",
        ]
        for path in expected:
            assert path in route_paths, f"Missing route: {path}"

    def test_minimum_route_count(self):
        """App should have at least 13 registered routes (excl. openapi, docs)."""
        route_paths = [
            getattr(r, "path", "")
            for r in app.routes
            if not getattr(r, "path", "").startswith("/openapi")
            and not getattr(r, "path", "").startswith("/docs")
            and not getattr(r, "path", "").startswith("/redoc")
        ]
        # 16 application routes minimum (added watchlist reorder + group)
        assert len(route_paths) >= 16


# ===================================================================
# 7. File Structure Validation
# ===================================================================
class TestFileStructure:
    """Verify scaffolding files exist with expected content."""

    def test_requirements_txt_exists(self):
        req_file = BACKEND_ROOT / "requirements.txt"
        assert req_file.exists(), "requirements.txt not found"

    def test_requirements_has_17_packages(self):
        req_file = BACKEND_ROOT / "requirements.txt"
        lines = req_file.read_text().splitlines()
        packages = [
            line.strip()
            for line in lines
            if line.strip() and not line.startswith("#")
        ]
        assert len(packages) == 17, (
            f"Expected 17 packages, found {len(packages)}: {packages}"
        )

    @pytest.mark.parametrize(
        "package",
        [
            "fastapi",
            "uvicorn",
            "pydantic",
            "httpx",
            "websockets",
            "yfinance",
            "pandas",
            "numpy",
            "aiosqlite",
        ],
        ids=lambda p: f"req-{p}",
    )
    def test_requirements_contains_key_packages(self, package):
        req_file = BACKEND_ROOT / "requirements.txt"
        content = req_file.read_text()
        assert package in content, f"requirements.txt missing {package}"

    def test_setup_py_exists(self):
        setup_file = BACKEND_ROOT / "setup.py"
        assert setup_file.exists(), "setup.py not found"

    def test_setup_py_has_correct_name(self):
        setup_file = BACKEND_ROOT / "setup.py"
        content = setup_file.read_text()
        assert 'name="market-terminal-backend"' in content

    def test_setup_py_has_correct_version(self):
        setup_file = BACKEND_ROOT / "setup.py"
        content = setup_file.read_text()
        assert 'version="0.1.0"' in content

    def test_setup_py_requires_python_311(self):
        setup_file = BACKEND_ROOT / "setup.py"
        content = setup_file.read_text()
        assert 'python_requires=">=3.11"' in content

    def test_init_files_exist(self):
        """All 6 __init__.py files must exist."""
        base = BACKEND_ROOT / "app"
        init_files = list(base.rglob("__init__.py"))
        assert len(init_files) >= 6, (
            f"Expected >= 6 __init__.py files, found {len(init_files)}"
        )

    def test_init_files_are_empty(self):
        """All __init__.py files should be empty (no code in scaffolding)."""
        base = BACKEND_ROOT / "app"
        init_files = list(base.rglob("__init__.py"))
        for f in init_files:
            assert f.read_text().strip() == "", f"{f.relative_to(BACKEND_ROOT)} is not empty"


# ===================================================================
# 8. Import Structure
# ===================================================================
class TestImportStructure:
    """All modules must be importable without errors."""

    @pytest.mark.parametrize(
        "module_path",
        [
            "app",
            "app.main",
            "app.api",
            "app.api.routes",
            "app.api.routes.ticker",
            "app.api.routes.news",
            "app.api.routes.fundamentals",
            "app.api.routes.macro",
            "app.api.routes.analysis",
            "app.api.routes.watchlist",
            "app.api.routes.query",
            "app.api.routes.ownership",
            "app.api.routes.scan",
            "app.api.routes.websocket",
            "app.exceptions",
            "app.agent",
            "app.analysis",
            "app.data",
        ],
        ids=lambda m: m.replace(".", "-"),
    )
    def test_module_importable(self, module_path):
        """Each module in the scaffolding must import without error."""
        mod = importlib.import_module(module_path)
        assert mod is not None


# ===================================================================
# 9. Negative / Edge-Case Tests
# ===================================================================
class TestEdgeCases:
    """Ensure undefined routes return 404 and methods return 405."""

    def test_unknown_route_returns_404(self):
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

    def test_get_on_post_only_route_returns_405(self):
        response = client.get("/api/query/")
        assert response.status_code == 405

    def test_post_on_get_only_route_returns_405(self):
        response = client.post("/api/ticker/AAPL")
        assert response.status_code == 405

    def test_health_post_returns_405(self):
        response = client.post("/api/health")
        assert response.status_code == 405
