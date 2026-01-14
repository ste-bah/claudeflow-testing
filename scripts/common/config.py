"""
Configuration Management for God-Learn Pipeline.

Provides centralized configuration with:
- YAML file loading
- Environment variable overrides
- Type validation
- Default value fallbacks

Usage:
    from scripts.common import config

    # Access configuration
    corpus_root = config.get("paths.corpus_root")
    chroma_dir = config.get("vector_db.chroma_dir")

    # With default fallback
    k = config.get("retrieval.top_k", default=12)

    # Get entire section
    db_config = config.get_section("vector_db")

    # Environment override: GOD_LEARN_PATHS_CORPUS_ROOT=/custom/path
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, TypeVar, Union

# Add project root for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.common.logging_config import get_logger

T = TypeVar("T")

logger = get_logger("config")


# =============================================================================
# Default Configuration
# =============================================================================

DEFAULT_CONFIG: Dict[str, Any] = {
    # Paths
    "paths": {
        "corpus_root": str(PROJECT_ROOT / "corpus"),
        "manifest": str(PROJECT_ROOT / "scripts/ingest/manifest.jsonl"),
        "knowledge_file": str(PROJECT_ROOT / "god-learn/knowledge.jsonl"),
        "index_file": str(PROJECT_ROOT / "god-learn/index.json"),
        "highlights_index": str(PROJECT_ROOT / "scripts/highlights/highlight_index.json"),
        "logs_dir": str(PROJECT_ROOT / "logs"),
        "tmp_dir": "/tmp",
    },

    # Vector Database
    "vector_db": {
        "chroma_dir": str(PROJECT_ROOT / "vector_db_1536"),
        "collection": "knowledge_chunks",
        "embedding_dim": 1536,
    },

    # Embedding Service
    "embedding": {
        "url": "http://localhost:11435/api/embeddings",
        "model": "nomic-embed-text",
        "timeout": 30,
    },

    # Retrieval Settings
    "retrieval": {
        "top_k": 12,
        "overfetch": 3,
        "min_score": 0.0,
    },

    # Highlight Boosting
    "highlights": {
        "alpha": 0.02,
        "cap": 5,
    },

    # Knowledge Promotion (Phase 6)
    "promotion": {
        "min_chars": 40,
        "max_units": 0,  # 0 = no cap
    },

    # Reasoning (Phase 7)
    "reasoning": {
        "batch_size": 10,
        "max_iterations": 100,
    },

    # LLM Settings
    "llm": {
        "model": "gpt-4",
        "temperature": 0.3,
        "max_tokens": 4096,
        "timeout": 120,
    },

    # Logging
    "logging": {
        "level": "INFO",
        "json_format": False,
        "file": None,
        "max_bytes": 10_000_000,
        "backup_count": 5,
    },

    # Resilience
    "resilience": {
        "retry_max_attempts": 3,
        "retry_delay": 1.0,
        "retry_backoff": 2.0,
        "circuit_failure_threshold": 5,
        "circuit_reset_timeout": 60,
        "request_timeout": 30,
    },
}


# =============================================================================
# Configuration Class
# =============================================================================

class Config:
    """
    Centralized configuration management.

    Loads configuration from:
    1. Built-in defaults
    2. config/defaults.yaml (if exists)
    3. config/local.yaml (if exists, for local overrides)
    4. Environment variables (GOD_LEARN_SECTION_KEY format)
    """

    def __init__(self):
        self._config: Dict[str, Any] = {}
        self._loaded = False

    def _deep_merge(self, base: Dict, overlay: Dict) -> Dict:
        """Deep merge overlay into base."""
        result = base.copy()
        for key, value in overlay.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def _load_yaml(self, path: Path) -> Dict[str, Any]:
        """Load YAML file if it exists."""
        if not path.exists():
            return {}

        try:
            import yaml
            with open(path, "r") as f:
                data = yaml.safe_load(f) or {}
                logger.debug(f"Loaded config from {path}")
                return data
        except ImportError:
            logger.warning("PyYAML not installed, skipping YAML config files")
            return {}
        except Exception as e:
            logger.warning(f"Failed to load {path}: {e}")
            return {}

    def _apply_env_overrides(self) -> None:
        """Apply environment variable overrides."""
        prefix = "GOD_LEARN_"

        for key, value in os.environ.items():
            if not key.startswith(prefix):
                continue

            # Convert GOD_LEARN_SECTION_KEY to section.key
            parts = key[len(prefix):].lower().split("_")
            if len(parts) < 2:
                continue

            section = parts[0]
            subkey = "_".join(parts[1:])

            if section not in self._config:
                continue

            if subkey in self._config[section]:
                # Type-convert based on existing value type
                existing_type = type(self._config[section][subkey])
                try:
                    if existing_type == bool:
                        converted = value.lower() in ("true", "1", "yes")
                    elif existing_type == int:
                        converted = int(value)
                    elif existing_type == float:
                        converted = float(value)
                    else:
                        converted = value

                    self._config[section][subkey] = converted
                    logger.debug(f"Environment override: {section}.{subkey} = {converted}")
                except ValueError:
                    logger.warning(f"Invalid value for {key}: {value}")

    def load(self, config_dir: Optional[Path] = None) -> None:
        """
        Load configuration from all sources.

        Args:
            config_dir: Directory containing config files (default: project_root/config)
        """
        if config_dir is None:
            config_dir = PROJECT_ROOT / "config"

        # Start with defaults
        self._config = DEFAULT_CONFIG.copy()

        # Deep copy nested dicts
        for key in self._config:
            if isinstance(self._config[key], dict):
                self._config[key] = self._config[key].copy()

        # Load YAML files
        defaults_yaml = self._load_yaml(config_dir / "defaults.yaml")
        self._config = self._deep_merge(self._config, defaults_yaml)

        local_yaml = self._load_yaml(config_dir / "local.yaml")
        self._config = self._deep_merge(self._config, local_yaml)

        # Apply environment overrides
        self._apply_env_overrides()

        self._loaded = True
        logger.debug("Configuration loaded successfully")

    def _ensure_loaded(self) -> None:
        """Ensure configuration is loaded."""
        if not self._loaded:
            self.load()

    def get(
        self,
        key: str,
        default: Optional[T] = None,
    ) -> Union[Any, T]:
        """
        Get a configuration value.

        Args:
            key: Dot-separated key (e.g., "paths.corpus_root")
            default: Default value if key not found

        Returns:
            Configuration value or default
        """
        self._ensure_loaded()

        parts = key.split(".")
        value = self._config

        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return default

        return value

    def get_section(self, section: str) -> Dict[str, Any]:
        """
        Get an entire configuration section.

        Args:
            section: Section name (e.g., "paths", "vector_db")

        Returns:
            Section dictionary or empty dict
        """
        self._ensure_loaded()
        return self._config.get(section, {}).copy()

    def get_path(self, key: str, default: Optional[str] = None) -> Optional[Path]:
        """
        Get a configuration value as a Path.

        Args:
            key: Dot-separated key
            default: Default path string

        Returns:
            Path object or None
        """
        value = self.get(key, default)
        if value is None:
            return None
        return Path(value)

    def set(self, key: str, value: Any) -> None:
        """
        Set a configuration value at runtime.

        Args:
            key: Dot-separated key
            value: Value to set
        """
        self._ensure_loaded()

        parts = key.split(".")
        current = self._config

        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        current[parts[-1]] = value

    def all(self) -> Dict[str, Any]:
        """Get entire configuration as dictionary."""
        self._ensure_loaded()
        return self._config.copy()

    def reload(self) -> None:
        """Reload configuration from all sources."""
        self._loaded = False
        self.load()


# =============================================================================
# Global Instance
# =============================================================================

# Singleton configuration instance
_config = Config()


def get(key: str, default: Optional[T] = None) -> Union[Any, T]:
    """Get a configuration value."""
    return _config.get(key, default)


def get_section(section: str) -> Dict[str, Any]:
    """Get an entire configuration section."""
    return _config.get_section(section)


def get_path(key: str, default: Optional[str] = None) -> Optional[Path]:
    """Get a configuration value as a Path."""
    return _config.get_path(key, default)


def set(key: str, value: Any) -> None:
    """Set a configuration value at runtime."""
    _config.set(key, value)


def all() -> Dict[str, Any]:
    """Get entire configuration as dictionary."""
    return _config.all()


def reload() -> None:
    """Reload configuration from all sources."""
    _config.reload()


def load(config_dir: Optional[Path] = None) -> None:
    """Load configuration from sources."""
    _config.load(config_dir)


# =============================================================================
# Validation Helpers
# =============================================================================

def validate_required(keys: list[str]) -> list[str]:
    """
    Validate that required configuration keys exist.

    Args:
        keys: List of dot-separated keys to check

    Returns:
        List of missing keys (empty if all present)
    """
    missing = []
    for key in keys:
        value = get(key)
        if value is None:
            missing.append(key)
    return missing


def validate_paths(keys: list[str]) -> Dict[str, str]:
    """
    Validate that configured paths exist.

    Args:
        keys: List of path config keys to check

    Returns:
        Dict of key -> error message for invalid paths
    """
    errors = {}
    for key in keys:
        path = get_path(key)
        if path is None:
            errors[key] = "Path not configured"
        elif not path.exists():
            errors[key] = f"Path does not exist: {path}"
    return errors


def print_config() -> None:
    """Print current configuration (for debugging)."""
    import json
    print(json.dumps(all(), indent=2, default=str))


# =============================================================================
# CLI Support
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="God-Learn Configuration")
    parser.add_argument("--show", action="store_true", help="Show current configuration")
    parser.add_argument("--get", type=str, help="Get specific key value")
    parser.add_argument("--validate", action="store_true", help="Validate configuration")

    args = parser.parse_args()

    if args.show:
        print_config()
    elif args.get:
        value = get(args.get)
        print(f"{args.get} = {value}")
    elif args.validate:
        # Validate critical paths
        path_errors = validate_paths([
            "paths.corpus_root",
            "vector_db.chroma_dir",
        ])
        if path_errors:
            print("Path validation errors:")
            for key, error in path_errors.items():
                print(f"  {key}: {error}")
            sys.exit(1)
        else:
            print("Configuration is valid.")
    else:
        parser.print_help()
