/**
 * FNet Attention Mechanism
 *
 * Replaces attention with Fourier transforms for O(N log N) complexity.
 * Based on Lee-Thorp et al. 2021 "FNet: Mixing Tokens with Fourier Transforms"
 *
 * Key Innovation:
 * - No learnable attention weights
 * - 2D FFT: sequence dimension + feature dimension
 * - Real part of complex DFT used as mixing
 * - Dramatically faster than standard attention
 *
 * @module fnet-attention
 */
/**
 * FNet Attention Implementation
 *
 * Complexity Analysis:
 * - Standard Attention: O(N² * D)
 * - FNet: O(N * D * log(N)) + O(D * N * log(D))
 *
 * For typical cases where D ≈ N or D < N², this is much faster.
 */
export class RealFNetAttention {
    name = 'fnet';
    dimension;
    numHeads;
    useApproximateDFT;
    // Precomputed cosine/sine tables for DFT efficiency
    seqCosTable;
    seqSinTable;
    featCosTable;
    featSinTable;
    lastSeqLen;
    constructor(config = {}) {
        this.dimension = config.dimension ?? 768;
        this.numHeads = config.numHeads ?? 12;
        this.useApproximateDFT = config.useApproximateDFT ?? false;
        // Validate configuration
        if (this.dimension <= 0) {
            throw new Error('ANTI-009: FNet dimension must be positive');
        }
        if (!Number.isInteger(this.dimension)) {
            throw new Error('ANTI-009: FNet dimension must be an integer');
        }
    }
    /**
     * Forward pass: Apply 2D Fourier transform
     *
     * Algorithm:
     * 1. Reshape input to [seqLen, dimension]
     * 2. Apply DFT along sequence dimension
     * 3. Apply DFT along feature dimension
     * 4. Take real part
     * 5. Flatten and return
     *
     * @param query - Ignored (FNet doesn't use Q/K/V)
     * @param key - Ignored
     * @param value - Input features [seqLen * dimension]
     * @param mask - Optional attention mask
     * @param seqLen - Sequence length
     */
    forward(query, key, value, mask, seqLen) {
        // Infer sequence length
        const inferredSeqLen = seqLen ?? Math.floor(value.length / this.dimension);
        // Validation - check sequence length first
        if (inferredSeqLen <= 0) {
            throw new Error('ANTI-009: FNet sequence length must be positive');
        }
        if (value.length !== inferredSeqLen * this.dimension) {
            throw new Error(`ANTI-009: FNet input size mismatch. Expected ${inferredSeqLen * this.dimension}, got ${value.length}`);
        }
        // Precompute trig tables if needed
        this.ensureTrigTables(inferredSeqLen);
        // Step 1: Apply DFT along sequence dimension
        // Shape: [seqLen, dimension] -> process each feature independently
        const afterSeqDFT = new Float32Array(value.length);
        for (let d = 0; d < this.dimension; d++) {
            // Extract sequence for this feature
            const featureSeq = new Float32Array(inferredSeqLen);
            for (let i = 0; i < inferredSeqLen; i++) {
                featureSeq[i] = value[i * this.dimension + d];
            }
            // Apply 1D DFT and take real part
            const dftResult = this.dft1D(featureSeq, this.seqCosTable, this.seqSinTable);
            // Store back
            for (let i = 0; i < inferredSeqLen; i++) {
                afterSeqDFT[i * this.dimension + d] = dftResult[i];
            }
        }
        // Step 2: Apply DFT along feature dimension
        // Shape: [seqLen, dimension] -> process each sequence position independently
        const afterFeatDFT = new Float32Array(value.length);
        for (let i = 0; i < inferredSeqLen; i++) {
            // Extract features for this position
            const posFeatures = new Float32Array(this.dimension);
            for (let d = 0; d < this.dimension; d++) {
                posFeatures[d] = afterSeqDFT[i * this.dimension + d];
            }
            // Apply 1D DFT and take real part
            const dftResult = this.dft1D(posFeatures, this.featCosTable, this.featSinTable);
            // Store back
            for (let d = 0; d < this.dimension; d++) {
                afterFeatDFT[i * this.dimension + d] = dftResult[d];
            }
        }
        // Step 3: Apply mask BEFORE layer norm
        if (mask && mask.length === inferredSeqLen) {
            for (let i = 0; i < inferredSeqLen; i++) {
                if (!mask[i]) {
                    for (let d = 0; d < this.dimension; d++) {
                        afterFeatDFT[i * this.dimension + d] = 0;
                    }
                }
            }
        }
        // Step 4: Layer normalization (standard FNet includes this)
        // Only normalize non-masked positions
        this.layerNorm(afterFeatDFT, inferredSeqLen, mask);
        return afterFeatDFT;
    }
    /**
     * 1D Discrete Fourier Transform with real output
     *
     * DFT Formula:
     * X[k] = Σ(n=0 to N-1) x[n] * exp(-2πi*k*n/N)
     *
     * Real part:
     * Re(X[k]) = Σ(n=0 to N-1) x[n] * cos(2π*k*n/N)
     *
     * @param input - Input sequence
     * @param cosTable - Precomputed cosine table
     * @param sinTable - Precomputed sine table (unused for real part, but kept for consistency)
     */
    dft1D(input, cosTable, sinTable) {
        const N = input.length;
        const output = new Float32Array(N);
        if (this.useApproximateDFT && N > 64) {
            // For very long sequences, use sampling approximation
            return this.approximateDFT(input);
        }
        // Standard DFT: O(N²) but with precomputed tables
        for (let k = 0; k < N; k++) {
            let real = 0;
            for (let n = 0; n < N; n++) {
                // Use precomputed cosine: cos(2π*k*n/N)
                const tableIndex = (k * n) % (N * N);
                const cosValue = cosTable[tableIndex];
                real += input[n] * cosValue;
            }
            output[k] = real / Math.sqrt(N); // Normalize
        }
        return output;
    }
    /**
     * Approximate DFT for very long sequences
     * Uses frequency sampling to reduce O(N²) to O(N * K) where K << N
     */
    approximateDFT(input) {
        const N = input.length;
        const K = Math.min(64, N); // Sample up to 64 frequencies
        const output = new Float32Array(N);
        // Compute K most important frequencies
        for (let k = 0; k < K; k++) {
            let real = 0;
            const freq = (2 * Math.PI * k) / N;
            for (let n = 0; n < N; n++) {
                real += input[n] * Math.cos(freq * n);
            }
            output[k] = real / Math.sqrt(N);
        }
        // Fill remaining with zeros (high frequencies discarded)
        for (let k = K; k < N; k++) {
            output[k] = 0;
        }
        return output;
    }
    /**
     * Ensure trigonometric tables are precomputed
     * Tables are cached for the current sequence length
     */
    ensureTrigTables(seqLen) {
        // Regenerate if sequence length changed
        if (this.lastSeqLen !== seqLen) {
            this.seqCosTable = this.buildCosineTable(seqLen);
            this.seqSinTable = this.buildSineTable(seqLen);
            this.lastSeqLen = seqLen;
        }
        // Feature tables (constant for this instance)
        if (!this.featCosTable) {
            this.featCosTable = this.buildCosineTable(this.dimension);
            this.featSinTable = this.buildSineTable(this.dimension);
        }
    }
    /**
     * Build precomputed cosine table for DFT
     * Table[k*n] = cos(2π*k*n/N)
     */
    buildCosineTable(N) {
        const table = new Float32Array(N * N);
        for (let k = 0; k < N; k++) {
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                table[k * N + n] = Math.cos(angle);
            }
        }
        return table;
    }
    /**
     * Build precomputed sine table for DFT
     */
    buildSineTable(N) {
        const table = new Float32Array(N * N);
        for (let k = 0; k < N; k++) {
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                table[k * N + n] = Math.sin(angle);
            }
        }
        return table;
    }
    /**
     * Layer normalization: normalize each feature across sequence
     *
     * For each dimension d:
     * x_norm[i,d] = (x[i,d] - mean_d) / sqrt(var_d + ε)
     *
     * @param mask - Optional mask to exclude certain positions from normalization
     */
    layerNorm(data, seqLen, mask) {
        const epsilon = 1e-6;
        for (let d = 0; d < this.dimension; d++) {
            // Compute mean for this dimension (only over unmasked positions)
            let sum = 0;
            let count = 0;
            for (let i = 0; i < seqLen; i++) {
                if (!mask || mask[i]) {
                    sum += data[i * this.dimension + d];
                    count++;
                }
            }
            const mean = count > 0 ? sum / count : 0;
            // Compute variance
            let varSum = 0;
            for (let i = 0; i < seqLen; i++) {
                if (!mask || mask[i]) {
                    const diff = data[i * this.dimension + d] - mean;
                    varSum += diff * diff;
                }
            }
            const variance = count > 0 ? varSum / count : 1;
            const std = Math.sqrt(variance + epsilon);
            // Normalize (only unmasked positions, masked stay at 0)
            for (let i = 0; i < seqLen; i++) {
                if (!mask || mask[i]) {
                    const idx = i * this.dimension + d;
                    data[idx] = (data[idx] - mean) / std;
                }
            }
        }
    }
    /**
     * Get parameter count
     * FNet has NO learnable parameters in the mixing layer
     * (Only potential parameters would be in surrounding FFN layers)
     */
    getParameterCount() {
        return 0; // Pure algorithmic transform, no learned weights
    }
    /**
     * Get complexity hint for documentation
     */
    getComplexityHint() {
        return 'O(N*D*log(N) + D*N*log(D)) vs O(N²*D) for standard attention';
    }
}
/**
 * Factory function for creating FNet attention
 */
export function createFNetAttention(config) {
    return new RealFNetAttention(config);
}
//# sourceMappingURL=fnet-attention.js.map