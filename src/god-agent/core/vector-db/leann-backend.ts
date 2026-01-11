/**
 * LEANN (Lazy-Evaluated Approximate Nearest Neighbors) Backend
 *
 * Implements: TASK-LEANN-001
 * Referenced by: BackendSelector, DualCodeEmbeddingProvider
 *
 * Optimized HNSW backend with LEANN-specific enhancements:
 * - Hub node caching (top 10% high-degree nodes)
 * - Graph pruning algorithm (preserve hub connectivity)
 * - Selective recomputation (on-demand embeddings)
 * - Two-level search (hub cache first, then full graph)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IHNSWBackend } from './hnsw-backend.js';
import { VectorID, SearchResult, DistanceMetric } from './types.js';
import { getMetricFunction, isSimilarityMetric } from './distance-metrics.js';
import {
  LEANNConfig,
  LEANNStats,
  HubCacheEntry,
  GraphNode,
  LEANNSerializedData,
  DEFAULT_LEANN_CONFIG,
  LEANN_STORAGE_VERSION,
} from './leann-types.js';

// Re-export types for convenience
// NOTE: Interfaces must use `export type` - they don't exist at runtime in ESM
export type { LEANNConfig, LEANNStats } from './leann-types.js';
export { DEFAULT_LEANN_CONFIG } from './leann-types.js';

/**
 * LEANN Backend Implementation
 *
 * Implements IHNSWBackend with LEANN optimizations:
 * 1. Hub node caching - keeps high-degree nodes in memory for fast access
 * 2. Graph pruning - removes low-value edges while preserving connectivity
 * 3. Selective recomputation - recomputes embeddings on-demand
 * 4. Two-level search - searches hub cache first, then full graph
 */
export class LEANNBackend implements IHNSWBackend {
  private readonly config: LEANNConfig;
  private readonly dimension: number;
  private readonly metric: DistanceMetric;
  private readonly metricFn: (a: Float32Array, b: Float32Array) => number;
  private readonly isSimilarity: boolean;

  /** Main vector storage */
  private readonly vectors: Map<VectorID, Float32Array>;

  /** Graph structure with adjacency lists */
  private readonly graph: Map<VectorID, GraphNode>;

  /** Hub cache with LRU tracking */
  private readonly hubCache: Map<VectorID, HubCacheEntry>;

  /** Maximum hub cache size based on config ratio */
  private maxHubCacheSize: number;

  /** Statistics tracking */
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private prunedEdges: number = 0;

  /** Embedding recomputation function (optional) */
  private embeddingGenerator?: (id: VectorID) => Promise<Float32Array>;

  constructor(
    dimension: number,
    metric: DistanceMetric = DistanceMetric.COSINE,
    config: Partial<LEANNConfig> = {}
  ) {
    this.dimension = dimension;
    this.metric = metric;
    this.metricFn = getMetricFunction(metric);
    this.isSimilarity = isSimilarityMetric(metric);

    this.config = { ...DEFAULT_LEANN_CONFIG, ...config };

    this.vectors = new Map();
    this.graph = new Map();
    this.hubCache = new Map();
    this.maxHubCacheSize = 0; // Will be updated on insert
  }

  /**
   * Set the embedding generator function for selective recomputation
   */
  setEmbeddingGenerator(generator: (id: VectorID) => Promise<Float32Array>): void {
    this.embeddingGenerator = generator;
  }

  /**
   * Insert a vector into the index
   */
  insert(id: VectorID, vector: Float32Array): void {
    // Store vector copy
    const vectorCopy = new Float32Array(vector);
    this.vectors.set(id, vectorCopy);

    // Initialize graph node
    const node: GraphNode = {
      vector: vectorCopy,
      neighbors: new Set(),
    };
    this.graph.set(id, node);

    // Connect to nearest neighbors
    this.connectToNeighbors(id, vectorCopy);

    // Update hub cache size
    this.maxHubCacheSize = Math.max(
      1,
      Math.floor(this.vectors.size * this.config.hubCacheRatio)
    );

    // Update hub cache
    this.updateHubCache();
  }

  /**
   * Connect a new node to its nearest neighbors
   */
  private connectToNeighbors(id: VectorID, vector: Float32Array): void {
    if (this.vectors.size <= 1) return;

    // Find k nearest neighbors
    const k = Math.min(16, this.vectors.size - 1); // M parameter
    const candidates: Array<{ id: VectorID; score: number }> = [];

    for (const [otherId, otherVector] of this.vectors.entries()) {
      if (otherId === id) continue;
      const score = this.metricFn(vector, otherVector);
      candidates.push({ id: otherId, score });
    }

    // Sort by score (descending for similarity, ascending for distance)
    candidates.sort((a, b) => {
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    // Connect to top k neighbors
    const node = this.graph.get(id)!;
    for (let i = 0; i < Math.min(k, candidates.length); i++) {
      const neighbor = candidates[i];
      node.neighbors.add(neighbor.id);

      // Bidirectional connection
      const neighborNode = this.graph.get(neighbor.id);
      if (neighborNode) {
        neighborNode.neighbors.add(id);
      }
    }

    // Apply pruning if needed
    this.pruneConnections(id);
  }

  /**
   * Prune low-value edges while preserving hub connectivity
   */
  private pruneConnections(id: VectorID): void {
    const node = this.graph.get(id);
    if (!node || !node.vector) return;

    const maxConnections = Math.floor(16 * this.config.graphPruningRatio);
    if (node.neighbors.size <= maxConnections) return;

    // Score each connection
    const connections: Array<{ neighborId: VectorID; score: number; isHub: boolean }> = [];

    for (const neighborId of node.neighbors) {
      const neighborNode = this.graph.get(neighborId);
      if (!neighborNode || !neighborNode.vector) continue;

      const score = this.metricFn(node.vector, neighborNode.vector);
      const isHub = this.isHubNode(neighborId);

      connections.push({ neighborId, score, isHub });
    }

    // Sort by: hubs first, then by score
    connections.sort((a, b) => {
      if (a.isHub !== b.isHub) return a.isHub ? -1 : 1;
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    // Keep only top connections
    const toKeep = new Set<VectorID>();
    for (let i = 0; i < Math.min(maxConnections, connections.length); i++) {
      toKeep.add(connections[i].neighborId);
    }

    // Remove pruned connections
    for (const neighborId of node.neighbors) {
      if (!toKeep.has(neighborId)) {
        node.neighbors.delete(neighborId);
        this.prunedEdges++;

        // Remove bidirectional link
        const neighborNode = this.graph.get(neighborId);
        if (neighborNode) {
          neighborNode.neighbors.delete(id);
        }
      }
    }
  }

  /**
   * Check if a node is a hub node
   */
  private isHubNode(id: VectorID): boolean {
    return this.hubCache.has(id);
  }

  /**
   * Get node degree (number of connections)
   */
  private getNodeDegree(id: VectorID): number {
    const node = this.graph.get(id);
    return node ? node.neighbors.size : 0;
  }

  /**
   * Update hub cache with highest-degree nodes
   */
  private updateHubCache(): void {
    // Get all nodes with their degrees
    const nodesByDegree: Array<{ id: VectorID; degree: number }> = [];

    for (const [id] of this.graph.entries()) {
      const degree = this.getNodeDegree(id);
      if (degree >= this.config.hubDegreeThreshold) {
        nodesByDegree.push({ id, degree });
      }
    }

    // Sort by degree descending
    nodesByDegree.sort((a, b) => b.degree - a.degree);

    // Update hub cache
    const newHubIds = new Set<VectorID>();
    for (let i = 0; i < Math.min(this.maxHubCacheSize, nodesByDegree.length); i++) {
      const { id, degree } = nodesByDegree[i];
      newHubIds.add(id);

      // Add to cache if not present
      if (!this.hubCache.has(id)) {
        const vector = this.vectors.get(id);
        if (vector) {
          this.hubCache.set(id, {
            vector: new Float32Array(vector),
            degree,
            lastAccess: Date.now(),
          });
        }
      } else {
        // Update degree
        const entry = this.hubCache.get(id)!;
        entry.degree = degree;
      }
    }

    // Remove evicted hubs
    for (const id of this.hubCache.keys()) {
      if (!newHubIds.has(id)) {
        this.hubCache.delete(id);
      }
    }
  }

  /**
   * Search for k nearest neighbors using two-level search
   */
  search(query: Float32Array, k: number, includeVectors: boolean = false): SearchResult[] {
    if (this.vectors.size === 0) {
      return [];
    }

    // For small datasets (<= 100 vectors), brute force is fast and guarantees exact results
    if (this.vectors.size <= 100) {
      return this.bruteForceSearch(query, k, includeVectors);
    }

    // Level 1: Search hub cache first
    const hubResults = this.searchHubCache(query, k);

    // If we have enough results from hub cache, return them
    if (hubResults.length >= k && this.hubCache.size >= this.maxHubCacheSize) {
      this.cacheHits++;
      return this.formatResults(hubResults.slice(0, k), includeVectors);
    }

    // Level 2: Full graph search
    this.cacheMisses++;
    const fullResults = this.searchFullGraph(query, k, new Set(hubResults.map(r => r.id)));

    // Merge results
    const allResults = [...hubResults, ...fullResults];

    // Sort by score
    allResults.sort((a, b) => {
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    // Return top k
    return this.formatResults(allResults.slice(0, k), includeVectors);
  }

  /**
   * Brute force search - guaranteed to find exact matches
   * Used for small datasets where linear scan is efficient
   */
  private bruteForceSearch(
    query: Float32Array,
    k: number,
    includeVectors: boolean
  ): SearchResult[] {
    const results: Array<{ id: VectorID; score: number }> = [];

    for (const [id, vector] of this.vectors.entries()) {
      const score = this.metricFn(query, vector);
      results.push({ id, score });
    }

    // Sort by score
    results.sort((a, b) => {
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    return this.formatResults(results.slice(0, k), includeVectors);
  }

  /**
   * Search hub cache for nearest neighbors
   */
  private searchHubCache(query: Float32Array, k: number): Array<{ id: VectorID; score: number }> {
    const results: Array<{ id: VectorID; score: number }> = [];

    for (const [id, entry] of this.hubCache.entries()) {
      const score = this.metricFn(query, entry.vector);
      results.push({ id, score });

      // Update LRU timestamp
      entry.lastAccess = Date.now();
    }

    // Sort by score
    results.sort((a, b) => {
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    return results.slice(0, k);
  }

  /**
   * Search full graph using greedy traversal
   */
  private searchFullGraph(
    query: Float32Array,
    k: number,
    excludeIds: Set<VectorID>
  ): Array<{ id: VectorID; score: number }> {
    const visited = new Set<VectorID>(excludeIds);
    const results: Array<{ id: VectorID; score: number }> = [];

    // Start from hub nodes if available
    const startNodes = this.hubCache.size > 0
      ? Array.from(this.hubCache.keys())
      : Array.from(this.vectors.keys()).slice(0, Math.min(10, this.vectors.size));

    // Priority queue for greedy search
    const candidates: Array<{ id: VectorID; score: number }> = [];

    // Initialize with start nodes
    for (const id of startNodes) {
      if (visited.has(id)) continue;
      visited.add(id);

      const vector = this.vectors.get(id);
      if (!vector) continue;

      const score = this.metricFn(query, vector);
      candidates.push({ id, score });
    }

    // Greedy search
    const maxIterations = this.config.efSearch;
    let iterations = 0;

    while (candidates.length > 0 && iterations < maxIterations) {
      iterations++;

      // Sort candidates
      candidates.sort((a, b) => {
        return this.isSimilarity ? b.score - a.score : a.score - b.score;
      });

      // Take best candidate
      const best = candidates.shift()!;
      results.push(best);

      // Expand neighbors
      const node = this.graph.get(best.id);
      if (!node) continue;

      for (const neighborId of node.neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborVector = this.vectors.get(neighborId);
        if (!neighborVector) continue;

        const score = this.metricFn(query, neighborVector);
        candidates.push({ id: neighborId, score });
      }

      // Keep candidates list bounded
      if (candidates.length > this.config.efSearch * 2) {
        candidates.sort((a, b) => {
          return this.isSimilarity ? b.score - a.score : a.score - b.score;
        });
        candidates.length = this.config.efSearch;
      }
    }

    // Sort final results
    results.sort((a, b) => {
      return this.isSimilarity ? b.score - a.score : a.score - b.score;
    });

    return results.slice(0, k);
  }

  /**
   * Format search results
   */
  private formatResults(
    results: Array<{ id: VectorID; score: number }>,
    includeVectors: boolean
  ): SearchResult[] {
    return results.map(({ id, score }) => ({
      id,
      similarity: score,
      vector: includeVectors ? this.getVector(id) : undefined,
    }));
  }

  /**
   * Retrieve a vector by ID
   */
  getVector(id: VectorID): Float32Array | undefined {
    // Check hub cache first
    const hubEntry = this.hubCache.get(id);
    if (hubEntry) {
      hubEntry.lastAccess = Date.now();
      return new Float32Array(hubEntry.vector);
    }

    // Check main storage
    const vector = this.vectors.get(id);
    return vector ? new Float32Array(vector) : undefined;
  }

  /**
   * Delete a vector from the index
   */
  delete(id: VectorID): boolean {
    if (!this.vectors.has(id)) {
      return false;
    }

    // Remove from vectors
    this.vectors.delete(id);

    // Remove from hub cache
    this.hubCache.delete(id);

    // Remove from graph and update neighbors
    const node = this.graph.get(id);
    if (node) {
      for (const neighborId of node.neighbors) {
        const neighborNode = this.graph.get(neighborId);
        if (neighborNode) {
          neighborNode.neighbors.delete(id);
        }
      }
      this.graph.delete(id);
    }

    // Update hub cache size and rebuild
    this.maxHubCacheSize = Math.max(
      0,
      Math.floor(this.vectors.size * this.config.hubCacheRatio)
    );
    this.updateHubCache();

    return true;
  }

  /**
   * Get the number of vectors in the index
   */
  count(): number {
    return this.vectors.size;
  }

  /**
   * Save the index to persistent storage
   */
  async save(filePath: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Build serialization data
    const data: LEANNSerializedData = {
      version: LEANN_STORAGE_VERSION,
      config: this.config,
      dimension: this.dimension,
      metric: this.metric,
      vectors: [],
      graph: [],
      hubIds: Array.from(this.hubCache.keys()),
      stats: {
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        prunedEdges: this.prunedEdges,
      },
    };

    // Serialize vectors
    for (const [id, vector] of this.vectors.entries()) {
      data.vectors.push({
        id,
        data: Array.from(vector),
      });
    }

    // Serialize graph
    for (const [id, node] of this.graph.entries()) {
      data.graph.push({
        id,
        neighbors: Array.from(node.neighbors),
        degree: node.neighbors.size,
      });
    }

    // Write to file
    const json = JSON.stringify(data);
    await fs.writeFile(filePath, json, 'utf-8');
  }

  /**
   * Load the index from persistent storage
   */
  async load(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      await fs.access(filePath);
    } catch {
      // File doesn't exist
      return false;
    }

    // Read file
    const json = await fs.readFile(filePath, 'utf-8');
    const data: LEANNSerializedData = JSON.parse(json);

    // Validate version
    if (data.version !== LEANN_STORAGE_VERSION) {
      throw new Error(`Unsupported LEANN storage version: ${data.version}`);
    }

    // Validate dimension
    if (data.dimension !== this.dimension) {
      throw new Error(`Dimension mismatch: file has ${data.dimension}D, expected ${this.dimension}D`);
    }

    // Clear existing data
    this.clear();

    // Restore vectors
    for (const { id, data: vectorData } of data.vectors) {
      const vector = new Float32Array(vectorData);
      this.vectors.set(id, vector);
    }

    // Restore graph
    for (const { id, neighbors } of data.graph) {
      const vector = this.vectors.get(id) || null;
      this.graph.set(id, {
        vector,
        neighbors: new Set(neighbors),
      });
    }

    // Restore hub cache
    this.maxHubCacheSize = Math.max(
      1,
      Math.floor(this.vectors.size * this.config.hubCacheRatio)
    );

    for (const hubId of data.hubIds) {
      const vector = this.vectors.get(hubId);
      if (vector) {
        const node = this.graph.get(hubId);
        this.hubCache.set(hubId, {
          vector: new Float32Array(vector),
          degree: node ? node.neighbors.size : 0,
          lastAccess: Date.now(),
        });
      }
    }

    // Restore stats
    this.cacheHits = data.stats.cacheHits;
    this.cacheMisses = data.stats.cacheMisses;
    this.prunedEdges = data.stats.prunedEdges;

    return true;
  }

  /**
   * Clear all vectors from the index
   */
  clear(): void {
    this.vectors.clear();
    this.graph.clear();
    this.hubCache.clear();
    this.maxHubCacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.prunedEdges = 0;
  }

  /**
   * Get statistics about the LEANN backend
   */
  getStats(): LEANNStats {
    let totalEdges = 0;
    let totalHubDegree = 0;

    for (const node of this.graph.values()) {
      totalEdges += node.neighbors.size;
    }

    for (const entry of this.hubCache.values()) {
      totalHubDegree += entry.degree;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;

    return {
      totalVectors: this.vectors.size,
      hubCacheSize: this.hubCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRatio: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      avgHubDegree: this.hubCache.size > 0 ? totalHubDegree / this.hubCache.size : 0,
      totalEdges: totalEdges / 2, // Divide by 2 for bidirectional edges
      prunedEdges: this.prunedEdges,
    };
  }

  /**
   * Get the configuration
   */
  getConfig(): LEANNConfig {
    return { ...this.config };
  }

  /**
   * Trigger selective recomputation for cold vectors
   * Uses the embedding generator if set
   */
  async recomputeColdVectors(maxVectors: number = this.config.batchSize): Promise<number> {
    if (!this.embeddingGenerator) {
      return 0;
    }

    // Find cold vectors (not in hub cache, not recently accessed)
    const coldVectors: VectorID[] = [];
    for (const id of this.vectors.keys()) {
      if (!this.hubCache.has(id)) {
        coldVectors.push(id);
        if (coldVectors.length >= maxVectors) break;
      }
    }

    // Recompute embeddings with latency tracking
    let recomputed = 0;
    const startTime = Date.now();

    for (const id of coldVectors) {
      // Check latency budget
      if (Date.now() - startTime >= this.config.maxRecomputeLatencyMs) {
        break;
      }

      try {
        const newVector = await this.embeddingGenerator(id);
        if (newVector && newVector.length === this.dimension) {
          this.vectors.set(id, new Float32Array(newVector));
          const node = this.graph.get(id);
          if (node) {
            node.vector = new Float32Array(newVector);
          }
          recomputed++;
        }
      } catch {
        // Skip failed recomputations
      }
    }

    return recomputed;
  }

  /**
   * Force rebuild of hub cache
   */
  rebuildHubCache(): void {
    this.hubCache.clear();
    this.updateHubCache();
  }

  /**
   * Get hub IDs for external use
   */
  getHubIds(): VectorID[] {
    return Array.from(this.hubCache.keys());
  }
}
