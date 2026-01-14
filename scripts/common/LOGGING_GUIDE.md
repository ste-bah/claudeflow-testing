# God-Learn Logging Integration Guide

How to add structured logging to pipeline scripts.

---

## Quick Start

```python
import sys
from pathlib import Path

# Add project root for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import get_logger

# Create logger for your module
logger = get_logger("phase6.promote")

# Basic logging
logger.info("Starting operation")
logger.warning("Something unusual")
logger.error("Something failed")

# Structured logging with context
logger.info("Processing document", extra={
    "doc": "aristotle.pdf",
    "page": 42,
    "chunks": 15,
})
```

---

## Log Levels

| Level | Use Case |
|-------|----------|
| `DEBUG` | Detailed debugging info (loop iterations, skips) |
| `INFO` | Normal operations (start, complete, counts) |
| `WARNING` | Recoverable issues (fallbacks, retries) |
| `ERROR` | Failures that stop the operation |
| `CRITICAL` | System-level failures |

---

## Structured Context

Always include relevant context in the `extra` dict:

```python
# Good - structured context
logger.info("Promoted knowledge unit", extra={
    "ku_id": "ku_abc123",
    "chunk_id": "chunk_456",
    "source": "aristotle.pdf",
    "confidence": 0.92,
})

# Bad - unstructured message
logger.info(f"Promoted ku_abc123 from chunk_456 in aristotle.pdf with 0.92 confidence")
```

### Common Context Fields

| Field | Description |
|-------|-------------|
| `doc`, `source`, `path` | Document path |
| `page`, `pages` | Page numbers |
| `chunk_id`, `ku_id`, `ru_id` | Entity IDs |
| `query` | Search query |
| `count`, `total` | Counts |
| `duration`, `elapsed` | Timing (seconds) |
| `error`, `reason` | Error info |

---

## Logging Patterns

### Operation Start/End

```python
import time

logger.info("Starting promotion", extra={
    "query": args.query,
    "input_file": str(hits_path),
})

start = time.time()
# ... do work ...
duration = time.time() - start

logger.info("Promotion complete", extra={
    "promoted": len(promoted),
    "total": len(index),
    "duration": round(duration, 2),
})
```

### Error Handling

```python
try:
    result = process_document(doc)
    logger.debug("Processed successfully", extra={"doc": doc})
except ValueError as e:
    logger.warning("Skipping invalid document", extra={
        "doc": doc,
        "error": str(e),
    })
except Exception as e:
    logger.error("Failed to process document", extra={
        "doc": doc,
        "error": str(e),
    }, exc_info=True)  # Include stack trace
    raise
```

### Loop Progress

```python
for i, item in enumerate(items):
    logger.debug("Processing item", extra={
        "index": i,
        "total": len(items),
        "item_id": item.id,
    })

    # ... process ...

    if i % 100 == 0:  # Log progress every 100 items
        logger.info("Progress update", extra={
            "processed": i,
            "total": len(items),
            "percent": round(100 * i / len(items), 1),
        })
```

### Skip/Filter Decisions

```python
if item.id in existing_ids:
    logger.debug("Skipping duplicate", extra={
        "item_id": item.id,
        "reason": "already_indexed",
    })
    continue

if len(item.text) < MIN_CHARS:
    logger.debug("Skipping short item", extra={
        "item_id": item.id,
        "chars": len(item.text),
        "min_required": MIN_CHARS,
    })
    continue
```

---

## Environment Configuration

Control logging via environment variables:

```bash
# Set log level
export GOD_LEARN_LOG_LEVEL=DEBUG   # DEBUG, INFO, WARNING, ERROR

# Enable JSON console output (for parsing)
export GOD_LEARN_LOG_JSON=true

# Custom log file
export GOD_LEARN_LOG_FILE=custom.log
export GOD_LEARN_LOG_DIR=/var/log/god-learn

# Log rotation settings
export GOD_LEARN_LOG_MAX_SIZE=50    # MB
export GOD_LEARN_LOG_BACKUP_COUNT=10
```

---

## Output Locations

| Output | Format | Purpose |
|--------|--------|---------|
| Console (stderr) | Colored text | Human-readable |
| `logs/god-learn.log` | JSON | Machine parsing, long-term storage |

### Console Output (default)
```
17:31:23 [INFO    ] god-learn.phase6: Starting promotion [query=phantasia, hits=12]
17:31:24 [INFO    ] god-learn.phase6: Promotion complete [promoted=7, total=52]
```

### JSON Log File
```json
{"timestamp": "2026-01-14T01:31:23.008", "level": "INFO", "logger": "god-learn.phase6", "message": "Starting promotion", "context": {"query": "phantasia", "hits": 12}, "source": {"file": "promote_hits.py", "line": 129}}
```

---

## Migrating Existing Scripts

### Step 1: Add Imports

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.common import get_logger

logger = get_logger("phase_name.module_name")
```

### Step 2: Replace Print Statements

```python
# Before
print(f"[Phase6] Promoted {count} units")

# After
logger.info("Promoted units", extra={"count": count})
print(f"[Phase6] Promoted {count} units")  # Keep for backward compat
```

### Step 3: Enhance Error Handling

```python
# Before
def die(msg):
    raise SystemExit(f"ERROR: {msg}")

# After
def die(msg, code=1):
    logger.error(msg, extra={"exit_code": code})
    raise SystemExit(f"ERROR: {msg}")
```

### Step 4: Add Context to Key Operations

Identify important operations and add structured logging:
- Start/end of main function
- File reads/writes
- API calls
- Loop progress for large datasets
- Skip/filter decisions
- Error recovery

---

## Querying Logs

### Find Errors
```bash
grep '"level": "ERROR"' logs/god-learn.log | jq .
```

### Filter by Logger
```bash
grep '"logger": "god-learn.phase6"' logs/god-learn.log | jq .
```

### Extract Metrics
```bash
# Count promotions per query
grep '"message": "Promotion complete"' logs/god-learn.log | jq -r '.context.query' | sort | uniq -c
```

### Time Range
```bash
# Last hour's errors
grep '"level": "ERROR"' logs/god-learn.log | \
  jq -r 'select(.timestamp > "2026-01-14T00:00:00")'
```

---

## Best Practices

1. **Use structured context** - Always use `extra={}` instead of f-strings
2. **Be consistent** - Use same field names across modules
3. **Log at appropriate level** - DEBUG for details, INFO for operations
4. **Include IDs** - Always log entity IDs for traceability
5. **Keep messages short** - Put details in context fields
6. **Log duration** - Time long operations
7. **Log decisions** - Explain skips, filters, fallbacks
8. **Don't log secrets** - Never log passwords, tokens, keys

---

## Example: Full Script Integration

See `scripts/learn/promote_hits.py` for a complete example of logging integration.
