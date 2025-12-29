/**
 * GNN Math Utilities - Extracted from GNNEnhancer
 *
 * Provides vector operations for GNN-enhanced embeddings.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-001
 *
 * @module src/god-agent/core/reasoning/gnn-math
 */
/**
 * Activation function types
 */
export type ActivationType = 'relu' | 'tanh' | 'sigmoid' | 'leaky_relu';
/**
 * Add two vectors element-wise
 */
export declare function addVectors(a: Float32Array, b: Float32Array): Float32Array;
/**
 * Zero-pad vector to target dimension
 */
export declare function zeroPad(embedding: Float32Array, targetDim: number): Float32Array;
/**
 * Normalize vector to unit length
 */
export declare function normalize(embedding: Float32Array): Float32Array;
/**
 * Calculate cosine similarity between two vectors
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Apply activation function to vector
 */
export declare function applyActivation(embedding: Float32Array, activation: ActivationType): Float32Array;
/**
 * Simple projection for dimension reduction/expansion
 *
 * @deprecated Use project() with weight matrix instead.
 * VIOLATES: ULTIMATE_RULE (fake neural computation - index cycling, not learned weights)
 * See: TASK-GNN-001 for migration guide
 */
export declare function simpleProjection(embedding: Float32Array, targetDim: number): Float32Array;
/**
 * Learned projection with weight matrix
 */
export declare function project(embedding: Float32Array, weights: Float32Array[], outputDim: number): Float32Array;
/**
 * Matrix-vector multiplication
 */
export declare function matVecMul(matrix: Float32Array[], vector: Float32Array): Float32Array;
/**
 * Prune graph edges by score threshold
 */
export declare function pruneByThreshold<T extends {
    score: number;
}>(items: T[], threshold: number): T[];
/**
 * Softmax activation for attention weights
 * Implements: TASK-GNN-002 (graph attention)
 *
 * Computes numerically stable softmax:
 *   softmax(x_i) = exp(x_i - max(x)) / sum(exp(x_j - max(x)))
 *
 * @param scores - Raw attention scores
 * @returns Normalized attention weights that sum to 1
 */
export declare function softmax(scores: Float32Array): Float32Array;
/**
 * Compute attention score between two vectors using scaled dot product
 * Implements: TASK-GNN-002 (graph attention)
 *
 * Formula: score = (query . key) / sqrt(d_k)
 * Where d_k is the dimension of the key vector
 *
 * @param query - Query vector (center node embedding)
 * @param key - Key vector (neighbor node embedding)
 * @param scale - Optional custom scaling factor (default: 1/sqrt(dim))
 * @returns Scalar attention score
 */
export declare function attentionScore(query: Float32Array, key: Float32Array, scale?: number): number;
/**
 * Apply attention weights to aggregate features
 * Implements: TASK-GNN-002 (graph attention)
 *
 * Computes: output = sum(attention_i * feature_i)
 *
 * @param features - Array of neighbor feature vectors
 * @param attentionWeights - Softmax-normalized attention weights (must sum to 1)
 * @returns Weighted sum of features
 */
export declare function weightedAggregate(features: Float32Array[], attentionWeights: Float32Array): Float32Array;
/**
 * Compute attention scores for all neighbors from adjacency matrix row
 * Implements: TASK-GNN-002 (graph attention)
 *
 * This function:
 * 1. Identifies neighbors from non-zero adjacency values
 * 2. Computes raw attention scores using scaled dot product
 * 3. Multiplies by edge weight from adjacency matrix
 * 4. Returns indices of neighbors and their raw scores
 *
 * @param centerIdx - Index of center node
 * @param center - Center node embedding
 * @param features - All node embeddings
 * @param adjacency - Adjacency matrix (row for center node)
 * @returns Object with neighbor indices and raw attention scores
 */
export declare function computeNeighborAttention(centerIdx: number, center: Float32Array, features: Float32Array[], adjacencyRow: Float32Array): {
    neighborIndices: number[];
    rawScores: Float32Array;
};
//# sourceMappingURL=gnn-math.d.ts.map