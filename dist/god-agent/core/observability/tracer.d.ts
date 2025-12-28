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
 * Span context containing trace and span IDs
 */
export interface SpanContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
}
/**
 * Span log entry
 */
export interface SpanLog {
    timestamp: number;
    message: string;
    fields?: Record<string, unknown>;
}
/**
 * Span tags
 */
export interface SpanTags {
    [key: string]: string | number | boolean;
}
/**
 * Span status
 */
export declare enum SpanStatus {
    UNSET = "unset",
    OK = "ok",
    ERROR = "error"
}
/**
 * Complete span information
 */
export interface Span {
    context: SpanContext;
    operationName: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    tags: SpanTags;
    logs: SpanLog[];
    status: SpanStatus;
}
/**
 * Trace export format (Jaeger-compatible)
 */
export interface TraceExport {
    traceId: string;
    spans: Array<{
        spanId: string;
        parentSpanId?: string;
        operationName: string;
        startTime: number;
        durationMs: number;
        tags: SpanTags;
        logs: SpanLog[];
        status: string;
    }>;
    totalDurationMs: number;
    spanCount: number;
}
/**
 * Trace statistics
 */
export interface TraceStats {
    activeSpans: number;
    completedTraces: number;
    totalSpans: number;
}
/**
 * Fluent builder for spans
 */
export declare class SpanBuilder {
    private span;
    private tracer;
    constructor(tracer: DistributedTracer, span: Span);
    /**
     * Set a tag on the span
     */
    setTag(key: string, value: string | number | boolean): SpanBuilder;
    /**
     * Add a log entry to the span
     */
    log(message: string, fields?: Record<string, unknown>): SpanBuilder;
    /**
     * Set span status to OK
     */
    setOk(): SpanBuilder;
    /**
     * Set span status to ERROR
     */
    setError(error?: Error | string): SpanBuilder;
    /**
     * Get span context for creating child spans
     */
    getContext(): SpanContext;
    /**
     * Finish the span
     */
    finish(): void;
    /**
     * Get the underlying span
     */
    getSpan(): Span;
}
/**
 * Distributed tracing implementation
 */
export declare class DistributedTracer {
    private activeSpans;
    private completedTraces;
    private samplingRate;
    private maxTracesRetained;
    constructor(options?: {
        samplingRate?: number;
        maxTracesRetained?: number;
    });
    /**
     * Start a new trace
     */
    startTrace(operationName: string): SpanBuilder;
    /**
     * Start a child span within an existing trace
     */
    startSpan(operationName: string, parentContext: SpanContext): SpanBuilder;
    /**
     * Finish a span (called by SpanBuilder)
     */
    finishSpan(span: Span): void;
    /**
     * Set a tag on an active span
     */
    setTag(context: SpanContext, key: string, value: string | number | boolean): void;
    /**
     * Add a log to an active span
     */
    log(context: SpanContext, message: string, fields?: Record<string, unknown>): void;
    /**
     * Get a completed trace by ID
     */
    getTrace(traceId: string): Span[] | undefined;
    /**
     * Export a trace in Jaeger-compatible format
     */
    exportTrace(traceId: string): TraceExport | null;
    /**
     * Get all trace IDs
     */
    listTraces(): string[];
    /**
     * Get tracer statistics
     */
    getStats(): TraceStats;
    /**
     * Clear all traces
     */
    clear(): void;
    /**
     * Set sampling rate (0.0 to 1.0)
     */
    setSamplingRate(rate: number): void;
    /**
     * Get current sampling rate
     */
    getSamplingRate(): number;
    /**
     * Generate a unique ID
     */
    private generateId;
    /**
     * Create a no-op span builder for sampled-out traces
     */
    private createNoOpSpanBuilder;
}
/**
 * Global tracer instance
 */
export declare const tracer: DistributedTracer;
/**
 * Execute a function with tracing
 */
export declare function withTrace<T>(operationName: string, fn: (span: SpanBuilder) => Promise<T>, parentContext?: SpanContext): Promise<T>;
/**
 * Execute a sync function with tracing
 */
export declare function withTraceSync<T>(operationName: string, fn: (span: SpanBuilder) => T, parentContext?: SpanContext): T;
/**
 * Create a span context from trace/span IDs
 */
export declare function createSpanContext(traceId: string, spanId: string, parentSpanId?: string): SpanContext;
/**
 * Serialize span context to header value
 */
export declare function serializeSpanContext(context: SpanContext): string;
/**
 * Deserialize span context from header value
 */
export declare function deserializeSpanContext(value: string): SpanContext | null;
//# sourceMappingURL=tracer.d.ts.map