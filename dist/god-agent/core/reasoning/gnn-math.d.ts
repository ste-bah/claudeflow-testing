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
//# sourceMappingURL=gnn-math.d.ts.map