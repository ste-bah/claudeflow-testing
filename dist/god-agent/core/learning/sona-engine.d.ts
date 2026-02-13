/**
 * Sona Engine
 * TASK-SON-001 - Trajectory Tracking and Weight Management
 * TASK-SON-002 - LoRA-Style Weight Updates and Persistence
 *
 * Implements trajectory-based learning for pattern weight adaptation.
 * Enables 10-30% improvement on repeated task types without retraining.
 *
 * Performance targets:
 * - createTrajectory(): <1ms
 * - getWeight(): <1ms
 * - getWeights(): <5ms
 * - provideFeedback(): <15ms
 */
import type { TrajectoryID, PatternID, Route, Weight, WeightStorage, ITrajectory, ISonaConfig, ILearningMetrics, IDriftMetrics, ISerializedSonaState, IWeightUpdateResult, CheckpointReason, ICheckpointFull, IReasoningStep, IRlmContext } from './sona-types.js';
import type { ITrajectoryStreamConfig, IRollbackState } from '../types/trajectory-streaming-types.js';
import { TrajectoryMetadataDAO } from '../database/dao/trajectory-metadata-dao.js';
import { PatternDAO } from '../database/dao/pattern-dao.js';
import { LearningFeedbackDAO } from '../database/dao/learning-feedback-dao.js';
/**
 * Sona Engine - Trajectory-Based Learning
 *
 * Manages trajectories and pattern weights for adaptive learning.
 * Supports EWC++ regularized weight updates with Fisher Information.
 * Includes drift detection and automatic rollback (TASK-SON-003).
 */
/**
 * Pattern interface for learned reusable patterns
 */
interface Pattern {
    id: string;
    sourceTrajectory: TrajectoryID;
    embedding: Float32Array;
    quality: number;
    steps: IReasoningStep[];
    createdAt: number;
    usageCount: number;
    taskType?: string;
    template?: string;
    successRate?: number;
    sonaWeight?: number;
    updatedAt?: Date;
    metadata?: {
        domain?: string;
        description?: string;
        tags?: string[];
        stepCount?: number;
        compressionRatio?: string;
    };
}
export declare class SonaEngine {
    private trajectories;
    private weights;
    private fisherInformation;
    private patterns;
    private config;
    private initialized;
    private embeddingProvider;
    private patternCreatedCallback?;
    private weightUpdateMutex;
    private lastAutoSave;
    private weightsFilePath;
    private baselineWeights;
    private checkpoints;
    private checkpointsDir;
    private rollbackCount;
    private lastRollbackTime;
    private static readonly ROLLBACK_WINDOW_MS;
    private static readonly MAX_ROLLBACKS_IN_WINDOW;
    private streamManager?;
    private rollbackState;
    private baselineCheckpointIds;
    private databaseConnection?;
    private trajectoryMetadataDAO?;
    private patternDAO?;
    private learningFeedbackDAO?;
    private persistenceEnabled;
    /**
     * Map RLM context to feedback input format
     * Extracts relay-race memory handoff fields for persistence
     */
    private mapRlmContextToFeedback;
    private metrics;
    constructor(config?: ISonaConfig);
    /**
     * Check if database persistence is enabled
     * @returns True if DAOs are initialized and ready
     */
    isPersistenceEnabled(): boolean;
    /**
     * Get database statistics for observability
     * @returns DAO statistics or null if persistence is disabled
     */
    getDatabaseStats(): {
        trajectoryMetadata: ReturnType<TrajectoryMetadataDAO['getStats']>;
        patterns: ReturnType<PatternDAO['getStats']>;
        feedback: ReturnType<LearningFeedbackDAO['getStats']>;
    } | null;
    /**
     * Initialize the Sona Engine
     */
    initialize(): Promise<void>;
    /**
     * Enable trajectory streaming to disk (TECH-TRJ-001)
     *
     * @param config - Optional streaming configuration
     */
    enableStreaming(config?: Partial<ITrajectoryStreamConfig>): Promise<void>;
    /**
     * Set the weights file path for persistence
     */
    setWeightsFilePath(path: string): void;
    /**
     * FIX: Set callback for pattern creation notifications
     * This connects SonaEngine patterns to PatternStore for reasoning
     *
     * @param callback - Function to call when a pattern is created
     */
    onPatternCreated(callback: (pattern: Pattern) => Promise<void>): void;
    /**
     * Create a new trajectory for a reasoning path
     *
     * @param route - Task type (e.g., "reasoning.causal")
     * @param patterns - Pattern IDs used in this trajectory
     * @param context - Context IDs that influenced the outcome
     * @returns Generated TrajectoryID
     * @throws TrajectoryValidationError if validation fails
     */
    createTrajectory(route: Route, patterns: PatternID[], context?: string[]): TrajectoryID;
    /**
     * Create a trajectory with a specific ID (for bridging with TrajectoryTracker)
     *
     * Same as createTrajectory but accepts an existing trajectory ID.
     * Used when syncing trajectories from ReasoningBank's TrajectoryTracker.
     *
     * @param trajectoryId - Existing trajectory ID to use
     * @param route - Task type (e.g., "reasoning.causal")
     * @param patterns - Pattern IDs used in this trajectory
     * @param context - Context IDs that influenced the outcome
     * @throws TrajectoryValidationError if validation fails
     */
    createTrajectoryWithId(trajectoryId: TrajectoryID, route: Route, patterns: PatternID[], context?: string[]): void;
    /**
     * Link a pattern to an existing trajectory.
     * Updates both the in-memory trajectory and the DB (via PatternDAO).
     *
     * Implements: FIX-TRAJ-PATTERN-001 (trajectory-pattern link gap)
     *
     * @param trajectoryId - Trajectory to link the pattern to
     * @param patternId - Pattern ID to add
     */
    addPatternToTrajectory(trajectoryId: TrajectoryID, patternId: PatternID): void;
    /**
     * Get weight for a single pattern in a route
     *
     * @param patternId - Pattern ID to get weight for
     * @param route - Task type/route
     * @returns Weight value (0.0 if not found)
     */
    getWeight(patternId: PatternID, route: Route): Promise<Weight>;
    /**
     * Get all weights for a route as Float32Array
     *
     * @param route - Task type/route
     * @returns Float32Array of weights (empty if route not found)
     */
    getWeights(route: Route): Promise<Float32Array>;
    /**
     * Get weights with pattern ID mapping for a route
     *
     * @param route - Task type/route
     * @returns Array of {patternId, weight} pairs
     */
    getWeightsWithIds(route: Route): Promise<Array<{
        patternId: PatternID;
        weight: Weight;
    }>>;
    /**
     * Set weight for a pattern (for testing and manual adjustment)
     *
     * @param patternId - Pattern ID
     * @param route - Task type/route
     * @param weight - Weight value (-1 to 1)
     */
    setWeight(patternId: PatternID, route: Route, weight: Weight): void;
    /**
     * Get a trajectory by ID
     * Implements: REQ-TRAJ-001 (SQLite fallback), REQ-TRAJ-002 (cache on load)
     * Constitution: RULE-008 (SQLite primary storage)
     *
     * @param trajectoryId - Trajectory ID
     * @returns ITrajectory or null if not found
     */
    getTrajectory(trajectoryId: TrajectoryID): ITrajectory | null;
    /**
     * Check if trajectory exists in persistent storage (SQLite)
     * Implements: REQ-TRAJ-006
     * Constitution: RULE-008 (SQLite primary storage), RULE-069 (try/catch)
     *
     * @param trajectoryId - Trajectory ID to check
     * @returns true if trajectory exists in database
     */
    hasTrajectoryInStorage(trajectoryId: TrajectoryID): boolean;
    /**
     * Load trajectory from persistent storage (SQLite)
     * Implements: REQ-TRAJ-006, REQ-TRAJ-008
     * Constitution: RULE-008 (SQLite primary storage), RULE-069 (try/catch)
     *
     * @param trajectoryId - Trajectory ID to load
     * @returns ITrajectory or null if not found
     */
    getTrajectoryFromStorage(trajectoryId: TrajectoryID): ITrajectory | null;
    /**
     * List all trajectories, optionally filtered by route
     *
     * @param route - Optional route filter
     * @returns Array of trajectories
     */
    listTrajectories(route?: Route): ITrajectory[];
    /**
     * Get trajectory count, optionally filtered by route
     *
     * @param route - Optional route filter
     * @returns Number of trajectories
     */
    getTrajectoryCount(route?: Route): number;
    /**
     * Get all routes with initialized weights
     *
     * @returns Array of route strings
     */
    getRoutes(): Route[];
    /**
     * Get number of patterns for a route
     *
     * @param route - Task type/route
     * @returns Number of patterns with weights
     */
    getPatternCount(route: Route): number;
    /**
     * Check if a route has been initialized
     *
     * @param route - Task type/route
     * @returns true if route exists
     */
    hasRoute(route: Route): boolean;
    /**
     * Get learning metrics
     *
     * @returns Current learning metrics
     */
    getMetrics(): ILearningMetrics;
    /**
     * Calculate drift from baseline weights
     *
     * @param baselineWeights - Baseline weight vector
     * @returns Drift metrics
     */
    calculateDrift(baselineWeights: Float32Array): IDriftMetrics;
    /**
     * Compute drift metrics from two weight vectors
     */
    private computeDriftMetrics;
    /**
     * Get all weights as a flat Float32Array
     */
    private getAllWeightsFlat;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
    /**
     * Provide feedback for a trajectory and update pattern weights
     *
     * @param trajectoryId - Trajectory ID to provide feedback for
     * @param quality - Quality score (0-1)
     * @param options - Optional parameters for weight updates
     * @returns Weight update result
     * @throws FeedbackValidationError if validation fails
     */
    provideFeedback(trajectoryId: TrajectoryID, quality: number, options?: {
        lScore?: number;
        similarities?: Map<PatternID, number>;
        skipAutoSave?: boolean;
        /** RLM context for relay-race memory handoff tracking */
        rlmContext?: IRlmContext;
    }): Promise<IWeightUpdateResult>;
    /**
     * Calculate average weight for a route (for observability)
     */
    private calculateAverageRouteWeight;
    /**
     * Ensure Fisher Information map exists for a route
     */
    private ensureFisherMap;
    /**
     * Calculate trajectory success rate for a route
     * (Historical average quality for this route)
     */
    private calculateTrajectorySuccessRate;
    /**
     * Get Fisher Information for a pattern
     */
    getFisherInformation(patternId: PatternID, route: Route): number;
    /**
     * Set Fisher Information for a pattern (for testing)
     */
    setFisherInformation(patternId: PatternID, route: Route, importance: number): void;
    /**
     * Save weights to binary file
     *
     * @param path - Optional file path (uses default if not provided)
     */
    saveWeights(path?: string): Promise<void>;
    /**
     * Load weights from binary file
     *
     * @param path - File path to load from
     */
    loadWeights(path?: string): Promise<void>;
    /**
     * Serialize weights to binary format
     * Format: [version(4), metadataLen(4), metadata(JSON), weights(Float32), fisher(Float32), checksum(4)]
     */
    private serializeWeightsBinary;
    /**
     * Deserialize weights from binary format
     */
    private deserializeWeightsBinary;
    /**
     * Export state for persistence
     */
    toJSON(): ISerializedSonaState;
    /**
     * Import state from persistence
     */
    fromJSON(data: ISerializedSonaState): void;
    /**
     * Get statistics about the Sona Engine
     */
    getStats(): {
        trajectoryCount: number;
        routeCount: number;
        totalPatterns: number;
        avgPatternsPerRoute: number;
    };
    /**
     * Get feedback health diagnostics (TRAJECTORY-ORPHAN-FIX diagnostic)
     *
     * Checks the health of the feedback system, specifically tracking:
     * - Hook-generated trajectories created on-demand
     * - Session-end trajectories created on-demand
     * - Overall feedback success rate
     *
     * @returns Feedback health metrics
     */
    getFeedbackHealth(): {
        totalTrajectories: number;
        hookTrajectories: number;
        sessionEndTrajectories: number;
        onDemandCreatedCount: number;
        feedbackSuccessRate: number;
        status: 'healthy' | 'degraded' | 'critical';
        recommendations: string[];
    };
    /**
     * Set the checkpoints directory path
     */
    setCheckpointsDir(path: string): void;
    /**
     * Set baseline weights (for drift comparison)
     */
    setBaselineWeights(weights?: WeightStorage): void;
    /**
     * Check drift from baseline weights
     *
     * @param autoRollback - If true, automatically rollback when drift > reject threshold
     * @returns Drift metrics
     */
    checkDrift(autoRollback?: boolean): Promise<IDriftMetrics>;
    /**
     * Create a checkpoint of current weights
     *
     * @param reason - Reason for creating checkpoint
     * @param markAsBaseline - Optional flag to mark checkpoint as baseline (TECH-TRJ-001)
     * @returns Checkpoint ID
     */
    createCheckpoint(reason?: CheckpointReason, markAsBaseline?: boolean): Promise<string>;
    /**
     * Rollback weights to a checkpoint
     *
     * @param checkpointId - Specific checkpoint ID (uses most recent if not provided)
     * @throws RollbackLoopError if too many rollbacks in short time or attempting to rollback to same checkpoint without progress (TECH-TRJ-001)
     */
    rollbackToCheckpoint(checkpointId?: string): Promise<void>;
    /**
     * Get checkpoint by ID
     */
    getCheckpoint(checkpointId: string): ICheckpointFull | undefined;
    /**
     * List all checkpoints
     */
    listCheckpoints(): ICheckpointFull[];
    /**
     * Get checkpoint count
     */
    getCheckpointCount(): number;
    /**
     * Save a checkpoint to disk
     */
    private saveCheckpoint;
    /**
     * Load a checkpoint from disk
     */
    loadCheckpoint(checkpointId: string): Promise<ICheckpointFull | undefined>;
    /**
     * Load all checkpoints from disk
     */
    loadAllCheckpoints(): Promise<void>;
    /**
     * Prune old checkpoints (keep last N)
     */
    private pruneCheckpoints;
    /**
     * Serialize checkpoint for persistence
     */
    private serializeCheckpoint;
    /**
     * Deserialize checkpoint from persistence
     */
    private deserializeCheckpoint;
    /**
     * Flatten weights map to Float32Array
     */
    private flattenWeightsToVector;
    /**
     * Deep copy weights map
     */
    private deepCopyWeights;
    /**
     * Get the most recent checkpoint
     */
    private getMostRecentCheckpoint;
    /**
     * Get the most recent checkpoint ID
     */
    private getMostRecentCheckpointId;
    /**
     * Reset rollback counter (for testing)
     */
    resetRollbackCounter(): void;
    /**
     * Create a reusable pattern from a high-quality trajectory
     * SPEC-SON-001: Now uses real steps from trajectory
     *
     * @param trajectory - High-quality trajectory to convert to pattern
     * @returns Pattern ID if created, null otherwise
     */
    private createPatternFromTrajectory;
    /**
     * Compress steps for storage efficiency
     * SPEC-SON-001
     */
    private compressStepsForPattern;
    /**
     * Compress action parameters
     */
    private compressParams;
    /**
     * Generate human-readable pattern description
     */
    private generatePatternDescription;
    /**
     * Infer domain from trajectory route
     */
    private inferDomain;
    /**
     * Extract tags from trajectory
     */
    private extractTags;
    /**
     * Generate embedding for a trajectory pattern
     *
     * @param trajectory - Trajectory to generate embedding from
     * @returns Pattern embedding as Float32Array
     */
    private generatePatternEmbedding;
    /**
     * Generate semantic embedding for a string using the real embedding provider (SPEC-EMB-002)
     *
     * @param str - String to embed
     * @returns Float32Array of length VECTOR_DIM (1536) with semantic embedding
     */
    private hashStringToFloat32Array;
    /**
     * Get all created patterns
     *
     * @returns Array of patterns
     */
    getPatterns(): Pattern[];
    /**
     * Get pattern by ID
     *
     * @param patternId - Pattern ID
     * @returns Pattern or undefined
     */
    getPatternById(patternId: string): Pattern | undefined;
    /**
     * Get pattern count
     *
     * @returns Number of patterns
     */
    getPatternStorageCount(): number;
    /**
     * Get current rollback state (TECH-TRJ-001)
     *
     * @returns Rollback state information
     */
    getRollbackState(): IRollbackState;
    /**
     * Check if learning has progressed past a checkpoint (TECH-TRJ-001)
     *
     * Progress is defined as:
     * 1. New trajectories created since checkpoint
     * 2. New checkpoint created since last rollback
     * 3. Weight changes above threshold since checkpoint
     *
     * @param checkpointId - Checkpoint to check progress against
     * @returns true if learning has progressed past checkpoint
     */
    private hasProgressedPastCheckpoint;
    /**
     * Calculate weight difference between two weight storages (TECH-TRJ-001)
     *
     * @param weights1 - First weight storage
     * @param weights2 - Second weight storage
     * @returns Normalized difference (0 = identical, 1 = completely different)
     */
    private calculateWeightDifference;
    /**
     * Determine if a checkpoint should be automatically marked as baseline (TECH-TRJ-001)
     *
     * @returns true if checkpoint should be marked as baseline
     */
    private shouldAutoMarkAsBaseline;
    /**
     * Reset rollback state when learning makes progress (TECH-TRJ-001)
     *
     * Called automatically when:
     * 1. New trajectory is created (indicates progress)
     * 2. New checkpoint is created (indicates progress worth saving)
     */
    private resetRollbackStateIfProgressed;
    /**
     * Sync quality scores from learning_feedback table to trajectory_metadata
     *
     * This method bridges the gap between feedback events (which contain quality scores)
     * and trajectory metadata (which stores quality for pattern creation eligibility).
     *
     * Implements: TASK-QUALITY-SYNC
     * - Queries learning_feedback for records with trajectory_id and quality
     * - Updates corresponding trajectory_metadata.quality_score via DAO
     * - Handles errors gracefully, continuing on individual failures
     *
     * @returns Object with count of synced records and any errors encountered
     */
    syncQualityFromEvents(): Promise<{
        synced: number;
        errors: string[];
    }>;
    /**
     * Convert high-quality trajectories to reusable patterns
     *
     * Queries trajectory_metadata for trajectories with quality >= threshold,
     * then calls createPatternFromTrajectory for each eligible trajectory.
     *
     * Implements: TASK-PATTERN-CONVERT
     * - Default threshold is AUTO_PATTERN_QUALITY_THRESHOLD (0.8) for pattern creation
     * - Supports dry-run mode for previewing without creating
     * - Skips trajectories that already have patterns
     * - Limits conversions per batch to prevent overwhelming the system
     *
     * @param options - Configuration options for conversion
     * @returns Statistics about the conversion process
     */
    convertHighQualityTrajectoriesToPatterns(options?: {
        qualityThreshold?: number;
        dryRun?: boolean;
        maxConversions?: number;
    }): Promise<{
        totalTrajectories: number;
        eligibleTrajectories: number;
        patternsCreated: number;
        errors: string[];
    }>;
    /**
     * Process unprocessed feedback records for batch learning.
     *
     * Retrieves unprocessed feedback from SQLite, updates pattern success/failure counts,
     * creates patterns from exceptional feedback (quality >= AUTO_PATTERN_QUALITY_THRESHOLD = 0.8),
     * and marks records as processed.
     *
     * Implements: TASK-BATCH-LEARN-001
     * - RULE-008: ALL learning data MUST be stored in SQLite
     * - ERR-001: No silent failures - log all errors
     * - Uses LearningFeedbackDAO.findUnprocessed() and markProcessed()
     *
     * @param limit - Maximum records to process per batch (default: 100)
     * @returns Processing statistics including processed count, patterns created, and errors
     *
     * @example
     * ```typescript
     * const engine = createProductionSonaEngine();
     * const stats = await engine.processUnprocessedFeedback(50);
     * console.log(`Processed ${stats.processed} records, created ${stats.patternsCreated} patterns`);
     * ```
     */
    processUnprocessedFeedback(limit?: number): Promise<{
        processed: number;
        patternsCreated: number;
        errors: number;
        details: Array<{
            feedbackId: string;
            trajectoryId: string;
            quality: number;
            status: 'processed' | 'pattern_created' | 'skipped' | 'error';
            reason?: string;
        }>;
    }>;
    /**
     * Get count of unprocessed feedback records awaiting batch learning.
     *
     * @returns Number of unprocessed records, or 0 if persistence is disabled
     */
    getUnprocessedFeedbackCount(): number;
}
/**
 * Create a SonaEngine with database persistence REQUIRED
 *
 * RULE-008: ALL learning data MUST be stored in SQLite
 * RULE-074: Map as primary storage is FORBIDDEN in production
 *
 * This factory function ensures the SonaEngine is properly configured
 * with SQLite persistence. Use this in production code.
 *
 * @param config - Optional SonaConfig (database connection will be added)
 * @param dbPath - Optional database path (defaults to .god-agent/learning.db)
 * @returns SonaEngine with persistence enabled
 *
 * @example
 * ```typescript
 * // Production usage
 * const engine = createProductionSonaEngine();
 *
 * // With custom config
 * const engine = createProductionSonaEngine({
 *   learningRate: 0.02,
 *   trackPerformance: true
 * });
 * ```
 */
export declare function createProductionSonaEngine(config?: Omit<ISonaConfig, 'databaseConnection'>, dbPath?: string): SonaEngine;
export {};
//# sourceMappingURL=sona-engine.d.ts.map