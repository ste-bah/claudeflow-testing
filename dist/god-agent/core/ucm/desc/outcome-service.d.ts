/**
 * IDESC-001: Intelligent DESC v2 - Outcome Service
 * TASK-IDESC-OUT-003: Build Outcome API Endpoints
 *
 * Implements: REQ-IDESC-001, AC-IDESC-003a
 *
 * Daemon service for outcome recording via IPC.
 * Exposes:
 * - desc.recordOutcome
 * - desc.getOutcomes
 * - desc.getEpisodeStats
 */
import type { ServiceHandler } from '../../daemon/service-registry.js';
import type { ErrorType } from '../types.js';
import { type IDatabaseConnection } from './outcome-tracker.js';
/**
 * Parameters for recordOutcome RPC method
 */
export interface IRecordOutcomeParams {
    episodeId: string;
    taskId: string;
    success: boolean;
    errorType?: ErrorType;
    details?: Record<string, unknown>;
}
/**
 * Parameters for getOutcomes RPC method
 */
export interface IGetOutcomesParams {
    episodeId: string;
}
/**
 * Parameters for getEpisodeStats RPC method
 */
export interface IGetEpisodeStatsParams {
    episodeId: string;
}
/**
 * Parameters for generateWarning RPC method
 */
export interface IGenerateWarningParams {
    episodeId: string;
}
/**
 * Create outcome service handler for daemon registration
 * Implements: AC-IDESC-003a
 *
 * @param db - Database connection
 * @returns ServiceHandler for registration with ServiceRegistry
 */
export declare function createOutcomeServiceHandler(db: IDatabaseConnection): ServiceHandler;
/**
 * Register outcome service with daemon
 *
 * @param registry - ServiceRegistry instance
 * @param db - Database connection
 */
export declare function registerOutcomeService(registry: {
    registerService: (name: string, handler: ServiceHandler) => void;
}, db: IDatabaseConnection): void;
//# sourceMappingURL=outcome-service.d.ts.map