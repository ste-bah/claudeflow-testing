/**
 * Observability Module
 * TASK-OBS-001 - Observability Stack
 *
 * Provides three-pillar observability:
 * - Metrics: Prometheus-style counters, gauges, histograms
 * - Logging: Structured JSON logging with correlation IDs
 * - Tracing: Distributed tracing with span hierarchy
 */
export { MetricType, type MetricLabels, type MetricValue, type PercentileResult, Metric, Counter, Gauge, Histogram, Summary, MetricsCollector, metricsCollector, METRICS, } from './metrics.js';
export { LogLevel, LogLevelNames, parseLogLevel, type LogContext, type LogEntry, type LogHandler, ConsoleLogHandler, MemoryLogHandler, SilentLogHandler, StructuredLogger, StructuredLogger as Logger, // Alias for backwards compatibility
logger, createComponentLogger, generateRequestId, generateCorrelationId, } from './logger.js';
export { type SpanContext, type SpanLog, type SpanTags, SpanStatus, type Span, type TraceExport, type TraceStats, SpanBuilder, DistributedTracer, tracer, withTrace, withTraceSync, createSpanContext, serializeSpanContext, deserializeSpanContext, } from './tracer.js';
export { type InstrumentedOptions, type TimedOptions, type LoggedOptions, type TracedOptions, Instrumented, Timed, Logged, Traced, Counted, } from './decorators.js';
//# sourceMappingURL=index.d.ts.map