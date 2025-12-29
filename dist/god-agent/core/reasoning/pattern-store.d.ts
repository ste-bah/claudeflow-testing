/**
 * Pattern Storage with Indexing
 *
 * Implements: TASK-PAT-001 (Pattern Store)
 *
 * In-memory pattern storage with task type indexing and persistence.
 * Uses VectorDB for HNSW search and MemoryEngine for persistence.
 */
import { VectorDB } from '../vector-db/index.js';
import { MemoryEngine } from '../memory/index.js';
import { Pattern, TaskType, CreatePatternParams, PatternStats } from './pattern-types.js';
/**
 * In-memory pattern store with indexing and persistence
 */
export declare class PatternStore {
    /** All patterns by ID */
    private patterns;
    /** Index by task type */
    private indexByTaskType;
    /** VectorDB for HNSW search */
    private vectorDB;
    /** MemoryEngine for persistence */
    private memoryEngine;
    /** Whether patterns have been loaded from storage */
    private initialized;
    constructor(vectorDB: VectorDB, memoryEngine: MemoryEngine);
    /**
     * Initialize store by loading patterns from persistence
     */
    initialize(): Promise<void>;
    /**
     * Add a new pattern to the store
     *
     * @param params - Pattern creation parameters
     * @returns Created pattern
     * @throws Error if successRate < 0.8 or duplicate detected
     */
    addPattern(params: CreatePatternParams): Promise<Pattern>;
    /**
     * Update an existing pattern
     *
     * @param patternId - Pattern ID to update
     * @param updates - Fields to update
     * @returns Updated pattern
     * @throws Error if pattern not found
     */
    updatePattern(patternId: string, updates: Partial<Omit<Pattern, 'id' | 'createdAt' | 'embedding'>>): Promise<Pattern>;
    /**
     * Delete a pattern from the store
     *
     * @param patternId - Pattern ID to delete
     * @returns True if deleted, false if not found
     */
    deletePattern(patternId: string): Promise<boolean>;
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
     * Get all patterns
     *
     * @returns Array of all patterns
     */
    getAllPatterns(): Pattern[];
    /**
     * Get statistics about the pattern store
     *
     * @returns Pattern statistics
     */
    getStats(): PatternStats;
    /**
     * Find duplicate pattern by task type and similarity
     *
     * @param taskType - Task type to check
     * @param embedding - Embedding to compare
     * @returns Pattern ID if duplicate found, undefined otherwise
     */
    private findDuplicate;
    /**
     * Persist patterns to MemoryEngine
     *
     * Implements: TASK-ERR-004, RULE-072 (database retry on failure)
     */
    private persist;
    /**
     * Estimate storage size in bytes
     */
    private estimateStorageSize;
}
//# sourceMappingURL=pattern-store.d.ts.map