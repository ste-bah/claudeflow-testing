/**
 * Context Service (SVC-001)
 * JSON-RPC 2.0 service for UCM context operations
 *
 * METHODS:
 * - context.estimate: Estimate tokens for text
 * - context.archive: Archive agent output to rolling window
 * - context.build: Build composed context for agent
 *
 * CONSTITUTION RULES: RULE-051 to RULE-054
 */
import { TokenEstimationService } from '../token/token-estimation-service.js';
import { ContextCompositionEngine } from '../context/context-composition-engine.js';
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
export declare class ContextService {
    private tokenEstimator;
    private compositionEngine;
    constructor(tokenEstimator?: TokenEstimationService, compositionEngine?: ContextCompositionEngine);
    /**
     * Handle JSON-RPC 2.0 request
     */
    handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
    /**
     * Handle context.estimate method
     * Estimate token count for text with optional hints
     */
    private handleEstimate;
    /**
     * Handle context.archive method
     * Archive agent output to rolling window
     */
    private handleArchive;
    /**
     * Handle context.build method
     * Build composed context for agent
     */
    private handleBuild;
    private isEstimateParams;
    private isArchiveParams;
    private isBuildParams;
    private successResponse;
    private errorResponse;
    private handleError;
}
export {};
//# sourceMappingURL=context-service.d.ts.map