/**
 * Service Registry - Central hub for IPC service management
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Manages registration, discovery, and invocation of God Agent services
 * via JSON-RPC 2.0 protocol.
 */
import { RpcErrorCode, type JsonRpcError } from './protocol-types.js';
/**
 * Method handler function type
 */
export type ServiceMethod<T = unknown, R = unknown> = (params: T) => Promise<R>;
/**
 * Service handler containing method implementations
 */
export interface ServiceHandler {
    readonly methods: Map<string, ServiceMethod>;
}
/**
 * Service metrics for performance monitoring
 */
export interface ServiceMetrics {
    readonly callCount: number;
    readonly errorCount: number;
    readonly totalDurationMs: number;
    readonly avgDurationMs: number;
    readonly lastCalledAt: number | null;
}
/**
 * Registry-wide metrics
 */
export interface RegistryMetrics {
    readonly totalCalls: number;
    readonly totalErrors: number;
    readonly servicesRegistered: number;
    readonly uptimeMs: number;
    readonly serviceMetrics: Map<string, ServiceMetrics>;
}
/**
 * Service call result with timing info
 */
export interface ServiceCallResult<T = unknown> {
    readonly result: T;
    readonly durationMs: number;
    readonly serviceName: string;
    readonly methodName: string;
}
/**
 * Error thrown when service operations fail
 */
export declare class ServiceRegistryError extends Error {
    readonly code: RpcErrorCode;
    readonly serviceName?: string | undefined;
    readonly methodName?: string | undefined;
    constructor(message: string, code: RpcErrorCode, serviceName?: string | undefined, methodName?: string | undefined);
    toRpcError(): JsonRpcError;
}
/**
 * ServiceRegistry - Central service management for IPC
 *
 * Provides service registration, discovery, and method invocation
 * with built-in metrics tracking and error handling.
 */
export declare class ServiceRegistry {
    private readonly services;
    private readonly metrics;
    private readonly startTime;
    private totalCalls;
    private totalErrors;
    /**
     * Register a service with the registry
     * @param name - Unique service name (e.g., 'search', 'vector', 'graph')
     * @param handler - Service handler with methods map
     * @throws ServiceRegistryError if service name is empty or already registered
     */
    registerService(name: string, handler: ServiceHandler): void;
    /**
     * Retrieve a service handler by name
     * @param name - Service name
     * @returns Service handler or undefined if not found
     */
    getService(name: string): ServiceHandler | undefined;
    /**
     * List all registered service names
     * @returns Array of service names
     */
    listServices(): string[];
    /**
     * Check if a service is registered
     * @param name - Service name
     * @returns True if service exists
     */
    hasService(name: string): boolean;
    /**
     * Unregister a service
     * @param name - Service name to remove
     * @returns True if service was removed, false if not found
     */
    unregisterService(name: string): boolean;
    /**
     * Call a method on a registered service
     * @param serviceName - Name of the service
     * @param method - Method name to invoke
     * @param params - Parameters to pass to the method
     * @returns Promise resolving to the method result
     * @throws ServiceRegistryError if service/method not found or execution fails
     */
    callService<T = unknown, R = unknown>(serviceName: string, method: string, params: T): Promise<R>;
    /**
     * Call a service method and return result with timing info
     * @param serviceName - Name of the service
     * @param method - Method name to invoke
     * @param params - Parameters to pass to the method
     * @returns Promise resolving to result with metadata
     */
    callServiceWithMetrics<T = unknown, R = unknown>(serviceName: string, method: string, params: T): Promise<ServiceCallResult<R>>;
    /**
     * Get metrics for a specific service
     * @param name - Service name
     * @returns Service metrics or undefined if not found
     */
    getServiceMetrics(name: string): ServiceMetrics | undefined;
    /**
     * Get registry-wide metrics
     * @returns Registry metrics including all service stats
     */
    getMetrics(): RegistryMetrics;
    /**
     * Reset all metrics
     */
    resetMetrics(): void;
    /**
     * Clear all registered services
     */
    clear(): void;
    /**
     * Get the number of registered services
     */
    get size(): number;
}
/**
 * Create a service handler from a method map
 * Helper function for creating service adapters
 *
 * Accepts methods with typed parameters and wraps them for ServiceHandler compatibility.
 * Each method function should handle its own parameter validation.
 */
export declare function createServiceHandler(methods: Record<string, (params: any) => Promise<unknown>>): ServiceHandler;
/**
 * Check if an error is a ServiceRegistryError
 */
export declare function isServiceRegistryError(error: unknown): error is ServiceRegistryError;
//# sourceMappingURL=service-registry.d.ts.map