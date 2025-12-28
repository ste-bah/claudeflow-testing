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
import type { IAttentionMechanism } from '../attention-types.js';
export interface FNetConfig {
    dimension?: number;
    numHeads?: number;
    seed?: number;
    useApproximateDFT?: boolean;
}
/**
 * FNet Attention Implementation
 *
 * Complexity Analysis:
 * - Standard Attention: O(N² * D)
 * - FNet: O(N * D * log(N)) + O(D * N * log(D))
 *
 * For typical cases where D ≈ N or D < N², this is much faster.
 */
export declare class RealFNetAttention implements IAttentionMechanism {
    readonly name = "fnet";
    private readonly dimension;
    private readonly numHeads;
    private readonly useApproximateDFT;
    private seqCosTable?;
    private seqSinTable?;
    private featCosTable?;
    private featSinTable?;
    private lastSeqLen?;
    constructor(config?: FNetConfig);
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
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
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
    private dft1D;
    /**
     * Approximate DFT for very long sequences
     * Uses frequency sampling to reduce O(N²) to O(N * K) where K << N
     */
    private approximateDFT;
    /**
     * Ensure trigonometric tables are precomputed
     * Tables are cached for the current sequence length
     */
    private ensureTrigTables;
    /**
     * Build precomputed cosine table for DFT
     * Table[k*n] = cos(2π*k*n/N)
     */
    private buildCosineTable;
    /**
     * Build precomputed sine table for DFT
     */
    private buildSineTable;
    /**
     * Layer normalization: normalize each feature across sequence
     *
     * For each dimension d:
     * x_norm[i,d] = (x[i,d] - mean_d) / sqrt(var_d + ε)
     *
     * @param mask - Optional mask to exclude certain positions from normalization
     */
    private layerNorm;
    /**
     * Get parameter count
     * FNet has NO learnable parameters in the mixing layer
     * (Only potential parameters would be in surrounding FFN layers)
     */
    getParameterCount(): number;
    /**
     * Get complexity hint for documentation
     */
    getComplexityHint(): string;
}
/**
 * Factory function for creating FNet attention
 */
export declare function createFNetAttention(config?: FNetConfig): RealFNetAttention;
//# sourceMappingURL=fnet-attention.d.ts.map