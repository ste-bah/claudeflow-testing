/**
 * Attention Mechanisms Registry
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Maps attention mechanism names to their Real implementations.
 * All placeholder classes have been removed per ANTI-009.
 *
 * Real implementations available in mechanisms/ directory:
 * - Phase 1: Standard, Linear, Flash, MultiQuery, GroupedQuery
 * - Phase 2: Longformer, BigBird, SparseTransformer
 * - Phase 3: Hyperbolic, GraphRoPe, Mamba, RWKV
 * - Phase 4: Performer, Linformer, Reformer, Retentive, Hyena
 * - Phase 5: Differential, Cross, Causal, Local, Bidirectional
 * - Phase 6: SlidingWindow, Global, Dilated, Strided, Axial, BlockSparse
 * - Phase 7: MemoryCompressed, RoutingTransformer, Clustered, SetTransformer,
 *            MultiHeadLatent, Synthesizer, Luna, Nystromformer, FNet, AFT, Mega
 *
 * See: docs/god-agent-specs/anti-pattern-fixes/SPEC-ANTI-009-PLACEHOLDER-NEURAL-NETWORKS.md
 */
import type { IAttentionMechanism } from './attention-types.js';
export { RealStandardAttention } from './mechanisms/standard-attention.js';
export { RealLinearAttention } from './mechanisms/linear-attention.js';
export { RealFlashAttention } from './mechanisms/flash-attention.js';
export { RealMultiQueryAttention } from './mechanisms/multi-query-attention.js';
export { RealGroupedQueryAttention } from './mechanisms/grouped-query-attention.js';
export { RealLongformerAttention } from './mechanisms/longformer-attention.js';
export { RealBigBirdAttention } from './mechanisms/bigbird-attention.js';
export { RealSparseTransformerAttention } from './mechanisms/sparse-transformer-attention.js';
export { RealHyperbolicAttention } from './mechanisms/hyperbolic-attention.js';
export { RealGraphRoPeAttention } from './mechanisms/graph-rope-attention.js';
export { RealMambaAttention } from './mechanisms/mamba-attention.js';
export { RealRWKVAttention } from './mechanisms/rwkv-attention.js';
export { RealPerformerAttention } from './mechanisms/performer-attention.js';
export { RealLinformerAttention } from './mechanisms/linformer-attention.js';
export { RealReformerAttention } from './mechanisms/reformer-attention.js';
export { RealRetentiveAttention } from './mechanisms/retentive-attention.js';
export { RealHyenaAttention } from './mechanisms/hyena-attention.js';
export { RealDifferentialAttention } from './mechanisms/differential-attention.js';
export { RealCrossAttention } from './mechanisms/cross-attention.js';
export { RealCausalAttention } from './mechanisms/causal-attention.js';
export { RealLocalAttention } from './mechanisms/local-attention.js';
export { RealBidirectionalAttention } from './mechanisms/bidirectional-attention.js';
export { RealSlidingWindowAttention } from './mechanisms/sliding-window-attention.js';
export { RealGlobalAttention } from './mechanisms/global-attention.js';
export { RealDilatedAttention } from './mechanisms/dilated-attention.js';
export { RealStridedAttention } from './mechanisms/strided-attention.js';
export { RealAxialAttention } from './mechanisms/axial-attention.js';
export { RealBlockSparseAttention } from './mechanisms/block-sparse-attention.js';
export { RealMemoryCompressedAttention } from './mechanisms/memory-compressed-attention.js';
export { RealRoutingTransformerAttention } from './mechanisms/routing-transformer-attention.js';
export { RealClusteredAttention } from './mechanisms/clustered-attention.js';
export { RealSetTransformerAttention } from './mechanisms/set-transformer-attention.js';
export { RealMultiHeadLatentAttention } from './mechanisms/multi-head-latent-attention.js';
export { RealSynthesizerAttention } from './mechanisms/synthesizer-attention.js';
export { RealLunaAttention } from './mechanisms/luna-attention.js';
export { RealNystromformerAttention } from './mechanisms/nystromformer-attention.js';
export { RealFNetAttention } from './mechanisms/fnet-attention.js';
export { RealAFTAttention } from './mechanisms/aft-attention.js';
export { RealMegaAttention } from './mechanisms/mega-attention.js';
/**
 * Map of mechanism names to their constructors.
 * All entries point to Real* implementations.
 */
export declare const MECHANISM_CONSTRUCTORS: Record<string, new (config?: Record<string, unknown>) => IAttentionMechanism>;
//# sourceMappingURL=attention-mechanisms.d.ts.map