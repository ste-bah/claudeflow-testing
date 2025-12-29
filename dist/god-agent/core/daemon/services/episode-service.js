/**
 * Episode Service - Real implementation delegating to EpisodeStore
 * TASK-DAEMON-001: Episode Service Implementation (GAP-ADV-001 fix)
 *
 * Provides IPC service layer for episodic memory operations via JSON-RPC 2.0.
 * All methods delegate to the injected EpisodeStore for actual storage operations.
 */
import { createServiceHandler } from '../service-registry.js';
/**
 * Convert number array to Float32Array for embeddings
 */
function toFloat32Array(embedding) {
    if (embedding instanceof Float32Array) {
        return embedding;
    }
    return new Float32Array(embedding);
}
/**
 * Create episode service handler with real EpisodeStore delegation
 *
 * @param episodeStore - Injected EpisodeStore instance for actual storage operations
 * @returns Service handler with methods for create, query, link, and stats
 */
export function createEpisodeService(episodeStore) {
    return createServiceHandler({
        /**
         * Create a new episode
         * Delegates to episodeStore.createEpisode()
         */
        create: async (params) => {
            const createOptions = {
                taskId: params.taskId,
                embedding: toFloat32Array(params.embedding),
                metadata: params.metadata,
                id: params.id,
                startTime: params.startTime,
                endTime: params.endTime,
                linkedEpisodes: params.linkedEpisodes,
            };
            const episodeId = await episodeStore.createEpisode(createOptions);
            return { episodeId };
        },
        /**
         * Query episodes by time range or similarity
         * Routes to episodeStore.queryByTimeRange() or episodeStore.searchBySimilarity()
         */
        query: async (params) => {
            if (params.queryType === 'timeRange') {
                if (!params.timeRange) {
                    throw new Error('timeRange parameters required for timeRange query');
                }
                const query = {
                    startTime: params.timeRange.startTime,
                    endTime: params.timeRange.endTime,
                    includeOngoing: params.timeRange.includeOngoing,
                    limit: params.timeRange.limit,
                };
                const episodes = await episodeStore.queryByTimeRange(query);
                return {
                    episodes: episodes.map((ep) => ({
                        id: ep.id,
                        taskId: ep.taskId,
                        startTime: ep.startTime,
                        endTime: ep.endTime,
                        metadata: ep.metadata,
                        linkedEpisodes: ep.linkedEpisodes,
                        createdAt: ep.createdAt,
                        updatedAt: ep.updatedAt,
                    })),
                    count: episodes.length,
                };
            }
            else if (params.queryType === 'similarity') {
                if (!params.similarity) {
                    throw new Error('similarity parameters required for similarity query');
                }
                const query = {
                    embedding: toFloat32Array(params.similarity.embedding),
                    k: params.similarity.k,
                    minSimilarity: params.similarity.minSimilarity,
                    taskIds: params.similarity.taskIds,
                };
                const episodes = await episodeStore.searchBySimilarity(query);
                return {
                    episodes: episodes.map((ep) => ({
                        id: ep.id,
                        taskId: ep.taskId,
                        startTime: ep.startTime,
                        endTime: ep.endTime,
                        metadata: ep.metadata,
                        linkedEpisodes: ep.linkedEpisodes,
                        createdAt: ep.createdAt,
                        updatedAt: ep.updatedAt,
                    })),
                    count: episodes.length,
                };
            }
            else {
                throw new Error(`Unknown queryType: ${params.queryType}. Use 'timeRange' or 'similarity'.`);
            }
        },
        /**
         * Link two episodes together
         * Uses episodeStore.update() to add linked episode reference
         */
        link: async (params) => {
            const { sourceId, targetId, linkType } = params;
            // Get the source episode to retrieve current linked episodes
            const sourceEpisode = await episodeStore.getById(sourceId);
            if (!sourceEpisode) {
                throw new Error(`Source episode not found: ${sourceId}`);
            }
            // Verify target exists
            const targetEpisode = await episodeStore.getById(targetId);
            if (!targetEpisode) {
                throw new Error(`Target episode not found: ${targetId}`);
            }
            // Add target to source's linked episodes if not already present
            const currentLinks = sourceEpisode.linkedEpisodes || [];
            if (!currentLinks.includes(targetId)) {
                const updatedLinks = [...currentLinks, targetId];
                await episodeStore.update(sourceId, { linkedEpisodes: updatedLinks });
            }
            return {
                success: true,
                sourceId,
                targetId,
                linkType,
            };
        },
        /**
         * Get episode statistics
         * Delegates to episodeStore.getStats()
         */
        stats: async () => {
            const stats = episodeStore.getStats();
            return {
                episodeCount: stats.episodeCount,
                vectorCount: stats.vectorCount,
                dbSizeBytes: stats.dbSizeBytes,
            };
        },
        /**
         * Get a single episode by ID
         * Delegates to episodeStore.getById()
         */
        get: async (params) => {
            const episode = await episodeStore.getById(params.id);
            if (!episode) {
                return { found: false, episode: null };
            }
            return {
                found: true,
                episode: {
                    id: episode.id,
                    taskId: episode.taskId,
                    startTime: episode.startTime,
                    endTime: episode.endTime,
                    metadata: episode.metadata,
                    linkedEpisodes: episode.linkedEpisodes,
                    createdAt: episode.createdAt,
                    updatedAt: episode.updatedAt,
                },
            };
        },
        /**
         * Delete an episode
         * Delegates to episodeStore.delete()
         */
        delete: async (params) => {
            await episodeStore.delete(params.id);
            return { success: true, id: params.id };
        },
        /**
         * Get links for an episode
         * Delegates to episodeStore.getLinks()
         */
        getLinks: async (params) => {
            const links = await episodeStore.getLinks(params.episodeId);
            return {
                episodeId: params.episodeId,
                links: links.map((link) => ({
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    linkType: link.linkType,
                    createdAt: link.createdAt,
                })),
                count: links.length,
            };
        },
        /**
         * Update an existing episode
         * Delegates to episodeStore.update()
         */
        update: async (params) => {
            const updateData = {};
            if (params.endTime !== undefined) {
                updateData.endTime = params.endTime;
            }
            if (params.embedding !== undefined) {
                updateData.embedding = toFloat32Array(params.embedding);
            }
            if (params.metadata !== undefined) {
                updateData.metadata = params.metadata;
            }
            if (params.linkedEpisodes !== undefined) {
                updateData.linkedEpisodes = params.linkedEpisodes;
            }
            await episodeStore.update(params.id, updateData);
            return { success: true, id: params.id };
        },
        /**
         * Save episode store to disk
         * Delegates to episodeStore.save()
         */
        save: async () => {
            await episodeStore.save();
            return { success: true };
        },
    });
}
//# sourceMappingURL=episode-service.js.map