/**
 * God Agent Episode Store Queries
 *
 * Implements: TASK-EPISODE-001
 * Referenced by: EpisodeStore
 *
 * Provides query methods for episode retrieval.
 * Split from episode-store.ts to comply with 500-line limit.
 */
import { EpisodeValidator, EpisodeStorageError, } from './episode-types.js';
/**
 * Query episodes by time range
 *
 * @param db - Database instance
 * @param vectorBackend - Vector backend for embeddings
 * @param getLinksStmt - Prepared statement for getting links
 * @param query - Time range query parameters
 * @returns Array of matching episodes
 */
export async function queryByTimeRange(db, vectorBackend, getLinksStmt, query) {
    if (!vectorBackend) {
        throw new EpisodeStorageError('Vector backend not initialized');
    }
    const { startTime, endTime, includeOngoing = false, limit } = query;
    try {
        let sql = `
      SELECT id, task_id, start_time, end_time, metadata, created_at, updated_at
      FROM episodes
      WHERE start_time <= ? AND (end_time >= ? OR (end_time IS NULL AND ?))
    `;
        if (limit !== undefined && limit > 0) {
            sql += ` LIMIT ${limit}`;
        }
        const rows = db.prepare(sql).all(endTime, startTime, includeOngoing ? 1 : 0);
        const episodes = [];
        for (const row of rows) {
            const embedding = vectorBackend.getVector(row.id);
            if (!embedding)
                continue;
            const linkedEpisodes = getLinksStmt.all(row.id);
            episodes.push({
                id: row.id,
                taskId: row.task_id,
                startTime: row.start_time,
                endTime: row.end_time,
                embedding,
                metadata: JSON.parse(row.metadata),
                linkedEpisodes: linkedEpisodes.map(l => l.target_id),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
        }
        return episodes;
    }
    catch (error) {
        throw new EpisodeStorageError(`Failed to query time range: ${error instanceof Error ? error.message : String(error)}`, error);
    }
}
/**
 * Search episodes by embedding similarity
 *
 * @param vectorBackend - Vector backend for similarity search
 * @param getById - Function to retrieve episode by ID
 * @param query - Similarity query parameters
 * @returns Array of similar episodes, sorted by similarity
 */
export async function searchBySimilarity(vectorBackend, getById, query) {
    if (!vectorBackend) {
        throw new EpisodeStorageError('Vector backend not initialized');
    }
    EpisodeValidator.validateEmbedding(query.embedding);
    try {
        // Perform vector search
        const results = vectorBackend.search(query.embedding, query.k, false);
        // Filter by minimum similarity if specified
        const filtered = query.minSimilarity !== undefined
            ? results.filter(r => r.similarity >= query.minSimilarity)
            : results;
        // Retrieve full episodes
        const episodes = [];
        for (const result of filtered) {
            const episode = await getById(result.id);
            if (episode) {
                // Filter by task IDs if specified
                if (query.taskIds === undefined || query.taskIds.includes(episode.taskId)) {
                    episodes.push(episode);
                }
            }
        }
        return episodes;
    }
    catch (error) {
        throw new EpisodeStorageError(`Failed to search by similarity: ${error instanceof Error ? error.message : String(error)}`, error);
    }
}
/**
 * Retrieve episode by ID
 *
 * @param db - Database instance
 * @param vectorBackend - Vector backend for embeddings
 * @param getEpisodeStmt - Prepared statement for getting episode
 * @param getLinksStmt - Prepared statement for getting links
 * @param id - Episode ID
 * @returns Episode or null if not found
 */
export async function getById(_db, vectorBackend, getEpisodeStmt, getLinksStmt, id) {
    if (!vectorBackend) {
        throw new EpisodeStorageError('Vector backend not initialized');
    }
    try {
        const row = getEpisodeStmt.get(id);
        if (!row)
            return null;
        const embedding = vectorBackend.getVector(id);
        if (!embedding) {
            throw new EpisodeStorageError(`Episode ${id} found in DB but missing vector`);
        }
        const linkedEpisodes = getLinksStmt.all(id);
        return {
            id: row.id,
            taskId: row.task_id,
            startTime: row.start_time,
            endTime: row.end_time,
            embedding,
            metadata: JSON.parse(row.metadata),
            linkedEpisodes: linkedEpisodes.map(l => l.target_id),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    catch (error) {
        throw new EpisodeStorageError(`Failed to retrieve episode ${id}: ${error instanceof Error ? error.message : String(error)}`, error);
    }
}
//# sourceMappingURL=episode-store-queries.js.map