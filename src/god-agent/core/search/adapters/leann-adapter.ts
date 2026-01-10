/**
 * LEANN Source Adapter
 * Wraps LEANNBackend for quad-fusion unified search integration
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-LEANN-002
 *
 * @module src/god-agent/core/search/adapters/leann-adapter
 */

import type {
  SourceExecutionResult,
  RawSourceResult,
} from '../search-types.js';
import { withTimeout, TimeoutError, generateResultId } from '../utils.js';
import { LEANNBackend, LEANNConfig, LEANNStats } from '../../vector-db/leann-backend.js';
import { DistanceMetric } from '../../vector-db/types.js';

/**
 * Configuration options for LEANNSourceAdapter
 */
export interface LEANNAdapterConfig {
  /** LEANN backend configuration */
  leannConfig?: Partial<LEANNConfig>;
  /** Function to generate embeddings from text */
  embeddingProvider?: (text: string) => Promise<Float32Array>;
  /** Vector dimension (default: 1536) */
  dimension?: number;
  /** Distance metric (default: COSINE) */
  metric?: DistanceMetric;
  /** Existing LEANNBackend instance (if provided, ignores other config) */
  backend?: LEANNBackend;
}

/**
 * Search options specific to LEANN adapter
 */
export interface LEANNSearchOptions {
  /** Maximum results to return */
  topK?: number;
  /** Include vector data in results */
  includeVectors?: boolean;
}

/**
 * Extended metadata returned by LEANN searches
 */
export interface LEANNResultMetadata {
  /** Vector ID in LEANN backend */
  vectorId: string;
  /** Original similarity score from LEANN */
  originalSimilarity: number;
  /** Whether result came from hub cache */
  fromHubCache: boolean;
  /** Whether vector was recomputed */
  recomputed: boolean;
  /** Hub cache hit ratio at query time */
  cacheHitRatio: number;
  /** Whether this search used hub cache */
  wasHubCacheHit?: boolean;
}

/**
 * Default adapter configuration
 */
export const DEFAULT_LEANN_ADAPTER_CONFIG = {
  dimension: 1536,
  metric: DistanceMetric.COSINE,
} as const;

/**
 * Adapter for LEANN vector similarity search
 * Implements the source adapter pattern for quad-fusion integration
 *
 * Features:
 * - Wraps LEANNBackend for unified search integration
 * - Score normalization for cosine/euclidean/dot metrics
 * - Metadata enrichment with LEANN-specific info (cache hits, etc.)
 * - Index operation for content ingestion
 */
export class LEANNSourceAdapter {
  /** Source identifier for quad-fusion */
  readonly name = 'leann';

  private readonly backend: LEANNBackend;
  private readonly embedder?: (text: string) => Promise<Float32Array>;
  private readonly dimension: number;
  private readonly metric: DistanceMetric;
  private readonly ownsBackend: boolean;

  /** Track hub IDs for cache hit detection */
  private hubIdsCache: Set<string> = new Set();
  private lastHubCacheUpdate: number = 0;
  private readonly hubCacheUpdateIntervalMs: number = 5000;

  /**
   * Create LEANN source adapter
   *
   * @param config - Adapter configuration
   */
  constructor(config: LEANNAdapterConfig = {}) {
    this.dimension = config.dimension ?? DEFAULT_LEANN_ADAPTER_CONFIG.dimension;
    this.metric = config.metric ?? DEFAULT_LEANN_ADAPTER_CONFIG.metric;
    this.embedder = config.embeddingProvider;

    // Use provided backend or create new one
    if (config.backend) {
      this.backend = config.backend;
      this.ownsBackend = false;
    } else {
      this.backend = new LEANNBackend(
        this.dimension,
        this.metric,
        config.leannConfig
      );
      this.ownsBackend = true;

      // Set embedding generator if provided
      if (this.embedder) {
        this.backend.setEmbeddingGenerator(async (id) => {
          // For recomputation, we need the original text
          // This is a simplified implementation - in production,
          // you'd store text alongside vectors or have a content retrieval system
          return new Float32Array(this.dimension);
        });
      }
    }
  }

  /**
   * Execute LEANN vector similarity search
   *
   * @param embedding - Query embedding (dimension must match backend)
   * @param topK - Maximum results to return
   * @param timeoutMs - Timeout in milliseconds
   * @returns Source execution result with LEANN metadata
   */
  async search(
    embedding: Float32Array | undefined,
    topK: number,
    timeoutMs: number
  ): Promise<SourceExecutionResult> {
    const startTime = performance.now();

    // Handle missing embedding gracefully
    if (!embedding) {
      return {
        status: 'success',
        results: [],
        durationMs: performance.now() - startTime,
      };
    }

    try {
      const searchPromise = this.executeSearch(embedding, topK);
      const results = await withTimeout(searchPromise, timeoutMs, 'leann');

      return {
        status: 'success',
        results,
        durationMs: performance.now() - startTime,
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;

      if (error instanceof TimeoutError) {
        return {
          status: 'timeout',
          durationMs,
        };
      }

      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
      };
    }
  }

  /**
   * Search by text query (generates embedding first)
   *
   * @param query - Text query
   * @param topK - Maximum results to return
   * @param timeoutMs - Timeout in milliseconds
   * @returns Source execution result
   */
  async searchByText(
    query: string,
    topK: number,
    timeoutMs: number
  ): Promise<SourceExecutionResult> {
    const startTime = performance.now();

    if (!this.embedder) {
      return {
        status: 'error',
        error: 'No embedding provider configured for text search',
        durationMs: performance.now() - startTime,
      };
    }

    try {
      // Generate embedding from query
      const embedding = await withTimeout(
        this.embedder(query),
        Math.floor(timeoutMs / 2), // Use half the timeout for embedding
        'leann-embed'
      );

      // Use remaining time for search
      const remainingTime = timeoutMs - (performance.now() - startTime);
      return this.search(embedding, topK, Math.max(100, remainingTime));
    } catch (error) {
      const durationMs = performance.now() - startTime;

      if (error instanceof TimeoutError) {
        return {
          status: 'timeout',
          durationMs,
        };
      }

      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
      };
    }
  }

  /**
   * Execute the underlying LEANN search
   */
  private async executeSearch(
    embedding: Float32Array,
    topK: number
  ): Promise<RawSourceResult[]> {
    // Get stats before search to track cache hits
    const statsBefore = this.backend.getStats();

    // Update hub IDs cache periodically
    this.updateHubIdsCache();

    // Execute search
    const searchResults = this.backend.search(embedding, topK, false);

    // Get stats after search
    const statsAfter = this.backend.getStats();
    const wasHubCacheHit = statsAfter.cacheHits > statsBefore.cacheHits;

    return searchResults.map((result, index) => {
      const fromHubCache = this.hubIdsCache.has(result.id);

      return {
        // Use 'vector' source type for quad-fusion compatibility
        // LEANN is an optimized vector backend alternative
        source: 'vector' as const,
        id: generateResultId('leann', index),
        content: result.id, // Vector ID is the content reference
        score: this.normalizeScore(result.similarity),
        metadata: {
          vectorId: result.id,
          originalSimilarity: result.similarity,
          fromHubCache,
          recomputed: false,
          cacheHitRatio: statsAfter.hitRatio,
          wasHubCacheHit,
          backendType: 'leann',
        },
      };
    });
  }

  /**
   * Index content into LEANN backend
   *
   * @param content - Content to index (will be embedded)
   * @param metadata - Optional metadata for the content
   * @returns Vector ID of indexed content
   */
  async index(
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    if (!this.embedder) {
      throw new Error('No embedding provider configured for indexing');
    }

    // Generate embedding
    const embedding = await this.embedder(content);

    // Generate unique ID
    const id = this.generateVectorId(content, metadata);

    // Insert into backend
    this.backend.insert(id, embedding);

    return id;
  }

  /**
   * Index a pre-computed embedding
   *
   * @param id - Vector ID
   * @param embedding - Pre-computed embedding
   */
  indexEmbedding(id: string, embedding: Float32Array): void {
    this.backend.insert(id, embedding);
  }

  /**
   * Delete a vector from the index
   *
   * @param id - Vector ID to delete
   * @returns True if deleted, false if not found
   */
  delete(id: string): boolean {
    return this.backend.delete(id);
  }

  /**
   * Get the number of vectors in the index
   */
  count(): number {
    return this.backend.count();
  }

  /**
   * Get LEANN backend statistics
   */
  getStats(): LEANNStats {
    return this.backend.getStats();
  }

  /**
   * Get the underlying LEANN backend
   * Use with caution - direct access bypasses adapter logic
   */
  getBackend(): LEANNBackend {
    return this.backend;
  }

  /**
   * Save index to persistent storage
   *
   * @param filePath - Path to save the index
   */
  async save(filePath: string): Promise<void> {
    await this.backend.save(filePath);
  }

  /**
   * Load index from persistent storage
   *
   * @param filePath - Path to load the index from
   * @returns True if loaded successfully
   */
  async load(filePath: string): Promise<boolean> {
    return this.backend.load(filePath);
  }

  /**
   * Clear all vectors from the index
   */
  clear(): void {
    this.backend.clear();
    this.hubIdsCache.clear();
    this.lastHubCacheUpdate = 0;
  }

  /**
   * Normalize similarity score to [0, 1] range
   *
   * Handles different distance metrics:
   * - Cosine: already [-1, 1], map to [0, 1]
   * - Dot product: similar to cosine for normalized vectors
   * - Euclidean: distance, needs inverse mapping
   * - Manhattan: distance, needs inverse mapping
   */
  private normalizeScore(similarity: number): number {
    switch (this.metric) {
      case DistanceMetric.COSINE:
      case DistanceMetric.DOT:
        // Map [-1, 1] to [0, 1]
        return (similarity + 1) / 2;

      case DistanceMetric.EUCLIDEAN:
      case DistanceMetric.MANHATTAN:
        // Distance metrics: lower is better
        // Use exponential decay for smoother normalization
        // This maps [0, inf) to (0, 1] with faster decay for larger distances
        return Math.exp(-similarity);

      default:
        // Fallback: clamp to [0, 1]
        return Math.max(0, Math.min(1, similarity));
    }
  }

  /**
   * Update hub IDs cache periodically
   */
  private updateHubIdsCache(): void {
    const now = Date.now();
    if (now - this.lastHubCacheUpdate > this.hubCacheUpdateIntervalMs) {
      this.hubIdsCache = new Set(this.backend.getHubIds());
      this.lastHubCacheUpdate = now;
    }
  }

  /**
   * Generate a unique vector ID
   */
  private generateVectorId(
    content: string,
    metadata?: Record<string, unknown>
  ): string {
    // Use crypto for unique ID generation
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const prefix = metadata?.idPrefix ?? 'leann';
    return `${prefix}_${timestamp}_${random}`;
  }
}

/**
 * Create a LEANNSourceAdapter with default configuration
 *
 * @param embeddingProvider - Function to generate embeddings
 * @param dimension - Vector dimension (default: 1536)
 * @returns Configured LEANNSourceAdapter instance
 */
export function createLEANNAdapter(
  embeddingProvider?: (text: string) => Promise<Float32Array>,
  dimension: number = 1536
): LEANNSourceAdapter {
  return new LEANNSourceAdapter({
    dimension,
    embeddingProvider,
    metric: DistanceMetric.COSINE,
  });
}
