/**
 * Health Service (SVC-004)
 * JSON-RPC 2.0 service for UCM health monitoring and metrics
 *
 * METHODS:
 * - health.check: Basic health check
 * - health.metrics: Detailed system metrics
 *
 * CONSTITUTION RULES: RULE-051 to RULE-054 (performance tracking)
 */
import type { IEmbeddingProvider } from '../types.js';
interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: unknown;
    id: string | number | null;
}
interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: JsonRpcError;
    id: string | number | null;
}
interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}
export declare class HealthService {
    private startTime;
    private embeddingProvider;
    private metrics;
    private version;
    private embeddingEndpoint;
    private embeddingModel;
    private embeddingDimension;
    constructor(embeddingProvider?: IEmbeddingProvider);
    /**
     * Handle JSON-RPC 2.0 request
     */
    handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
    /**
     * Handle health.check method
     * Basic health check with service availability
     */
    private handleHealthCheck;
    /**
     * Handle health.metrics method
     * Detailed system metrics and performance statistics
     */
    private handleMetrics;
    /**
     * Record operation timing for metrics
     */
    recordOperation(type: 'tokenEstimation' | 'contextBuild' | 'descRetrieval' | 'recoveryCheck' | 'embedding', durationMs: number): void;
    /**
     * Increment counters
     */
    incrementCounter(type: 'episodeStored' | 'recovery'): void;
    /**
     * Set configuration values
     */
    setEmbeddingConfig(endpoint: string, model: string, dimension: number): void;
    private successResponse;
    private errorResponse;
    private handleError;
}
export {};
//# sourceMappingURL=health-service.d.ts.map