/**
 * Instrumentation Decorators
 * TASK-OBS-001 - Observability Stack
 *
 * Provides TypeScript decorators for automatic instrumentation:
 * - @Instrumented: Automatic metrics and tracing
 * - @Timed: Measure execution time
 * - @Logged: Automatic logging
 * - @Traced: Automatic span creation
 *
 * NOTE: All rethrows in decorators are INTENTIONAL transparent rethrows.
 * Decorators wrap methods to provide observability but should NOT modify
 * error behavior - errors must bubble up unchanged to preserve stack traces
 * and allow proper error handling by the wrapped method's caller.
 */
import { type MetricLabels } from './metrics.js';
/**
 * Instrumentation options
 */
export interface InstrumentedOptions {
    /** Metric name to record (optional) */
    metricName?: string;
    /** Static labels to add to metrics */
    labels?: MetricLabels;
    /** Whether to enable tracing (default: true) */
    tracing?: boolean;
    /** Whether to enable logging (default: true) */
    logging?: boolean;
    /** Log level for success (default: 'debug') */
    successLogLevel?: 'debug' | 'info';
    /** Log level for errors (default: 'error') */
    errorLogLevel?: 'error' | 'warn';
}
/**
 * Timed decorator options
 */
export interface TimedOptions {
    /** Histogram metric name */
    metricName: string;
    /** Static labels */
    labels?: MetricLabels;
    /** Buckets for histogram */
    buckets?: number[];
}
/**
 * Logged decorator options
 */
export interface LoggedOptions {
    /** Component name for log context */
    component?: string;
    /** Log level for entry (default: 'debug') */
    entryLevel?: 'debug' | 'info';
    /** Log level for exit (default: 'debug') */
    exitLevel?: 'debug' | 'info';
    /** Whether to log arguments (default: false) */
    logArgs?: boolean;
    /** Whether to log result (default: false) */
    logResult?: boolean;
}
/**
 * Traced decorator options
 */
export interface TracedOptions {
    /** Operation name (default: method name) */
    operationName?: string;
    /** Static tags to add to span */
    tags?: Record<string, string | number | boolean>;
}
/**
 * @Instrumented decorator
 *
 * Automatically instruments a method with:
 * - Metrics recording (latency histogram)
 * - Distributed tracing
 * - Structured logging
 *
 * @example
 * class MyService {
 *   @Instrumented({ metricName: 'my_operation_seconds' })
 *   async doWork(): Promise<void> { ... }
 * }
 */
export declare function Instrumented(options?: InstrumentedOptions): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * @Timed decorator
 *
 * Records execution time to a histogram metric.
 *
 * @example
 * class MyService {
 *   @Timed({ metricName: 'operation_duration_seconds' })
 *   async doWork(): Promise<void> { ... }
 * }
 */
export declare function Timed(options: TimedOptions): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * @Logged decorator
 *
 * Automatically logs method entry and exit.
 *
 * @example
 * class MyService {
 *   @Logged({ component: 'MyService' })
 *   async doWork(input: string): Promise<void> { ... }
 * }
 */
export declare function Logged(options?: LoggedOptions): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * @Traced decorator
 *
 * Automatically creates a span for the method execution.
 *
 * @example
 * class MyService {
 *   @Traced({ operationName: 'custom_operation' })
 *   async doWork(): Promise<void> { ... }
 * }
 */
export declare function Traced(options?: TracedOptions): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * @Counted decorator
 *
 * Increments a counter on method execution.
 *
 * @example
 * class MyService {
 *   @Counted({ metricName: 'requests_total' })
 *   async handleRequest(): Promise<void> { ... }
 * }
 */
export declare function Counted(options: {
    metricName: string;
    labels?: MetricLabels;
}): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=decorators.d.ts.map