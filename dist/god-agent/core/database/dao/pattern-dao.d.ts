/**
 * PatternDAO - Data Access Object for Pattern persistence
 *
 * Implements: TASK-PERSIST-002, GAP-PATTERN-001
 * Constitution: RULE-008 (SQLite for all pattern data), RULE-019 (no DELETE),
 *               RULE-072 (withRetrySync), RULE-013 (patterns table), RULE-023 (indexes)
 *
 * This DAO provides SQLite-backed persistence for learned patterns.
 * CRITICAL: All pattern data MUST be stored in SQLite (RULE-008)
 * CRITICAL: NO hard DELETE - use soft delete via deprecated flag (RULE-019)
 * CRITICAL: Map as primary storage is FORBIDDEN (RULE-074)
 */
import type { IDatabaseConnection } from '../connection.js';
/**
 * Input interface for creating a new pattern
 */
export interface IPatternInput {
    id: string;
    name: string;
    context: string;
    action: string;
    outcome?: string;
    embedding: Float32Array;
    weight?: number;
    trajectoryIds: string[];
    agentId: string;
    taskType: string;
    createdAt: number;
    tags?: string[];
}
/**
 * Full pattern interface including all computed fields
 */
export interface IPattern {
    id: string;
    name: string;
    context: string;
    action: string;
    outcome?: string;
    embedding: Float32Array;
    weight: number;
    trajectoryIds: string[];
    successCount: number;
    failureCount: number;
    agentId: string;
    taskType: string;
    createdAt: number;
    updatedAt: number;
    version: number;
    deprecated: boolean;
    tags: string[];
}
/**
 * PatternDAO - SQLite-backed pattern persistence
 *
 * Provides CRUD operations for learned patterns with proper serialization
 * of Float32Array embeddings to/from SQLite BLOB storage.
 *
 * FORBIDDEN OPERATIONS:
 * - Hard DELETE (RULE-019) - use deprecate() instead
 * - Map as primary storage (RULE-074)
 */
export declare class PatternDAO {
    private readonly db;
    private insertStmt;
    private selectByIdStmt;
    private selectByTaskTypeStmt;
    private selectActiveStmt;
    private countStmt;
    private updateWeightStmt;
    private incrementSuccessStmt;
    private incrementFailureStmt;
    private deprecateStmt;
    constructor(db: IDatabaseConnection);
    /**
     * Ensure the patterns table exists
     * Schema is loaded from patterns.sql by DatabaseConnection
     * This method validates the table exists
     */
    private ensureSchema;
    /**
     * Prepare SQL statements for performance
     */
    private prepareStatements;
    /**
     * Insert a pattern into SQLite
     *
     * Implements: TASK-PERSIST-002, RULE-072 (database retry on failure)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param pattern - The pattern input to persist
     * @throws Error if insert fails after all retry attempts
     */
    insert(pattern: IPatternInput): void;
    /**
     * Update the weight of a pattern
     * Used for learning/reinforcement
     *
     * @param id - Pattern ID
     * @param weight - New weight value (0.0 to 1.0)
     * @throws Error if weight is out of range or update fails
     */
    updateWeight(id: string, weight: number): void;
    /**
     * Increment the success count for a pattern
     * Used when a pattern leads to successful outcome
     *
     * @param id - Pattern ID
     */
    incrementSuccess(id: string): void;
    /**
     * Increment the failure count for a pattern
     * Used when a pattern leads to unsuccessful outcome
     *
     * @param id - Pattern ID
     */
    incrementFailure(id: string): void;
    /**
     * Soft-delete a pattern by setting deprecated=1
     * RULE-019: Hard DELETE is FORBIDDEN - use this instead
     *
     * @param id - Pattern ID to deprecate
     */
    deprecate(id: string): void;
    /**
     * Find a pattern by ID
     *
     * @param id - The pattern ID to find
     * @returns The pattern or null if not found
     */
    findById(id: string): IPattern | null;
    /**
     * Find all patterns for a given task type
     * Only returns active (non-deprecated) patterns
     *
     * @param taskType - The task type to filter by
     * @returns Array of patterns sorted by weight (highest first)
     */
    findByTaskType(taskType: string): IPattern[];
    /**
     * Find all active (non-deprecated) patterns
     *
     * @returns Array of active patterns sorted by weight (highest first)
     */
    findActive(): IPattern[];
    /**
     * Get the total count of patterns (including deprecated)
     *
     * @returns The total number of patterns in storage
     */
    count(): number;
    /**
     * Check if a pattern exists
     *
     * @param id - The pattern ID to check
     * @returns True if the pattern exists
     */
    exists(id: string): boolean;
    /**
     * Delete a pattern by ID
     *
     * RULE-019 VIOLATION: Patterns cannot be deleted. Use deprecate() instead.
     *
     * @param _id - The pattern ID (unused - operation forbidden)
     * @throws Error Always throws - DELETE is forbidden per RULE-019
     */
    delete(_id: string): never;
    /**
     * Clear all patterns
     *
     * RULE-019 VIOLATION: Patterns cannot be deleted. This operation is FORBIDDEN.
     *
     * @throws Error Always throws - CLEAR is forbidden per RULE-019
     */
    clear(): never;
    /**
     * Get storage and usage statistics for observability
     */
    getStats(): {
        totalCount: number;
        activeCount: number;
        deprecatedCount: number;
        totalSuccessCount: number;
        totalFailureCount: number;
        averageWeight: number;
        successRate: number;
    };
    /**
     * Serialize Float32Array to Buffer for SQLite BLOB storage
     * Format: [length:4bytes][data:length*4bytes]
     */
    private serializeEmbedding;
    /**
     * Deserialize Buffer from SQLite BLOB to Float32Array
     */
    private deserializeEmbedding;
    /**
     * Convert a database row to an IPattern
     */
    private rowToPattern;
}
//# sourceMappingURL=pattern-dao.d.ts.map