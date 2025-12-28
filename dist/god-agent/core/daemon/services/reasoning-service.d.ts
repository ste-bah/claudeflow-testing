/**
 * Reasoning Service - IPC wrapper for ReasoningBank
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes reasoning operations via JSON-RPC 2.0
 */
import type { ReasoningBank } from '../../reasoning/reasoning-bank.js';
import { ReasoningMode } from '../../reasoning/reasoning-types.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * Reasoning service parameters
 */
export interface IReasoningReasonParams {
    query: number[];
    type?: ReasoningMode;
    maxResults?: number;
    confidenceThreshold?: number;
    minLScore?: number;
    enhanceWithGNN?: boolean;
}
export interface IReasoningFeedbackParams {
    trajectoryId: string;
    quality: number;
    outcome: 'success' | 'failure';
    userFeedback?: string;
}
/**
 * Create reasoning service handler
 *
 * @param reasoningBank - ReasoningBank instance
 * @returns Service handler with method map
 */
export declare function createReasoningService(reasoningBank: ReasoningBank): ServiceHandler;
//# sourceMappingURL=reasoning-service.d.ts.map