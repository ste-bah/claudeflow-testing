/**
 * God Agent Episode Linker Implementation
 *
 * Implements: TASK-EPISODE-003
 * Referenced by: God Agent memory system
 *
 * Provides episode linking and context retrieval:
 * - Episode relationship management (sequence, reference, continuation)
 * - Cycle detection for sequence links (DAG enforcement)
 * - Context retrieval (direct, temporal, semantic)
 * - Maximum 100 links per episode
 */
import { EpisodeStore } from './episode-store.js';
import { TimeIndex } from './time-index.js';
import { Episode } from './episode-types.js';
import { type EpisodeContext } from './episode-linker-context.js';
/**
 * Episode link type for relationship classification
 */
export type LinkType = 'sequence' | 'reference' | 'continuation';
/**
 * Link query direction
 */
export type LinkDirection = 'outgoing' | 'incoming' | 'both';
/**
 * EpisodeLinker - Episode relationship and context management
 *
 * Performance targets:
 * - Create link: <10ms p95
 * - Remove link: <5ms p95
 * - Get linked (10): <20ms p95
 * - Get linked (100): <50ms p95
 * - Cycle detection: <30ms (1k nodes)
 * - Context retrieval: <100ms combined
 */
export declare class EpisodeLinker {
    private store;
    private timeIndex;
    private adjacencyList;
    private readonly maxLinksPerEpisode;
    constructor(store: EpisodeStore, timeIndex: TimeIndex);
    /**
     * Initialize adjacency list from existing links in database
     */
    initialize(): Promise<void>;
    /**
     * Create a link between two episodes
     */
    linkEpisodes(sourceId: string, targetId: string, type: LinkType): Promise<void>;
    /**
     * Add link to in-memory adjacency list
     */
    private addToAdjacencyList;
    /**
     * Remove link from in-memory adjacency list
     */
    private removeFromAdjacencyList;
    /**
     * Persist link to database
     */
    private persistLink;
    /**
     * Remove link from database
     */
    private unpersistLink;
    /**
     * Remove a link between two episodes
     */
    unlinkEpisodes(sourceId: string, targetId: string): Promise<void>;
    /**
     * Get linked episodes
     */
    getLinkedEpisodes(id: string, direction?: LinkDirection): Promise<Episode[]>;
    /**
     * Detect cycles in sequence links using DFS
     */
    detectCycles(sourceId: string, targetId: string): boolean;
    /**
     * Get episode context for task-aware memory retrieval (delegates to context module)
     */
    getEpisodeContext(taskId: string): Promise<EpisodeContext>;
    /**
     * Get all outgoing links for an episode
     */
    getOutgoingLinks(episodeId: string, linkType?: LinkType): string[];
    /**
     * Get all incoming links for an episode
     */
    getIncomingLinks(episodeId: string, linkType?: LinkType): string[];
    /**
     * Get link statistics
     */
    getStats(): {
        totalLinks: number;
        episodesWithLinks: number;
        avgLinksPerEpisode: number;
    };
    /**
     * Clear all links (for testing)
     */
    clear(): void;
}
export type { EpisodeContext } from './episode-linker-context.js';
//# sourceMappingURL=episode-linker.d.ts.map