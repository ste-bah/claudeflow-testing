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
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../observability/index.js';
const logger = createComponentLogger('BackgroundTrainer', {
    minLevel: LogLevel.INFO,
    handlers: [new ConsoleLogHandler()]
});
// =============================================================================
// Default Configuration
// =============================================================================
const DEFAULT_CONFIG = {
    useWorkerThread: false,
    workerThreshold: 100,
    yieldInterval: 10,
    progressUpdateIntervalMs: 100,
    maxTrainingTimeMs: 300000, // 5 minutes
    detailedProgress: true,
};
// =============================================================================
// BackgroundTrainer Class
// =============================================================================
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
export class BackgroundTrainer extends EventEmitter {
    config;
    trainer;
    // Training state
    isTraining = false;
    isCancelled = false;
    worker = null;
    startTime = 0;
    currentProgress;
    // Batch processing state
    batchResults = [];
    epochResults = [];
    /**
     * Create a new BackgroundTrainer
     *
     * @param trainer - GNNTrainer instance to wrap
     * @param config - Optional configuration
     */
    constructor(trainer, config = {}) {
        super();
        this.trainer = trainer;
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize progress state
        this.currentProgress = this.createInitialProgress();
        logger.info('BackgroundTrainer initialized', {
            workerThreshold: this.config.workerThreshold,
            yieldInterval: this.config.yieldInterval,
        });
    }
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
    async trainInBackground(trajectories) {
        if (this.isTraining) {
            throw new Error('Training already in progress');
        }
        if (trajectories.length === 0) {
            return this.createEmptyResult();
        }
        this.isTraining = true;
        this.isCancelled = false;
        this.startTime = performance.now();
        this.batchResults = [];
        this.epochResults = [];
        this.currentProgress = this.createInitialProgress();
        // Determine strategy based on batch size
        const useWorker = this.config.useWorkerThread ||
            trajectories.length >= this.config.workerThreshold;
        logger.info('Starting background training', {
            sampleCount: trajectories.length,
            strategy: useWorker ? 'worker' : 'setImmediate',
        });
        try {
            let result;
            if (useWorker) {
                // Implements: AC-003 (Worker thread option)
                result = await this.trainWithWorker(trajectories);
            }
            else {
                // Implements: AC-001, AC-002 (setImmediate yielding)
                result = await this.trainWithSetImmediate(trajectories);
            }
            return result;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('Background training failed', { error: err.message });
            this.updateProgress({
                phase: 'error',
            });
            this.emit('error', err);
            return {
                success: false,
                epochResults: this.epochResults,
                progress: this.currentProgress,
                error: err.message,
                totalTimeMs: performance.now() - this.startTime,
                cancelled: false,
                strategy: this.config.useWorkerThread ? 'worker' : 'setImmediate',
            };
        }
        finally {
            this.isTraining = false;
            this.worker = null;
        }
    }
    /**
     * Cancel running training
     *
     * Implements: AC-005 (Can be cancelled)
     */
    cancel() {
        if (!this.isTraining || this.isCancelled) {
            return;
        }
        logger.info('Cancelling background training');
        this.isCancelled = true;
        if (this.worker) {
            this.worker.postMessage({ type: 'cancel' });
            this.worker.terminate();
            this.worker = null;
        }
        // Update progress without emitting (to prevent recursive cancel calls)
        this.currentProgress = {
            ...this.currentProgress,
            phase: 'cancelled',
            elapsedMs: performance.now() - this.startTime,
        };
        // Emit progress once after state update
        this.emit('progress', this.currentProgress);
    }
    /**
     * Get current training progress
     *
     * @returns Current progress or idle state
     */
    getProgress() {
        return { ...this.currentProgress };
    }
    /**
     * Check if training is in progress
     */
    isRunning() {
        return this.isTraining;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    // =========================================================================
    // Event Emitter Type Safety
    // =========================================================================
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    // =========================================================================
    // Private Methods - setImmediate Strategy
    // =========================================================================
    /**
     * Train using setImmediate yielding for cooperative multitasking
     *
     * This approach yields control back to the event loop every N items,
     * ensuring the main thread remains responsive.
     *
     * Implements: AC-001, AC-002
     */
    async trainWithSetImmediate(trajectories) {
        this.updateProgress({
            phase: 'preparing',
            totalSamples: trajectories.length,
            usingWorker: false,
        });
        const trainerConfig = this.trainer.getConfig();
        const batchSize = trainerConfig.batchSize;
        const maxEpochs = trainerConfig.maxEpochs;
        // Split into batches
        const batches = this.createBatches(trajectories, batchSize);
        const totalBatches = batches.length;
        this.updateProgress({
            phase: 'training',
            totalEpochs: maxEpochs,
            totalBatches,
        });
        // Process epochs
        for (let epoch = 0; epoch < maxEpochs; epoch++) {
            if (this.isCancelled) {
                break;
            }
            this.updateProgress({
                currentEpoch: epoch + 1,
                currentBatch: 0,
            });
            // Process batches with yielding
            const epochStartTime = performance.now();
            let epochLoss = 0;
            let activeTriplets = 0;
            for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
                if (this.isCancelled) {
                    break;
                }
                const batch = batches[batchIdx];
                // Yield every yieldInterval batches to prevent blocking
                if (batchIdx > 0 && batchIdx % this.config.yieldInterval === 0) {
                    await this.yieldToEventLoop();
                }
                // Train on batch
                const batchResult = await this.trainer.trainBatch(batch);
                this.batchResults.push(batchResult);
                epochLoss += batchResult.loss;
                activeTriplets += batchResult.activeTriplets;
                // Update progress
                // Implements: AC-004 (Progress events)
                this.updateProgress({
                    currentBatch: batchIdx + 1,
                    currentLoss: batchResult.loss,
                    samplesProcessed: (epoch * trajectories.length) + ((batchIdx + 1) * batchSize),
                });
                // Emit batch complete event
                this.emit('batchComplete', batchResult);
            }
            if (this.isCancelled) {
                break;
            }
            // Create epoch result
            const avgLoss = batches.length > 0 ? epochLoss / batches.length : 0;
            const epochResult = {
                epoch: epoch + 1,
                trainingLoss: avgLoss,
                improvement: avgLoss < this.currentProgress.bestLoss,
                stoppedEarly: false,
                batchesProcessed: batches.length,
                epochTimeMs: performance.now() - epochStartTime,
                avgGradientNorm: this.computeAvgGradientNorm(),
            };
            this.epochResults.push(epochResult);
            // Update best loss
            if (avgLoss < this.currentProgress.bestLoss) {
                this.updateProgress({ bestLoss: avgLoss });
            }
            // Emit epoch complete event
            this.emit('epochComplete', epochResult);
            logger.info('Epoch completed', {
                epoch: epoch + 1,
                loss: avgLoss.toFixed(6),
                timeMs: epochResult.epochTimeMs.toFixed(1),
            });
            // Check early stopping
            if (epochResult.stoppedEarly) {
                break;
            }
        }
        // Persist weights (batched persistence)
        if (!this.isCancelled) {
            this.updateProgress({ phase: 'persisting' });
            await this.yieldToEventLoop();
            // Weights are persisted by GNNTrainer after training
        }
        // Complete
        this.updateProgress({
            phase: this.isCancelled ? 'cancelled' : 'complete',
            percentComplete: 100,
        });
        const result = {
            success: !this.isCancelled,
            epochResults: this.epochResults,
            progress: this.currentProgress,
            totalTimeMs: performance.now() - this.startTime,
            cancelled: this.isCancelled,
            strategy: 'setImmediate',
        };
        this.emit('complete', result);
        return result;
    }
    // =========================================================================
    // Private Methods - Worker Thread Strategy
    // =========================================================================
    /**
     * Train using Worker Thread for true parallelism
     *
     * This approach offloads training to a separate thread, ensuring
     * zero blocking of the main event loop.
     *
     * Implements: AC-003
     */
    async trainWithWorker(trajectories) {
        this.updateProgress({
            phase: 'preparing',
            totalSamples: trajectories.length,
            usingWorker: true,
        });
        try {
            return await new Promise((resolve, reject) => {
                try {
                    // Get the worker script path
                    const workerPath = this.getWorkerPath();
                    // Serialize trajectories for worker
                    const serializedTrajectories = this.serializeTrajectories(trajectories);
                    // Create worker
                    this.worker = new Worker(workerPath, {
                        workerData: {
                            trajectories: serializedTrajectories,
                            config: this.trainer.getConfig(),
                            yieldInterval: this.config.yieldInterval,
                        },
                    });
                    // Handle worker messages
                    this.worker.on('message', (message) => {
                        switch (message.type) {
                            case 'progress':
                                this.handleWorkerProgress(message.payload);
                                break;
                            case 'batch':
                                this.handleWorkerBatch(message.payload);
                                break;
                            case 'epoch':
                                this.handleWorkerEpoch(message.payload);
                                break;
                            case 'complete':
                                this.handleWorkerComplete(message.payload, resolve);
                                break;
                            case 'error':
                                reject(new Error(message.payload));
                                break;
                        }
                    });
                    this.worker.on('error', (error) => {
                        logger.warn('Worker error, will fallback to setImmediate', { error: error.message });
                        reject(error);
                    });
                    this.worker.on('exit', (code) => {
                        if (code !== 0 && !this.isCancelled) {
                            logger.warn('Worker exited with non-zero code', { code });
                        }
                    });
                    // Start training
                    this.worker.postMessage({ type: 'start' });
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        catch (error) {
            // Fallback to setImmediate if worker fails
            logger.warn('Worker failed, falling back to setImmediate', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.worker = null;
            return this.trainWithSetImmediate(trajectories);
        }
    }
    /**
     * Get worker script path
     */
    getWorkerPath() {
        // In ESM, we need to resolve the path relative to this file
        const currentFilePath = fileURLToPath(import.meta.url);
        const currentDir = dirname(currentFilePath);
        return join(currentDir, 'training-worker.js');
    }
    /**
     * Serialize trajectories for worker thread transfer
     */
    serializeTrajectories(trajectories) {
        return trajectories.map(t => ({
            id: t.id,
            embedding: Array.from(t.embedding),
            enhancedEmbedding: t.enhancedEmbedding ? Array.from(t.enhancedEmbedding) : undefined,
            quality: t.quality,
        }));
    }
    /**
     * Handle progress update from worker
     */
    handleWorkerProgress(progress) {
        this.updateProgress(progress);
    }
    /**
     * Handle batch complete from worker
     */
    handleWorkerBatch(batchResult) {
        this.batchResults.push(batchResult);
        this.emit('batchComplete', batchResult);
    }
    /**
     * Handle epoch complete from worker
     */
    handleWorkerEpoch(epochResult) {
        this.epochResults.push(epochResult);
        this.emit('epochComplete', epochResult);
    }
    /**
     * Handle worker completion
     */
    handleWorkerComplete(result, resolve) {
        this.updateProgress({ phase: 'complete', percentComplete: 100 });
        const finalResult = {
            ...result,
            epochResults: this.epochResults,
            progress: this.currentProgress,
            totalTimeMs: performance.now() - this.startTime,
            strategy: 'worker',
        };
        this.emit('complete', finalResult);
        resolve(finalResult);
    }
    // =========================================================================
    // Private Methods - Utilities
    // =========================================================================
    /**
     * Yield control back to the event loop using setImmediate
     *
     * This ensures the main thread remains responsive during training.
     * Implements: AC-001, AC-002
     */
    yieldToEventLoop() {
        return new Promise((resolve) => setImmediate(resolve));
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
     * Update progress and emit event
     */
    updateProgress(updates) {
        const elapsed = performance.now() - this.startTime;
        this.currentProgress = {
            ...this.currentProgress,
            ...updates,
            elapsedMs: elapsed,
        };
        // Calculate percent complete
        if (this.currentProgress.totalEpochs > 0 && this.currentProgress.totalBatches > 0) {
            const epochProgress = (this.currentProgress.currentEpoch - 1) / this.currentProgress.totalEpochs;
            const batchProgress = this.currentProgress.currentBatch / this.currentProgress.totalBatches / this.currentProgress.totalEpochs;
            this.currentProgress.percentComplete = Math.min(100, (epochProgress + batchProgress) * 100);
        }
        // Estimate remaining time
        if (this.currentProgress.percentComplete > 0) {
            const rate = elapsed / this.currentProgress.percentComplete;
            this.currentProgress.estimatedRemainingMs = rate * (100 - this.currentProgress.percentComplete);
        }
        // Emit progress event (implements: AC-004)
        this.emit('progress', this.currentProgress);
    }
    /**
     * Create initial progress state
     */
    createInitialProgress() {
        return {
            phase: 'idle',
            currentEpoch: 0,
            totalEpochs: 0,
            currentBatch: 0,
            totalBatches: 0,
            percentComplete: 0,
            elapsedMs: 0,
            estimatedRemainingMs: 0,
            currentLoss: 0,
            bestLoss: Infinity,
            samplesProcessed: 0,
            totalSamples: 0,
            usingWorker: false,
        };
    }
    /**
     * Create empty result for zero-sample case
     */
    createEmptyResult() {
        return {
            success: true,
            epochResults: [],
            progress: this.createInitialProgress(),
            totalTimeMs: 0,
            cancelled: false,
            strategy: 'setImmediate',
        };
    }
    /**
     * Compute average gradient norm from batch results
     */
    computeAvgGradientNorm() {
        if (this.batchResults.length === 0)
            return 0;
        const sum = this.batchResults.reduce((acc, r) => acc + r.gradientNorm, 0);
        return sum / this.batchResults.length;
    }
}
// =============================================================================
// Factory Function
// =============================================================================
/**
 * Create a BackgroundTrainer with default configuration
 *
 * @param trainer - GNNTrainer instance
 * @param config - Optional configuration
 * @returns BackgroundTrainer instance
 */
export function createBackgroundTrainer(trainer, config) {
    return new BackgroundTrainer(trainer, config);
}
//# sourceMappingURL=background-trainer.js.map