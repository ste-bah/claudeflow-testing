/**
 * Training Worker - Worker Thread for Background GNN Training
 *
 * Runs GNN training in a separate thread to ensure zero blocking
 * of the main event loop. Communicates with BackgroundTrainer via
 * message passing.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-010
 *
 * WORKER PROTOCOL:
 * - Receives: 'start' | 'cancel' messages
 * - Sends: 'progress' | 'batch' | 'epoch' | 'complete' | 'error' messages
 *
 * @module src/god-agent/core/reasoning/training-worker
 */
import type { TrainingConfig } from './gnn-trainer.js';
/**
 * Serialized trajectory for worker thread transfer
 */
interface SerializedTrajectory {
    id: string;
    embedding: number[];
    enhancedEmbedding?: number[];
    quality: number;
}
/**
 * Worker initialization data
 */
interface WorkerData {
    trajectories: SerializedTrajectory[];
    config: TrainingConfig;
    yieldInterval: number;
}
/**
 * TrainingWorker - Executes training in worker thread
 *
 * This class replicates the training logic from GNNTrainer but runs
 * entirely within the worker thread context. It uses a simplified
 * implementation to avoid complex dependencies.
 */
declare class TrainingWorker {
    private readonly trajectories;
    private readonly config;
    private readonly yieldInterval;
    private isCancelled;
    private startTime;
    constructor(data: WorkerData);
    /**
     * Run training loop
     */
    run(): Promise<void>;
    /**
     * Cancel training
     */
    cancel(): void;
    /**
     * Train on a single batch
     *
     * Simplified implementation that computes contrastive loss
     * without full GNN forward pass (weights remain unchanged in worker).
     */
    private trainBatch;
    /**
     * Compute centroid of trajectory embeddings
     */
    private computeQueryEmbedding;
    /**
     * Create trajectory pairs for contrastive learning
     */
    private createPairs;
    /**
     * Compute Euclidean distance
     */
    private euclideanDistance;
    /**
     * Approximate gradient norm (simplified)
     */
    private approximateGradientNorm;
    /**
     * Create empty batch result
     */
    private createEmptyBatchResult;
    /**
     * Create batches from array
     */
    private createBatches;
    /**
     * Yield to allow message processing
     */
    private yield;
    /**
     * Send message to parent
     */
    private sendMessage;
    /**
     * Send progress update
     */
    private sendProgress;
}
export { TrainingWorker };
//# sourceMappingURL=training-worker.d.ts.map