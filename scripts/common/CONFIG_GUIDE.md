# God-Learn Configuration Guide

Centralized configuration management for the pipeline.

---

## Quick Start

```python
from scripts.common import config

# Access configuration values
corpus_root = config.get("paths.corpus_root")
chroma_dir = config.get("vector_db.chroma_dir")

# With default fallback
k = config.get("retrieval.top_k", default=12)

# Get entire section
db_config = config.get_section("vector_db")

# Get as Path object
corpus_path = config.get_path("paths.corpus_root")
```

---

## Configuration Sources

Configuration is loaded from multiple sources (later sources override earlier):

1. **Built-in Defaults** - Hardcoded in `config.py`
2. **defaults.yaml** - `config/defaults.yaml`
3. **local.yaml** - `config/local.yaml` (gitignored, for local overrides)
4. **Environment Variables** - `GOD_LEARN_SECTION_KEY` format

### Priority Order

```
Environment Variables (highest)
    ↓
config/local.yaml
    ↓
config/defaults.yaml
    ↓
Built-in Defaults (lowest)
```

---

## Configuration Sections

### Paths

```yaml
paths:
  corpus_root: corpus                          # Document root
  manifest: scripts/ingest/manifest.jsonl      # Ingest manifest
  knowledge_file: god-learn/knowledge.jsonl    # Knowledge store
  index_file: god-learn/index.json             # KU index
  highlights_index: scripts/highlights/highlight_index.json
  logs_dir: logs                               # Log directory
  tmp_dir: /tmp                                # Temp files
```

### Vector Database

```yaml
vector_db:
  chroma_dir: vector_db_1536      # ChromaDB directory
  collection: knowledge_chunks     # Default collection
  embedding_dim: 1536              # Embedding dimension
```

### Embedding Service

```yaml
embedding:
  url: http://localhost:11435/api/embeddings
  model: nomic-embed-text
  timeout: 30
```

### Retrieval

```yaml
retrieval:
  top_k: 12           # Results to return
  overfetch: 3        # Overfetch multiplier
  min_score: 0.0      # Minimum similarity threshold
```

### Highlights

```yaml
highlights:
  alpha: 0.02         # Boost factor
  cap: 5              # Maximum boost
```

### Promotion (Phase 6)

```yaml
promotion:
  min_chars: 40       # Minimum claim length
  max_units: 0        # Max units (0 = no limit)
```

### Reasoning (Phase 7)

```yaml
reasoning:
  batch_size: 10
  max_iterations: 100
```

### LLM

```yaml
llm:
  model: gpt-4
  temperature: 0.3
  max_tokens: 4096
  timeout: 120
```

### Logging

```yaml
logging:
  level: INFO                 # DEBUG, INFO, WARNING, ERROR
  json_format: false          # Use JSON for file logs
  file: null                  # Log file path (null = no file)
  max_bytes: 10000000         # Max log file size
  backup_count: 5             # Backup log files to keep
```

### Resilience

```yaml
resilience:
  retry_max_attempts: 3
  retry_delay: 1.0
  retry_backoff: 2.0
  circuit_failure_threshold: 5
  circuit_reset_timeout: 60
  request_timeout: 30
```

---

## Environment Variable Overrides

Override any setting using environment variables:

```bash
# Format: GOD_LEARN_SECTION_KEY=value

# Override corpus path
export GOD_LEARN_PATHS_CORPUS_ROOT=/custom/path/corpus

# Override retrieval settings
export GOD_LEARN_RETRIEVAL_TOP_K=20
export GOD_LEARN_RETRIEVAL_OVERFETCH=5

# Enable debug logging
export GOD_LEARN_LOGGING_LEVEL=DEBUG

# Change embedding timeout
export GOD_LEARN_EMBEDDING_TIMEOUT=60
```

Type conversion is automatic:
- Boolean: `true`, `1`, `yes` → `True`
- Integer: `"20"` → `20`
- Float: `"0.5"` → `0.5`
- String: everything else

---

## Local Overrides

Create `config/local.yaml` for machine-specific settings:

```yaml
# config/local.yaml (gitignored)

paths:
  corpus_root: /home/user/my-corpus

embedding:
  url: http://192.168.1.100:11435/api/embeddings

logging:
  level: DEBUG
  file: logs/debug.log
```

---

## API Reference

### Getting Values

```python
from scripts.common import config

# Simple key
value = config.get("paths.corpus_root")

# With default
k = config.get("retrieval.top_k", default=12)

# Entire section
paths = config.get_section("paths")
# Returns: {"corpus_root": "...", "manifest": "...", ...}

# As Path object
path = config.get_path("paths.corpus_root")
# Returns: Path("/home/dalton/projects/claudeflow-testing/corpus")
```

### Setting Values (Runtime)

```python
# Override at runtime (in-memory only)
config.set("retrieval.top_k", 20)
```

### Validation

```python
from scripts.common import config

# Check required keys exist
missing = config.validate_required([
    "paths.corpus_root",
    "vector_db.chroma_dir",
])
if missing:
    raise ValueError(f"Missing config: {missing}")

# Validate paths exist on disk
errors = config.validate_paths([
    "paths.corpus_root",
    "vector_db.chroma_dir",
])
if errors:
    for key, error in errors.items():
        print(f"{key}: {error}")
```

### Reload Configuration

```python
# Reload from all sources
config.reload()
```

### View Configuration

```python
# Get all config as dict
all_config = config.all()

# Print for debugging
config.print_config()
```

---

## CLI Usage

```bash
# Show all configuration
python -m scripts.common.config --show

# Get specific value
python -m scripts.common.config --get paths.corpus_root

# Validate configuration
python -m scripts.common.config --validate
```

---

## Migrating Scripts

### Before (Hardcoded Defaults)

```python
ap.add_argument("--chroma_dir", default="vector_db_1536")
ap.add_argument("--collection", default="knowledge_chunks")
ap.add_argument("--k", type=int, default=12)
```

### After (Using Config)

```python
from scripts.common import config

ap.add_argument(
    "--chroma_dir",
    default=config.get("vector_db.chroma_dir"),
)
ap.add_argument(
    "--collection",
    default=config.get("vector_db.collection"),
)
ap.add_argument(
    "--k",
    type=int,
    default=config.get("retrieval.top_k"),
)
```

---

## Best Practices

### 1. Use Dot Notation for Keys

```python
# Good
config.get("vector_db.chroma_dir")

# Avoid
config.get_section("vector_db")["chroma_dir"]
```

### 2. Always Provide Defaults for Optional Settings

```python
# Good - explicit default
timeout = config.get("custom.timeout", default=30)

# Risky - may return None
timeout = config.get("custom.timeout")
```

### 3. Validate at Startup

```python
def main():
    # Validate configuration before processing
    errors = config.validate_paths(["paths.corpus_root"])
    if errors:
        logger.error("Invalid configuration", extra=errors)
        sys.exit(1)
```

### 4. Use Environment Variables for Secrets

```bash
# Never put secrets in YAML files
export GOD_LEARN_LLM_API_KEY=sk-xxx
```

```python
api_key = config.get("llm.api_key")  # From environment
```

### 5. Log Configuration on Startup

```python
logger.info("Starting with configuration", extra={
    "corpus_root": config.get("paths.corpus_root"),
    "chroma_dir": config.get("vector_db.chroma_dir"),
    "log_level": config.get("logging.level"),
})
```

---

## Summary

| Function | Description |
|----------|-------------|
| `config.get(key, default)` | Get single value |
| `config.get_section(name)` | Get entire section |
| `config.get_path(key)` | Get value as Path |
| `config.set(key, value)` | Set runtime value |
| `config.all()` | Get all configuration |
| `config.reload()` | Reload from sources |
| `config.validate_required(keys)` | Check keys exist |
| `config.validate_paths(keys)` | Check paths exist |
