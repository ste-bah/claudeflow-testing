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
import { parentPort, workerData, isMainThread } from 'worker_threads';
// =============================================================================
// Constants
// =============================================================================
/** Quality threshold for positive samples (high quality) */
const POSITIVE_QUALITY_THRESHOLD = 0.7;
/** Quality threshold for negative samples (low quality) */
const NEGATIVE_QUALITY_THRESHOLD = 0.5;
/** Default margin for contrastive loss */
const DEFAULT_MARGIN = 0.5;
// =============================================================================
// Worker Implementation
// =============================================================================
/**
 * TrainingWorker - Executes training in worker thread
 *
 * This class replicates the training logic from GNNTrainer but runs
 * entirely within the worker thread context. It uses a simplified
 * implementation to avoid complex dependencies.
 */
class TrainingWorker {
    trajectories;
    config;
    yieldInterval;
    isCancelled = false;
    startTime = 0;
    constructor(data) {
        // Deserialize trajectories with defensive null check
        this.trajectories = (data.trajectories ?? []).map(t => ({
            id: t.id,
            embedding: new Float32Array(t.embedding),
            enhancedEmbedding: t.enhancedEmbedding ? new Float32Array(t.enhancedEmbedding) : undefined,
            quality: t.quality,
        }));
        this.config = data.config;
        this.yieldInterval = data.yieldInterval;
    }
    /**
     * Run training loop
     */
    async run() {
        this.startTime = performance.now();
        try {
            this.sendProgress({
                phase: 'training',
                totalSamples: this.trajectories.length,
                totalEpochs: this.config.maxEpochs,
                usingWorker: true,
            });
            // Create batches
            const batches = this.createBatches(this.trajectories, this.config.batchSize);
            const totalBatches = batches.length;
            this.sendProgress({
                totalBatches,
            });
            const epochResults = [];
            let bestLoss = Infinity;
            // Training loop
            for (let epoch = 0; epoch < this.config.maxEpochs; epoch++) {
                if (this.isCancelled) {
                    break;
                }
                const epochStartTime = performance.now();
                let epochLoss = 0;
                let totalActiveTriplets = 0;
                let totalGradientNorm = 0;
                this.sendProgress({
                    currentEpoch: epoch + 1,
                    currentBatch: 0,
                });
                // Process batches
                for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
                    if (this.isCancelled) {
                        break;
                    }
                    const batch = batches[batchIdx];
                    // Yield periodically (though in worker, this is less critical)
                    if (batchIdx > 0 && batchIdx % this.yieldInterval === 0) {
                        await this.yield();
                    }
                    // Train on batch
                    const batchResult = this.trainBatch(batch, epoch, batchIdx);
                    epochLoss += batchResult.loss;
                    totalActiveTriplets += batchResult.activeTriplets;
                    totalGradientNorm += batchResult.gradientNorm;
                    // Send batch result
                    this.sendMessage('batch', batchResult);
                    // Update progress
                    this.sendProgress({
                        currentBatch: batchIdx + 1,
                        currentLoss: batchResult.loss,
                        samplesProcessed: (epoch * this.trajectories.length) + ((batchIdx + 1) * this.config.batchSize),
                    });
                }
                if (this.isCancelled) {
                    break;
                }
                // Create epoch result
                const avgLoss = batches.length > 0 ? epochLoss / batches.length : 0;
                const improvement = avgLoss < bestLoss;
                if (improvement) {
                    bestLoss = avgLoss;
                    this.sendProgress({ bestLoss });
                }
                const epochResult = {
                    epoch: epoch + 1,
                    trainingLoss: avgLoss,
                    improvement,
                    stoppedEarly: false,
                    batchesProcessed: batches.length,
                    epochTimeMs: performance.now() - epochStartTime,
                    avgGradientNorm: batches.length > 0 ? totalGradientNorm / batches.length : 0,
                };
                epochResults.push(epochResult);
                this.sendMessage('epoch', epochResult);
                // Early stopping check would go here
            }
            // Send completion
            this.sendMessage('complete', {
                success: !this.isCancelled,
                epochResults,
                totalTimeMs: performance.now() - this.startTime,
                cancelled: this.isCancelled,
            });
        }
        catch (error) {
            this.sendMessage('error', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Cancel training
     */
    cancel() {
        this.isCancelled = true;
    }
    // =========================================================================
    // Training Implementation
    // =========================================================================
    /**
     * Train on a single batch
     *
     * Simplified implementation that computes contrastive loss
     * without full GNN forward pass (weights remain unchanged in worker).
     */
    trainBatch(batch, epoch, batchIndex) {
        const startTime = performance.now();
        // Filter valid trajectories
        const validTrajectories = batch.filter(t => t.quality !== undefined &&
            Number.isFinite(t.quality) &&
            t.embedding.length > 0);
        if (validTrajectories.length === 0) {
            return this.createEmptyBatchResult(epoch, batchIndex);
        }
        // Compute query embedding (centroid)
        const queryEmbedding = this.computeQueryEmbedding(validTrajectories);
        // Create triplets
        const pairs = this.createPairs(validTrajectories, queryEmbedding);
        if (pairs.length === 0) {
            return this.createEmptyBatchResult(epoch, batchIndex);
        }
        // Compute loss
        let totalLoss = 0;
        let activeTriplets = 0;
        for (const pair of pairs) {
            const distPos = this.euclideanDistance(pair.query, pair.positive);
            const distNeg = this.euclideanDistance(pair.query, pair.negative);
            const loss = Math.max(0, distPos - distNeg + DEFAULT_MARGIN);
            totalLoss += loss;
            if (loss > 0) {
                activeTriplets++;
            }
        }
        const avgLoss = pairs.length > 0 ? totalLoss / pairs.length : 0;
        // Compute approximate gradient norm
        const gradientNorm = this.approximateGradientNorm(pairs, avgLoss);
        return {
            epoch,
            batchIndex,
            loss: avgLoss,
            gradientNorm,
            activeTriplets,
            totalTriplets: pairs.length,
            trainingTimeMs: performance.now() - startTime,
        };
    }
    /**
     * Compute centroid of trajectory embeddings
     */
    computeQueryEmbedding(trajectories) {
        const dim = trajectories[0]?.embedding.length ?? 1536;
        const centroid = new Float32Array(dim);
        for (const traj of trajectories) {
            const embedding = traj.enhancedEmbedding ?? traj.embedding;
            for (let i = 0; i < Math.min(dim, embedding.length); i++) {
                centroid[i] += embedding[i];
            }
        }
        const n = trajectories.length;
        if (n > 0) {
            for (let i = 0; i < dim; i++) {
                centroid[i] /= n;
            }
        }
        return centroid;
    }
    /**
     * Create trajectory pairs for contrastive learning
     */
    createPairs(trajectories, queryEmbedding) {
        const positives = [];
        const negatives = [];
        for (const traj of trajectories) {
            if (traj.quality >= POSITIVE_QUALITY_THRESHOLD) {
                positives.push(traj);
            }
            else if (traj.quality < NEGATIVE_QUALITY_THRESHOLD) {
                negatives.push(traj);
            }
        }
        const pairs = [];
        for (const pos of positives) {
            for (const neg of negatives) {
                const posEmb = pos.enhancedEmbedding ?? pos.embedding;
                const negEmb = neg.enhancedEmbedding ?? neg.embedding;
                if (posEmb.length === queryEmbedding.length && negEmb.length === queryEmbedding.length) {
                    pairs.push({
                        query: queryEmbedding,
                        positive: posEmb,
                        negative: negEmb,
                    });
                }
            }
        }
        return pairs;
    }
    /**
     * Compute Euclidean distance
     */
    euclideanDistance(a, b) {
        const minLen = Math.min(a.length, b.length);
        let sum = 0;
        for (let i = 0; i < minLen; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
    /**
     * Approximate gradient norm (simplified)
     */
    approximateGradientNorm(pairs, avgLoss) {
        // Simplified approximation based on loss magnitude
        // In full implementation, this would compute actual gradients
        return avgLoss * 0.1 * Math.sqrt(pairs.length);
    }
    /**
     * Create empty batch result
     */
    createEmptyBatchResult(epoch, batchIndex) {
        return {
            epoch,
            batchIndex,
            loss: 0,
            gradientNorm: 0,
            activeTriplets: 0,
            totalTriplets: 0,
            trainingTimeMs: 0,
        };
    }
    // =========================================================================
    // Utilities
    // =========================================================================
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
     * Yield to allow message processing
     */
    yield() {
        return new Promise(resolve => setImmediate(resolve));
    }
    /**
     * Send message to parent
     */
    sendMessage(type, payload) {
        if (parentPort) {
            parentPort.postMessage({ type, payload });
        }
    }
    /**
     * Send progress update
     */
    sendProgress(updates) {
        this.sendMessage('progress', updates);
    }
}
// =============================================================================
// Worker Entry Point
// =============================================================================
// Only run if this is a worker thread
if (!isMainThread && parentPort) {
    const worker = new TrainingWorker(workerData);
    // Listen for messages from parent
    parentPort.on('message', async (message) => {
        switch (message.type) {
            case 'start':
                await worker.run();
                break;
            case 'cancel':
                worker.cancel();
                break;
        }
    });
    // Handle errors
    process.on('uncaughtException', (error) => {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                payload: error.message,
            });
        }
    });
    process.on('unhandledRejection', (reason) => {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                payload: String(reason),
            });
        }
    });
}
// Export for type checking (though worker doesn't export at runtime)
export { TrainingWorker };
//# sourceMappingURL=training-worker.js.map