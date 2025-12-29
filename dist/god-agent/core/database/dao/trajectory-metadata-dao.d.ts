/**
 * TrajectoryMetadataDAO - Data Access Object for Trajectory Metadata persistence
 *
 * Implements: GAP-DESC-005, GAP-DESC-007, SPEC-FUNC-LEARNING
 * Constitution: RULE-008 (SQLite for all learning data), RULE-016 (append-only),
 *               RULE-023 (indexes), RULE-072 (retry with exponential backoff)
 *
 * This DAO provides SQLite-backed persistence for trajectory metadata.
 * Binary trajectory data is stored in .agentdb/sona/trajectories/ files;
 * this table stores only metadata and file references.
 *
 * CRITICAL: RULE-016 - trajectory_metadata is APPEND-ONLY
 * - DELETE operations are FORBIDDEN
 * - UPDATE only allowed for: status, quality_score, completed_at, version
 */
import type { IDatabaseConnection } from '../connection.js';
/**
 * Valid status values for trajectory metadata
 */
export type TrajectoryStatus = 'active' | 'completed' | 'failed' | 'abandoned';
/**
 * Input interface for creating new trajectory metadata
 * Used when inserting new records
 */
export interface ITrajectoryMetadataInput {
    id: string;
    filePath: string;
    fileOffset: number;
    fileLength: number;
    route: string;
    stepCount: number;
    qualityScore?: number;
    createdAt: number;
    status?: TrajectoryStatus;
}
/**
 * Full trajectory metadata interface including all fields
 * Returned from database queries
 */
export interface ITrajectoryMetadata extends ITrajectoryMetadataInput {
    completedAt?: number;
    version: number;
}
/**
 * TrajectoryMetadataDAO - SQLite-backed trajectory metadata persistence
 *
 * Provides CRUD operations for trajectory metadata with proper enforcement
 * of RULE-016 (append-only) and RULE-072 (retry on failure).
 *
 * Key features:
 * - Insert new trajectory metadata (with retry)
 * - Update status (with retry) - ONLY status, quality_score, completed_at allowed
 * - Update quality score (with retry)
 * - Query by ID or status
 * - Aggregate statistics for observability
 * - DELETE/CLEAR operations throw errors (RULE-016)
 */
export declare class TrajectoryMetadataDAO {
    private readonly db;
    private insertStmt;
    private updateStatusStmt;
    private updateQualityStmt;
    private selectByIdStmt;
    private selectByStatusStmt;
    private selectAllStmt;
    private countStmt;
    constructor(db: IDatabaseConnection);
    /**
     * Ensure the trajectory_metadata table and indexes exist
     * Schema matches outcomes.sql lines 98-127
     */
    private ensureSchema;
    /**
     * Prepare SQL statements for performance
     */
    private prepareStatements;
    /**
     * Insert a new trajectory metadata record
     *
     * Implements: RULE-072 (database retry on failure)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param metadata - The trajectory metadata to insert
     * @throws Error if insert fails after all retry attempts
     */
    insert(metadata: ITrajectoryMetadataInput): void;
    /**
     * Update the status of a trajectory
     *
     * RULE-016 COMPLIANCE: Only status, completed_at, and version can be updated.
     * Other fields are immutable after creation.
     *
     * @param id - The trajectory ID
     * @param status - New status value
     * @param completedAt - Optional completion timestamp (epoch ms)
     * @throws Error if update fails after all retry attempts
     */
    updateStatus(id: string, status: TrajectoryStatus, completedAt?: number): void;
    /**
     * Update the quality score of a trajectory
     *
     * RULE-016 COMPLIANCE: Only quality_score and version can be updated.
     * Other fields are immutable after creation.
     *
     * @param id - The trajectory ID
     * @param qualityScore - Quality score between 0.0 and 1.0
     * @throws Error if qualityScore is out of range or update fails
     */
    updateQuality(id: string, qualityScore: number): void;
    /**
     * Find trajectory metadata by ID
     *
     * @param id - The trajectory ID to find
     * @returns The trajectory metadata or null if not found
     */
    findById(id: string): ITrajectoryMetadata | null;
    /**
     * Find all trajectory metadata with a specific status
     *
     * @param status - Status to filter by
     * @returns Array of matching trajectory metadata (newest first)
     */
    findByStatus(status: TrajectoryStatus): ITrajectoryMetadata[];
    /**
     * Get all trajectory metadata
     *
     * @returns Array of all trajectory metadata (newest first)
     */
    findAll(): ITrajectoryMetadata[];
    /**
     * Get the count of trajectory metadata records
     *
     * @returns The number of records in storage
     */
    count(): number;
    /**
     * Check if trajectory metadata exists
     *
     * @param id - The trajectory ID to check
     * @returns True if the metadata exists
     */
    exists(id: string): boolean;
    /**
     * Delete trajectory metadata by ID
     *
     * RULE-016 VIOLATION: Trajectory metadata is append-only. DELETE operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @param _id - The trajectory ID (unused - operation forbidden)
     * @throws Error Always throws - DELETE is forbidden per RULE-016
     */
    delete(_id: string): never;
    /**
     * Clear all trajectory metadata
     *
     * RULE-016 VIOLATION: Trajectory metadata is append-only. DELETE/CLEAR operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @throws Error Always throws - CLEAR is forbidden per RULE-016
     */
    clear(): never;
    /**
     * Convert a database row to ITrajectoryMetadata
     */
    private rowToMetadata;
    /**
     * Get storage and trajectory statistics for observability
     *
     * @returns Aggregate statistics about stored trajectories
     */
    getStats(): {
        totalCount: number;
        activeCount: number;
        completedCount: number;
        failedCount: number;
        abandonedCount: number;
        avgQualityScore: number | null;
        avgStepCount: number | null;
        totalFileBytes: number;
    };
    /**
     * Find trajectories by route pattern
     *
     * @param routePattern - Route string to match (exact match)
     * @returns Array of matching trajectory metadata
     */
    findByRoute(routePattern: string): ITrajectoryMetadata[];
    /**
     * Find trajectories within a time range
     *
     * @param startTime - Start timestamp (epoch ms, inclusive)
     * @param endTime - End timestamp (epoch ms, inclusive)
     * @returns Array of matching trajectory metadata
     */
    findByTimeRange(startTime: number, endTime: number): ITrajectoryMetadata[];
    /**
     * Find trajectories with quality score above threshold
     *
     * @param minQuality - Minimum quality score (0.0 to 1.0)
     * @returns Array of matching trajectory metadata
     */
    findByMinQuality(minQuality: number): ITrajectoryMetadata[];
}
//# sourceMappingURL=trajectory-metadata-dao.d.ts.map