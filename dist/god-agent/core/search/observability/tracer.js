/**
 * Distributed Tracer
 * TASK-OBS-001 - Observability Stack
 *
 * Provides distributed tracing with:
 * - Trace IDs for end-to-end request tracking
 * - Span IDs for individual operations
 * - Parent-child span relationships
 * - Timing and metadata for each span
 * - Jaeger-compatible export format
 */
/**
 * Span status
 */
export var SpanStatus;
(function (SpanStatus) {
    SpanStatus["UNSET"] = "unset";
    SpanStatus["OK"] = "ok";
    SpanStatus["ERROR"] = "error";
})(SpanStatus || (SpanStatus = {}));
// ==================== Span Builder ====================
/**
 * Fluent builder for spans
 */
export class SpanBuilder {
    span;
    tracer;
    constructor(tracer, span) {
        this.tracer = tracer;
        this.span = span;
    }
    /**
     * Set a tag on the span
     */
    setTag(key, value) {
        this.span.tags[key] = value;
        return this;
    }
    /**
     * Add a log entry to the span
     */
    log(message, fields) {
        this.span.logs.push({
            timestamp: Date.now(),
            message,
            fields,
        });
        return this;
    }
    /**
     * Set span status to OK
     */
    setOk() {
        this.span.status = SpanStatus.OK;
        return this;
    }
    /**
     * Set span status to ERROR
     */
    setError(error) {
        this.span.status = SpanStatus.ERROR;
        if (error) {
            const errorMessage = error instanceof Error ? error.message : error;
            this.setTag('error', true);
            this.setTag('error.message', errorMessage);
            if (error instanceof Error && error.stack) {
                this.setTag('error.stack', error.stack);
            }
        }
        return this;
    }
    /**
     * Get span context for creating child spans
     */
    getContext() {
        return { ...this.span.context };
    }
    /**
     * Finish the span
     */
    finish() {
        this.span.endTime = performance.now();
        this.span.durationMs = this.span.endTime - this.span.startTime;
        if (this.span.status === SpanStatus.UNSET) {
            this.span.status = SpanStatus.OK;
        }
        this.tracer.finishSpan(this.span);
    }
    /**
     * Get the underlying span
     */
    getSpan() {
        return this.span;
    }
}
// ==================== Distributed Tracer ====================
/**
 * Distributed tracing implementation
 */
export class DistributedTracer {
    activeSpans = new Map();
    completedTraces = new Map();
    samplingRate;
    maxTracesRetained;
    constructor(options = {}) {
        this.samplingRate = options.samplingRate ?? 1.0; // 100% by default
        this.maxTracesRetained = options.maxTracesRetained ?? 1000;
    }
    /**
     * Start a new trace
     */
    startTrace(operationName) {
        // Sampling decision
        if (Math.random() > this.samplingRate) {
            // Return a no-op span builder for sampled-out traces
            return this.createNoOpSpanBuilder();
        }
        const traceId = this.generateId();
        const spanId = this.generateId();
        const span = {
            context: { traceId, spanId },
            operationName,
            startTime: performance.now(),
            tags: {},
            logs: [],
            status: SpanStatus.UNSET,
        };
        this.activeSpans.set(spanId, span);
        return new SpanBuilder(this, span);
    }
    /**
     * Start a child span within an existing trace
     */
    startSpan(operationName, parentContext) {
        // Sampling decision based on trace
        if (Math.random() > this.samplingRate) {
            return this.createNoOpSpanBuilder();
        }
        const spanId = this.generateId();
        const span = {
            context: {
                traceId: parentContext.traceId,
                spanId,
                parentSpanId: parentContext.spanId,
            },
            operationName,
            startTime: performance.now(),
            tags: {},
            logs: [],
            status: SpanStatus.UNSET,
        };
        this.activeSpans.set(spanId, span);
        return new SpanBuilder(this, span);
    }
    /**
     * Finish a span (called by SpanBuilder)
     */
    finishSpan(span) {
        this.activeSpans.delete(span.context.spanId);
        // Add to completed traces
        const traceId = span.context.traceId;
        if (!this.completedTraces.has(traceId)) {
            this.completedTraces.set(traceId, []);
        }
        this.completedTraces.get(traceId).push(span);
        // Trim old traces if over limit
        if (this.completedTraces.size > this.maxTracesRetained) {
            const oldestTraceId = this.completedTraces.keys().next().value;
            if (oldestTraceId) {
                this.completedTraces.delete(oldestTraceId);
            }
        }
    }
    /**
     * Set a tag on an active span
     */
    setTag(context, key, value) {
        const span = this.activeSpans.get(context.spanId);
        if (span) {
            span.tags[key] = value;
        }
    }
    /**
     * Add a log to an active span
     */
    log(context, message, fields) {
        const span = this.activeSpans.get(context.spanId);
        if (span) {
            span.logs.push({
                timestamp: Date.now(),
                message,
                fields,
            });
        }
    }
    /**
     * Get a completed trace by ID
     */
    getTrace(traceId) {
        return this.completedTraces.get(traceId);
    }
    /**
     * Export a trace in Jaeger-compatible format
     */
    exportTrace(traceId) {
        const spans = this.completedTraces.get(traceId);
        if (!spans || spans.length === 0)
            return null;
        // Calculate total duration
        const startTimes = spans.map(s => s.startTime);
        const endTimes = spans.map(s => s.endTime || s.startTime);
        const totalDuration = Math.max(...endTimes) - Math.min(...startTimes);
        return {
            traceId,
            spans: spans.map(span => ({
                spanId: span.context.spanId,
                parentSpanId: span.context.parentSpanId,
                operationName: span.operationName,
                startTime: span.startTime,
                durationMs: span.durationMs || 0,
                tags: span.tags,
                logs: span.logs,
                status: span.status,
            })),
            totalDurationMs: totalDuration,
            spanCount: spans.length,
        };
    }
    /**
     * Get all trace IDs
     */
    listTraces() {
        return Array.from(this.completedTraces.keys());
    }
    /**
     * Get tracer statistics
     */
    getStats() {
        let totalSpans = 0;
        for (const spans of this.completedTraces.values()) {
            totalSpans += spans.length;
        }
        return {
            activeSpans: this.activeSpans.size,
            completedTraces: this.completedTraces.size,
            totalSpans,
        };
    }
    /**
     * Clear all traces
     */
    clear() {
        this.activeSpans.clear();
        this.completedTraces.clear();
    }
    /**
     * Set sampling rate (0.0 to 1.0)
     */
    setSamplingRate(rate) {
        this.samplingRate = Math.max(0, Math.min(1, rate));
    }
    /**
     * Get current sampling rate
     */
    getSamplingRate() {
        return this.samplingRate;
    }
    /**
     * Generate a unique ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 18);
    }
    /**
     * Create a no-op span builder for sampled-out traces
     */
    createNoOpSpanBuilder() {
        const noOpSpan = {
            context: { traceId: 'noop', spanId: 'noop' },
            operationName: 'noop',
            startTime: 0,
            tags: {},
            logs: [],
            status: SpanStatus.UNSET,
        };
        const noOpBuilder = new SpanBuilder({
            finishSpan: () => { },
        }, noOpSpan);
        return noOpBuilder;
    }
}
// ==================== Global Instance ====================
/**
 * Global tracer instance
 */
export const tracer = new DistributedTracer();
// ==================== Utility Functions ====================
/**
 * Execute a function with tracing
 */
export async function withTrace(operationName, fn, parentContext) {
    const span = parentContext
        ? tracer.startSpan(operationName, parentContext)
        : tracer.startTrace(operationName);
    try {
        const result = await fn(span);
        span.setOk();
        return result;
    }
    catch (error) {
        span.setError(error);
        // INTENTIONAL: transparent rethrow - tracing wrapper should not modify errors
        throw error;
    }
    finally {
        span.finish();
    }
}
/**
 * Execute a sync function with tracing
 */
export function withTraceSync(operationName, fn, parentContext) {
    const span = parentContext
        ? tracer.startSpan(operationName, parentContext)
        : tracer.startTrace(operationName);
    try {
        const result = fn(span);
        span.setOk();
        return result;
    }
    catch (error) {
        span.setError(error);
        // INTENTIONAL: transparent rethrow - tracing wrapper should not modify errors
        throw error;
    }
    finally {
        span.finish();
    }
}
/**
 * Create a span context from trace/span IDs
 */
export function createSpanContext(traceId, spanId, parentSpanId) {
    return { traceId, spanId, parentSpanId };
}
/**
 * Serialize span context to header value
 */
export function serializeSpanContext(context) {
    return `${context.traceId}:${context.spanId}:${context.parentSpanId || ''}`;
}
/**
 * Deserialize span context from header value
 */
export function deserializeSpanContext(value) {
    const parts = value.split(':');
    if (parts.length < 2)
        return null;
    return {
        traceId: parts[0],
        spanId: parts[1],
        parentSpanId: parts[2] || undefined,
    };
}
//# sourceMappingURL=tracer.js.map