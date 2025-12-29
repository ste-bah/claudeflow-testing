/**
 * Shadow Vector Search
 * TASK-SHA-001 - Adversarial Contradiction Detection
 *
 * Implements semantic inversion search for finding contradictions:
 * - Shadow(v) = v × -1 inverts semantic meaning
 * - Property: cosine(v, x) = -cosine(Shadow(v), x)
 *
 * Use cases:
 * - Find counterarguments to hypotheses
 * - Detect conflicting evidence
 * - Validate claims against opposing viewpoints
 *
 * Target: 90% recall on opposing viewpoints
 */
import type { IShadowSearchOptions, IContradiction, ISupportingEvidence, IValidationReport, IShadowVectorConfig } from './shadow-types.js';
/**
 * Interface for vector storage backend
 * Allows decoupling from specific VectorDB implementation
 */
export interface IVectorStore {
    /** Search for similar vectors */
    search(query: Float32Array, k: number): Promise<IVectorSearchResult[]>;
    /** Get vector by ID */
    getVector(id: string): Promise<Float32Array | null>;
}
/**
 * Vector search result from storage backend
 */
export interface IVectorSearchResult {
    id: string;
    similarity: number;
    vector?: Float32Array;
    metadata?: Record<string, unknown>;
}
/**
 * Mock vector store for testing
 */
export declare class MockVectorStore implements IVectorStore {
    private vectors;
    addVector(id: string, vector: Float32Array, content: string, metadata?: Record<string, unknown>): void;
    search(query: Float32Array, k: number): Promise<IVectorSearchResult[]>;
    getVector(id: string): Promise<Float32Array | null>;
    getContent(id: string): string | null;
    clear(): void;
}
/**
 * Shadow Vector Search for contradiction detection
 *
 * Performs adversarial search by inverting query vectors to find
 * semantically opposing documents in the vector space.
 */
export declare class ShadowVectorSearch {
    private vectorStore;
    private config;
    constructor(config?: IShadowVectorConfig);
    /**
     * Set the vector store for searches
     */
    setVectorStore(store: IVectorStore): void;
    /**
     * Log message if verbose mode enabled
     */
    private log;
    /**
     * Find contradictions to a hypothesis vector
     *
     * Algorithm:
     * 1. Create shadow vector: Shadow(v) = v × -1
     * 2. Search vector store with shadow vector
     * 3. For each result, calculate both hypothesis and shadow similarities
     * 4. Classify and filter by refutation strength
     *
     * @param hypothesisVector - Query vector (1536-dim, L2-normalized)
     * @param options - Search options
     * @returns Array of contradictions sorted by refutation strength
     */
    findContradictions(hypothesisVector: Float32Array, options: IShadowSearchOptions): Promise<IContradiction[]>;
    /**
     * Find supporting evidence for a hypothesis
     *
     * @param hypothesisVector - Query vector (1536-dim, L2-normalized)
     * @param k - Maximum results
     * @returns Array of supporting evidence
     */
    findSupport(hypothesisVector: Float32Array, k?: number): Promise<ISupportingEvidence[]>;
    /**
     * Validate a claim by finding both support and contradictions
     *
     * @param hypothesisVector - Query vector for the claim
     * @param claimText - Text description of the claim
     * @returns Comprehensive validation report
     */
    validateClaim(hypothesisVector: Float32Array, claimText: string): Promise<IValidationReport>;
    /**
     * Find contradictions for multiple hypotheses
     *
     * @param hypotheses - Array of hypothesis vectors
     * @param options - Search options
     * @returns Array of contradiction arrays
     */
    batchFindContradictions(hypotheses: Float32Array[], options: IShadowSearchOptions): Promise<IContradiction[][]>;
    /**
     * Validate multiple claims
     *
     * @param claims - Array of { vector, text } pairs
     * @returns Array of validation reports
     */
    batchValidateClaims(claims: Array<{
        vector: Float32Array;
        text: string;
    }>): Promise<IValidationReport[]>;
    /**
     * Get current configuration
     */
    getConfig(): Required<IShadowVectorConfig>;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<IShadowVectorConfig>): void;
}
//# sourceMappingURL=shadow-vector-search.d.ts.map