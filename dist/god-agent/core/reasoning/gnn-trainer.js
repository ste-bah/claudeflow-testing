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
import { AdamOptimizer, applyAdamTo2DWeights, } from './adam-optimizer.js';
import { ContrastiveLoss, POSITIVE_QUALITY_THRESHOLD, NEGATIVE_QUALITY_THRESHOLD, } from './contrastive-loss.js';
import { TrainingHistoryManager, } from './training-history.js';
import { LORA_PARAMS, VECTOR_DIM } from '../validation/constants.js';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../observability/index.js';
// Implements GAP-GNN-002: Bridge backpropagation functions
import { layer_backward, } from './gnn-backprop.js';
// Implements GAP-GNN-004: EWC integration types
import { EWCRegularizer, } from './ewc-utils.js';
const logger = createComponentLogger('GNNTrainer', {
    minLevel: LogLevel.INFO,
    handlers: [new ConsoleLogHandler()]
});
// =============================================================================
// Default Configuration
// =============================================================================
const DEFAULT_TRAINING_CONFIG = {
    learningRate: 0.001,
    batchSize: 32,
    maxEpochs: 10,
    earlyStoppingPatience: 3,
    validationSplit: 0.2,
    ewcLambda: LORA_PARAMS.ewcLambda,
    margin: 0.5,
    beta1: 0.9,
    beta2: 0.999,
    maxGradientNorm: 1.0,
    shuffle: true,
    minImprovement: 0.001,
};
const CHECKPOINT_VERSION = '1.0.0';
// =============================================================================
// GNNTrainer Class
// =============================================================================
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
export class GNNTrainer {
    gnnEnhancer;
    weightManager;
    config;
    optimizer;
    contrastiveLoss;
    historyManager = null;
    // Training state
    currentEpoch = 0;
    bestValidationLoss = Infinity;
    epochsWithoutImprovement = 0;
    totalBatchesTrained = 0;
    // Implements GAP-GNN-004: EWC continual learning properties
    ewcRegularizer;
    fisherDiagonal;
    optimalWeights;
    // Gradient history stores per-layer gradients from each batch for Fisher computation
    // Each entry is a Map from layerId to 2D weight gradients (Float32Array[])
    gradientHistory;
    /**
     * Create a new GNNTrainer
     *
     * @param gnnEnhancer - GNN enhancer for forward pass
     * @param weightManager - Weight manager for weight access and persistence
     * @param config - Training configuration
     * @param db - Optional database connection for history persistence
     */
    constructor(gnnEnhancer, weightManager, config = {}, db) {
        this.gnnEnhancer = gnnEnhancer;
        this.weightManager = weightManager;
        this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
        // Initialize Adam optimizer
        const adamConfig = {
            learningRate: this.config.learningRate,
            beta1: this.config.beta1,
            beta2: this.config.beta2,
        };
        this.optimizer = new AdamOptimizer(adamConfig);
        // Initialize contrastive loss
        const lossConfig = {
            margin: this.config.margin,
            maxGradientNorm: this.config.maxGradientNorm,
            positiveThreshold: POSITIVE_QUALITY_THRESHOLD,
            negativeThreshold: NEGATIVE_QUALITY_THRESHOLD,
        };
        this.contrastiveLoss = new ContrastiveLoss(lossConfig);
        // Initialize history manager if database provided
        if (db) {
            this.historyManager = new TrainingHistoryManager(db);
        }
        // Implements GAP-GNN-004: EWC integration for continual learning
        this.ewcRegularizer = new EWCRegularizer({
            lambda: this.config.ewcLambda ?? 0.4,
            online: true,
            persistPath: '.agentdb/gnn/ewc',
        });
        // Initialize Fisher and optimal weights (load if exists)
        this.fisherDiagonal = new Map();
        this.optimalWeights = new Map();
        this.gradientHistory = [];
        this.loadEWCState();
        logger.info('GNNTrainer initialized', {
            learningRate: this.config.learningRate,
            batchSize: this.config.batchSize,
            maxEpochs: this.config.maxEpochs,
            ewcLambda: this.config.ewcLambda,
        });
    }
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
    async trainBatch(trajectories) {
        const startTime = performance.now();
        // Filter trajectories that have valid quality scores
        const validTrajectories = trajectories.filter(t => t.quality !== undefined &&
            Number.isFinite(t.quality) &&
            t.embedding.length > 0);
        if (validTrajectories.length === 0) {
            return this.createEmptyResult();
        }
        // Create triplets from trajectories
        // Use the first trajectory's embedding as query (or could use centroid)
        const queryEmbedding = this.computeQueryEmbedding(validTrajectories);
        const pairs = ContrastiveLoss.createPairs(validTrajectories, queryEmbedding, {
            positiveThreshold: POSITIVE_QUALITY_THRESHOLD,
            negativeThreshold: NEGATIVE_QUALITY_THRESHOLD,
        });
        if (pairs.length === 0) {
            return this.createEmptyResult();
        }
        // Implements GAP-GNN-002: Forward pass with activation collection for backpropagation
        // collectActivations=true captures pre/post activation values required by layer_backward()
        const forwardResult = await this.gnnEnhancer.enhance(queryEmbedding, undefined, // No graph context
        undefined, // No hyperedges
        true // collectActivations=true for backpropagation
        );
        // Compute loss and gradients
        const loss = this.contrastiveLoss.compute(pairs);
        const gradientBatch = this.contrastiveLoss.backward(pairs);
        // Compute gradient norm
        const gradientNorm = this.computeGradientNorm(gradientBatch);
        // Update weights if we have active gradients
        // Implements GAP-GNN-002: Pass activation cache for proper backpropagation
        if (gradientBatch.activeCount > 0 && loss > 0) {
            // Collect gradients for Fisher computation (GAP-GNN-004)
            // Compute backward pass to get per-layer weight gradients
            const weightGradients = this.computeBackwardPass(gradientBatch, forwardResult.activationCache);
            if (weightGradients.size > 0) {
                this.gradientHistory.push(weightGradients);
            }
            await this.updateWeights(gradientBatch, forwardResult.activationCache);
        }
        // Record training history
        // Implements: RULE-028 (all feedback persisted)
        const result = {
            epoch: this.currentEpoch,
            batchIndex: this.totalBatchesTrained,
            loss,
            gradientNorm,
            activeTriplets: gradientBatch.activeCount,
            totalTriplets: pairs.length,
            trainingTimeMs: performance.now() - startTime,
        };
        await this.recordTrainingBatch(result);
        this.totalBatchesTrained++;
        return result;
    }
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
    async trainEpoch(dataset) {
        const startTime = performance.now();
        this.currentEpoch++;
        const { training, validation, queries } = dataset;
        // Shuffle training data if configured
        const shuffledTraining = this.config.shuffle
            ? this.shuffleArray([...training])
            : training;
        // Process batches
        const batchResults = [];
        const batches = this.createBatches(shuffledTraining, this.config.batchSize);
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const result = await this.trainBatch(batch);
            batchResults.push(result);
            if (i % 10 === 0) {
                logger.debug('Batch progress', {
                    epoch: this.currentEpoch,
                    batch: i + 1,
                    totalBatches: batches.length,
                    loss: result.loss,
                });
            }
        }
        // Compute epoch statistics
        const trainingLoss = this.computeAverageLoss(batchResults);
        const avgGradientNorm = this.computeAverageGradientNorm(batchResults);
        // Validation
        let validationLoss;
        let improvement = false;
        if (validation && validation.length > 0) {
            const validationResult = await this.validate(validation);
            validationLoss = validationResult.loss;
            // Check for improvement
            if (validationLoss < this.bestValidationLoss - this.config.minImprovement) {
                this.bestValidationLoss = validationLoss;
                this.epochsWithoutImprovement = 0;
                improvement = true;
                // Save checkpoint on improvement
                await this.gnnEnhancer.saveWeights();
                logger.info('Validation improved, weights saved', {
                    epoch: this.currentEpoch,
                    validationLoss,
                    previousBest: this.bestValidationLoss,
                });
            }
            else {
                this.epochsWithoutImprovement++;
            }
        }
        // Check early stopping
        const stoppedEarly = this.epochsWithoutImprovement >= this.config.earlyStoppingPatience;
        const epochResult = {
            epoch: this.currentEpoch,
            trainingLoss,
            validationLoss,
            improvement,
            stoppedEarly,
            batchesProcessed: batches.length,
            epochTimeMs: performance.now() - startTime,
            avgGradientNorm,
        };
        logger.info('Epoch completed', {
            epoch: this.currentEpoch,
            trainingLoss: trainingLoss.toFixed(6),
            validationLoss: validationLoss?.toFixed(6) ?? 'N/A',
            improvement,
            stoppedEarly,
            epochTimeMs: epochResult.epochTimeMs.toFixed(1),
        });
        return epochResult;
    }
    /**
     * Run validation on a set of trajectories
     *
     * Computes loss without updating weights.
     *
     * @param validationSet - Trajectories to validate against
     * @returns Validation result with loss metrics
     */
    async validate(validationSet) {
        const startTime = performance.now();
        if (validationSet.length === 0) {
            return {
                loss: 0,
                sampleCount: 0,
                activeTriplets: 0,
                validationTimeMs: 0,
            };
        }
        // Create triplets for validation
        const queryEmbedding = this.computeQueryEmbedding(validationSet);
        const pairs = ContrastiveLoss.createPairs(validationSet, queryEmbedding, {
            positiveThreshold: POSITIVE_QUALITY_THRESHOLD,
            negativeThreshold: NEGATIVE_QUALITY_THRESHOLD,
        });
        if (pairs.length === 0) {
            return {
                loss: 0,
                sampleCount: validationSet.length,
                activeTriplets: 0,
                validationTimeMs: performance.now() - startTime,
            };
        }
        // Compute loss only (no gradient update)
        const loss = this.contrastiveLoss.compute(pairs);
        const gradientBatch = this.contrastiveLoss.backward(pairs);
        return {
            loss,
            sampleCount: validationSet.length,
            activeTriplets: gradientBatch.activeCount,
            validationTimeMs: performance.now() - startTime,
        };
    }
    /**
     * Save a checkpoint of the trainer state
     *
     * Saves weights, optimizer state, and training progress.
     * Implements: TASK-GNN-005, RULE-028 (persistence)
     *
     * @param path - Path to save checkpoint
     */
    async saveCheckpoint(path) {
        const checkpoint = {
            epoch: this.currentEpoch,
            bestValidationLoss: this.bestValidationLoss,
            epochsWithoutImprovement: this.epochsWithoutImprovement,
            optimizerState: this.optimizer.getState(),
            config: this.config,
            timestamp: new Date().toISOString(),
            version: CHECKPOINT_VERSION,
        };
        // Save GNN weights
        await this.gnnEnhancer.saveWeights();
        // Save checkpoint data to a file
        const { writeFileSync, mkdirSync, existsSync } = await import('fs');
        const { dirname } = await import('path');
        const dir = dirname(path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(path, JSON.stringify(checkpoint, null, 2));
        logger.info('Checkpoint saved', {
            path,
            epoch: this.currentEpoch,
            bestLoss: this.bestValidationLoss,
        });
    }
    /**
     * Load a checkpoint to resume training
     *
     * Restores weights, optimizer state, and training progress.
     *
     * @param path - Path to checkpoint file
     */
    async loadCheckpoint(path) {
        const { readFileSync, existsSync } = await import('fs');
        if (!existsSync(path)) {
            throw new Error(`Checkpoint not found: ${path}`);
        }
        const checkpointJson = readFileSync(path, 'utf-8');
        const checkpoint = JSON.parse(checkpointJson);
        // Validate version
        if (checkpoint.version !== CHECKPOINT_VERSION) {
            logger.warn('Checkpoint version mismatch', {
                expected: CHECKPOINT_VERSION,
                actual: checkpoint.version,
            });
        }
        // Restore training state
        this.currentEpoch = checkpoint.epoch;
        this.bestValidationLoss = checkpoint.bestValidationLoss;
        this.epochsWithoutImprovement = checkpoint.epochsWithoutImprovement;
        // Restore optimizer state
        this.optimizer.setState(checkpoint.optimizerState);
        // Load GNN weights
        await this.gnnEnhancer.loadWeights();
        logger.info('Checkpoint loaded', {
            path,
            epoch: this.currentEpoch,
            bestLoss: this.bestValidationLoss,
        });
    }
    /**
     * Full training loop
     *
     * Runs training for multiple epochs until convergence or max epochs.
     *
     * @param dataset - Complete training dataset
     * @returns Array of epoch results
     */
    async train(dataset) {
        const results = [];
        // Split training data into train/validation if not provided
        const { training, queries } = dataset;
        let validation = dataset.validation;
        if (!validation && this.config.validationSplit > 0) {
            const splitIndex = Math.floor(training.length * (1 - this.config.validationSplit));
            validation = training.slice(splitIndex);
            dataset = {
                training: training.slice(0, splitIndex),
                validation,
                queries,
            };
        }
        logger.info('Starting training', {
            trainingSize: dataset.training.length,
            validationSize: validation?.length ?? 0,
            maxEpochs: this.config.maxEpochs,
        });
        for (let epoch = 0; epoch < this.config.maxEpochs; epoch++) {
            const result = await this.trainEpoch(dataset);
            results.push(result);
            if (result.stoppedEarly) {
                logger.info('Early stopping triggered', {
                    epoch: this.currentEpoch,
                    patience: this.config.earlyStoppingPatience,
                });
                break;
            }
        }
        return results;
    }
    /**
     * Get current training configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get current training state
     */
    getTrainingState() {
        return {
            currentEpoch: this.currentEpoch,
            bestValidationLoss: this.bestValidationLoss,
            epochsWithoutImprovement: this.epochsWithoutImprovement,
            totalBatchesTrained: this.totalBatchesTrained,
        };
    }
    /**
     * Reset training state for fresh training
     */
    reset() {
        this.currentEpoch = 0;
        this.bestValidationLoss = Infinity;
        this.epochsWithoutImprovement = 0;
        this.totalBatchesTrained = 0;
        this.optimizer.reset();
        this.gradientHistory = [];
        logger.info('Trainer reset');
    }
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
    async completeTask(taskId) {
        if (this.gradientHistory.length === 0) {
            logger.warn('No gradients collected for Fisher update', { taskId });
            return;
        }
        // Convert gradient history to format expected by EWC updateFisher
        // gradientHistory is already Map<string, Float32Array>[] which matches the API
        const numSamples = this.gradientHistory.length;
        // Flatten per-layer gradients for Fisher computation
        // The EWC updateFisher expects gradients as Map<string, Float32Array>[]
        const layerGradients = this.flattenGradientHistoryToLayerArrays();
        // Update Fisher diagonal with online EWC
        const result = this.ewcRegularizer.updateFisher(this.fisherDiagonal, layerGradients, numSamples);
        this.fisherDiagonal = result.fisher;
        // Snapshot optimal weights from this task
        this.optimalWeights = this.getCurrentWeightsFlattened();
        // Persist to disk (RULE-028)
        await this.ewcRegularizer.saveFisher(this.fisherDiagonal, 'fisher.json');
        await this.saveOptimalWeights();
        // Clear gradient history for next task
        this.gradientHistory = [];
        logger.info('Task completed, Fisher updated', {
            taskId,
            fisherParams: this.countFisherParams(result.fisher),
            samples: result.numSamples,
            computeTimeMs: result.computeTimeMs.toFixed(2),
        });
    }
    /**
     * Get the number of tasks that have been completed (for EWC tracking)
     */
    getEWCTaskCount() {
        return this.ewcRegularizer.getTaskCount();
    }
    /**
     * Get Fisher statistics for diagnostics
     */
    getFisherStats() {
        if (this.fisherDiagonal.size === 0) {
            return null;
        }
        return this.ewcRegularizer.getFisherStats(this.fisherDiagonal);
    }
    /**
     * Get training history statistics
     */
    async getTrainingStats() {
        if (!this.historyManager) {
            return null;
        }
        return this.historyManager.getStats();
    }
    /**
     * Get recent loss trend
     *
     * @param windowSize - Number of recent losses to retrieve
     */
    async getLossTrend(windowSize = 10) {
        if (!this.historyManager) {
            return [];
        }
        return this.historyManager.getLossTrend(windowSize);
    }
    /**
     * Check if loss is improving
     *
     * @param windowSize - Window size for trend analysis
     */
    async isLossImproving(windowSize = 10) {
        if (!this.historyManager) {
            return false;
        }
        return this.historyManager.isLossImproving(windowSize);
    }
    // =========================================================================
    // Private Methods
    // =========================================================================
    /**
     * Compute query embedding from trajectories
     * Uses centroid of all trajectory embeddings
     */
    computeQueryEmbedding(trajectories) {
        const dim = trajectories[0]?.embedding.length ?? VECTOR_DIM;
        const centroid = new Float32Array(dim);
        for (const traj of trajectories) {
            const embedding = traj.enhancedEmbedding ?? traj.embedding;
            for (let i = 0; i < Math.min(dim, embedding.length); i++) {
                centroid[i] += embedding[i];
            }
        }
        // Normalize
        const n = trajectories.length;
        if (n > 0) {
            for (let i = 0; i < dim; i++) {
                centroid[i] /= n;
            }
        }
        return centroid;
    }
    /**
     * Update weights using Adam optimizer with proper backpropagation
     *
     * Implements: GAP-GNN-002 - Uses computeBackwardPass with activation cache
     * instead of the heuristic distributeGradients method.
     *
     * @param gradientBatch - Gradients from contrastive loss
     * @param activationCache - Activation cache from forward pass for backpropagation
     */
    async updateWeights(gradientBatch, activationCache) {
        const layerIds = this.weightManager.getLayerIds();
        // Get current weights
        const currentWeights = new Map();
        for (const layerId of layerIds) {
            const weights = this.weightManager.getWeights(layerId);
            if (weights.length > 0) {
                currentWeights.set(layerId, weights);
            }
        }
        if (currentWeights.size === 0) {
            return;
        }
        // Implements GAP-GNN-002: Use proper chain-rule backpropagation
        // instead of heuristic gradient distribution
        const gradients = this.computeBackwardPass(gradientBatch, activationCache);
        // Apply Adam optimizer
        const updatedWeights = applyAdamTo2DWeights(this.optimizer, currentWeights, gradients);
        // Apply EWC regularization if configured
        // Implements: LORA_PARAMS.ewcLambda from constitution
        if (this.config.ewcLambda > 0) {
            this.applyEWCRegularization(updatedWeights, currentWeights);
        }
        // Implements TASK-WM-003, GAP-WM-001: Direct weight updates via new API
        for (const [layerId, weights] of updatedWeights) {
            this.weightManager.setWeights(layerId, weights);
        }
    }
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
    computeBackwardPass(gradientBatch, activationCache) {
        const weightGradients = new Map();
        // Handle edge case: no activation cache (fallback to empty gradients)
        if (!activationCache || activationCache.length === 0) {
            logger.warn('computeBackwardPass called without activation cache, returning empty gradients');
            return weightGradients;
        }
        // Start with output gradient (dL/dOutput from contrastive loss)
        let currentGradient = gradientBatch.dQuery;
        // Reverse layer order for backprop (chain rule: work backwards through layers)
        // activationCache is in forward order [layer1, layer2, layer3]
        // We iterate backwards: layer3 -> layer2 -> layer1
        for (let i = activationCache.length - 1; i >= 0; i--) {
            const cache = activationCache[i];
            // Validate cache entry has required data
            if (!cache.input || !cache.weights || !cache.preActivation || !cache.postActivation) {
                logger.warn('Incomplete activation cache for layer', { layerId: cache.layerId, index: i });
                continue;
            }
            // Call layer_backward from gnn-backprop.ts
            // This computes both weight gradients (dW) and input gradient (dx) using chain rule
            const result = layer_backward(currentGradient, cache.input, cache.weights, cache.preActivation, cache.postActivation, 'relu', // Activation function (matches GNN config default)
            true // useResidual (matches GNN config default)
            );
            // Store weight gradients for this layer (used by optimizer)
            weightGradients.set(cache.layerId, result.dW);
            // Propagate gradient to previous layer (chain rule)
            currentGradient = result.dx;
        }
        return weightGradients;
    }
    // Implements GAP-GNN-004: Load persisted EWC state
    async loadEWCState() {
        try {
            const fisher = await this.ewcRegularizer.loadFisher();
            if (fisher) {
                this.fisherDiagonal = fisher;
            }
            const optimal = await this.ewcRegularizer.loadFisher('optimal-weights.json');
            if (optimal) {
                this.optimalWeights = optimal;
            }
        }
        catch (error) {
            // First run - no persisted state yet
            logger.debug('No EWC state to load', { error: error instanceof Error ? error.message : 'unknown' });
        }
    }
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
    flattenGradientHistoryToLayerArrays() {
        // Each entry in gradientHistory is a Map<string, Float32Array[]> where
        // Float32Array[] is per-row weights. We need to flatten each to Float32Array.
        const result = [];
        for (const batchGradients of this.gradientHistory) {
            const flattenedBatch = new Map();
            for (const [layerId, gradients2D] of batchGradients) {
                // gradients2D is Float32Array[] (2D) - flatten to 1D
                const totalLen = gradients2D.reduce((sum, row) => sum + row.length, 0);
                const flat = new Float32Array(totalLen);
                let offset = 0;
                for (const row of gradients2D) {
                    flat.set(row, offset);
                    offset += row.length;
                }
                flattenedBatch.set(layerId, flat);
            }
            result.push(flattenedBatch);
        }
        return result;
    }
    /**
     * Implements GAP-GNN-004: Get flattened current weights for optimal snapshot
     *
     * Retrieves all weights from WeightManager and flattens them from 2D arrays
     * to 1D Float32Arrays for storage as optimal weights reference.
     *
     * @returns Map of layerId to flattened weights
     */
    getCurrentWeightsFlattened() {
        const result = new Map();
        for (const layerId of this.weightManager.getLayerIds()) {
            const weights = this.weightManager.getWeights(layerId);
            if (weights && weights.length > 0) {
                // Flatten 2D weights to 1D
                const totalLength = weights.reduce((sum, row) => sum + row.length, 0);
                const flat = new Float32Array(totalLength);
                let offset = 0;
                for (const row of weights) {
                    flat.set(row, offset);
                    offset += row.length;
                }
                result.set(layerId, flat);
            }
        }
        return result;
    }
    /**
     * Implements GAP-GNN-004: Save optimal weights to disk
     *
     * Persists the optimal weights snapshot using the EWC regularizer's
     * saveFisher method (reused for consistency in serialization format).
     *
     * RULE-028: All learning state must be persisted
     */
    async saveOptimalWeights() {
        await this.ewcRegularizer.saveFisher(this.optimalWeights, 'optimal-weights.json');
    }
    /**
     * Implements GAP-GNN-004: Count total Fisher parameters
     *
     * Helper for logging Fisher update statistics.
     *
     * @param fisher - Fisher diagonal map
     * @returns Total number of parameters with Fisher values
     */
    countFisherParams(fisher) {
        let count = 0;
        for (const arr of fisher.values()) {
            count += arr.length;
        }
        return count;
    }
    /**
     * Implements GAP-GNN-004: Fisher-weighted EWC regularization
     * Prevents catastrophic forgetting by penalizing changes to important weights
     * using Fisher information matrix diagonal as importance weights.
     *
     * EWC Penalty: theta -= lambda * F_i * (theta - theta_optimal)
     *
     * Where F_i is the Fisher diagonal (NOT naive L2 which ignores importance)
     */
    applyEWCRegularization(updatedWeights, currentWeights) {
        if (this.fisherDiagonal.size === 0) {
            return; // No prior task - skip EWC
        }
        const lambda = this.config.ewcLambda ?? 0.4;
        for (const [layerId, weights] of updatedWeights) {
            const fisher = this.fisherDiagonal.get(layerId);
            const optimal = this.optimalWeights.get(layerId);
            if (!fisher || !optimal) {
                continue; // No Fisher info for this layer
            }
            // Apply Fisher-weighted EWC: theta -= lambda * F_i * (theta - theta_optimal)
            for (let r = 0; r < weights.length; r++) {
                for (let c = 0; c < weights[r].length; c++) {
                    const idx = r * weights[r].length + c;
                    const fisherWeight = fisher[idx] ?? 0;
                    const optimalVal = optimal[idx] ?? weights[r][c];
                    const diff = weights[r][c] - optimalVal;
                    // Fisher-weighted penalty (NOT naive L2)
                    weights[r][c] -= lambda * fisherWeight * diff;
                }
            }
        }
    }
    /**
     * Compute L2 norm of gradients
     */
    computeGradientNorm(gradientBatch) {
        let sumSq = 0;
        for (let i = 0; i < gradientBatch.dQuery.length; i++) {
            sumSq += gradientBatch.dQuery[i] * gradientBatch.dQuery[i];
        }
        for (let i = 0; i < gradientBatch.dPositive.length; i++) {
            sumSq += gradientBatch.dPositive[i] * gradientBatch.dPositive[i];
        }
        for (let i = 0; i < gradientBatch.dNegative.length; i++) {
            sumSq += gradientBatch.dNegative[i] * gradientBatch.dNegative[i];
        }
        return Math.sqrt(sumSq);
    }
    /**
     * Record training batch to history
     */
    async recordTrainingBatch(result) {
        if (!this.historyManager) {
            return;
        }
        const record = {
            id: TrainingHistoryManager.generateRecordId(result.epoch, result.batchIndex),
            epoch: result.epoch,
            batchIndex: result.batchIndex,
            loss: result.loss,
            learningRate: this.config.learningRate,
            samplesCount: result.totalTriplets,
            createdAt: new Date(),
        };
        await this.historyManager.recordBatch(record);
    }
    /**
     * Create batches from array
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * Fisher-Yates shuffle
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    /**
     * Compute average loss from batch results
     */
    computeAverageLoss(results) {
        if (results.length === 0)
            return 0;
        const totalLoss = results.reduce((sum, r) => sum + r.loss, 0);
        return totalLoss / results.length;
    }
    /**
     * Compute average gradient norm from batch results
     */
    computeAverageGradientNorm(results) {
        if (results.length === 0)
            return 0;
        const totalNorm = results.reduce((sum, r) => sum + r.gradientNorm, 0);
        return totalNorm / results.length;
    }
    /**
     * Create empty training result
     */
    createEmptyResult() {
        return {
            epoch: this.currentEpoch,
            batchIndex: this.totalBatchesTrained,
            loss: 0,
            gradientNorm: 0,
            activeTriplets: 0,
            totalTriplets: 0,
            trainingTimeMs: 0,
        };
    }
}
// =============================================================================
// Factory Function
// =============================================================================
/**
 * Create a GNNTrainer with default configuration
 *
 * @param gnnEnhancer - GNN enhancer instance
 * @param weightManager - Weight manager instance
 * @param config - Optional training configuration
 * @param db - Optional database for history persistence
 */
export function createGNNTrainer(gnnEnhancer, weightManager, config, db) {
    return new GNNTrainer(gnnEnhancer, weightManager, config, db);
}
//# sourceMappingURL=gnn-trainer.js.map