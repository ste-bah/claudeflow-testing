/**
 * SPRINT 3 - DESC-003: Episode Retriever
 *
 * RULE-069: All-to-all chunk comparison for retrieval
 * RULE-067: Chunk-level match, episode-level return
 * RULE-066: Threshold 0.80 similarity
 *
 * Retrieves episodes by comparing query chunks against stored answer chunks
 * using cosine similarity on L2-normalized embeddings.
 */
import type { IEpisodeRetriever, IRetrievalResult, IRetrievalOptions, IDualEmbeddingStore, IInjectionFilter, ITaskContext } from '../types.js';
/**
 * EpisodeRetriever - RULE-069 compliant retrieval
 *
 * Key features:
 * - All-to-all chunk comparison
 * - Cosine similarity on L2-normalized embeddings
 * - 0.80 similarity threshold (configurable)
 * - Returns full answer text (not chunks)
 * - Episode-level results with aggregated scores
 */
export declare class EpisodeRetriever implements IEpisodeRetriever {
    private store;
    private options;
    private filter;
    constructor(store?: IDualEmbeddingStore, options?: IRetrievalOptions, filter?: IInjectionFilter);
    /**
     * Retrieve episodes matching query chunks
     *
     * RULE-069: All-to-all comparison - every query chunk is compared
     * against every answer chunk of every episode
     *
     * RULE-067: Chunk-level match, episode-level return - matches happen
     * at chunk level but we return complete episodes
     *
     * @param queryChunks - Chunks from the query
     * @param queryEmbeddings - Embeddings for query chunks
     * @param options - Retrieval options (overrides constructor options)
     * @param taskContext - Optional task context for safety filtering
     */
    retrieve(queryChunks: string[], queryEmbeddings: Float32Array[], options?: IRetrievalOptions, taskContext?: ITaskContext): Promise<IRetrievalResult[]>;
    /**
     * Compute episode scores using RULE-069: all-to-all comparison
     */
    private computeEpisodeScores;
    /**
     * Compute cosine similarity between two L2-normalized embeddings
     *
     * For L2-normalized vectors, cosine similarity = dot product
     * This is because ||a|| = ||b|| = 1, so:
     * cos(θ) = (a·b) / (||a|| * ||b||) = a·b
     */
    private cosineSimilarity;
    /**
     * Get full answer text
     * RULE-067: Return full answer text, not individual chunks
     */
    private reconstructAnswerText;
    /**
     * Validate retrieval input
     */
    private validateRetrievalInput;
    /**
     * Update retrieval options
     */
    updateOptions(options: Partial<IRetrievalOptions>): void;
    /**
     * Get current retrieval options
     */
    getOptions(): Required<IRetrievalOptions>;
    /**
     * Get the underlying store
     */
    getStore(): IDualEmbeddingStore;
    /**
     * Get the injection filter
     */
    getFilter(): IInjectionFilter;
}
//# sourceMappingURL=episode-retriever.d.ts.map