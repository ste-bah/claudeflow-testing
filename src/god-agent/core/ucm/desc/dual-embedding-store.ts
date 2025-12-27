/**
 * SPRINT 3 - DESC-002: Dual Embedding Store
 *
 * Stores episodes with BOTH query and answer embeddings for efficient retrieval.
 * In-memory implementation with episodeId-based lookup.
 * SQLite integration will be added in future sprint.
 */

import type {
  IStoredEpisode,
  IEpisodeInput,
  IDualEmbeddingStore
} from '../types.js';
import { DESCStorageError } from '../errors.js';

/**
 * DualEmbeddingStore - In-memory episode storage
 *
 * Key features:
 * - Stores both query and answer embeddings
 * - Embeddings stored as base64-encoded Float32Arrays
 * - Episode-based organization (episodeId as key)
 * - CRUD operations for episodes
 */
export class DualEmbeddingStore implements IDualEmbeddingStore {
  private episodes: Map<string, IStoredEpisode>;

  constructor() {
    this.episodes = new Map();
  }

  /**
   * Store an episode with dual embeddings
   *
   * @param input - Episode data with query/answer text
   * @param queryEmbeddings - Embeddings for query chunks
   * @param answerEmbeddings - Embeddings for answer chunks
   * @returns The episodeId
   */
  async storeEpisode(
    input: IEpisodeInput,
    queryEmbeddings: Float32Array[],
    answerEmbeddings: Float32Array[]
  ): Promise<string> {
    try {
      // Validate input
      if (!input.queryText || !input.answerText) {
        throw new DESCStorageError('queryText and answerText are required');
      }
      if (!queryEmbeddings.length || !answerEmbeddings.length) {
        throw new DESCStorageError('queryEmbeddings and answerEmbeddings are required');
      }

      // Generate episodeId
      const episodeId = this.generateEpisodeId();

      // Check for duplicate episodeId (unlikely with UUID)
      if (this.episodes.has(episodeId)) {
        throw new DESCStorageError(
          `Episode ${episodeId} already exists`,
          { episodeId }
        );
      }

      // Create stored episode matching IStoredEpisode interface
      const storedEpisode: IStoredEpisode = {
        episodeId,
        queryText: input.queryText,
        answerText: input.answerText,
        queryChunkEmbeddings: queryEmbeddings,
        answerChunkEmbeddings: answerEmbeddings,
        queryChunkCount: queryEmbeddings.length,
        answerChunkCount: answerEmbeddings.length,
        createdAt: new Date(),
        metadata: input.metadata
      };

      // Store in map
      this.episodes.set(episodeId, storedEpisode);

      return episodeId;
    } catch (error) {
      if (error instanceof DESCStorageError) {
        throw error;
      }
      throw new DESCStorageError(
        `Failed to store episode: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Generate unique episode ID
   */
  private generateEpisodeId(): string {
    return `ep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Retrieve an episode by ID
   *
   * @param episodeId - Unique episode identifier
   * @returns The stored episode or null if not found
   */
  async getEpisode(episodeId: string): Promise<IStoredEpisode | null> {
    try {
      const episode = this.episodes.get(episodeId);
      return episode || null;
    } catch (error) {
      throw new DESCStorageError(
        `Failed to retrieve episode: ${error instanceof Error ? error.message : String(error)}`,
        { episodeId, originalError: error }
      );
    }
  }

  /**
   * Get all stored episodes
   *
   * @returns Array of all stored episodes
   */
  async getAllEpisodes(): Promise<IStoredEpisode[]> {
    try {
      return Array.from(this.episodes.values());
    } catch (error) {
      throw new DESCStorageError(
        `Failed to retrieve all episodes: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  /**
   * Delete an episode by ID
   *
   * @param episodeId - Episode to delete
   */
  async deleteEpisode(episodeId: string): Promise<void> {
    try {
      this.episodes.delete(episodeId);
    } catch (error) {
      throw new DESCStorageError(
        `Failed to delete episode: ${error instanceof Error ? error.message : String(error)}`,
        { episodeId, originalError: error }
      );
    }
  }

  /**
   * Get episode count
   */
  getEpisodeCount(): number {
    return this.episodes.size;
  }

  /**
   * Clear all episodes (use with caution!)
   */
  async clear(): Promise<void> {
    this.episodes.clear();
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    episodeCount: number;
    totalQueryChunks: number;
    totalAnswerChunks: number;
    avgQueryChunksPerEpisode: number;
    avgAnswerChunksPerEpisode: number;
  } {
    const episodes = Array.from(this.episodes.values());
    const totalQueryChunks = episodes.reduce((sum, e) => sum + e.queryChunkCount, 0);
    const totalAnswerChunks = episodes.reduce((sum, e) => sum + e.answerChunkCount, 0);

    return {
      episodeCount: this.episodes.size,
      totalQueryChunks,
      totalAnswerChunks,
      avgQueryChunksPerEpisode: this.episodes.size > 0 ? totalQueryChunks / this.episodes.size : 0,
      avgAnswerChunksPerEpisode: this.episodes.size > 0 ? totalAnswerChunks / this.episodes.size : 0
    };
  }
}
