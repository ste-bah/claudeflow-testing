# God-Learn Resilience Guide

Patterns for building fault-tolerant pipeline components.

---

## Quick Start

```python
from scripts.common import (
    retry,
    circuit_breaker,
    with_timeout,
    fallback,
    with_fallback_value,
    HealthChecker,
)

# Retry with exponential backoff
@retry(max_attempts=3, delay=1.0, backoff=2.0)
def fetch_embeddings(text):
    return embedding_api.embed(text)

# Circuit breaker for external services
@circuit_breaker("chromadb", failure_threshold=5)
def query_vectors(query):
    return chroma_client.query(query)

# Fallback to cached value
@with_fallback_value([])
def optional_enrichment(data):
    return external_api.enrich(data)
```

---

## Retry Decorator

Use when operations may fail transiently (network issues, rate limits).

### Basic Usage

```python
from scripts.common import retry

@retry(max_attempts=3, delay=1.0)
def call_api():
    return requests.get(url)
```

### Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_attempts` | 3 | Maximum retry attempts |
| `delay` | 1.0 | Initial delay (seconds) |
| `backoff` | 2.0 | Delay multiplier each retry |
| `max_delay` | 60.0 | Maximum delay cap |
| `jitter` | True | Add randomness to prevent thundering herd |
| `exceptions` | (Exception,) | Exceptions to retry on |

### Retry Only Specific Exceptions

```python
@retry(
    max_attempts=5,
    delay=0.5,
    exceptions=(ConnectionError, TimeoutError, requests.RequestException),
)
def fetch_with_retry():
    ...
```

### Custom Retry Callback

```python
def on_retry(exception, attempt):
    metrics.increment("api.retries")
    logger.info(f"Retry {attempt}", extra={"error": str(exception)})

@retry(max_attempts=3, on_retry=on_retry)
def monitored_call():
    ...
```

### Backoff Timing Example

With `delay=1.0, backoff=2.0, jitter=True`:

| Attempt | Base Delay | With Jitter (approx) |
|---------|------------|----------------------|
| 1 | 1.0s | 0.5-1.5s |
| 2 | 2.0s | 1.0-3.0s |
| 3 | 4.0s | 2.0-6.0s |
| 4 | 8.0s | 4.0-12.0s |

---

## Circuit Breaker

Prevents cascading failures by stopping calls to failing services.

### States

```
CLOSED ──(failures >= threshold)──> OPEN
   ^                                   │
   │                                   │ (after reset_timeout)
   │                                   v
   └───(successes >= threshold)─── HALF_OPEN
```

- **CLOSED**: Normal operation, requests go through
- **OPEN**: Service failing, requests rejected immediately
- **HALF_OPEN**: Testing if service recovered

### Basic Usage

```python
from scripts.common import circuit_breaker

@circuit_breaker("embedding_api", failure_threshold=5, reset_timeout=60)
def get_embedding(text):
    return api.embed(text)
```

### Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `failure_threshold` | 5 | Failures before opening |
| `success_threshold` | 2 | Successes in half-open to close |
| `reset_timeout` | 60.0 | Seconds before trying half-open |
| `exceptions` | (Exception,) | Exceptions that count as failures |

### Handling Open Circuit

```python
from scripts.common import circuit_breaker, CircuitOpenError

@circuit_breaker("api", failure_threshold=3)
def call_api():
    ...

try:
    result = call_api()
except CircuitOpenError as e:
    logger.warning(f"Service {e.service} is down, using cache")
    result = get_from_cache()
```

### Monitoring Circuit State

```python
from scripts.common import CircuitBreaker

# Get all circuit breaker states
states = CircuitBreaker.get_all_states()
for name, state in states.items():
    print(f"{name}: {state['state']} (failures: {state['failure_count']})")

# Get specific circuit
cb = CircuitBreaker.get("chromadb")
if cb and cb.state == CircuitState.OPEN:
    alert("ChromaDB circuit is open!")

# Manual reset
cb.reset()
```

---

## Timeout Wrapper

Prevent operations from hanging indefinitely.

### Basic Usage

```python
from scripts.common import with_timeout

@with_timeout(30)
def slow_operation():
    # Will raise TimeoutError if takes > 30s
    ...
```

### With Fallback

```python
@with_timeout(10, default=None, raise_on_timeout=False)
def optional_slow_operation():
    # Returns None if times out
    ...
```

---

## Fallback Patterns

### Fallback Function

Use another function as fallback:

```python
from scripts.common import fallback

def get_from_cache(text):
    return cache.get(hash(text))

@fallback(get_from_cache)
def get_embedding(text):
    return api.embed(text)  # If this fails, tries cache
```

### Fallback Value

Return a static value on failure:

```python
from scripts.common import with_fallback_value

@with_fallback_value([])
def fetch_optional_metadata():
    return external_api.get_metadata()  # Returns [] on any error

@with_fallback_value({"status": "unknown"})
def get_service_status():
    return api.status()
```

---

## Health Checker

Monitor external service health.

### Setup

```python
from scripts.common import HealthChecker

health = HealthChecker()

# Register health checks
health.register("chromadb", lambda: chroma_client.heartbeat())
health.register("embedding_api", lambda: api.health_check())
health.register("filesystem", lambda: Path("corpus").exists())
```

### Check Health

```python
# Check all services
results = health.check_all()

for name, status in results.items():
    if not status.healthy:
        logger.error(f"Service {name} is unhealthy: {status.error}")
    else:
        logger.info(f"Service {name} OK ({status.latency_ms}ms)")

# Check specific service
if not health.is_healthy("chromadb"):
    raise RuntimeError("ChromaDB is required but unavailable")
```

### Health Response Format

```python
ServiceHealth(
    name="chromadb",
    healthy=True,
    latency_ms=15.2,
    error=None,
    last_check=datetime(2026, 1, 13, 17, 45, 0),
)
```

---

## Combining Patterns

### Resilient External API Call

```python
from scripts.common import retry, circuit_breaker, with_fallback_value

# Layer 1: Fallback to empty on complete failure
@with_fallback_value([])
# Layer 2: Circuit breaker to prevent hammering failed service
@circuit_breaker("embedding_api", failure_threshold=5, reset_timeout=120)
# Layer 3: Retry transient failures
@retry(max_attempts=3, delay=1.0, exceptions=(ConnectionError, TimeoutError))
def get_embeddings(texts):
    return embedding_api.batch_embed(texts)
```

### Startup Health Check

```python
def startup():
    health = HealthChecker()
    health.register("chromadb", check_chroma)
    health.register("embedding_api", check_embedding)

    results = health.check_all()
    unhealthy = [n for n, s in results.items() if not s.healthy]

    if unhealthy:
        logger.error(f"Required services unavailable: {unhealthy}")
        sys.exit(1)

    logger.info("All services healthy, starting pipeline")
```

### Graceful Degradation

```python
def process_document(doc):
    # Primary path: full processing
    try:
        embeddings = get_embeddings(doc.chunks)
        metadata = fetch_metadata(doc.path)
        return full_process(doc, embeddings, metadata)

    except CircuitOpenError:
        # Fallback: process without embeddings
        logger.warning("Embedding API unavailable, using keyword search")
        return keyword_process(doc)

    except Exception as e:
        # Last resort: minimal processing
        logger.error("Full processing failed", extra={"error": str(e)})
        return minimal_process(doc)
```

---

## Best Practices

### 1. Choose Appropriate Thresholds

```python
# For flaky but fast APIs (< 100ms latency)
@retry(max_attempts=5, delay=0.1, backoff=2.0)

# For slow but reliable APIs (> 1s latency)
@retry(max_attempts=3, delay=2.0, backoff=1.5)

# For critical services
@circuit_breaker("critical", failure_threshold=10, reset_timeout=30)

# For non-critical services
@circuit_breaker("optional", failure_threshold=3, reset_timeout=300)
```

### 2. Log Resilience Events

All resilience utilities log automatically:
- Retries with attempt count and delay
- Circuit state changes
- Fallback activations
- Timeout occurrences

### 3. Monitor Circuit States

```python
# Periodic monitoring
def monitor_circuits():
    states = CircuitBreaker.get_all_states()
    open_circuits = [n for n, s in states.items() if s["state"] == "open"]

    if open_circuits:
        alert(f"Open circuits: {open_circuits}")
```

### 4. Test Failure Paths

```python
def test_embedding_fallback():
    # Force circuit open
    cb = CircuitBreaker.get("embedding_api")
    for _ in range(cb.failure_threshold + 1):
        try:
            raise ConnectionError("Simulated failure")
        except:
            cb._record_failure(ConnectionError())

    # Verify fallback works
    result = get_embeddings(["test"])
    assert result == []  # Fallback value
```

---

## Summary

| Pattern | When to Use |
|---------|-------------|
| `@retry` | Transient failures (network, rate limits) |
| `@circuit_breaker` | Protect against failing external services |
| `@with_timeout` | Prevent hanging operations |
| `@fallback` | Use alternative implementation on failure |
| `@with_fallback_value` | Return default value on failure |
| `HealthChecker` | Monitor service availability |
