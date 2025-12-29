/**
 * Episode Service - Real implementation delegating to EpisodeStore
 * TASK-DAEMON-001: Episode Service Implementation (GAP-ADV-001 fix)
 *
 * Provides IPC service layer for episodic memory operations via JSON-RPC 2.0.
 * All methods delegate to the injected EpisodeStore for actual storage operations.
 */
import { type ServiceHandler } from '../service-registry.js';
import { EpisodeStore } from '../../episode/episode-store.js';
import type { EpisodeLinkType, EpisodeMetadata } from '../../episode/episode-types.js';
/**
 * Parameters for creating an episode via the service
 */
export interface CreateEpisodeParams {
    taskId: string;
    embedding: number[] | Float32Array;
    metadata: EpisodeMetadata;
    id?: string;
    startTime?: number;
    endTime?: number | null;
    linkedEpisodes?: string[];
}
/**
 * Parameters for querying episodes
 */
export interface QueryEpisodesParams {
    /** Query type: 'timeRange' or 'similarity' */
    queryType: 'timeRange' | 'similarity';
    /** Time range query parameters (required when queryType is 'timeRange') */
    timeRange?: {
        startTime: number;
        endTime: number;
        includeOngoing?: boolean;
        limit?: number;
    };
    /** Similarity query parameters (required when queryType is 'similarity') */
    similarity?: {
        embedding: number[] | Float32Array;
        k: number;
        minSimilarity?: number;
        taskIds?: string[];
    };
}
/**
 * Parameters for linking episodes
 */
export interface LinkEpisodesParams {
    sourceId: string;
    targetId: string;
    linkType: EpisodeLinkType;
}
/**
 * Response for episode creation
 */
export interface CreateEpisodeResponse {
    episodeId: string;
}
/**
 * Response for episode queries
 */
export interface QueryEpisodesResponse {
    episodes: Array<{
        id: string;
        taskId: string;
        startTime: number;
        endTime: number | null;
        metadata: EpisodeMetadata;
        linkedEpisodes: string[];
        createdAt: number;
        updatedAt: number;
    }>;
    count: number;
}
/**
 * Response for linking episodes
 */
export interface LinkEpisodesResponse {
    success: boolean;
    sourceId: string;
    targetId: string;
    linkType: EpisodeLinkType;
}
/**
 * Response for episode statistics
 */
export interface EpisodeStatsResponse {
    episodeCount: number;
    vectorCount: number;
    dbSizeBytes: number;
}
/**
 * Create episode service handler with real EpisodeStore delegation
 *
 * @param episodeStore - Injected EpisodeStore instance for actual storage operations
 * @returns Service handler with methods for create, query, link, and stats
 */
export declare function createEpisodeService(episodeStore: EpisodeStore): ServiceHandler;
//# sourceMappingURL=episode-service.d.ts.map