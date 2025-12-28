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
import { createServiceHandler } from '../../daemon/service-registry.js';
import { OutcomeTracker } from './outcome-tracker.js';
/**
 * Create outcome service handler for daemon registration
 * Implements: AC-IDESC-003a
 *
 * @param db - Database connection
 * @returns ServiceHandler for registration with ServiceRegistry
 */
export function createOutcomeServiceHandler(db) {
    const outcomeTracker = new OutcomeTracker(db);
    return createServiceHandler({
        /**
         * Record an outcome for an episode
         * RPC Method: desc.recordOutcome
         *
         * @param params - Episode ID, task ID, success status, error details
         * @returns Outcome ID on success
         */
        'recordOutcome': async (params) => {
            const outcome = {
                episodeId: params.episodeId,
                taskId: params.taskId,
                success: params.success,
                errorType: params.errorType,
                details: params.details
            };
            return await outcomeTracker.recordOutcome(outcome);
        },
        /**
         * Get all outcomes for an episode
         * RPC Method: desc.getOutcomes
         *
         * @param params - Episode ID
         * @returns List of outcomes
         */
        'getOutcomes': async (params) => {
            return await outcomeTracker.getOutcomes(params.episodeId);
        },
        /**
         * Get episode statistics
         * RPC Method: desc.getEpisodeStats
         *
         * @param params - Episode ID
         * @returns Episode statistics
         */
        'getEpisodeStats': async (params) => {
            return await outcomeTracker.getEpisodeStats(params.episodeId);
        },
        /**
         * Get success rate for an episode
         * RPC Method: desc.getSuccessRate
         *
         * @param params - Episode ID
         * @returns Success rate (null if insufficient data)
         */
        'getSuccessRate': async (params) => {
            return await outcomeTracker.getSuccessRate(params.episodeId);
        },
        /**
         * Check if episode should trigger a warning
         * RPC Method: desc.shouldWarn
         *
         * @param params - Episode ID
         * @returns True if warning should be shown
         */
        'shouldWarn': async (params) => {
            return await outcomeTracker.shouldWarn(params.episodeId);
        },
        /**
         * Generate warning message for an episode
         * RPC Method: desc.generateWarning
         *
         * @param params - Episode ID
         * @returns Warning message or null
         */
        'generateWarning': async (params) => {
            return await outcomeTracker.generateWarning(params.episodeId);
        },
        /**
         * Get failure outcomes for an episode
         * RPC Method: desc.getFailures
         *
         * @param params - Episode ID and optional limit
         * @returns List of failure outcomes
         */
        'getFailures': async (params) => {
            return await outcomeTracker.getFailures(params.episodeId, params.limit);
        },
        /**
         * Get batch success rates for multiple episodes
         * RPC Method: desc.getBatchSuccessRates
         *
         * @param params - List of episode IDs
         * @returns Map of episode ID to success rate (serialized as array of tuples)
         */
        'getBatchSuccessRates': async (params) => {
            const rates = await outcomeTracker.getBatchSuccessRates(params.episodeIds);
            return Array.from(rates.entries());
        }
    });
}
/**
 * Register outcome service with daemon
 *
 * @param registry - ServiceRegistry instance
 * @param db - Database connection
 */
export function registerOutcomeService(registry, db) {
    const handler = createOutcomeServiceHandler(db);
    registry.registerService('outcome', handler);
}
//# sourceMappingURL=outcome-service.js.map