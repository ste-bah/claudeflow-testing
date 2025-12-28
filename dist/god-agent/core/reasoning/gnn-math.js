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
 * Add two vectors element-wise
 */
export function addVectors(a, b) {
    const maxLen = Math.max(a.length, b.length);
    const result = new Float32Array(maxLen);
    for (let i = 0; i < maxLen; i++) {
        const aVal = i < a.length ? a[i] : 0;
        const bVal = i < b.length ? b[i] : 0;
        result[i] = aVal + bVal;
    }
    return result;
}
/**
 * Zero-pad vector to target dimension
 */
export function zeroPad(embedding, targetDim) {
    if (embedding.length >= targetDim) {
        return embedding.slice(0, targetDim);
    }
    const padded = new Float32Array(targetDim);
    padded.set(embedding);
    return padded;
}
/**
 * Normalize vector to unit length
 */
export function normalize(embedding) {
    let magnitude = 0;
    for (let i = 0; i < embedding.length; i++) {
        magnitude += embedding[i] * embedding[i];
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude === 0) {
        return embedding;
    }
    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
        normalized[i] = embedding[i] / magnitude;
    }
    return normalized;
}
/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
    const minLen = Math.min(a.length, b.length);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < minLen; i++) {
        dotProduct += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) {
        return 0;
    }
    return dotProduct / (magA * magB);
}
/**
 * Apply activation function to vector
 */
export function applyActivation(embedding, activation) {
    const result = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
        const x = embedding[i];
        switch (activation) {
            case 'relu':
                result[i] = Math.max(0, x);
                break;
            case 'tanh':
                result[i] = Math.tanh(x);
                break;
            case 'sigmoid':
                result[i] = 1 / (1 + Math.exp(-x));
                break;
            case 'leaky_relu':
                result[i] = x > 0 ? x : 0.01 * x;
                break;
            default:
                result[i] = x;
        }
    }
    return result;
}
/**
 * Simple projection for dimension reduction/expansion
 */
export function simpleProjection(embedding, targetDim) {
    if (embedding.length === targetDim) {
        return new Float32Array(embedding);
    }
    const result = new Float32Array(targetDim);
    if (embedding.length < targetDim) {
        // Expand by cycling
        for (let i = 0; i < targetDim; i++) {
            result[i] = embedding[i % embedding.length];
        }
    }
    else {
        // Reduce by averaging
        const ratio = embedding.length / targetDim;
        for (let i = 0; i < targetDim; i++) {
            const start = Math.floor(i * ratio);
            const end = Math.floor((i + 1) * ratio);
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += embedding[j];
            }
            result[i] = sum / (end - start);
        }
    }
    return result;
}
/**
 * Learned projection with weight matrix
 */
export function project(embedding, weights, outputDim) {
    const result = new Float32Array(outputDim);
    for (let o = 0; o < outputDim; o++) {
        let sum = 0;
        const w = weights[o] || new Float32Array(embedding.length);
        for (let i = 0; i < embedding.length && i < w.length; i++) {
            sum += embedding[i] * w[i];
        }
        result[o] = sum;
    }
    return result;
}
/**
 * Matrix-vector multiplication
 */
export function matVecMul(matrix, vector) {
    const rows = matrix.length;
    const result = new Float32Array(rows);
    for (let i = 0; i < rows; i++) {
        let sum = 0;
        const row = matrix[i];
        for (let j = 0; j < vector.length && j < row.length; j++) {
            sum += row[j] * vector[j];
        }
        result[i] = sum;
    }
    return result;
}
/**
 * Prune graph edges by score threshold
 */
export function pruneByThreshold(items, threshold) {
    return items.filter((item) => item.score >= threshold);
}
//# sourceMappingURL=gnn-math.js.map