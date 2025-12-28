/**
 * Trajectory Streaming Types
 * TECH-TRJ-001 - Trajectory Streaming to Disk
 *
 * Type definitions for streaming trajectory data to disk
 * with binary encoding, version migration, and rollback loop detection.
 */
// ==================== Error Classes ====================
/**
 * Error thrown when multiple processes access same storage directory
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
 * Error thrown when rollback loop is detected
 */
export class ERR_ROLLBACK_LOOP extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_ROLLBACK_LOOP';
    }
}
/**
 * Error thrown when checkpoint is invalid
 */
export class ERR_INVALID_CHECKPOINT extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_INVALID_CHECKPOINT';
    }
}
/**
 * Error thrown when migration fails
 */
export class ERR_MIGRATION_FAILED extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_MIGRATION_FAILED';
    }
}
/**
 * Error thrown when deletion would violate safety constraints
 */
export class ERR_DELETE_BASELINE extends Error {
    constructor(message) {
        super(message);
        this.name = 'ERR_DELETE_BASELINE';
    }
}
//# sourceMappingURL=trajectory-streaming-types.js.map