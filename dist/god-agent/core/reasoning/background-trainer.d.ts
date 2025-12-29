/**
 * BackgroundTrainer - Non-blocking GNN Training Orchestrator
 *
 * Ensures training runs as a background process with zero latency impact
 * on the reasoning heart. Uses adaptive strategies:
 *
 * 1. Default (<100 samples): setImmediate yielding between batch steps
 * 2. Large batches (>=100 samples): Worker Thread for true parallelism
 * 3. Batched persistence: Only write weights after epoch completes
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-010
 *
 * PERFORMANCE REQUIREMENTS:
 * - AC-001: Training doesn't block main event loop
 * - AC-002: Latency impact < 10ms on reasoning operations
 * - AC-003: Worker thread option for large batches
 * - AC-004: Progress events emitted during training
 * - AC-005: Can be cancelled if needed
 *
 * @module src/god-agent/core/reasoning/background-trainer
 */
import { EventEmitter } from 'events';
import type { GNNTrainer, TrainingResult, EpochResult } from './gnn-trainer.js';
import type { ITrajectoryWithFeedback } from './contrastive-loss.js';
/**
 * Configuration for BackgroundTrainer
 * Implements: TASK-GNN-010 specification
 */
export interface BackgroundTrainerConfig {
    /** Use Worker Thread for training (default: false, auto-enabled at threshold) */
    useWorkerThread: boolean;
    /** Batch size threshold to switch to worker thread (default: 100) */
    workerThreshold: number;
    /** Yield interval - yield every N items when using setImmediate (default: 10) */
    yieldInterval: number;
    /** Progress update interval in milliseconds (default: 100) */
    progressUpdateIntervalMs: number;
    /** Maximum training time in milliseconds before auto-cancel (default: 300000 = 5 min) */
    maxTrainingTimeMs: number;
    /** Enable detailed progress tracking (default: true) */
    detailedProgress: boolean;
}
/**
 * Training progress information
 */
export interface TrainingProgress {
    /** Current phase: 'preparing' | 'training' | 'persisting' | 'complete' | 'cancelled' | 'error' */
    phase: TrainingPhase;
    /** Current epoch (1-indexed) */
    currentEpoch: number;
    /** Total epochs planned */
    totalEpochs: number;
    /** Current batch within epoch (1-indexed) */
    currentBatch: number;
    /** Total batches in current epoch */
    totalBatches: number;
    /** Percentage complete [0, 100] */
    percentComplete: number;
    /** Elapsed time in milliseconds */
    elapsedMs: number;
    /** Estimated time remaining in milliseconds */
    estimatedRemainingMs: number;
    /** Current loss value */
    currentLoss: number;
    /** Best loss seen so far */
    bestLoss: number;
    /** Number of samples processed */
    samplesProcessed: number;
    /** Total samples to process */
    totalSamples: number;
    /** Whether using worker thread */
    usingWorker: boolean;
}
/**
 * Training phase enumeration
 */
export type TrainingPhase = 'idle' | 'preparing' | 'training' | 'persisting' | 'complete' | 'cancelled' | 'error';
/**
 * Result from background training
 */
export interface BackgroundTrainingResult {
    /** Whether training completed successfully */
    success: boolean;
    /** Epoch results (if completed) */
    epochResults: EpochResult[];
    /** Final progress state */
    progress: TrainingProgress;
    /** Error message if failed */
    error?: string;
    /** Total training time in milliseconds */
    totalTimeMs: number;
    /** Whether training was cancelled */
    cancelled: boolean;
    /** Strategy used: 'setImmediate' | 'worker' */
    strategy: 'setImmediate' | 'worker';
}
/**
 * Event types emitted by BackgroundTrainer
 */
export interface BackgroundTrainerEvents {
    progress: (progress: TrainingProgress) => void;
    complete: (result: BackgroundTrainingResult) => void;
    error: (error: Error) => void;
    epochComplete: (epochResult: EpochResult) => void;
    batchComplete: (batchResult: TrainingResult) => void;
}
/**
 * Message types for Worker Thread communication
 */
export interface WorkerMessage {
    type: 'start' | 'cancel' | 'progress' | 'complete' | 'error' | 'batch' | 'epoch';
    payload?: unknown;
}
/**
 * BackgroundTrainer - Orchestrates non-blocking GNN training
 *
 * This class wraps GNNTrainer to provide background execution that doesn't
 * block the main event loop. It automatically selects the best strategy
 * based on batch size:
 *
 * - Small batches (<100): Uses setImmediate for cooperative multitasking
 * - Large batches (>=100): Uses Worker Thread for true parallelism
 *
 * Implements: TASK-GNN-010
 *
 * @example
 * ```typescript
 * const bgTrainer = new BackgroundTrainer(gnnTrainer, {
 *   workerThreshold: 100,
 *   yieldInterval: 10
 * });
 *
 * bgTrainer.on('progress', (progress) => {
 *   console.log(`Training ${progress.percentComplete}% complete`);
 * });
 *
 * const result = await bgTrainer.trainInBackground(trajectories);
 * console.log(`Training completed: ${result.success}`);
 * ```
 */
export declare class BackgroundTrainer extends EventEmitter {
    private readonly config;
    private readonly trainer;
    private isTraining;
    private isCancelled;
    private worker;
    private startTime;
    private currentProgress;
    private batchResults;
    private epochResults;
    /**
     * Create a new BackgroundTrainer
     *
     * @param trainer - GNNTrainer instance to wrap
     * @param config - Optional configuration
     */
    constructor(trainer: GNNTrainer, config?: Partial<BackgroundTrainerConfig>);
    /**
     * Run training in background
     *
     * Automatically selects the best strategy based on batch size:
     * - setImmediate yielding for small batches
     * - Worker Thread for large batches
     *
     * Implements: AC-001 (non-blocking), AC-002 (<10ms latency impact)
     *
     * @param trajectories - Trajectories with quality feedback to train on
     * @returns Promise resolving to training result
     */
    trainInBackground(trajectories: ITrajectoryWithFeedback[]): Promise<BackgroundTrainingResult>;
    /**
     * Cancel running training
     *
     * Implements: AC-005 (Can be cancelled)
     */
    cancel(): void;
    /**
     * Get current training progress
     *
     * @returns Current progress or idle state
     */
    getProgress(): TrainingProgress;
    /**
     * Check if training is in progress
     */
    isRunning(): boolean;
    /**
     * Get configuration
     */
    getConfig(): Readonly<BackgroundTrainerConfig>;
    on<K extends keyof BackgroundTrainerEvents>(event: K, listener: BackgroundTrainerEvents[K]): this;
    emit<K extends keyof BackgroundTrainerEvents>(event: K, ...args: Parameters<BackgroundTrainerEvents[K]>): boolean;
    /**
     * Train using setImmediate yielding for cooperative multitasking
     *
     * This approach yields control back to the event loop every N items,
     * ensuring the main thread remains responsive.
     *
     * Implements: AC-001, AC-002
     */
    private trainWithSetImmediate;
    /**
     * Train using Worker Thread for true parallelism
     *
     * This approach offloads training to a separate thread, ensuring
     * zero blocking of the main event loop.
     *
     * Implements: AC-003
     */
    private trainWithWorker;
    /**
     * Get worker script path
     */
    private getWorkerPath;
    /**
     * Serialize trajectories for worker thread transfer
     */
    private serializeTrajectories;
    /**
     * Handle progress update from worker
     */
    private handleWorkerProgress;
    /**
     * Handle batch complete from worker
     */
    private handleWorkerBatch;
    /**
     * Handle epoch complete from worker
     */
    private handleWorkerEpoch;
    /**
     * Handle worker completion
     */
    private handleWorkerComplete;
    /**
     * Yield control back to the event loop using setImmediate
     *
     * This ensures the main thread remains responsive during training.
     * Implements: AC-001, AC-002
     */
    private yieldToEventLoop;
    /**
     * Create batches from array
     */
    private createBatches;
    /**
     * Update progress and emit event
     */
    private updateProgress;
    /**
     * Create initial progress state
     */
    private createInitialProgress;
    /**
     * Create empty result for zero-sample case
     */
    private createEmptyResult;
    /**
     * Compute average gradient norm from batch results
     */
    private computeAvgGradientNorm;
}
/**
 * Create a BackgroundTrainer with default configuration
 *
 * @param trainer - GNNTrainer instance
 * @param config - Optional configuration
 * @returns BackgroundTrainer instance
 */
export declare function createBackgroundTrainer(trainer: GNNTrainer, config?: Partial<BackgroundTrainerConfig>): BackgroundTrainer;
//# sourceMappingURL=background-trainer.d.ts.map