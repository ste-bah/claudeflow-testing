/**
 * God Agent Episode Linker Context Utilities
 *
 * Implements: TASK-EPISODE-003
 * Referenced by: EpisodeLinker
 *
 * Provides context retrieval methods for episode linking.
 * Split from episode-linker.ts to comply with 500-line limit.
 */
import { EpisodeStore } from './episode-store.js';
import { TimeIndex } from './time-index.js';
import { Episode } from './episode-types.js';
/**
 * Episode context for task-aware memory retrieval
 */
export interface EpisodeContext {
    /** Episodes with same taskId */
    direct: Episode[];
    /** Recent episodes (last 1 hour) */
    temporal: Episode[];
    /** Semantically similar episodes (top-10) */
    semantic: Episode[];
}
/**
 * Get direct context (same taskId)
 */
export declare function getDirectContext(store: EpisodeStore, taskId: string): Promise<Episode[]>;
/**
 * Get temporal context (recent episodes)
 */
export declare function getTemporalContext(timeIndex: TimeIndex, startTime: number, endTime: number): Promise<string[]>;
/**
 * Get semantic context (similar episodes)
 */
export declare function getSemanticContext(store: EpisodeStore, taskId: string): Promise<Episode[]>;
/**
 * Helper: Convert episode IDs to episodes
 */
export declare function getEpisodesByIds(store: EpisodeStore, ids: string[]): Promise<Episode[]>;
/**
 * Get episode context for task-aware memory retrieval
 *
 * Retrieves three types of context:
 * 1. Direct: Episodes with the same taskId
 * 2. Temporal: Recent episodes (last 1 hour)
 * 3. Semantic: Semantically similar episodes (top-10)
 *
 * @param store - EpisodeStore instance
 * @param timeIndex - TimeIndex instance
 * @param taskId - Task identifier
 * @returns Episode context with direct, temporal, and semantic episodes
 */
export declare function getEpisodeContext(store: EpisodeStore, timeIndex: TimeIndex, taskId: string): Promise<EpisodeContext>;
//# sourceMappingURL=episode-linker-context.d.ts.map