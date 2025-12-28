/**
 * Step Capture Service
 * SPEC-SON-001 - Captures reasoning steps during trajectory execution
 *
 * Production-ready implementation with:
 * - Thread-safe step buffer per trajectory
 * - Automatic result compression
 * - Configurable limits
 * - Memory-efficient storage
 */
import type { IReasoningStep, ReasoningStepAction, IStepCaptureConfig } from './sona-types.js';
/** Trajectory ID type */
export type TrajectoryID = string;
/**
 * Service for capturing reasoning steps during trajectory execution
 * Designed for production use with proper resource management
 */
export declare class StepCaptureService {
    private readonly config;
    private readonly stepBuffer;
    private currentTrajectory;
    constructor(config?: IStepCaptureConfig);
    /**
     * Begin capturing steps for a trajectory
     * @param trajectoryId - Unique trajectory identifier
     */
    beginCapture(trajectoryId: TrajectoryID): void;
    /**
     * Capture a reasoning step
     * @param step - Step data (without auto-generated fields)
     */
    captureStep(step: Omit<IReasoningStep, 'stepId' | 'timestamp'>): void;
    /**
     * Capture step with timing measurement
     * @param action - Action type
     * @param actionParams - Action parameters
     * @param executor - Async function to execute and time
     * @returns Result of executor
     */
    captureWithTiming<T>(action: ReasoningStepAction, actionParams: Record<string, unknown>, executor: () => Promise<T>): Promise<T>;
    /**
     * Finish capturing and return steps
     * @param trajectoryId - Trajectory to finalize
     * @returns Array of captured steps
     */
    endCapture(trajectoryId: TrajectoryID): IReasoningStep[];
    /**
     * Get captured steps for trajectory (without ending capture)
     * @param trajectoryId - Trajectory ID
     * @returns Current captured steps
     */
    getSteps(trajectoryId: TrajectoryID): IReasoningStep[];
    /**
     * Get current active trajectory
     */
    getCurrentTrajectory(): TrajectoryID | null;
    /**
     * Check if trajectory has active capture
     */
    hasActiveCapture(trajectoryId: TrajectoryID): boolean;
    /**
     * Get statistics about capture service
     */
    getStats(): {
        activeCaptures: number;
        currentTrajectory: TrajectoryID | null;
        totalStepsCaptured: number;
        totalTrajectories?: number;
    };
    /**
     * Clear all captures (for cleanup/testing)
     */
    clear(): void;
    /**
     * Estimate confidence from result
     */
    private estimateConfidence;
    /**
     * Serialize result to string for storage
     */
    private serializeResult;
}
export declare function getGlobalStepCapture(): StepCaptureService;
export declare function resetGlobalStepCapture(): void;
//# sourceMappingURL=step-capture-service.d.ts.map