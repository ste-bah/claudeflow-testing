/**
 * DAI-003: Intelligent Task Routing - Confirmation Handler
 *
 * TASK-010: Confirmation Handler
 * Constitution: RULE-DAI-003-003 (Low confidence MUST require confirmation with graduated thresholds)
 *
 * Handles low-confidence routing decisions with user confirmation flow.
 * Implements graduated thresholds:
 * - >= 0.9: Auto-execute (no confirmation)
 * - 0.7-0.9: Show decision, 5s timeout, proceed automatically
 * - 0.5-0.7: REQUIRE explicit confirmation
 * - < 0.5: REQUIRE user selection from top 5 agents
 *
 * @module src/god-agent/core/routing/confirmation-handler
 */
import type { IConfirmationHandler, IConfirmationRequest, IConfirmationResponse, IRoutingResult, IRoutingConfig } from './routing-types.js';
/**
 * Confirmation handler configuration
 */
export interface IConfirmationHandlerConfig {
    /** Routing configuration (optional, uses defaults) */
    routingConfig?: Partial<IRoutingConfig>;
    /** Timeout for 'show' level in milliseconds (default: 5000) */
    showTimeoutMs?: number;
    /** Timeout for 'confirm' level in milliseconds (default: 0 = no timeout) */
    confirmTimeoutMs?: number;
    /** Timeout for 'select' level in milliseconds (default: 0 = no timeout) */
    selectTimeoutMs?: number;
    /** Callback when user overrides recommended agent */
    onUserOverride?: (routingId: string, originalAgent: string, selectedAgent: string) => void;
    /** Enable verbose logging */
    verbose?: boolean;
}
/**
 * Confirmation handler implementation
 * Handles low-confidence routing decisions with user confirmation
 */
export declare class ConfirmationHandler implements IConfirmationHandler {
    private readonly config;
    private readonly routingConfig;
    constructor(config?: IConfirmationHandlerConfig);
    /**
     * Request confirmation from user based on routing confidence
     */
    requestConfirmation(routing: IRoutingResult): Promise<IConfirmationResponse>;
    /**
     * Create confirmation request from routing result
     * Public for testing
     */
    createConfirmationRequest(routing: IRoutingResult): IConfirmationRequest;
    /**
     * Handle auto-execute level (confidence >= 0.9)
     * Execute immediately, no confirmation
     */
    private handleAutoLevel;
    /**
     * Handle show level (confidence 0.7-0.9)
     * Show message, wait for timeout, proceed automatically
     */
    private handleShowLevel;
    /**
     * Handle confirm level (confidence 0.5-0.7)
     * REQUIRE explicit confirmation or alternative selection
     */
    private handleConfirmLevel;
    /**
     * Handle select level (confidence < 0.5)
     * REQUIRE user to select from numbered list of options
     */
    private handleSelectLevel;
    /**
     * Format confirmation message based on routing result
     */
    private formatConfirmationMessage;
    /**
     * Get timeout duration for confirmation level
     */
    private getTimeoutForLevel;
    /**
     * Log user override for learning
     */
    private logUserOverride;
    /**
     * Process user response and return confirmation response
     * Public for testing - allows tests to simulate user input
     */
    processUserResponse(request: IConfirmationRequest, selectedKey: string): Promise<IConfirmationResponse>;
}
//# sourceMappingURL=confirmation-handler.d.ts.map