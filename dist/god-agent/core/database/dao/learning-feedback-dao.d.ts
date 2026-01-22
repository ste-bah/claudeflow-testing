/**
 * LearningFeedbackDAO - Data Access Object for Learning Feedback persistence
 *
 * Implements: GAP-DESC-005, RULE-008, RULE-018, RULE-072, RULE-088
 * Constitution:
 *   - RULE-008: ALL learning feedback MUST be stored in SQLite
 *   - RULE-018: Feedback is APPEND-ONLY (NO DELETE, NO UPDATE except processed flag)
 *   - RULE-072: Use withRetrySync for all DB operations
 *   - RULE-074: FORBIDDEN - Map as primary storage
 *   - RULE-088: Quality must be validated (0.0-1.0)
 *
 * This DAO provides SQLite-backed persistence for learning feedback records.
 * CRITICAL: All feedback data MUST be stored in SQLite (RULE-008)
 */
import type { IDatabaseConnection } from '../connection.js';
/**
 * Valid outcome values for feedback
 * Matches CHECK constraint in outcomes.sql
 */
export type FeedbackOutcome = 'positive' | 'negative' | 'neutral';
/**
 * Input for creating new learning feedback
 * Does not include version or processed (set by DAO)
 */
export interface ILearningFeedbackInput {
    /** Unique identifier for this feedback record */
    id: string;
    /** Associated trajectory ID (required) */
    trajectoryId: string;
    /** Optional linked episode ID */
    episodeId?: string;
    /** Optional linked pattern ID */
    patternId?: string;
    /** Quality score 0.0-1.0 (RULE-088 validated) */
    quality: number;
    /** Outcome classification */
    outcome: FeedbackOutcome;
    /** Type of task that generated this feedback */
    taskType: string;
    /** ID of agent that generated this feedback */
    agentId: string;
    /** Length of result in characters (optional) */
    resultLength?: number;
    /** Whether the result contains code blocks */
    hasCodeBlocks?: boolean;
    /** Unix timestamp in milliseconds */
    createdAt: number;
    /** RLM: Whether context injection was successful */
    rlmInjectionSuccess?: boolean;
    /** RLM: Source agent key that produced the injected output */
    rlmSourceAgent?: string;
    /** RLM: Source step index in the pipeline */
    rlmSourceStepIndex?: number;
    /** RLM: Memory domain from which output was retrieved */
    rlmSourceDomain?: string;
}
/**
 * Full learning feedback record including system fields
 */
export interface ILearningFeedback extends ILearningFeedbackInput {
    /** Version number for optimistic locking */
    version: number;
    /** Whether this feedback has been processed for learning */
    processed: boolean;
    /** RLM: Whether context injection was successful (inherited from input) */
    rlmInjectionSuccess?: boolean;
    /** RLM: Source agent key that produced the injected output (inherited from input) */
    rlmSourceAgent?: string;
    /** RLM: Source step index in the pipeline (inherited from input) */
    rlmSourceStepIndex?: number;
    /** RLM: Memory domain from which output was retrieved (inherited from input) */
    rlmSourceDomain?: string;
}
/**
 * LearningFeedbackDAO - SQLite-backed learning feedback persistence
 *
 * Provides CRUD operations for learning feedback with proper validation
 * and APPEND-ONLY semantics per Constitution RULE-018.
 *
 * RULE-074 COMPLIANCE: No Map/in-memory primary storage - all data in SQLite.
 */
export declare class LearningFeedbackDAO {
    private readonly db;
    private insertStmt;
    private selectByIdStmt;
    private selectByTrajectoryIdStmt;
    private selectUnprocessedStmt;
    private countStmt;
    private countUnprocessedStmt;
    private markProcessedStmt;
    constructor(db: IDatabaseConnection);
    /**
     * Ensure additional indexes exist for learning_feedback table
     * The table itself is created by outcomes.sql schema initialization
     */
    private ensureSchema;
    /**
     * Prepare SQL statements for performance
     */
    private prepareStatements;
    /**
     * Validate quality score per RULE-088
     *
     * @param quality - Quality score to validate
     * @throws Error if quality is outside valid range
     */
    private validateQuality;
    /**
     * Validate outcome value
     *
     * @param outcome - Outcome to validate
     * @throws Error if outcome is not a valid value
     */
    private validateOutcome;
    /**
     * Validate and truncate RLM string values
     *
     * @param value - String value to validate
     * @param maxLength - Maximum allowed length (default: 256)
     * @returns Validated/truncated string or null if undefined
     */
    private validateRlmString;
    /**
     * Insert learning feedback into SQLite
     *
     * Implements: RULE-008 (SQLite storage), RULE-072 (retry), RULE-088 (validation)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param feedback - The learning feedback input to persist
     * @throws Error if insert fails after all retry attempts or validation fails
     */
    insert(feedback: ILearningFeedbackInput): void;
    /**
     * Mark feedback as processed
     *
     * This is the ONLY update operation allowed per RULE-018.
     * Used to track which feedback has been consumed by the learning system.
     *
     * @param id - The feedback ID to mark as processed
     * @throws Error if update fails after retry attempts
     */
    markProcessed(id: string): void;
    /**
     * Find feedback by ID
     *
     * @param id - The feedback ID to find
     * @returns The learning feedback or null if not found
     */
    findById(id: string): ILearningFeedback | null;
    /**
     * Find all feedback for a trajectory
     *
     * @param trajectoryId - The trajectory ID to query
     * @returns Array of learning feedback records (newest first)
     */
    findByTrajectoryId(trajectoryId: string): ILearningFeedback[];
    /**
     * Find unprocessed feedback for batch learning
     *
     * @param limit - Maximum number of records to return (default: 100)
     * @returns Array of unprocessed feedback records (oldest first for FIFO processing)
     */
    findUnprocessed(limit?: number): ILearningFeedback[];
    /**
     * Get total count of feedback records
     *
     * @returns Total number of feedback records
     */
    count(): number;
    /**
     * Get count of unprocessed feedback records
     *
     * @returns Number of feedback records awaiting processing
     */
    countUnprocessed(): number;
    /**
     * Check if feedback exists
     *
     * @param id - The feedback ID to check
     * @returns True if the feedback exists
     */
    exists(id: string): boolean;
    /**
     * Delete a feedback record by ID
     *
     * RULE-018 VIOLATION: Learning feedback is append-only. DELETE operations are FORBIDDEN.
     *
     * @param _id - The feedback ID (unused - operation forbidden)
     * @throws Error Always throws - DELETE is forbidden per RULE-018
     */
    delete(_id: string): never;
    /**
     * Clear all feedback records
     *
     * RULE-018 VIOLATION: Learning feedback is append-only. DELETE/CLEAR operations are FORBIDDEN.
     *
     * @throws Error Always throws - CLEAR is forbidden per RULE-018
     */
    clear(): never;
    /**
     * Get storage statistics for observability
     *
     * @returns Statistics about stored feedback
     */
    getStats(): {
        feedbackCount: number;
        processedCount: number;
        unprocessedCount: number;
        avgQuality: number;
        outcomeBreakdown: {
            positive: number;
            negative: number;
            neutral: number;
        };
    };
    /**
     * Convert a database row to an ILearningFeedback object
     */
    private rowToFeedback;
}
//# sourceMappingURL=learning-feedback-dao.d.ts.map