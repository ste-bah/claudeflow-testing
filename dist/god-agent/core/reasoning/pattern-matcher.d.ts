/**
 * Pattern Matcher - Template-based Pattern Retrieval
 *
 * Implements: TASK-PAT-001 (Pattern Matcher)
 *
 * Main PatternMatcher class providing pattern retrieval, creation, and management.
 * Performance targets:
 * - Pattern retrieval: <5ms for k=100
 * - Confidence scoring: <1ms per pattern
 */
import { VectorDB } from '../vector-db/index.js';
import { MemoryEngine } from '../memory/index.js';
import { Pattern, PatternQuery, PatternResult, PatternStats, CreatePatternParams, UpdateSuccessParams, PruneParams, PruneResult, TaskType } from './pattern-types.js';
/**
 * Main PatternMatcher class
 *
 * Provides template-based retrieval of successful reasoning patterns
 * using HNSW vector search and confidence scoring.
 */
export declare class PatternMatcher {
    private patternStore;
    private vectorDB;
    private initialized;
    /**
     * Create a new PatternMatcher instance
     *
     * @param vectorDB - VectorDB instance for HNSW search
     * @param memoryEngine - MemoryEngine instance for persistence
     */
    constructor(vectorDB: VectorDB, memoryEngine: MemoryEngine);
    /**
     * Initialize the pattern matcher by loading patterns from storage
     */
    initialize(): Promise<void>;
    /**
     * Find patterns matching a query
     *
     * Performance target: <5ms for k=100
     *
     * @param query - Pattern query parameters
     * @returns Array of ranked pattern results
     */
    findPatterns(query: PatternQuery): Promise<PatternResult[]>;
    /**
     * Create a new pattern
     *
     * Only creates patterns with successRate >= 0.1 (sanity floor)
     *
     * @param params - Pattern creation parameters
     * @returns Created pattern
     * @throws Error if successRate < 0.1 or duplicate detected
     */
    createPattern(params: CreatePatternParams): Promise<Pattern>;
    /**
     * Update pattern success using exponential moving average
     *
     * Formula: newSuccessRate = alpha * newValue + (1 - alpha) * oldSuccessRate
     * where alpha = 0.2
     *
     * @param params - Update parameters
     * @returns Updated pattern
     * @throws Error if pattern not found
     */
    updatePatternSuccess(params: UpdateSuccessParams): Promise<Pattern>;
    /**
     * Update pattern SONA weight
     *
     * @param patternId - Pattern ID to update
     * @param weight - New SONA weight [0, 1]
     * @returns Updated pattern
     * @throws Error if pattern not found or weight invalid
     */
    updatePatternSonaWeight(patternId: string, weight: number): Promise<Pattern>;
    /**
     * Get a pattern by ID
     *
     * @param patternId - Pattern ID
     * @returns Pattern or undefined if not found
     */
    getPattern(patternId: string): Pattern | undefined;
    /**
     * Get all patterns for a task type
     *
     * @param taskType - Task type to filter by
     * @returns Array of patterns
     */
    getPatternsByTaskType(taskType: TaskType): Pattern[];
    /**
     * Get statistics about the pattern database
     *
     * @returns Pattern statistics
     */
    getStats(): PatternStats;
    /**
     * Prune low-quality patterns
     *
     * Removes patterns below minimum success rate and usage count thresholds.
     *
     * @param params - Pruning parameters
     * @returns Prune result with count and IDs
     */
    pruneLowQualityPatterns(params?: PruneParams): Promise<PruneResult>;
    /**
     * Delete a pattern by ID
     *
     * @param patternId - Pattern ID to delete
     * @returns True if deleted, false if not found
     */
    deletePattern(patternId: string): Promise<boolean>;
    /**
     * Get all patterns
     *
     * @returns Array of all patterns
     */
    getAllPatterns(): Pattern[];
    /**
     * Ensure the matcher is initialized
     *
     * @throws Error if not initialized
     */
    private ensureInitialized;
}
//# sourceMappingURL=pattern-matcher.d.ts.map