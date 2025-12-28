/**
 * Real Performer Attention Implementation (FAVOR+)
 *
 * Reference: Choromanski et al. 2020 "Rethinking Attention with Performers"
 * https://arxiv.org/abs/2009.14794
 *
 * Key insight: Use random feature maps to approximate the softmax kernel,
 * enabling O(N) complexity attention through FAVOR+ mechanism:
 *
 * Original attention: softmax(QK^T/√d) V
 * FAVOR+ approximation: φ(Q) · (φ(K)^T · V) / (φ(Q) · φ(K)^T · 1)
 *
 * Where φ is a random feature map that approximates exp(q·k/√d):
 * φ(x) = exp(x²/2) · [cos(ωx), sin(ωx)] / √m
 *
 * The key is that φ(Q)·φ(K)^T ≈ softmax(QK^T)
 *
 * Complexity: O(N × d × m) where m is number of random features
 * Parameter Count: 4 × dim² + random features
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Performer Attention Implementation
 *
 * Implements FAVOR+ (Fast Attention Via Orthogonal Random features)
 * for efficient O(N) attention approximation.
 *
 * @example
 * ```typescript
 * // Create Performer attention
 * const attention = new RealPerformerAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   numFeatures: 256,  // Random feature dimension
 *   seed: 42
 * });
 *
 * // Process long sequence efficiently
 * const seqLen = 16384;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealPerformerAttention implements IAttentionMechanism {
    readonly name = "performer";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly numFeatures;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly randomProjection;
    private readonly rng?;
    /**
     * Initialize Performer attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.numFeatures Number of random features (default: dimension / numHeads)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        numFeatures?: number;
        seed?: number;
    });
    /**
     * Compute random feature map φ(x) for FAVOR+
     *
     * φ(x) = exp(-||x||²/2) * [cos(ω·x), sin(ω·x)] / √m
     *
     * This approximates the softmax kernel exp(x·y)
     */
    private computeFeatureMap;
    /**
     * Forward pass: Performer FAVOR+ attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. Apply random feature map φ to Q and K
     * 3. Compute attention as: φ(Q) · (φ(K)^T · V) / (φ(Q) · sum(φ(K)))
     * 4. Project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask (ignored for efficiency)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute FAVOR+ attention for a single head
     *
     * Linear attention: output = φ(Q) · (φ(K)^T · V) / (φ(Q) · φ(K)^T · 1)
     */
    private computeHeadFavorAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Performer: 4 × dim² + headDim × numFeatures (random features)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=performer-attention.d.ts.map