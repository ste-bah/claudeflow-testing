/**
 * DualSpace Attention
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Combines hyperbolic + graph attention for mixed workloads:
 * - Hyperbolic attention for hierarchical structure
 * - GraphRoPe for graph connectivity
 * - Adaptive weighting based on data characteristics
 *
 * Used when: hierarchyDepth >2 AND hasGraphStructure = true
 */
import type { IAttentionMechanism } from './attention-types.js';
/**
 * DualSpace attention: combines hyperbolic + graph attention
 */
export declare class DualSpaceAttention implements IAttentionMechanism {
    readonly name = "dual-space";
    private hyperbolicAttention;
    private graphAttention;
    private alpha;
    constructor(config?: {
        hyperbolicConfig?: Record<string, unknown>;
        graphConfig?: Record<string, unknown>;
        mixingWeight?: number;
    });
    /**
     * Forward pass: combine hyperbolic and graph attention outputs
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[]): Float32Array;
    /**
     * Get total parameter count from both mechanisms
     */
    getParameterCount(): number;
    /**
     * Get current mixing weight
     */
    getMixingWeight(): number;
    /**
     * Set mixing weight
     * @param alpha Weight for hyperbolic attention (0-1)
     *              0 = all graph attention
     *              1 = all hyperbolic attention
     *              0.5 = equal mix
     */
    setMixingWeight(alpha: number): void;
    /**
     * Adaptively adjust mixing weight based on data characteristics
     */
    adaptMixingWeight(hierarchyScore: number, graphScore: number): void;
    /**
     * Get component mechanisms for inspection
     */
    getComponents(): {
        hyperbolic: IAttentionMechanism;
        graph: IAttentionMechanism;
    };
}
//# sourceMappingURL=dual-space-attention.d.ts.map