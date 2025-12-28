/**
 * Placeholder Attention Mechanisms
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Provides placeholder implementations of attention mechanisms.
 * These are PRODUCTION code that return simplified outputs.
 *
 * FUTURE WORK: Replace each placeholder with real neural network implementations.
 * See: docs/god-agent-specs/anti-pattern-fixes/SPEC-ANTI-009-PLACEHOLDER-NEURAL-NETWORKS.md
 *
 * Currently implemented (real):
 * - RealStandardAttention (mechanisms/standard-attention.ts) - Standard O(N²) attention
 * - RealLinearAttention (mechanisms/linear-attention.ts) - O(N) complexity
 * - RealFlashAttention (mechanisms/flash-attention.ts) - IO-aware tiling
 * - RealMultiQueryAttention (mechanisms/multi-query-attention.ts) - Single shared K,V head
 * - RealGroupedQueryAttention (mechanisms/grouped-query-attention.ts) - Grouped K,V heads
 *
 * Placeholder implementations (this file):
 * - 33 remaining mechanisms use simplified weighted averaging
 *
 * ANTI-009: As real implementations are created, they should replace placeholders
 * in MECHANISM_CONSTRUCTORS below. No backwards compatibility - clean breaks only.
 */
import { VECTOR_DIM, DEFAULT_NUM_HEADS } from '../validation/constants.js';
import { RealStandardAttention } from './mechanisms/standard-attention.js';
import { RealLinearAttention } from './mechanisms/linear-attention.js';
import { RealFlashAttention } from './mechanisms/flash-attention.js';
import { RealMultiQueryAttention } from './mechanisms/multi-query-attention.js';
import { RealGroupedQueryAttention } from './mechanisms/grouped-query-attention.js';
// Phase 2 implementations
import { RealLongformerAttention } from './mechanisms/longformer-attention.js';
import { RealBigBirdAttention } from './mechanisms/bigbird-attention.js';
import { RealSparseTransformerAttention } from './mechanisms/sparse-transformer-attention.js';
// Phase 3 implementations
import { RealHyperbolicAttention } from './mechanisms/hyperbolic-attention.js';
import { RealGraphRoPeAttention } from './mechanisms/graph-rope-attention.js';
import { RealMambaAttention } from './mechanisms/mamba-attention.js';
import { RealRWKVAttention } from './mechanisms/rwkv-attention.js';
// Phase 4 implementations
import { RealPerformerAttention } from './mechanisms/performer-attention.js';
import { RealLinformerAttention } from './mechanisms/linformer-attention.js';
import { RealReformerAttention } from './mechanisms/reformer-attention.js';
import { RealRetentiveAttention } from './mechanisms/retentive-attention.js';
import { RealHyenaAttention } from './mechanisms/hyena-attention.js';
// Phase 5 implementations
import { RealDifferentialAttention } from './mechanisms/differential-attention.js';
import { RealCrossAttention } from './mechanisms/cross-attention.js';
import { RealCausalAttention } from './mechanisms/causal-attention.js';
import { RealLocalAttention } from './mechanisms/local-attention.js';
import { RealBidirectionalAttention } from './mechanisms/bidirectional-attention.js';
// Phase 6 implementations
import { RealSlidingWindowAttention } from './mechanisms/sliding-window-attention.js';
import { RealGlobalAttention } from './mechanisms/global-attention.js';
import { RealDilatedAttention } from './mechanisms/dilated-attention.js';
import { RealStridedAttention } from './mechanisms/strided-attention.js';
import { RealAxialAttention } from './mechanisms/axial-attention.js';
import { RealBlockSparseAttention } from './mechanisms/block-sparse-attention.js';
// Phase 7 implementations
import { RealMemoryCompressedAttention } from './mechanisms/memory-compressed-attention.js';
import { RealRoutingTransformerAttention } from './mechanisms/routing-transformer-attention.js';
import { RealClusteredAttention } from './mechanisms/clustered-attention.js';
import { RealSetTransformerAttention } from './mechanisms/set-transformer-attention.js';
import { RealMultiHeadLatentAttention } from './mechanisms/multi-head-latent-attention.js';
import { RealSynthesizerAttention } from './mechanisms/synthesizer-attention.js';
import { RealLunaAttention } from './mechanisms/luna-attention.js';
import { RealNystromformerAttention } from './mechanisms/nystromformer-attention.js';
import { RealFNetAttention } from './mechanisms/fnet-attention.js';
import { RealAFTAttention } from './mechanisms/aft-attention.js';
import { RealMegaAttention } from './mechanisms/mega-attention.js';
// ==================== Base Placeholder Mechanism ====================
/**
 * Base class for placeholder attention mechanisms.
 *
 * PRODUCTION CODE: These placeholders are used when real implementations
 * are not yet available. They provide simplified weighted averaging.
 *
 * To implement a real mechanism:
 * 1. Create new file in mechanisms/ directory
 * 2. Implement IAttentionMechanism with actual neural network logic
 * 3. Register in MECHANISM_CONSTRUCTORS (replacing placeholder)
 * 4. See RealStandardAttention for reference implementation
 */
export class BasePlaceholderAttention {
    dimension;
    numHeads;
    constructor(config) {
        this.dimension = config?.dimension ?? VECTOR_DIM;
        this.numHeads = config?.numHeads ?? DEFAULT_NUM_HEADS;
    }
    /**
     * Placeholder forward pass - returns simplified weighted combination.
     * Real implementations should compute actual attention scores.
     */
    forward(query, _key, value, _mask) {
        // Simple mock: return weighted combination of query and value
        const output = new Float32Array(query.length);
        for (let i = 0; i < query.length; i++) {
            output[i] = 0.5 * query[i] + 0.5 * value[i];
        }
        return output;
    }
    /**
     * Get parameter count
     */
    getParameterCount() {
        // W_q, W_k, W_v, W_o each of size (dim × dim)
        return 4 * this.dimension * this.dimension;
    }
}
// ==================== Efficiency Mechanisms (Placeholders) ====================
/**
 * Flash Attention - IO-aware exact attention
 * PLACEHOLDER: Real implementation requires CUDA/GPU memory tiling
 */
export class FlashAttention extends BasePlaceholderAttention {
    name = 'flash';
}
/**
 * Linear Attention - O(N) complexity via kernel approximation
 * PLACEHOLDER: Real implementation requires kernel feature maps
 */
export class LinearAttention extends BasePlaceholderAttention {
    name = 'linear';
}
/**
 * Performer - FAVOR+ kernel method
 */
export class PerformerAttention extends BasePlaceholderAttention {
    name = 'performer';
}
/**
 * Linformer - Low-rank self-attention
 */
export class LinformerAttention extends BasePlaceholderAttention {
    name = 'linformer';
}
/**
 * Reformer - Locality-sensitive hashing
 */
export class ReformerAttention extends BasePlaceholderAttention {
    name = 'reformer';
}
// ==================== Structure-Aware Mechanisms ====================
/**
 * Hyperbolic Attention - For hierarchical data
 */
export class HyperbolicAttention extends BasePlaceholderAttention {
    name = 'hyperbolic';
}
/**
 * GraphRoPe - Rotary position embeddings for graphs
 */
export class GraphRoPeAttention extends BasePlaceholderAttention {
    name = 'graph-rope';
}
// ==================== Sparse/Structured Mechanisms ====================
/**
 * BigBird - Sparse attention with random, window, and global tokens
 */
export class BigBirdAttention extends BasePlaceholderAttention {
    name = 'bigbird';
}
/**
 * Longformer - Sliding window + global attention
 */
export class LongformerAttention extends BasePlaceholderAttention {
    name = 'longformer';
}
/**
 * Sparse Transformer - Fixed sparse patterns
 */
export class SparseTransformerAttention extends BasePlaceholderAttention {
    name = 'sparse-transformer';
}
// ==================== Memory-Based Mechanisms ====================
/**
 * Memory Compressed Attention
 */
export class MemoryCompressedAttention extends BasePlaceholderAttention {
    name = 'memory-compressed';
}
/**
 * Routing Transformer - Content-based routing
 */
export class RoutingTransformerAttention extends BasePlaceholderAttention {
    name = 'routing-transformer';
}
/**
 * Clustered Attention - Cluster-based approximation
 */
export class ClusteredAttention extends BasePlaceholderAttention {
    name = 'clustered';
}
/**
 * Set Transformer - Attention for sets
 */
export class SetTransformerAttention extends BasePlaceholderAttention {
    name = 'set-transformer';
}
// ==================== Domain-Specific Mechanisms ====================
/**
 * Retentive Network - Retention-based attention
 */
export class RetentiveAttention extends BasePlaceholderAttention {
    name = 'retentive';
}
/**
 * Differential Transformer - Differential attention
 */
export class DifferentialAttention extends BasePlaceholderAttention {
    name = 'differential';
}
/**
 * Hyena - Subquadratic via implicit convolutions
 */
export class HyenaAttention extends BasePlaceholderAttention {
    name = 'hyena';
}
/**
 * Mamba - State space models
 */
export class MambaAttention extends BasePlaceholderAttention {
    name = 'mamba';
}
/**
 * RWKV - Receptance Weighted Key Value
 */
export class RWKVAttention extends BasePlaceholderAttention {
    name = 'rwkv';
}
// ==================== Standard Attention ====================
/**
 * Standard Multi-Head Attention
 */
export class StandardAttention extends BasePlaceholderAttention {
    name = 'standard';
}
// ==================== Specialized Mechanisms ====================
/**
 * Cross Attention - For encoder-decoder
 */
export class CrossAttention extends BasePlaceholderAttention {
    name = 'cross';
}
/**
 * Local Attention - Window-based
 */
export class LocalAttention extends BasePlaceholderAttention {
    name = 'local';
}
/**
 * Global Attention - Selected global tokens
 */
export class GlobalAttention extends BasePlaceholderAttention {
    name = 'global';
}
/**
 * Axial Attention - Factored attention
 */
export class AxialAttention extends BasePlaceholderAttention {
    name = 'axial';
}
/**
 * Block Sparse Attention
 */
export class BlockSparseAttention extends BasePlaceholderAttention {
    name = 'block-sparse';
}
/**
 * Strided Attention
 */
export class StridedAttention extends BasePlaceholderAttention {
    name = 'strided';
}
/**
 * Dilated Attention
 */
export class DilatedAttention extends BasePlaceholderAttention {
    name = 'dilated';
}
/**
 * Sliding Window Attention
 */
export class SlidingWindowAttention extends BasePlaceholderAttention {
    name = 'sliding-window';
}
/**
 * Causal Attention - Left-to-right only
 */
export class CausalAttention extends BasePlaceholderAttention {
    name = 'causal';
}
/**
 * Bidirectional Attention
 */
export class BidirectionalAttention extends BasePlaceholderAttention {
    name = 'bidirectional';
}
/**
 * Multi-Query Attention - Shared KV heads
 */
export class MultiQueryAttention extends BasePlaceholderAttention {
    name = 'multi-query';
}
/**
 * Grouped Query Attention - Grouped KV heads
 */
export class GroupedQueryAttention extends BasePlaceholderAttention {
    name = 'grouped-query';
}
/**
 * Multi-Head Latent Attention
 */
export class MultiHeadLatentAttention extends BasePlaceholderAttention {
    name = 'multi-head-latent';
}
/**
 * Synthesizer - Random feature attention
 */
export class SynthesizerAttention extends BasePlaceholderAttention {
    name = 'synthesizer';
}
/**
 * Luna - Linear Unified Nested Attention
 */
export class LunaAttention extends BasePlaceholderAttention {
    name = 'luna';
}
/**
 * Nyströmformer - Nyström approximation
 */
export class NystromformerAttention extends BasePlaceholderAttention {
    name = 'nystromformer';
}
/**
 * FNet - Fourier attention
 */
export class FNetAttention extends BasePlaceholderAttention {
    name = 'fnet';
}
/**
 * AFT - Attention Free Transformer
 */
export class AFTAttention extends BasePlaceholderAttention {
    name = 'aft';
}
/**
 * Mega - Moving Average Equipped Gated Attention
 */
export class MegaAttention extends BasePlaceholderAttention {
    name = 'mega';
}
// ==================== Factory Map ====================
/**
 * Map of mechanism names to their constructors
 */
export const MECHANISM_CONSTRUCTORS = {
    // === Phase 1: Real implementations ===
    'flash': RealFlashAttention, // ANTI-009 fix: Real IO-aware tiling implementation
    'linear': RealLinearAttention, // ANTI-009 fix: Real O(N) linear attention
    'standard': RealStandardAttention, // ANTI-009 fix: Use real implementation, not placeholder
    'real-standard': RealStandardAttention, // Explicit alias for real implementation
    'multi-query': RealMultiQueryAttention, // ANTI-009 fix: Real MQA with shared K,V
    'grouped-query': RealGroupedQueryAttention, // ANTI-009 fix: Real GQA with grouped K,V
    // === Phase 2: Sparse/Long-Context implementations ===
    'longformer': RealLongformerAttention, // ANTI-009 fix: Real sliding window + global attention
    'bigbird': RealBigBirdAttention, // ANTI-009 fix: Real random + window + global patterns
    'sparse-transformer': RealSparseTransformerAttention, // ANTI-009 fix: Real strided + fixed patterns
    // === Phase 3: Structure-Aware and SSM implementations ===
    'hyperbolic': RealHyperbolicAttention, // ANTI-009 fix: Real Poincaré ball attention
    'graph-rope': RealGraphRoPeAttention, // ANTI-009 fix: Real Rotary Position Embeddings
    'mamba': RealMambaAttention, // ANTI-009 fix: Real Selective State Space Model
    'rwkv': RealRWKVAttention, // ANTI-009 fix: Real Receptance Weighted Key Value
    // === Phase 4: Linear attention variants ===
    'performer': RealPerformerAttention, // ANTI-009 fix: Real FAVOR+ random features
    'linformer': RealLinformerAttention, // ANTI-009 fix: Real low-rank projection
    'reformer': RealReformerAttention, // ANTI-009 fix: Real LSH-based attention
    'retentive': RealRetentiveAttention, // ANTI-009 fix: Real RetNet attention
    'hyena': RealHyenaAttention, // ANTI-009 fix: Real implicit convolution attention
    // === Phase 5: Real implementations ===
    'differential': RealDifferentialAttention, // ANTI-009 fix: Real noise-cancellation attention
    'cross': RealCrossAttention, // ANTI-009 fix: Real encoder-decoder attention
    'local': RealLocalAttention, // ANTI-009 fix: Real windowed local attention
    'causal': RealCausalAttention, // ANTI-009 fix: Real autoregressive attention
    'bidirectional': RealBidirectionalAttention, // ANTI-009 fix: Real full bidirectional attention
    // === Phase 6: Sparse/structured pattern implementations ===
    'sliding-window': RealSlidingWindowAttention, // ANTI-009 fix: Real sliding window pattern
    'global': RealGlobalAttention, // ANTI-009 fix: Real global token attention
    'dilated': RealDilatedAttention, // ANTI-009 fix: Real dilated/spaced attention
    'strided': RealStridedAttention, // ANTI-009 fix: Real local + strided global
    'axial': RealAxialAttention, // ANTI-009 fix: Real row-then-column factorized
    'block-sparse': RealBlockSparseAttention, // ANTI-009 fix: Real structured block sparsity
    // === Phase 7: Memory and specialized implementations ===
    'memory-compressed': RealMemoryCompressedAttention, // ANTI-009 fix: Real memory compression
    'routing-transformer': RealRoutingTransformerAttention, // ANTI-009 fix: Real content-based routing
    'clustered': RealClusteredAttention, // ANTI-009 fix: Real k-means clustering attention
    'set-transformer': RealSetTransformerAttention, // ANTI-009 fix: Real permutation-invariant attention
    'multi-head-latent': RealMultiHeadLatentAttention, // ANTI-009 fix: Real learned latent queries
    'synthesizer': RealSynthesizerAttention, // ANTI-009 fix: Real random/dense synthesized attention
    'luna': RealLunaAttention, // ANTI-009 fix: Real linear unified nested attention
    'nystromformer': RealNystromformerAttention, // ANTI-009 fix: Real Nyström approximation
    'fnet': RealFNetAttention, // ANTI-009 fix: Real Fourier transform mixing
    'aft': RealAFTAttention, // ANTI-009 fix: Real attention-free transformer
    'mega': RealMegaAttention, // ANTI-009 fix: Real EMA + gated attention
};
//# sourceMappingURL=attention-mechanisms.js.map