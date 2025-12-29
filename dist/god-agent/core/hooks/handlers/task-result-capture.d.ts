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
/**
 * Captured result metadata
 */
export interface ICapturedResult {
    /** Name of the tool that was executed */
    toolName: string;
    /** Output returned from the tool execution */
    toolOutput: unknown;
    /** Timestamp when result was captured */
    timestamp: number;
    /** Whether the tool execution was successful */
    executionSuccess?: boolean;
    /** Duration of tool execution in milliseconds */
    durationMs?: number;
}
/**
 * Get captured result for a trajectory
 *
 * @param trajectoryId - The trajectory ID to look up
 * @returns The captured result if found, undefined otherwise
 */
export declare function getCapturedResult(trajectoryId: string): ICapturedResult | undefined;
/**
 * Check if a captured result exists for a trajectory
 *
 * @param trajectoryId - The trajectory ID to check
 * @returns True if a result exists
 */
export declare function hasCapturedResult(trajectoryId: string): boolean;
/**
 * Get count of captured results
 *
 * @returns Number of captured results in storage
 */
export declare function getCapturedResultCount(): number;
/**
 * Get all trajectory IDs with captured results
 *
 * @returns Array of trajectory IDs
 */
export declare function getCapturedTrajectoryIds(): string[];
/**
 * Clear a specific captured result
 *
 * @param trajectoryId - The trajectory ID to clear
 * @returns True if result was cleared, false if not found
 */
export declare function clearCapturedResult(trajectoryId: string): boolean;
/**
 * Clear captured results (for testing)
 * WARNING: Only for testing purposes
 */
export declare function _clearCapturedResultsForTesting(): void;
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
export declare function registerTaskResultCaptureHook(): void;
//# sourceMappingURL=task-result-capture.d.ts.map