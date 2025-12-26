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
   * @param input - Episode data with query/answer chunks and embeddings
   * @returns The stored episode with timestamp
   */
  async storeEpisode(input: IEpisodeInput): Promise<IStoredEpisode> {
    try {
      // Validate input
      this.validateEpisodeInput(input);

      // Check for duplicate episodeId
      if (this.episodes.has(input.episodeId)) {
        throw new DESCStorageError(
          `Episode ${input.episodeId} already exists`,
          { episodeId: input.episodeId }
        );
      }

      // Create stored episode
      const storedEpisode: IStoredEpisode = {
        episodeId: input.episodeId,
        queryChunks: input.queryChunks,
        answerChunks: input.answerChunks,
        queryEmbeddings: this.encodeEmbeddings(input.queryEmbeddings),
        answerEmbeddings: this.encodeEmbeddings(input.answerEmbeddings),
        metadata: input.metadata || {},
        storedAt: Date.now()
      };

      // Store in map
      this.episodes.set(input.episodeId, storedEpisode);

      return storedEpisode;
    } catch (error) {
      if (error instanceof DESCStorageError) {
        throw error;
      }
      throw new DESCStorageError(
        `Failed to store episode: ${error instanceof Error ? error.message : String(error)}`,
        { episodeId: input.episodeId, originalError: error }
      );
    }
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
   * @returns true if deleted, false if not found
   */
  async deleteEpisode(episodeId: string): Promise<boolean> {
    try {
      return this.episodes.delete(episodeId);
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
   * Validate episode input data
   */
  private validateEpisodeInput(input: IEpisodeInput): void {
    if (!input.episodeId || input.episodeId.trim().length === 0) {
      throw new DESCStorageError('Episode ID is required', { input });
    }

    if (!Array.isArray(input.queryChunks) || input.queryChunks.length === 0) {
      throw new DESCStorageError('Query chunks must be a non-empty array', {
        episodeId: input.episodeId
      });
    }

    if (!Array.isArray(input.answerChunks) || input.answerChunks.length === 0) {
      throw new DESCStorageError('Answer chunks must be a non-empty array', {
        episodeId: input.episodeId
      });
    }

    if (!Array.isArray(input.queryEmbeddings) || input.queryEmbeddings.length !== input.queryChunks.length) {
      throw new DESCStorageError(
        'Query embeddings must match query chunks length',
        {
          episodeId: input.episodeId,
          queryChunks: input.queryChunks.length,
          queryEmbeddings: input.queryEmbeddings.length
        }
      );
    }

    if (!Array.isArray(input.answerEmbeddings) || input.answerEmbeddings.length !== input.answerChunks.length) {
      throw new DESCStorageError(
        'Answer embeddings must match answer chunks length',
        {
          episodeId: input.episodeId,
          answerChunks: input.answerChunks.length,
          answerEmbeddings: input.answerEmbeddings.length
        }
      );
    }

    // Validate embedding vectors
    for (let i = 0; i < input.queryEmbeddings.length; i++) {
      if (!this.isValidEmbedding(input.queryEmbeddings[i])) {
        throw new DESCStorageError(
          `Invalid query embedding at index ${i}`,
          { episodeId: input.episodeId, index: i }
        );
      }
    }

    for (let i = 0; i < input.answerEmbeddings.length; i++) {
      if (!this.isValidEmbedding(input.answerEmbeddings[i])) {
        throw new DESCStorageError(
          `Invalid answer embedding at index ${i}`,
          { episodeId: input.episodeId, index: i }
        );
      }
    }
  }

  /**
   * Validate that an embedding is a valid Float32Array
   */
  private isValidEmbedding(embedding: Float32Array): boolean {
    return (
      embedding instanceof Float32Array &&
      embedding.length > 0 &&
      !embedding.some(v => !Number.isFinite(v))
    );
  }

  /**
   * Encode embeddings to base64 for storage
   */
  private encodeEmbeddings(embeddings: Float32Array[]): string[] {
    return embeddings.map(embedding => {
      const buffer = embedding.buffer;
      const bytes = new Uint8Array(buffer);
      return Buffer.from(bytes).toString('base64');
    });
  }

  /**
   * Decode embeddings from base64 (utility for future use)
   */
  static decodeEmbedding(encoded: string): Float32Array {
    const bytes = Buffer.from(encoded, 'base64');
    return new Float32Array(bytes.buffer);
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
    const totalQueryChunks = episodes.reduce((sum, e) => sum + e.queryChunks.length, 0);
    const totalAnswerChunks = episodes.reduce((sum, e) => sum + e.answerChunks.length, 0);

    return {
      episodeCount: this.episodes.size,
      totalQueryChunks,
      totalAnswerChunks,
      avgQueryChunksPerEpisode: this.episodes.size > 0 ? totalQueryChunks / this.episodes.size : 0,
      avgAnswerChunksPerEpisode: this.episodes.size > 0 ? totalAnswerChunks / this.episodes.size : 0
    };
  }
}
