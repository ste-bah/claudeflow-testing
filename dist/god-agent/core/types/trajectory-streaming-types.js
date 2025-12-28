/**
 * Trajectory Streaming to Disk - Type Definitions
 *
 * @module trajectory-streaming-types
 * @version 1.2
 * @description Type definitions for trajectory streaming functionality implementing
 * SPEC-TRJ-001 v1.2. Provides interfaces for configuration, statistics, errors,
 * and binary format schemas.
 *
 * @since v1.0
 */
/**
 * Default configuration values for trajectory streaming.
 * All fields use production-optimized defaults.
 *
 * @constant DEFAULT_STREAMING_CONFIG
 * @since v1.0
 */
export const DEFAULT_STREAMING_CONFIG = {
    memoryWindowSize: 1000,
    batchWriteSize: 10,
    batchWriteIntervalMs: 5000,
    storageDir: '.agentdb/sona/trajectories',
    compressionEnabled: true,
    enableIndexing: true,
    trajectoriesPerFile: 10000,
    minCheckpoints: 2,
    queryQueueSize: 10,
    memoryPressureThreshold: 0.85,
    readOnly: false,
    maxMetadataEntries: 10000, // 10x default memoryWindowSize
};
/**
 * Error codes for trajectory streaming operations.
 *
 * Categorized by subsystem: storage, memory, deletion, rollback,
 * multi-process, and migration errors.
 *
 * @enum TrajectoryStreamError
 * @since v1.0
 */
export var TrajectoryStreamError;
(function (TrajectoryStreamError) {
    // Base storage errors (v1.0)
    /**
     * Disk storage is full or quota exceeded.
     *
     * @since v1.0
     */
    TrajectoryStreamError["ERR_STORAGE_FULL"] = "ERR_STORAGE_FULL";
    /**
     * Search index is corrupted and needs rebuilding.
     *
     * @since v1.0
     */
    TrajectoryStreamError["ERR_INDEX_CORRUPTED"] = "ERR_INDEX_CORRUPTED";
    /**
     * Requested trajectory file not found on disk.
     *
     * @since v1.0
     */
    TrajectoryStreamError["ERR_FILE_NOT_FOUND"] = "ERR_FILE_NOT_FOUND";
    // Memory safety errors (v1.1)
    /**
     * Memory pressure is high; operation blocked to prevent OOM.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_MEMORY_PRESSURE"] = "ERR_MEMORY_PRESSURE";
    /**
     * Query result set too large for available memory.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_QUERY_TOO_LARGE"] = "ERR_QUERY_TOO_LARGE";
    /**
     * Query queue is full; too many concurrent queries.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_QUERY_QUEUE_FULL"] = "ERR_QUERY_QUEUE_FULL";
    // Deletion safety errors (v1.1)
    /**
     * Cannot delete baseline checkpoint without force flag.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_DELETE_BASELINE"] = "ERR_DELETE_BASELINE";
    /**
     * Cannot delete last checkpoint; at least one must remain.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_DELETE_LAST_CHECKPOINT"] = "ERR_DELETE_LAST_CHECKPOINT";
    /**
     * Prune operation would exceed configured limits.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_PRUNE_LIMIT_EXCEEDED"] = "ERR_PRUNE_LIMIT_EXCEEDED";
    // Rollback safety errors (v1.1, COMPLETE in v1.2)
    /**
     * Rollback loop detected: same checkpoint rolled back to without progress.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_ROLLBACK_LOOP"] = "ERR_ROLLBACK_LOOP";
    /**
     * Checkpoint not found or invalid.
     *
     * @since v1.1
     */
    TrajectoryStreamError["ERR_INVALID_CHECKPOINT"] = "ERR_INVALID_CHECKPOINT";
    // Multi-process safety errors (v1.2)
    /**
     * Another process is using this storage directory.
     *
     * @since v1.2
     * @deprecated MEM-001: Multi-process access now handled by MemoryServer
     */
    TrajectoryStreamError["ERR_MULTI_PROCESS"] = "ERR_MULTI_PROCESS";
    /**
     * Operation not allowed in read-only mode.
     *
     * @since v1.2
     */
    TrajectoryStreamError["ERR_READ_ONLY"] = "ERR_READ_ONLY";
    /**
     * Cannot unmark the last baseline checkpoint.
     *
     * @since v1.2
     */
    TrajectoryStreamError["ERR_LAST_BASELINE"] = "ERR_LAST_BASELINE";
    // Migration errors (v1.2)
    /**
     * Version migration failed.
     *
     * @since v1.2
     */
    TrajectoryStreamError["ERR_MIGRATION_FAILED"] = "ERR_MIGRATION_FAILED";
    /**
     * Unsupported or unknown file format version.
     *
     * @since v1.2
     */
    TrajectoryStreamError["ERR_UNSUPPORTED_VERSION"] = "ERR_UNSUPPORTED_VERSION";
    /**
     * Backup creation failed before migration.
     *
     * @since v1.2
     */
    TrajectoryStreamError["ERR_BACKUP_FAILED"] = "ERR_BACKUP_FAILED";
})(TrajectoryStreamError || (TrajectoryStreamError = {}));
// ==================== Error Classes ====================
/**
 * Error thrown when multi-process conflict detected.
 * @deprecated MEM-001: Multi-process access now handled by MemoryServer.
 * Kept for backwards compatibility but no longer thrown.
 */
export class ERR_MULTI_PROCESS extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_MULTI_PROCESS';
    }
}
/**
 * Error thrown when rollback loop detected.
 */
export class ERR_ROLLBACK_LOOP extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_ROLLBACK_LOOP';
    }
}
/**
 * Error thrown when checkpoint is invalid.
 */
export class ERR_INVALID_CHECKPOINT extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_INVALID_CHECKPOINT';
    }
}
/**
 * Error thrown when migration fails.
 */
export class ERR_MIGRATION_FAILED extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_MIGRATION_FAILED';
    }
}
/**
 * Error thrown when attempting to delete baseline checkpoint.
 */
export class ERR_DELETE_BASELINE extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_DELETE_BASELINE';
    }
}
/**
 * Error thrown when operation not allowed in read-only mode.
 */
export class ERR_READ_ONLY extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_READ_ONLY';
    }
}
//# sourceMappingURL=trajectory-streaming-types.js.map