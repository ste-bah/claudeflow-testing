/**
 * Q&A Hyperedge Store
 * TASK-HYPEREDGE-001
 *
 * Stores question-answer hyperedges with semantic search and quality validation
 * Constitution:
 * - HYPER-02: Quality threshold >= 0.7
 * - HYPER-03: Creation <30ms (p95)
 * - HYPER-04: Search <50ms (p95)
 */
import type { NodeID, HyperedgeID } from '../../graph-db/types.js';
import type { VectorDB } from '../../vector-db/vector-db.js';
import type { GraphDB } from '../../graph-db/graph-db.js';
import type { QAHyperedge, QAAnswer, QASearchResult } from '../hyperedge-types.js';
/**
 * Configuration for Q&A store
 */
export interface QAStoreConfig {
    /** Minimum quality threshold (default: 0.7) */
    minQuality?: number;
    /** Vector DB for semantic search */
    vectorDB: VectorDB;
    /** Graph DB for hyperedge storage */
    graphDB: GraphDB;
    /** Enable observability events (default: true) */
    emitEvents?: boolean;
}
/**
 * Q&A Hyperedge Store
 *
 * Constitution compliance:
 * - HYPER-02: minQuality >= 0.7
 * - HYPER-03: createQA <30ms target
 * - HYPER-04: findByQuestion <50ms target
 */
export declare class QAStore {
    private readonly minQuality;
    private readonly vectorDB;
    private readonly graphDB;
    private readonly emitEvents;
    private readonly qaCache;
    constructor(config: QAStoreConfig);
    /**
     * Create a Q&A hyperedge
     *
     * @param question - Question text
     * @param questionEmbedding - VECTOR_DIM (1536)-dimensional question embedding
     * @param answers - Array of answers with confidence and evidence
     * @param evidence - Optional additional evidence node IDs
     * @returns Created Q&A hyperedge
     *
     * Constitution: HYPER-03 - <30ms (p95)
     */
    createQA(question: string, questionEmbedding: Float32Array, answers: QAAnswer[], evidence?: NodeID[]): Promise<QAHyperedge>;
    /**
     * Find Q&A hyperedges by question similarity
     *
     * @param queryEmbedding - Query embedding (VECTOR_DIM = 1536D)
     * @param k - Number of results to return (default: 10)
     * @returns Top-k Q&A hyperedges ranked by similarity
     *
     * Constitution: HYPER-04 - <50ms (p95)
     */
    findByQuestion(queryEmbedding: Float32Array, k?: number): Promise<QASearchResult[]>;
    /**
     * Rank Q&A hyperedges by quality
     *
     * @param hyperedges - Hyperedges to rank
     * @returns Hyperedges sorted by quality (descending)
     */
    rankByQuality(hyperedges: QAHyperedge[]): QAHyperedge[];
    /**
     * Get Q&A hyperedge by ID
     *
     * @param id - Hyperedge ID
     * @returns Q&A hyperedge or undefined
     */
    getById(id: HyperedgeID): QAHyperedge | undefined;
    /**
     * Calculate quality score from answers
     *
     * @param answers - Array of answers
     * @returns Quality score [0.0-1.0]
     *
     * Quality = average of:
     * - Average confidence
     * - Evidence coverage (% of answers with evidence)
     * - Answer consensus (variance penalty)
     */
    private calculateQuality;
    /**
     * Validate inputs for Q&A creation
     */
    private validateInputs;
    /**
     * Collect all unique node IDs from answers and evidence
     */
    private collectNodeIds;
    /**
     * Clear cache (for testing/maintenance)
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: number;
    };
}
//# sourceMappingURL=qa-store.d.ts.map