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
import { ServiceError } from '../errors.js';
// JSON-RPC error codes
const ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603
};
// ============================================================================
// Context Service
// ============================================================================
export class ContextService {
    tokenEstimator;
    compositionEngine;
    constructor(tokenEstimator, compositionEngine) {
        this.tokenEstimator = tokenEstimator ?? new TokenEstimationService();
        this.compositionEngine = compositionEngine ?? new ContextCompositionEngine();
    }
    /**
     * Handle JSON-RPC 2.0 request
     */
    async handleRequest(request) {
        const { method, params, id } = request;
        try {
            // Validate JSON-RPC version
            if (request.jsonrpc !== '2.0') {
                return this.errorResponse(ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC version', id);
            }
            // Route to method handler
            let result;
            switch (method) {
                case 'context.estimate':
                    result = await this.handleEstimate(params);
                    break;
                case 'context.archive':
                    result = await this.handleArchive(params);
                    break;
                case 'context.build':
                    result = await this.handleBuild(params);
                    break;
                case 'context.initSession':
                    result = await this.handleInitSession(params);
                    break;
                default:
                    return this.errorResponse(ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, id);
            }
            return this.successResponse(result, id);
        }
        catch (error) {
            return this.handleError(error, id);
        }
    }
    /**
     * Handle context.estimate method
     * Estimate token count for text with optional hints
     */
    async handleEstimate(params) {
        if (!this.isEstimateParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { text: string, hints?: object }');
        }
        const { text, hints } = params;
        return this.tokenEstimator.estimate(text, hints);
    }
    /**
     * Handle context.archive method
     * Archive agent output to rolling window
     */
    async handleArchive(params) {
        if (!this.isArchiveParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { agentId, content, tokenCount, phase, metadata? }');
        }
        const { agentId, content, tokenCount, phase, metadata } = params;
        // Update phase first if different
        if (phase) {
            this.compositionEngine.setPhase(phase);
        }
        // Add to rolling window (automatically archives when window is full)
        this.compositionEngine.addToWindow(agentId, content, tokenCount);
        return {
            success: true,
            archived: agentId
        };
    }
    /**
     * Handle context.build method
     * Build composed context for agent
     */
    async handleBuild(params) {
        if (!this.isBuildParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { targetAgent?, contextWindow, phase, includeDependencies?, maxDescPrior? }');
        }
        const options = {
            targetAgent: params.targetAgent,
            contextWindow: params.contextWindow,
            phase: params.phase,
            includeDependencies: params.includeDependencies ?? true,
            maxDescPrior: params.maxDescPrior ?? 2
        };
        return this.compositionEngine.compose(options);
    }
    /**
     * Handle context.initSession method
     * Initialize session state for a new conversation
     */
    async handleInitSession(params) {
        if (!this.isInitSessionParams(params)) {
            throw new ServiceError(ERROR_CODES.INVALID_PARAMS, 'Invalid params: expected { sessionId: string, projectPath?: string, timestamp?: number, config?: object }');
        }
        const { sessionId, projectPath, config } = params;
        // Configure composition engine with session settings if provided
        if (config?.rollingWindowSize) {
            // The composition engine handles rolling window internally
            // This is a placeholder for future session-specific configuration
        }
        // Reset composition engine state for new session
        this.compositionEngine.setPhase('init');
        return {
            success: true,
            sessionId,
            initialized: true
        };
    }
    // ============================================================================
    // Type Guards
    // ============================================================================
    isEstimateParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return typeof p.text === 'string';
    }
    isArchiveParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return (typeof p.agentId === 'string' &&
            typeof p.content === 'string' &&
            typeof p.tokenCount === 'number' &&
            typeof p.phase === 'string');
    }
    isBuildParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return (typeof p.contextWindow === 'number' &&
            typeof p.phase === 'string');
    }
    isInitSessionParams(params) {
        if (!params || typeof params !== 'object')
            return false;
        const p = params;
        return typeof p.sessionId === 'string';
    }
    // ============================================================================
    // Response Helpers
    // ============================================================================
    successResponse(result, id) {
        return {
            jsonrpc: '2.0',
            result,
            id
        };
    }
    errorResponse(code, message, id, data) {
        return {
            jsonrpc: '2.0',
            error: { code, message, data },
            id
        };
    }
    handleError(error, id) {
        if (error instanceof ServiceError) {
            return this.errorResponse(Number(error.code) || ERROR_CODES.INTERNAL_ERROR, error.message, id, error.details);
        }
        const message = error instanceof Error ? error.message : 'Internal error';
        return this.errorResponse(ERROR_CODES.INTERNAL_ERROR, message, id);
    }
}
//# sourceMappingURL=context-service.js.map