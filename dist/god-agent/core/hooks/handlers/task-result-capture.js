/**
 * Task Result Capture Hook
 * TASK-HOOK-003
 *
 * Captures Task tool results and stores them for trajectory tracking.
 * This is a REQUIRED hook per CONSTITUTION RULE-032.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-033: Quality assessed on Task() result, NOT prompt
 * - RULE-036: Capture actual execution output
 */
import { registerPostToolUseHook, DEFAULT_PRIORITIES } from '../index.js';
import { createComponentLogger } from '../../observability/logger.js';
const logger = createComponentLogger('TaskResultCaptureHook');
// ============================================================================
// Result Storage
// ============================================================================
/** Storage for captured task results (keyed by trajectoryId) */
const capturedResults = new Map();
/**
 * Get captured result for a trajectory
 *
 * @param trajectoryId - The trajectory ID to look up
 * @returns The captured result if found, undefined otherwise
 */
export function getCapturedResult(trajectoryId) {
    return capturedResults.get(trajectoryId);
}
/**
 * Check if a captured result exists for a trajectory
 *
 * @param trajectoryId - The trajectory ID to check
 * @returns True if a result exists
 */
export function hasCapturedResult(trajectoryId) {
    return capturedResults.has(trajectoryId);
}
/**
 * Get count of captured results
 *
 * @returns Number of captured results in storage
 */
export function getCapturedResultCount() {
    return capturedResults.size;
}
/**
 * Get all trajectory IDs with captured results
 *
 * @returns Array of trajectory IDs
 */
export function getCapturedTrajectoryIds() {
    return Array.from(capturedResults.keys());
}
/**
 * Clear a specific captured result
 *
 * @param trajectoryId - The trajectory ID to clear
 * @returns True if result was cleared, false if not found
 */
export function clearCapturedResult(trajectoryId) {
    return capturedResults.delete(trajectoryId);
}
/**
 * Clear captured results (for testing)
 * WARNING: Only for testing purposes
 */
export function _clearCapturedResultsForTesting() {
    capturedResults.clear();
}
// ============================================================================
// Hook Registration
// ============================================================================
/**
 * Register the task-result-capture hook
 *
 * This hook captures Task tool execution results for trajectory tracking.
 * It stores results keyed by trajectoryId for later quality assessment.
 *
 * MUST be called before HookRegistry.initialize() per RULE-032.
 *
 * Hook details:
 * - ID: 'task-result-capture' (REQUIRED hook)
 * - Type: postToolUse
 * - Tool: Task (only triggers for Task tool)
 * - Priority: CAPTURE (40) - runs before quality assessment
 */
export function registerTaskResultCaptureHook() {
    registerPostToolUseHook({
        id: 'task-result-capture',
        toolName: 'Task', // Only trigger for Task tool
        priority: DEFAULT_PRIORITIES.CAPTURE, // Priority 40
        description: 'Captures Task tool results for trajectory tracking and quality assessment',
        handler: async (context) => {
            try {
                // Skip if no trajectory is active
                if (!context.trajectoryId) {
                    logger.debug('No active trajectory, skipping capture', {
                        toolName: context.toolName,
                        sessionId: context.sessionId
                    });
                    return { continue: true };
                }
                // Store the captured result
                const capturedResult = {
                    toolName: context.toolName,
                    toolOutput: context.toolOutput,
                    timestamp: context.timestamp,
                    executionSuccess: context.executionSuccess,
                    durationMs: context.executionDurationMs
                };
                capturedResults.set(context.trajectoryId, capturedResult);
                logger.info('Task result captured', {
                    trajectoryId: context.trajectoryId,
                    toolName: context.toolName,
                    executionSuccess: context.executionSuccess,
                    durationMs: context.executionDurationMs,
                    totalCaptured: capturedResults.size
                });
                return {
                    continue: true,
                    metadata: {
                        capturedAt: Date.now(),
                        trajectoryId: context.trajectoryId,
                        resultStored: true
                    }
                };
            }
            catch (error) {
                // Log but don't throw - hook errors shouldn't break the chain
                logger.error('Failed to capture task result', error, {
                    trajectoryId: context.trajectoryId,
                    toolName: context.toolName
                });
                return {
                    continue: true,
                    metadata: {
                        captureError: error instanceof Error ? error.message : String(error)
                    }
                };
            }
        }
    });
    logger.debug('Task result capture hook registered');
}
//# sourceMappingURL=task-result-capture.js.map