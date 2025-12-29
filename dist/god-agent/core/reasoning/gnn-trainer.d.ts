/**
 * GNNTrainer - Orchestrates GNN Training Loop
 *
 * Connects all training components:
 * - GNNEnhancer: Forward pass and embedding enhancement
 * - WeightManager: Weight storage and persistence
 * - AdamOptimizer: Gradient-based weight updates
 * - ContrastiveLoss: Loss computation for quality-guided learning
 * - TrainingHistoryManager: Persistence of training metrics
 *
 * Implements:
 * - TASK-GNN-005: Core trainer class
 * - RULE-028: All feedback persisted
 * - RULE-046: Atomic operations
 *
 * Training Process:
 * 1. Create triplets from trajectories with quality feedback
 * 2. Forward pass through GNN to get enhanced embeddings
 * 3. Compute contrastive loss
 * 4. Backward pass to get gradients
 * 5. Update weights using Adam optimizer
 * 6. Persist training history
 *
 * PRD: PRD-GOD-AGENT-001
 *
 * @module src/god-agent/core/reasoning/gnn-trainer
 */
import type { GNNEnhancer } from './gnn-enhancer.js';
import type { WeightManager } from './weight-manager.js';
import type { IDatabaseConnection } from '../database/connection.js';
import { type AdamState } from './adam-optimizer.js';
import { type ITrajectoryWithFeedback } from './contrastive-loss.js';
import { type ITrainingStats } from './training-history.js';
import { EWCRegularizer } from './ewc-utils.js';
/**
 * Training configuration
 * Implements: TASK-GNN-005 specification
 */
export interface TrainingConfig {
    /** Learning rate for Adam optimizer (default: 0.001) */
    learningRate: number;
    /** Batch size for training (default: 32) */
    batchSize: number;
    /** Maximum number of epochs (default: 10) */
    maxEpochs: number;
    /** Epochs without improvement before stopping (default: 3) */
    earlyStoppingPatience: number;
    /** Fraction of data for validation (default: 0.2) */
    validationSplit: number;
    /** EWC regularization strength from LORA_PARAMS */
    ewcLambda: number;
    /** Margin for contrastive loss (default: 0.5) */
    margin: number;
    /** Adam beta1 (default: 0.9) */
    beta1: number;
    /** Adam beta2 (default: 0.999) */
    beta2: number;
    /** Maximum gradient norm for clipping (default: 1.0) */
    maxGradientNorm: number;
    /** Whether to shuffle data each epoch (default: true) */
    shuffle: boolean;
    /** Minimum improvement to reset patience (default: 0.001) */
    minImprovement: number;
}
/**
 * Result from training a single batch
 */
export interface TrainingResult {
    /** Current epoch number */
    epoch: number;
    /** Batch index within epoch */
    batchIndex: number;
    /** Loss value for this batch */
    loss: number;
    /** L2 norm of gradients */
    gradientNorm: number;
    /** Number of active triplets (contributed to loss) */
    activeTriplets: number;
    /** Total triplets in batch */
    totalTriplets: number;
    /** Training time in milliseconds */
    trainingTimeMs: number;
}
/**
 * Result from training a full epoch
 */
export interface EpochResult {
    /** Epoch number */
    epoch: number;
    /** Average training loss over all batches */
    trainingLoss: number;
    /** Validation loss if validation was performed */
    validationLoss?: number;
    /** Whether validation loss improved from previous best */
    improvement: boolean;
    /** Whether training stopped early due to no improvement */
    stoppedEarly: boolean;
    /** Number of batches processed */
    batchesProcessed: number;
    /** Total training time for epoch in milliseconds */
    epochTimeMs: number;
    /** Average gradient norm across batches */
    avgGradientNorm: number;
}
/**
 * Result from validation pass
 */
export interface ValidationResult {
    /** Average validation loss */
    loss: number;
    /** Number of validation samples */
    sampleCount: number;
    /** Number of active triplets */
    activeTriplets: number;
    /** Validation time in milliseconds */
    validationTimeMs: number;
}
/**
 * Training dataset structure
 */
export interface TrainingDataset {
    /** Training trajectories */
    training: ITrajectoryWithFeedback[];
    /** Validation trajectories (optional) */
    validation?: ITrajectoryWithFeedback[];
    /** Query embeddings for creating triplets */
    queries: Float32Array[];
}
/**
 * Checkpoint data for save/restore
 */
export interface TrainerCheckpoint {
    /** Current epoch */
    epoch: number;
    /** Best validation loss seen */
    bestValidationLoss: number;
    /** Epochs without improvement */
    epochsWithoutImprovement: number;
    /** Adam optimizer state */
    optimizerState: AdamState;
    /** Training configuration */
    config: TrainingConfig;
    /** Timestamp of checkpoint */
    timestamp: string;
    /** Version for compatibility */
    version: string;
}
/**
 * GNNTrainer - Orchestrates GNN training with quality-guided contrastive learning
 *
 * This trainer connects the GNN forward pass with backpropagation and
 * optimization to enable learning from user quality feedback.
 *
 * Training flow:
 * 1. Split dataset into training/validation
 * 2. For each epoch:
 *    a. Shuffle training data
 *    b. Process batches through forward pass
 *    c. Compute contrastive loss
 *    d. Backpropagate gradients
 *    e. Update weights with Adam
 *    f. Record training metrics
 * 3. Validate after each epoch
 * 4. Early stop if no improvement
 *
 * Implements: TASK-GNN-005
 *
 * @example
 * ```typescript
 * const trainer = new GNNTrainer(gnnEnhancer, weightManager, {
 *   learningRate: 0.001,
 *   batchSize: 32,
 *   maxEpochs: 10
 * });
 *
 * const result = await trainer.trainEpoch(dataset);
 * console.log(`Epoch ${result.epoch}: loss=${result.trainingLoss}`);
 * ```
 */
export declare class GNNTrainer {
    private readonly gnnEnhancer;
    private readonly weightManager;
    private readonly config;
    private readonly optimizer;
    private readonly contrastiveLoss;
    private historyManager;
    private currentEpoch;
    private bestValidationLoss;
    private epochsWithoutImprovement;
    private totalBatchesTrained;
    private ewcRegularizer;
    private fisherDiagonal;
    private optimalWeights;
    private gradientHistory;
    /**
     * Create a new GNNTrainer
     *
     * @param gnnEnhancer - GNN enhancer for forward pass
     * @param weightManager - Weight manager for weight access and persistence
     * @param config - Training configuration
     * @param db - Optional database connection for history persistence
     */
    constructor(gnnEnhancer: GNNEnhancer, weightManager: WeightManager, config?: Partial<TrainingConfig>, db?: IDatabaseConnection);
    /**
     * Train on a single batch of trajectories
     *
     * Implements the core training loop for one batch:
     * 1. Create triplets from trajectories
     * 2. Compute forward pass with activation collection for backpropagation
     * 3. Compute contrastive loss
     * 4. Backward pass using chain rule via layer_backward()
     * 5. Update weights using Adam optimizer
     *
     * Implements: TASK-GNN-005, RULE-028 (feedback persisted), GAP-GNN-002
     *
     * @param trajectories - Batch of trajectories with quality feedback
     * @returns Training result with loss and gradient metrics
     */
    trainBatch(trajectories: ITrajectoryWithFeedback[]): Promise<TrainingResult>;
    /**
     * Train for a full epoch
     *
     * Processes all batches in the training set, performs validation,
     * and checks for early stopping.
     *
     * Implements: TASK-GNN-005, RULE-046 (atomic operations)
     *
     * @param dataset - Training dataset with trajectories and queries
     * @returns Epoch result with training and validation metrics
     */
    trainEpoch(dataset: TrainingDataset): Promise<EpochResult>;
    /**
     * Run validation on a set of trajectories
     *
     * Computes loss without updating weights.
     *
     * @param validationSet - Trajectories to validate against
     * @returns Validation result with loss metrics
     */
    validate(validationSet: ITrajectoryWithFeedback[]): Promise<ValidationResult>;
    /**
     * Save a checkpoint of the trainer state
     *
     * Saves weights, optimizer state, and training progress.
     * Implements: TASK-GNN-005, RULE-028 (persistence)
     *
     * @param path - Path to save checkpoint
     */
    saveCheckpoint(path: string): Promise<void>;
    /**
     * Load a checkpoint to resume training
     *
     * Restores weights, optimizer state, and training progress.
     *
     * @param path - Path to checkpoint file
     */
    loadCheckpoint(path: string): Promise<void>;
    /**
     * Full training loop
     *
     * Runs training for multiple epochs until convergence or max epochs.
     *
     * @param dataset - Complete training dataset
     * @returns Array of epoch results
     */
    train(dataset: TrainingDataset): Promise<EpochResult[]>;
    /**
     * Get current training configuration
     */
    getConfig(): Readonly<TrainingConfig>;
    /**
     * Get current training state
     */
    getTrainingState(): {
        currentEpoch: number;
        bestValidationLoss: number;
        epochsWithoutImprovement: number;
        totalBatchesTrained: number;
    };
    /**
     * Reset training state for fresh training
     */
    reset(): void;
    /**
     * Call after completing a training task to update Fisher information
     * for continual learning protection.
     *
     * Implements GAP-GNN-004: Fisher tracking for EWC
     *
     * This method:
     * 1. Computes Fisher diagonal from collected gradient history
     * 2. Updates the Fisher estimate using online EWC
     * 3. Snapshots current weights as optimal for this task
     * 4. Persists Fisher and optimal weights to disk (RULE-028)
     * 5. Clears gradient history for the next task
     *
     * @param taskId - Identifier for the completed task (for logging)
     */
    completeTask(taskId: string): Promise<void>;
    /**
     * Get the number of tasks that have been completed (for EWC tracking)
     */
    getEWCTaskCount(): number;
    /**
     * Get Fisher statistics for diagnostics
     */
    getFisherStats(): ReturnType<EWCRegularizer['getFisherStats']> | null;
    /**
     * Get training history statistics
     */
    getTrainingStats(): Promise<ITrainingStats | null>;
    /**
     * Get recent loss trend
     *
     * @param windowSize - Number of recent losses to retrieve
     */
    getLossTrend(windowSize?: number): Promise<number[]>;
    /**
     * Check if loss is improving
     *
     * @param windowSize - Window size for trend analysis
     */
    isLossImproving(windowSize?: number): Promise<boolean>;
    /**
     * Compute query embedding from trajectories
     * Uses centroid of all trajectory embeddings
     */
    private computeQueryEmbedding;
    /**
     * Update weights using Adam optimizer with proper backpropagation
     *
     * Implements: GAP-GNN-002 - Uses computeBackwardPass with activation cache
     * instead of the heuristic distributeGradients method.
     *
     * @param gradientBatch - Gradients from contrastive loss
     * @param activationCache - Activation cache from forward pass for backpropagation
     */
    private updateWeights;
    /**
     * Implements GAP-GNN-002: Proper backpropagation via gnn-backprop.ts
     *
     * Computes weight gradients using chain rule through all GNN layers.
     * Replaces the heuristic distributeGradients() that used hardcoded scales.
     *
     * Backpropagation order (reverse of forward pass):
     * 1. Start with output gradient (dL/dOutput) from contrastive loss
     * 2. For each layer in reverse order (layer3 -> layer2 -> layer1):
     *    a. Call layer_backward() with activation cache
     *    b. Store weight gradients (dW) for optimizer
     *    c. Propagate input gradient (dx) to previous layer
     *
     * @param gradientBatch - Gradients from contrastive loss (dQuery is the output gradient)
     * @param activationCache - Activation cache from forward pass, one per layer in forward order
     * @returns Map of layerId to weight gradients for optimizer update
     */
    private computeBackwardPass;
    private loadEWCState;
    /**
     * Implements GAP-GNN-004: Flatten gradient history to layer-wise arrays
     *
     * Converts the gradient history (array of per-batch Maps) into the format
     * expected by EWCRegularizer.updateFisher(), which needs an array of
     * Map<string, Float32Array> where each entry represents gradients from one batch.
     *
     * The gradientHistory stores Map<string, Float32Array[]>[] (2D weight arrays),
     * so we flatten each 2D array to 1D for Fisher computation.
     *
     * @returns Array of gradient maps suitable for Fisher computation
     */
    private flattenGradientHistoryToLayerArrays;
    /**
     * Implements GAP-GNN-004: Get flattened current weights for optimal snapshot
     *
     * Retrieves all weights from WeightManager and flattens them from 2D arrays
     * to 1D Float32Arrays for storage as optimal weights reference.
     *
     * @returns Map of layerId to flattened weights
     */
    private getCurrentWeightsFlattened;
    /**
     * Implements GAP-GNN-004: Save optimal weights to disk
     *
     * Persists the optimal weights snapshot using the EWC regularizer's
     * saveFisher method (reused for consistency in serialization format).
     *
     * RULE-028: All learning state must be persisted
     */
    private saveOptimalWeights;
    /**
     * Implements GAP-GNN-004: Count total Fisher parameters
     *
     * Helper for logging Fisher update statistics.
     *
     * @param fisher - Fisher diagonal map
     * @returns Total number of parameters with Fisher values
     */
    private countFisherParams;
    /**
     * Implements GAP-GNN-004: Fisher-weighted EWC regularization
     * Prevents catastrophic forgetting by penalizing changes to important weights
     * using Fisher information matrix diagonal as importance weights.
     *
     * EWC Penalty: theta -= lambda * F_i * (theta - theta_optimal)
     *
     * Where F_i is the Fisher diagonal (NOT naive L2 which ignores importance)
     */
    private applyEWCRegularization;
    /**
     * Compute L2 norm of gradients
     */
    private computeGradientNorm;
    /**
     * Record training batch to history
     */
    private recordTrainingBatch;
    /**
     * Create batches from array
     */
    private createBatches;
    /**
     * Fisher-Yates shuffle
     */
    private shuffleArray;
    /**
     * Compute average loss from batch results
     */
    private computeAverageLoss;
    /**
     * Compute average gradient norm from batch results
     */
    private computeAverageGradientNorm;
    /**
     * Create empty training result
     */
    private createEmptyResult;
}
/**
 * Create a GNNTrainer with default configuration
 *
 * @param gnnEnhancer - GNN enhancer instance
 * @param weightManager - Weight manager instance
 * @param config - Optional training configuration
 * @param db - Optional database for history persistence
 */
export declare function createGNNTrainer(gnnEnhancer: GNNEnhancer, weightManager: WeightManager, config?: Partial<TrainingConfig>, db?: IDatabaseConnection): GNNTrainer;
//# sourceMappingURL=gnn-trainer.d.ts.map