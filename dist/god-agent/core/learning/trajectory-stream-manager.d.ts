/**
 * Trajectory Stream Manager
 * TECH-TRJ-001 - Trajectory Streaming to Disk Implementation
 *
 * Manages streaming of trajectory data to disk with:
 * - Memory window (hot cache)
 * - Binary encoding with LZ4 compression
 * - Version migration (v1 -> v2)
 * - Rollback loop detection
 * - Multi-process safety
 * - Deletion API with safeguards
 */
import type { ITrajectory, TrajectoryID } from './sona-types.js';
import type { ITrajectoryStreamConfig, IStreamStats, IRollbackState, IDeleteResult, IPruneFilter, IMigrationOptions, IMigrationResult } from '../types/trajectory-streaming-types.js';
/**
 * Trajectory Stream Manager
 *
 * Manages the lifecycle of trajectories from memory window to disk storage.
 */
export declare class TrajectoryStreamManager {
    private config;
    private memoryWindow;
    private metadata;
    private rollbackState;
    private flushMutex;
    private pendingWrites;
    private currentFileIndex;
    private stats;
    private queryQueue;
    private activeQueries;
    constructor(config: Partial<ITrajectoryStreamConfig>);
    /**
     * Initialize the stream manager
     * - Load index from disk
     * - Check for multi-process conflicts
     * - Auto-migrate if enabled
     */
    initialize(): Promise<void>;
    /**
     * Add trajectory to stream
     * - Add to memory window
     * - Trigger eviction if needed
     * - Auto-flush if batch size reached
     */
    addTrajectory(trajectory: ITrajectory): Promise<void>;
    /**
     * Get trajectory by ID
     * - Check memory window first
     * - Then check disk
     */
    getTrajectory(id: TrajectoryID): Promise<ITrajectory | null>;
    /**
     * Get current statistics
     */
    getStats(): IStreamStats;
    /**
     * Flush pending writes to disk
     */
    flush(): Promise<void>;
    /**
     * Record a rollback (CRITICAL-004)
     */
    recordRollback(checkpointId: string): Promise<void>;
    /**
     * Get current rollback state
     */
    getRollbackState(): IRollbackState;
    /**
     * Delete a single trajectory (Deletion API)
     */
    deleteTrajectory(id: TrajectoryID, force?: boolean): Promise<IDeleteResult>;
    /**
     * Prune trajectories in bulk (Deletion API)
     */
    pruneTrajectories(filter: IPruneFilter): Promise<IDeleteResult>;
    /**
     * Migrate data files to target version (CRITICAL-005)
     */
    migrateToVersion(targetVersion: number, options?: IMigrationOptions): Promise<IMigrationResult>;
    /**
     * Detect format version of data files
     */
    detectVersion(): Promise<number>;
    /**
     * Evict oldest trajectory from memory window to pending writes
     */
    private evictOldest;
    /**
     * Prune oldest metadata entries when limit exceeded (ANTI-005)
     *
     * Uses LRU eviction: removes entries with oldest createdAt timestamps.
     * Only prunes metadata for trajectories that have been flushed to disk.
     */
    private pruneMetadata;
    /**
     * Flush pending writes to disk
     */
    private flushPendingWrites;
    /**
     * Read trajectory from disk
     */
    private readTrajectoryFromDisk;
    /**
     * Load index from disk
     */
    private loadIndex;
    /**
     * Load index file
     */
    private loadIndexFile;
    /**
     * Save index to disk
     */
    private saveIndex;
    /**
     * Save index file
     */
    private saveIndexFile;
    /**
     * Get data file information
     */
    private getDataFileInfo;
    /**
     * Update memory statistics
     */
    private updateMemoryStats;
    /**
     * Acquire query slot
     */
    private acquireQuerySlot;
    /**
     * Release query slot
     */
    private releaseQuerySlot;
    /**
     * Encode v1 format (simple length-prefixed JSON records)
     */
    private encodeV1;
    /**
     * Decode v1 format
     */
    private decodeV1;
    /**
     * Decode v2 format
     */
    private decodeV2;
    /**
     * Encode v2 format
     */
    private encodeV2;
    /**
     * Check if data is LZ4 compressed
     */
    private isLZ4Compressed;
    /**
     * Migrate trajectories from one version to another
     */
    private migrateTrajectories;
    /**
     * Read data file with version detection
     */
    private readDataFile;
    /**
     * Write data file with version encoding
     */
    private writeDataFile;
    /**
     * Create backup of storage directory
     */
    private createBackup;
    /**
     * Save rollback state to disk
     */
    private saveRollbackState;
}
//# sourceMappingURL=trajectory-stream-manager.d.ts.map