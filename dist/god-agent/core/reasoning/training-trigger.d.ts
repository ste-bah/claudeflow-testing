/**
 * TrainingTriggerController - Autonomic Training Trigger System
 *
 * Implements threshold-based triggers for GNN training:
 * 1. Sample Density: At least 50 new feedback pairs (COLD_START_THRESHOLD)
 * 2. Graceful Exit: During GodAgent.shutdown
 *
 * Features:
 * - Automatic training when sample threshold is reached
 * - Cooldown period to prevent excessive training
 * - Buffer persistence for restart recovery
 * - Stats and monitoring capabilities
 *
 * Implements: TASK-GNN-009
 * PRD: PRD-GOD-AGENT-001
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-028: All feedback persisted
 * - RULE-046: Atomic operations
 * - RULE-079: No magic numbers (uses COLD_START_THRESHOLD)
 *
 * @module src/god-agent/core/reasoning/training-trigger
 */
import type { GNNTrainer, EpochResult } from './gnn-trainer.js';
import type { ITrajectoryWithFeedback } from './contrastive-loss.js';
/**
 * Configuration for TrainingTriggerController
 * Implements: TASK-GNN-009 specification
 */
export interface TriggerConfig {
    /** Minimum samples before training triggers (default: COLD_START_THRESHOLD = 50) */
    minSamples: number;
    /** Cooldown period between training runs in milliseconds (default: 300000 = 5 minutes) */
    cooldownMs: number;
    /** Maximum pending samples before force-triggering (default: 500) */
    maxPendingSamples: number;
    /** Enable buffer persistence to disk (default: true) */
    enablePersistence: boolean;
    /** Directory for buffer persistence (default: '.agentdb/training') */
    persistenceDir: string;
    /** Auto-trigger check interval in milliseconds (default: 60000 = 1 minute) */
    autoCheckIntervalMs: number;
}
/**
 * Statistics about training trigger state
 */
export interface TriggerStats {
    /** Number of trajectories in the buffer */
    bufferSize: number;
    /** Samples until next training trigger */
    samplesToNextTrigger: number;
    /** Time until cooldown expires (0 if not in cooldown) */
    cooldownRemainingMs: number;
    /** Whether currently in cooldown period */
    inCooldown: boolean;
    /** Total training runs since creation */
    totalTrainingRuns: number;
    /** Last training timestamp (0 if never trained) */
    lastTrainingTime: number;
    /** Total trajectories processed since creation */
    totalTrajectoriesProcessed: number;
    /** Average training loss from last run */
    lastTrainingLoss: number;
    /** Whether training is currently in progress */
    trainingInProgress: boolean;
}
/**
 * Result from a training trigger attempt
 */
export interface TriggerResult {
    /** Whether training was triggered */
    triggered: boolean;
    /** Reason for trigger/no-trigger */
    reason: string;
    /** Training results if triggered */
    epochResults?: EpochResult[];
    /** Final loss after training */
    finalLoss?: number;
    /** Training duration in milliseconds */
    trainingDurationMs?: number;
}
/**
 * TrainingTriggerController - Autonomic trigger system for GNN training
 *
 * Monitors incoming feedback trajectories and triggers training when:
 * 1. Buffer reaches minSamples (default: 50 per COLD_START_THRESHOLD)
 * 2. Buffer exceeds maxPendingSamples (force trigger)
 * 3. forceTraining() is called (e.g., during shutdown)
 *
 * Implements cooldown period to prevent excessive training.
 *
 * Implements: TASK-GNN-009
 *
 * @example
 * ```typescript
 * const trigger = new TrainingTriggerController(trainer, {
 *   minSamples: 50,
 *   cooldownMs: 300000
 * });
 *
 * // Add trajectories as feedback comes in
 * trigger.addTrajectory(trajectory);
 *
 * // Check if training should happen
 * if (trigger.shouldTrigger()) {
 *   await trigger.checkAndTrain();
 * }
 *
 * // Force training on shutdown
 * await trigger.forceTraining();
 * ```
 */
export declare class TrainingTriggerController {
    private readonly config;
    private readonly trainer;
    private trajectoryBuffer;
    private lastTrainingTime;
    private totalTrainingRuns;
    private totalTrajectoriesProcessed;
    private lastTrainingLoss;
    private trainingInProgress;
    private autoCheckTimer?;
    /**
     * Create a new TrainingTriggerController
     *
     * @param trainer - GNNTrainer instance for executing training
     * @param config - Optional configuration overrides
     */
    constructor(trainer: GNNTrainer, config?: Partial<TriggerConfig>);
    /**
     * Add a trajectory to the buffer
     *
     * Implements: AC-001 (training triggers at 50 samples)
     *
     * @param trajectory - Trajectory with quality feedback to add
     */
    addTrajectory(trajectory: ITrajectoryWithFeedback): void;
    /**
     * Check if training should trigger based on current state
     *
     * Implements: AC-001, AC-002
     *
     * @returns true if training should be triggered
     */
    shouldTrigger(): boolean;
    /**
     * Check conditions and run training if appropriate
     *
     * Implements: AC-001, AC-002
     *
     * @returns Result indicating whether training was triggered and outcomes
     */
    checkAndTrain(): Promise<TriggerResult>;
    /**
     * Force training regardless of thresholds (for shutdown)
     *
     * Implements: AC-003 (shutdown triggers final training epoch)
     */
    forceTraining(): Promise<TriggerResult>;
    /**
     * Get current trigger statistics
     *
     * Implements: AC-005 (stats available for monitoring)
     *
     * @returns Current trigger state statistics
     */
    getStats(): TriggerStats;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<TriggerConfig>;
    /**
     * Get current buffer size
     */
    getBufferSize(): number;
    /**
     * Clear the trajectory buffer
     */
    clearBuffer(): void;
    /**
     * Stop the auto-check timer and cleanup
     */
    destroy(): void;
    /**
     * Execute training with the current buffer
     *
     * @param triggerType - Type of trigger ('threshold' or 'force')
     * @returns Training result
     */
    private executeTraining;
    /**
     * Create a training dataset from the buffer
     */
    private createTrainingDataset;
    /**
     * Compute centroid of embeddings
     */
    private computeCentroid;
    /**
     * Start auto-check timer
     */
    private startAutoCheck;
    /**
     * Persist buffer to disk for restart recovery
     *
     * Implements: AC-004 (buffer persists to disk)
     */
    private persistBufferToDisk;
    /**
     * Load buffer from disk on startup
     *
     * Implements: AC-004 (buffer persists for restart recovery)
     */
    private loadBufferFromDisk;
    /**
     * Clear persisted buffer from disk
     */
    private clearPersistedBuffer;
}
/**
 * Create a TrainingTriggerController with default configuration
 *
 * @param trainer - GNNTrainer instance
 * @param config - Optional configuration overrides
 * @returns Configured TrainingTriggerController
 */
export declare function createTrainingTriggerController(trainer: GNNTrainer, config?: Partial<TriggerConfig>): TrainingTriggerController;
//# sourceMappingURL=training-trigger.d.ts.map