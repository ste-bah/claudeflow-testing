/**
 * SPRINT 3 - DESC-002: Dual Embedding Store
 *
 * Stores episodes with BOTH query and answer embeddings for efficient retrieval.
 * In-memory implementation with episodeId-based lookup.
 * SQLite integration will be added in future sprint.
 */
import type { IStoredEpisode, IEpisodeInput, IDualEmbeddingStore } from '../types.js';
/**
 * DualEmbeddingStore - In-memory episode storage
 *
 * Key features:
 * - Stores both query and answer embeddings
 * - Embeddings stored as base64-encoded Float32Arrays
 * - Episode-based organization (episodeId as key)
 * - CRUD operations for episodes
 */
export declare class DualEmbeddingStore implements IDualEmbeddingStore {
    private episodes;
    constructor();
    /**
     * Store an episode with dual embeddings
     *
     * @param input - Episode data with query/answer text
     * @param queryEmbeddings - Embeddings for query chunks
     * @param answerEmbeddings - Embeddings for answer chunks
     * @returns The episodeId
     */
    storeEpisode(input: IEpisodeInput, queryEmbeddings: Float32Array[], answerEmbeddings: Float32Array[]): Promise<string>;
    /**
     * Generate unique episode ID
     */
    private generateEpisodeId;
    /**
     * Retrieve an episode by ID
     *
     * @param episodeId - Unique episode identifier
     * @returns The stored episode or null if not found
     */
    getEpisode(episodeId: string): Promise<IStoredEpisode | null>;
    /**
     * Get all stored episodes
     *
     * @returns Array of all stored episodes
     */
    getAllEpisodes(): Promise<IStoredEpisode[]>;
    /**
     * Delete an episode by ID
     *
     * @param episodeId - Episode to delete
     */
    deleteEpisode(episodeId: string): Promise<void>;
    /**
     * Get episode count
     */
    getEpisodeCount(): number;
    /**
     * Clear all episodes (use with caution!)
     */
    clear(): Promise<void>;
    /**
     * Get storage statistics
     */
    getStats(): {
        episodeCount: number;
        totalQueryChunks: number;
        totalAnswerChunks: number;
        avgQueryChunksPerEpisode: number;
        avgAnswerChunksPerEpisode: number;
    };
}
//# sourceMappingURL=dual-embedding-store.d.ts.map