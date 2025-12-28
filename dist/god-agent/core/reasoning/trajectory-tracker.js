/**
 * Trajectory Tracker for ReasoningBank
 *
 * Tracks reasoning trajectories for learning feedback loop integration.
 * Supports pattern creation from successful trajectories and performance analysis.
 *
 * Features:
 * - LRU eviction with quality preference
 * - Automatic pruning of expired trajectories
 * - VectorDB integration for semantic search
 * - Sona feedback integration
 * - High-quality trajectory extraction
 */
import { randomUUID } from 'crypto';
/**
 * TrajectoryTracker - Manages reasoning trajectory history
 *
 * Tracks all reasoning trajectories for:
 * 1. Sona feedback loop integration
 * 2. Pattern creation from successful paths
 * 3. Performance analysis and optimization
 */
export class TrajectoryTracker {
    trajectories;
    maxTrajectories;
    retentionMs;
    vectorDB;
    autoPrune;
    pruneIntervalMs;
    pruneTimer;
    constructor(config) {
        this.maxTrajectories = config?.maxTrajectories ?? 10000;
        this.retentionMs = config?.retentionMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
        this.vectorDB = config?.vectorDB;
        this.autoPrune = config?.autoPrune ?? true;
        this.pruneIntervalMs = config?.pruneIntervalMs ?? 60 * 60 * 1000; // 1 hour
        this.trajectories = new Map();
        if (this.autoPrune) {
            this.startAutoPruning();
        }
    }
    /**
     * Generate unique trajectory ID
     * Format: "traj_{timestamp}_{uuid}"
     */
    generateTrajectoryId() {
        const timestamp = Date.now();
        const uuid = randomUUID().substring(0, 8);
        return `traj_${timestamp}_${uuid}`;
    }
    /**
     * Create and store a new trajectory
     *
     * @param request - Original reasoning request
     * @param result - Reasoning result
     * @param embedding - Base embedding
     * @param enhancedEmbedding - Optional GNN-enhanced embedding
     * @param lScore - Optional L-score (defaults to 0 if not provided)
     * @returns Created trajectory record
     */
    async createTrajectory(request, result, embedding, enhancedEmbedding, lScore) {
        // Enforce max trajectories limit
        if (this.trajectories.size >= this.maxTrajectories) {
            await this.evictLowestPriority();
        }
        const trajectoryId = this.generateTrajectoryId();
        const timestamp = Date.now();
        const trajectory = {
            id: trajectoryId,
            timestamp,
            request,
            response: result,
            embedding,
            enhancedEmbedding,
            lScore: lScore ?? 0
        };
        // Store in memory
        this.trajectories.set(trajectoryId, {
            record: trajectory,
            lastAccessed: timestamp
        });
        // Optionally persist to VectorDB
        if (this.vectorDB) {
            await this.persistToVectorDB(trajectory);
        }
        return trajectory;
    }
    /**
     * Get trajectory by ID
     *
     * @param trajectoryId - Trajectory identifier
     * @returns Trajectory record or null if not found
     */
    async getTrajectory(trajectoryId) {
        const node = this.trajectories.get(trajectoryId);
        if (!node) {
            return null;
        }
        // Update LRU timestamp
        node.lastAccessed = Date.now();
        return node.record;
    }
    /**
     * Update trajectory with Sona feedback
     *
     * @param trajectoryId - Trajectory to update
     * @param feedback - Learning feedback from Sona
     * @returns Updated trajectory record
     */
    async updateFeedback(trajectoryId, feedback) {
        const node = this.trajectories.get(trajectoryId);
        if (!node) {
            throw new Error(`Trajectory not found: ${trajectoryId}`);
        }
        // Update feedback
        node.record.feedback = feedback;
        node.lastAccessed = Date.now();
        // Update in VectorDB if available
        if (this.vectorDB) {
            await this.persistToVectorDB(node.record);
        }
        return node.record;
    }
    /**
     * Get high-quality trajectories for pattern creation
     * Returns trajectories with quality >= threshold
     *
     * @param minQuality - Minimum quality threshold (0-1)
     * @param limit - Maximum number of trajectories to return
     * @returns High-quality trajectory records
     */
    async getHighQualityTrajectories(minQuality = 0.8, limit) {
        const highQuality = [];
        for (const node of Array.from(this.trajectories.values())) {
            const record = node.record;
            // Check if has feedback with sufficient quality
            if (record.feedback && record.feedback.quality !== undefined && record.feedback.quality >= minQuality) {
                highQuality.push(record);
            }
        }
        // Sort by quality (descending)
        highQuality.sort((a, b) => {
            const qualityA = a.feedback?.quality ?? 0;
            const qualityB = b.feedback?.quality ?? 0;
            return qualityB - qualityA;
        });
        // Apply limit if specified
        if (limit !== undefined && limit > 0) {
            return highQuality.slice(0, limit);
        }
        return highQuality;
    }
    /**
     * Find similar trajectories using embedding search
     *
     * @param embedding - Query embedding
     * @param k - Number of similar trajectories to return
     * @param minSimilarity - Minimum cosine similarity threshold
     * @returns Similar trajectory records
     */
    async findSimilarTrajectories(embedding, k = 10, minSimilarity = 0.7) {
        // Calculate cosine similarity for all trajectories
        const similarities = [];
        for (const node of Array.from(this.trajectories.values())) {
            const record = node.record;
            const targetEmbedding = record.enhancedEmbedding ?? record.embedding;
            const similarity = this.cosineSimilarity(embedding, targetEmbedding);
            if (similarity >= minSimilarity) {
                similarities.push({ record, similarity });
            }
        }
        // Sort by similarity (descending)
        similarities.sort((a, b) => b.similarity - a.similarity);
        // Return top k
        return similarities.slice(0, k).map(s => s.record);
    }
    /**
     * Prune expired trajectories
     * Removes trajectories older than retentionMs
     *
     * @returns Number of trajectories pruned
     */
    async pruneExpired() {
        const now = Date.now();
        const cutoff = now - this.retentionMs;
        const toDelete = [];
        for (const [id, node] of Array.from(this.trajectories.entries())) {
            if (node.record.timestamp < cutoff) {
                toDelete.push(id);
            }
        }
        // Remove expired trajectories
        for (const id of toDelete) {
            this.trajectories.delete(id);
        }
        return toDelete.length;
    }
    /**
     * Get trajectory statistics
     *
     * @returns Statistics summary
     */
    getStats() {
        let withFeedback = 0;
        let highQuality = 0;
        let totalLScore = 0;
        let totalQuality = 0;
        let lScoreCount = 0;
        let qualityCount = 0;
        let oldestTimestamp = Date.now();
        let newestTimestamp = 0;
        for (const node of Array.from(this.trajectories.values())) {
            const record = node.record;
            // Count feedback
            if (record.feedback) {
                withFeedback++;
                const quality = record.feedback.quality ?? 0;
                totalQuality += quality;
                qualityCount++;
                if (quality >= 0.8) {
                    highQuality++;
                }
            }
            // Accumulate L-scores
            if (record.lScore !== undefined && record.lScore !== null) {
                totalLScore += record.lScore;
                lScoreCount++;
            }
            // Track timestamp range
            if (record.timestamp < oldestTimestamp) {
                oldestTimestamp = record.timestamp;
            }
            if (record.timestamp > newestTimestamp) {
                newestTimestamp = record.timestamp;
            }
        }
        return {
            total: this.trajectories.size,
            withFeedback,
            highQuality,
            averageLScore: lScoreCount > 0 ? totalLScore / lScoreCount : 0,
            averageQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
            oldestTimestamp: this.trajectories.size > 0 ? oldestTimestamp : 0,
            newestTimestamp: this.trajectories.size > 0 ? newestTimestamp : 0
        };
    }
    /**
     * Stop auto-pruning and cleanup
     */
    destroy() {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = undefined;
        }
    }
    /**
     * Persist trajectory to VectorDB (if available)
     *
     * @param trajectory - Trajectory to persist
     */
    async persistToVectorDB(trajectory) {
        if (!this.vectorDB) {
            return;
        }
        try {
            const embedding = trajectory.enhancedEmbedding ?? trajectory.embedding;
            // Store trajectory with metadata
            await this.vectorDB.add({
                id: trajectory.id,
                embedding,
                metadata: {
                    timestamp: trajectory.timestamp,
                    mode: trajectory.request.type,
                    lScore: trajectory.lScore,
                    quality: trajectory.feedback?.quality,
                    hasEnhancement: !!trajectory.enhancedEmbedding
                }
            });
        }
        catch (error) {
            // Log error but don't fail the operation
            console.warn(`Failed to persist trajectory ${trajectory.id} to VectorDB:`, error);
        }
    }
    /**
     * Evict lowest priority trajectory to make room
     * Priority: low quality + old access time
     */
    async evictLowestPriority() {
        if (this.trajectories.size === 0) {
            return;
        }
        let lowestPriorityId = null;
        let lowestPriority = Infinity;
        for (const [id, node] of Array.from(this.trajectories.entries())) {
            // Calculate priority score (higher is better)
            const quality = node.record.feedback?.quality ?? 0.5;
            const ageMs = Date.now() - node.lastAccessed;
            const ageDays = ageMs / (24 * 60 * 60 * 1000);
            // Priority = quality / (age in days + 1)
            // Low quality + old = low priority (evict first)
            const priority = quality / (ageDays + 1);
            if (priority < lowestPriority) {
                lowestPriority = priority;
                lowestPriorityId = id;
            }
        }
        if (lowestPriorityId) {
            this.trajectories.delete(lowestPriorityId);
        }
    }
    /**
     * Start automatic pruning interval
     */
    startAutoPruning() {
        this.pruneTimer = setInterval(() => {
            this.pruneExpired().catch(error => {
                console.warn('Auto-prune failed:', error);
            });
        }, this.pruneIntervalMs);
    }
    /**
     * Calculate cosine similarity between two embeddings
     *
     * @param a - First embedding
     * @param b - Second embedding
     * @returns Cosine similarity (0-1)
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Embedding dimensions must match');
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) {
            return 0;
        }
        return dotProduct / denominator;
    }
}
//# sourceMappingURL=trajectory-tracker.js.map