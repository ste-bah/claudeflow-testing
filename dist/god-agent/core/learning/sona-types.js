/**
 * Sona Engine Types
 * TASK-SON-001 - Trajectory-Based Learning Type Definitions
 *
 * Defines types for trajectory tracking, weight management,
 * and learning metrics in the Sona Engine.
 */
// ==================== Error Types ====================
/**
 * Error thrown when trajectory validation fails
 */
export class TrajectoryValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TrajectoryValidationError';
    }
}
/**
 * Error thrown when weight update fails
 */
export class WeightUpdateError extends Error {
    patternId;
    constructor(patternId, message) {
        super(`Weight update failed for pattern ${patternId}: ${message}`);
        this.patternId = patternId;
        this.name = 'WeightUpdateError';
    }
}
/**
 * Error thrown when drift exceeds threshold
 */
export class DriftExceededError extends Error {
    drift;
    threshold;
    constructor(drift, threshold) {
        super(`Drift ${drift.toFixed(3)} exceeds threshold ${threshold}`);
        this.drift = drift;
        this.threshold = threshold;
        this.name = 'DriftExceededError';
    }
}
/**
 * Error thrown when feedback validation fails
 */
export class FeedbackValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FeedbackValidationError';
    }
}
/**
 * Error thrown when weight persistence fails
 */
export class WeightPersistenceError extends Error {
    operation;
    constructor(operation, message) {
        super(`Weight ${operation} failed: ${message}`);
        this.operation = operation;
        this.name = 'WeightPersistenceError';
    }
}
/**
 * Error thrown when rollback loop is detected
 */
export class RollbackLoopError extends Error {
    rollbackCount;
    timeWindowMs;
    constructor(rollbackCount, timeWindowMs) {
        super(`Rollback loop detected: ${rollbackCount} rollbacks in ${timeWindowMs}ms`);
        this.rollbackCount = rollbackCount;
        this.timeWindowMs = timeWindowMs;
        this.name = 'RollbackLoopError';
    }
}
/**
 * Error thrown when checkpoint operation fails
 */
export class CheckpointError extends Error {
    operation;
    constructor(operation, message) {
        super(`Checkpoint ${operation} failed: ${message}`);
        this.operation = operation;
        this.name = 'CheckpointError';
    }
}
//# sourceMappingURL=sona-types.js.map