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
import type { TrajectoryRecord, TrajectoryID, IReasoningRequest, IReasoningResponse, ILearningFeedback } from './reasoning-types.js';
/**
 * VectorDB interface for optional persistence
 * Will be replaced with actual VectorDB import when available
 */
interface VectorDB {
    add(entry: {
        id: string;
        embedding: Float32Array;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
/**
 * Configuration for TrajectoryTracker
 */
export interface TrajectoryTrackerConfig {
    maxTrajectories?: number;
    retentionMs?: number;
    vectorDB?: VectorDB;
    autoPrune?: boolean;
    pruneIntervalMs?: number;
}
/**
 * Statistics about tracked trajectories
 */
export interface TrajectoryStats {
    total: number;
    withFeedback: number;
    highQuality: number;
    averageLScore: number;
    averageQuality: number;
    oldestTimestamp: number;
    newestTimestamp: number;
}
/**
 * TrajectoryTracker - Manages reasoning trajectory history
 *
 * Tracks all reasoning trajectories for:
 * 1. Sona feedback loop integration
 * 2. Pattern creation from successful paths
 * 3. Performance analysis and optimization
 */
export declare class TrajectoryTracker {
    private trajectories;
    private maxTrajectories;
    private retentionMs;
    private vectorDB?;
    private autoPrune;
    private pruneIntervalMs;
    private pruneTimer?;
    constructor(config?: TrajectoryTrackerConfig);
    /**
     * Generate unique trajectory ID
     * Format: "traj_{timestamp}_{uuid}"
     */
    generateTrajectoryId(): TrajectoryID;
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
    createTrajectory(request: IReasoningRequest, result: IReasoningResponse, embedding: Float32Array, enhancedEmbedding?: Float32Array, lScore?: number): Promise<TrajectoryRecord>;
    /**
     * Get trajectory by ID
     *
     * @param trajectoryId - Trajectory identifier
     * @returns Trajectory record or null if not found
     */
    getTrajectory(trajectoryId: TrajectoryID): Promise<TrajectoryRecord | null>;
    /**
     * Update trajectory with Sona feedback
     *
     * @param trajectoryId - Trajectory to update
     * @param feedback - Learning feedback from Sona
     * @returns Updated trajectory record
     */
    updateFeedback(trajectoryId: TrajectoryID, feedback: ILearningFeedback): Promise<TrajectoryRecord>;
    /**
     * Get high-quality trajectories for pattern creation
     * Returns trajectories with quality >= threshold
     *
     * @param minQuality - Minimum quality threshold (0-1)
     * @param limit - Maximum number of trajectories to return
     * @returns High-quality trajectory records
     */
    getHighQualityTrajectories(minQuality?: number, limit?: number): Promise<TrajectoryRecord[]>;
    /**
     * Find similar trajectories using embedding search
     *
     * @param embedding - Query embedding
     * @param k - Number of similar trajectories to return
     * @param minSimilarity - Minimum cosine similarity threshold
     * @returns Similar trajectory records
     */
    findSimilarTrajectories(embedding: Float32Array, k?: number, minSimilarity?: number): Promise<TrajectoryRecord[]>;
    /**
     * Prune expired trajectories
     * Removes trajectories older than retentionMs
     *
     * @returns Number of trajectories pruned
     */
    pruneExpired(): Promise<number>;
    /**
     * Get trajectory statistics
     *
     * @returns Statistics summary
     */
    getStats(): TrajectoryStats;
    /**
     * Stop auto-pruning and cleanup
     */
    destroy(): void;
    /**
     * Persist trajectory to VectorDB (if available)
     *
     * @param trajectory - Trajectory to persist
     */
    private persistToVectorDB;
    /**
     * Evict lowest priority trajectory to make room
     * Priority: low quality + old access time
     */
    private evictLowestPriority;
    /**
     * Start automatic pruning interval
     */
    private startAutoPruning;
    /**
     * Calculate cosine similarity between two embeddings
     *
     * @param a - First embedding
     * @param b - Second embedding
     * @returns Cosine similarity (0-1)
     */
    private cosineSimilarity;
}
export {};
//# sourceMappingURL=trajectory-tracker.d.ts.map