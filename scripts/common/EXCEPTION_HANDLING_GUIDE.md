# God-Learn Exception Handling Guide

Best practices for error handling in the pipeline.

---

## Quick Start

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import (
    get_logger,
    GodLearnError,
    IngestionError,
    safe_execute,
    with_error_context,
)

logger = get_logger("phase6")

# Use custom exceptions with context
raise IngestionError("PDF extraction failed", {"file": "doc.pdf", "page": 42})

# Use safe_execute for fallback behavior
result = safe_execute(json.loads, raw_data, default={}, logger_name="phase6")

# Use decorator for automatic error handling
@with_error_context("loading knowledge units", "phase6")
def load_kus(path):
    ...
```

---

## Exception Hierarchy

```
GodLearnError (base)
├── IngestionError     # Phases 1-3: Document ingestion
├── RetrievalError     # Phases 4-5: Search and retrieval
├── PromotionError     # Phase 6: Knowledge promotion
├── ReasoningError     # Phase 7: Reasoning graph
├── ValidationError    # Data validation failures
├── ConfigurationError # Setup/config issues
└── FileOperationError # File read/write errors
```

---

## Custom Exceptions

### Creating Exceptions with Context

```python
from scripts.common import IngestionError

# With context dictionary
raise IngestionError(
    "PDF extraction failed",
    context={
        "file": "aristotle.pdf",
        "page": 42,
        "reason": "corrupted_stream",
    }
)

# Output: "PDF extraction failed [file=aristotle.pdf, page=42, reason=corrupted_stream]"
```

### Catching and Re-raising

```python
from scripts.common import IngestionError, RetrievalError

try:
    chunks = extract_chunks(pdf_path)
except IngestionError:
    # Let our exceptions propagate
    raise
except Exception as e:
    # Wrap unknown exceptions
    raise IngestionError(
        f"Unexpected error during extraction: {e}",
        context={"file": str(pdf_path)}
    ) from e
```

---

## Exception Best Practices

### DO: Use Specific Exception Types

```python
# Good - specific exceptions
try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    logger.warning("Invalid JSON", extra={"error": str(e), "line": e.lineno})
    return default_value

# Bad - bare except
try:
    data = json.loads(raw)
except:  # Never do this!
    return default_value
```

### DO: Include Context in Logs

```python
# Good - structured context
except FileNotFoundError as e:
    logger.error("File not found", extra={
        "path": str(path),
        "operation": "load_kus",
        "phase": 6,
    })

# Bad - just the message
except FileNotFoundError as e:
    logger.error(f"File not found: {e}")
```

### DO: Use `exc_info=True` for Stack Traces

```python
try:
    result = complex_operation()
except Exception as e:
    logger.error("Operation failed", extra={"op": "complex"}, exc_info=True)
    raise
```

### DON'T: Catch and Ignore

```python
# Bad - silently swallowing errors
try:
    process(item)
except Exception:
    pass  # Never do this!

# Good - log before continuing
try:
    process(item)
except ValueError as e:
    logger.warning("Skipping invalid item", extra={"item": item.id, "error": str(e)})
    continue
```

---

## Safe Execution Patterns

### `safe_execute` - For Optional Operations

Use when failure is acceptable and a default value works:

```python
from scripts.common import safe_execute

# Returns {} if JSON parsing fails
data = safe_execute(
    json.loads,
    raw_data,
    default={},
    logger_name="phase6",
)

# Returns None if file read fails
content = safe_execute(
    Path(file).read_text,
    default=None,
    logger_name="ingest",
)
```

### `@with_error_context` - For Critical Operations

Use to add context and optionally convert to custom exceptions:

```python
from scripts.common import with_error_context, PromotionError

@with_error_context("promoting knowledge units", "phase6", error_class=PromotionError)
def promote_hits(hits_json, query):
    # If this fails, it raises PromotionError with context
    ...
```

### `@log_and_continue` - For Non-Critical Enrichment

Use for operations where failure shouldn't stop processing:

```python
from scripts.common import log_and_continue

@log_and_continue("phase6", default=[])
def fetch_author_metadata(source_path):
    # Returns [] on failure instead of crashing
    ...
```

---

## Exception Types to Catch

### JSON Operations

```python
try:
    data = json.loads(line)
except json.JSONDecodeError as e:
    # Malformed JSON
    logger.debug("Skipping malformed line", extra={"error": str(e), "line_num": i})
```

### File Operations

```python
try:
    content = path.read_text()
except FileNotFoundError:
    logger.error("File not found", extra={"path": str(path)})
    raise
except PermissionError:
    logger.error("Permission denied", extra={"path": str(path)})
    raise
except OSError as e:
    logger.error("OS error", extra={"path": str(path), "error": str(e)})
    raise
```

### Dictionary Access

```python
try:
    value = data["required_key"]
except KeyError:
    logger.warning("Missing required key", extra={"key": "required_key"})
    value = default_value
```

### Type Conversions

```python
try:
    page_num = int(page_str)
except (ValueError, TypeError) as e:
    logger.warning("Invalid page number", extra={"value": page_str, "error": str(e)})
    page_num = 0
```

### Network Operations

```python
try:
    response = requests.get(url, timeout=30)
except requests.Timeout:
    logger.error("Request timed out", extra={"url": url})
    raise RetrievalError("API timeout", {"url": url})
except requests.ConnectionError:
    logger.error("Connection failed", extra={"url": url})
    raise RetrievalError("Connection failed", {"url": url})
```

---

## Migrating `except Exception:`

When you encounter generic `except Exception:`, ask:

1. **What specific exceptions can this raise?**
   - Check the function's documentation
   - Look for the exception types it mentions

2. **Is failure acceptable here?**
   - If yes, use `safe_execute` or `@log_and_continue`
   - If no, catch specific types and re-raise

3. **Should it be logged?**
   - Almost always yes
   - Use structured context

### Before/After Example

```python
# Before - generic catch
try:
    ku = json.loads(line.strip())
    self._existing_kus[ku.ku_id] = ku
except Exception:
    continue

# After - specific catches with logging
try:
    ku = json.loads(line.strip())
    self._existing_kus[ku.ku_id] = ku
except (json.JSONDecodeError, KeyError, TypeError) as e:
    logger.debug("Skipping malformed KU", extra={
        "error": str(e),
        "line_preview": line[:50] if line else "",
    })
    continue
```

---

## Testing Error Handling

```python
import pytest
from scripts.common import IngestionError

def test_raises_on_missing_file():
    with pytest.raises(IngestionError) as exc_info:
        process_pdf("nonexistent.pdf")

    assert "not found" in str(exc_info.value)
    assert exc_info.value.context["file"] == "nonexistent.pdf"

def test_graceful_fallback():
    # Should return empty list, not crash
    result = load_optional_metadata("missing.json")
    assert result == []
```

---

## Summary

| Pattern | When to Use |
|---------|-------------|
| Specific exception types | Always prefer over `except Exception:` |
| Custom `GodLearnError` subclasses | Domain-specific failures |
| `safe_execute()` | Optional operations with fallback |
| `@with_error_context` | Critical operations needing context |
| `@log_and_continue` | Non-critical enrichment |
| `exc_info=True` | When you need stack traces |
| Context dictionaries | Always include relevant IDs, paths, counts |
