/**
 * Training History Manager - TASK-GNN-004
 *
 * Implements loss history persistence for GNN training progress tracking.
 * Loss values survive restarts per Constitution RULE-009 (Zero data loss).
 *
 * Implements:
 * - RULE-008: Persist to SQLite
 * - RULE-009: Zero data loss - training history survives restarts
 * - RULE-072: Database operations retry on failure (max 3 attempts)
 *
 * Performance targets:
 * - recordBatch: <5ms per record
 * - getHistory: <10ms for 1000 records
 * - getLossTrend: <5ms for window of 100
 *
 * @module src/god-agent/core/reasoning/training-history
 */
import type { IDatabaseConnection } from '../database/connection.js';
/**
 * Training record for a single batch during GNN training
 *
 * Represents one training iteration with associated metrics
 */
export interface TrainingRecord {
    /** Unique identifier for this record (format: "train_{epoch}_{batch}_{timestamp}") */
    id: string;
    /** Training epoch number (0-indexed) */
    epoch: number;
    /** Batch index within the epoch */
    batchIndex: number;
    /** Training loss value for this batch */
    loss: number;
    /** Optional validation loss if validation was performed */
    validationLoss?: number;
    /** Learning rate used for this batch */
    learningRate: number;
    /** Number of samples in this batch */
    samplesCount: number;
    /** Optional path to checkpoint file if checkpoint was saved */
    checkpointPath?: string;
    /** Timestamp when record was created */
    createdAt?: Date;
}
/**
 * Training statistics summary
 */
export interface ITrainingStats {
    /** Total number of training records */
    totalRecords: number;
    /** Number of unique epochs */
    uniqueEpochs: number;
    /** Lowest loss value recorded */
    minLoss: number;
    /** Highest loss value recorded */
    maxLoss: number;
    /** Average loss across all records */
    averageLoss: number;
    /** Total samples processed */
    totalSamples: number;
    /** Latest learning rate */
    latestLearningRate: number;
}
/**
 * TrainingHistoryManager - SQLite-backed training history persistence
 *
 * Provides CRUD operations for GNN training records with proper
 * retry logic and transaction support per Constitution RULE-008, RULE-009, RULE-072.
 *
 * @example
 * ```typescript
 * const manager = new TrainingHistoryManager(dbConnection);
 *
 * // Record a training batch
 * await manager.recordBatch({
 *   id: 'train_0_0_1234567890',
 *   epoch: 0,
 *   batchIndex: 0,
 *   loss: 0.5,
 *   learningRate: 0.001,
 *   samplesCount: 32
 * });
 *
 * // Get loss trend
 * const trend = await manager.getLossTrend(10);
 * console.log('Loss trend:', trend);
 * ```
 */
export declare class TrainingHistoryManager {
    private readonly db;
    private insertStmt;
    private selectByIdStmt;
    private selectAllStmt;
    private selectByEpochRangeStmt;
    private selectLatestLossStmt;
    private selectRecentLossesStmt;
    private countStmt;
    private deleteOlderThanStmt;
    /**
     * Create a new TrainingHistoryManager
     *
     * @param db - Database connection implementing IDatabaseConnection
     */
    constructor(db: IDatabaseConnection);
    /**
     * Ensure the training history table and indexes exist
     * Implements: RULE-008 (SQLite persistence), RULE-023 (indexes)
     */
    private ensureSchema;
    /**
     * Prepare SQL statements for performance
     * Pre-compiled statements reduce parsing overhead
     */
    private prepareStatements;
    /**
     * Record a training batch result
     *
     * Implements: RULE-009 (Zero data loss), RULE-072 (retry on failure)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param record - Training record to persist
     * @throws Error if insert fails after all retry attempts
     */
    recordBatch(record: TrainingRecord): Promise<void>;
    /**
     * Record multiple training batches in a single transaction
     *
     * Implements: RULE-046 (atomic operations), RULE-009 (Zero data loss)
     * All records are inserted atomically - either all succeed or none do.
     *
     * @param records - Array of training records to persist
     * @throws Error if transaction fails
     */
    recordBatchBulk(records: TrainingRecord[]): Promise<void>;
    /**
     * Get training history with optional epoch range filter
     *
     * @param epochRange - Optional range to filter by epoch
     * @returns Array of training records (ordered by epoch/batch for ranges, by created_at DESC otherwise)
     */
    getHistory(epochRange?: {
        start: number;
        end: number;
    }): Promise<TrainingRecord[]>;
    /**
     * Get the most recent loss value
     *
     * @returns Latest loss value or null if no records exist
     */
    getLatestLoss(): Promise<number | null>;
    /**
     * Get loss trend as an array of recent loss values
     *
     * Returns loss values in chronological order (oldest to newest)
     * to facilitate trend analysis.
     *
     * @param windowSize - Number of recent losses to retrieve
     * @returns Array of loss values (oldest to newest)
     */
    getLossTrend(windowSize: number): Promise<number[]>;
    /**
     * Cleanup old training records
     *
     * Removes records older than the specified date.
     * Use with caution - this permanently deletes historical data.
     *
     * @param olderThan - Delete records created before this date
     * @returns Number of records deleted
     */
    cleanup(olderThan: Date): Promise<number>;
    /**
     * Get a specific training record by ID
     *
     * @param recordId - Record ID to find
     * @returns Training record or null if not found
     */
    findById(recordId: string): Promise<TrainingRecord | null>;
    /**
     * Get the count of training records
     *
     * @returns Total number of records
     */
    count(): Promise<number>;
    /**
     * Check if a training record exists
     *
     * @param recordId - Record ID to check
     * @returns True if record exists
     */
    exists(recordId: string): Promise<boolean>;
    /**
     * Get training statistics summary
     *
     * @returns Statistics about all training records
     */
    getStats(): Promise<ITrainingStats>;
    /**
     * Get loss values for a specific epoch
     *
     * @param epoch - Epoch number to query
     * @returns Array of training records for that epoch
     */
    getEpochHistory(epoch: number): Promise<TrainingRecord[]>;
    /**
     * Calculate the average loss for a specific epoch
     *
     * @param epoch - Epoch number to calculate average for
     * @returns Average loss or null if no records for that epoch
     */
    getEpochAverageLoss(epoch: number): Promise<number | null>;
    /**
     * Get the best (lowest) loss and its associated record
     *
     * @returns Best training record or null if no records exist
     */
    getBestLoss(): Promise<TrainingRecord | null>;
    /**
     * Check if loss is improving (decreasing trend)
     *
     * @param windowSize - Number of recent losses to analyze (minimum 2)
     * @returns True if loss is trending downward, false otherwise
     */
    isLossImproving(windowSize?: number): Promise<boolean>;
    /**
     * Generate a unique record ID
     *
     * @param epoch - Epoch number
     * @param batchIndex - Batch index
     * @returns Unique record ID
     */
    static generateRecordId(epoch: number, batchIndex: number): string;
    /**
     * Convert database row to TrainingRecord
     */
    private rowToRecord;
}
//# sourceMappingURL=training-history.d.ts.map