/**
 * Tiny Dancer Routing Utilities
 * TASK-TIN-001 - Neural Agent Routing Helpers
 *
 * Provides utility functions for:
 * - Vector similarity calculations
 * - Confidence scoring
 * - Uncertainty estimation
 * - Softmax and activation functions
 */
/**
 * Calculate cosine similarity between two vectors
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * L2-normalize a vector
 */
export declare function normalizeL2(vector: Float32Array): Float32Array;
/**
 * Softmax function for probability distribution
 */
export declare function softmax(logits: number[]): number[];
/**
 * ReLU activation
 */
export declare function relu(x: number): number;
/**
 * Sigmoid activation
 */
export declare function sigmoid(x: number): number;
/**
 * Tanh activation
 */
export declare function tanh(x: number): number;
/**
 * Matrix-vector multiplication
 * matrix: (rows × cols), vector: (cols), output: (rows)
 */
export declare function matVecMul(matrix: Float32Array, vector: Float32Array, rows: number, cols: number): Float32Array;
/**
 * Add bias to vector
 */
export declare function addBias(vector: Float32Array, bias: Float32Array): Float32Array;
/**
 * Apply ReLU activation to vector
 */
export declare function reluVector(vector: Float32Array): Float32Array;
/**
 * Calculate confidence from softmax probabilities
 * Higher max probability = higher confidence
 */
export declare function calculateConfidence(probabilities: number[]): number;
/**
 * Calculate epistemic uncertainty from softmax probabilities
 * Based on entropy: H = -Σ p(x) log p(x)
 * Normalized to [0, 1] where 1 = maximum uncertainty
 */
export declare function calculateUncertainty(probabilities: number[]): number;
/**
 * Calculate score from similarity for ranking
 * Applies temperature scaling for better discrimination
 */
export declare function calculateScore(similarity: number, temperature?: number): number;
/**
 * Rank items by score descending
 */
export declare function rankByScore<T extends {
    score: number;
}>(items: T[]): T[];
/**
 * Get top-k items by score
 */
export declare function topK<T extends {
    score: number;
}>(items: T[], k: number): T[];
/**
 * Check if timestamp is within window
 */
export declare function isWithinWindow(timestamp: number, windowMs: number): boolean;
/**
 * Calculate remaining time until expiry
 */
export declare function timeUntilExpiry(expiryTimestamp: number): number;
/**
 * Xavier/Glorot initialization for weight matrix
 */
export declare function xavierInit(rows: number, cols: number): Float32Array;
/**
 * Initialize bias vector with zeros
 */
export declare function zeroInit(size: number): Float32Array;
/**
 * Initialize weights from agent embeddings
 * Creates projection from query space to agent probability space
 */
export declare function initFromEmbeddings(embeddings: Float32Array[], inputDim: number, hiddenDim: number): {
    W_input: Float32Array;
    W_output: Float32Array;
    b_hidden: Float32Array;
    b_output: Float32Array;
};
//# sourceMappingURL=routing-utils.d.ts.map