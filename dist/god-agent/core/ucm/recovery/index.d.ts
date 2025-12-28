/**
 * UCM Recovery Module
 *
 * Exports all recovery components for handling Claude Code compaction:
 * - CompactionDetector: Detects compaction events
 * - MemoryReconstructor: Reconstructs lost context
 * - TierBridge: Manages memory tier transitions
 */
export { CompactionDetector, createCompactionDetector } from './compaction-detector.js';
export { MemoryReconstructor, createMemoryReconstructor } from './memory-reconstructor.js';
export { TierBridge, MemoryTier, createTierBridge, type ITierStats } from './tier-bridge.js';
export type { ICompactionDetector, IMemoryReconstructor, IReconstructedContext, IRecoveryMetrics, IUnrecoverableItem } from '../types.js';
//# sourceMappingURL=index.d.ts.map