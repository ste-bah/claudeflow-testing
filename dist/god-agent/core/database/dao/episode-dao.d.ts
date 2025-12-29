/**
 * EpisodeDAO - Data Access Object for Episode persistence
 *
 * Implements: GAP-DESC-001, GAP-DESC-004, GAP-DESC-007
 * Constitution: RULE-011 (SQLite for all episode data), RULE-016 (append-only), RULE-023 (indexes)
 *
 * This DAO provides SQLite-backed persistence for DESC episodes.
 * CRITICAL: All episode data MUST be stored in SQLite (RULE-011)
 */
import type { IDatabaseConnection } from '../connection.js';
import type { IStoredEpisode } from '../../ucm/types.js';
/**
 * EpisodeDAO - SQLite-backed episode persistence
 *
 * Provides CRUD operations for DESC episodes with proper serialization
 * of Float32Array embeddings to/from SQLite BLOB storage.
 */
export declare class EpisodeDAO {
    private readonly db;
    private insertStmt;
    private selectByIdStmt;
    private selectAllStmt;
    private countStmt;
    constructor(db: IDatabaseConnection);
    /**
     * Ensure the DESC episodes table exists
     * Uses separate table from main episodes to avoid schema conflicts
     */
    private ensureSchema;
    /**
     * Prepare SQL statements for performance
     */
    private prepareStatements;
    /**
     * Insert an episode into SQLite
     *
     * Implements: TASK-ERR-004, RULE-072 (database retry on failure)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param episode - The stored episode to persist
     * @throws Error if insert fails after all retry attempts
     */
    insert(episode: IStoredEpisode): void;
    /**
     * Find an episode by ID
     *
     * @param episodeId - The episode ID to find
     * @returns The stored episode or null if not found
     */
    findById(episodeId: string): IStoredEpisode | null;
    /**
     * Get all stored episodes
     *
     * @returns Array of all stored episodes (newest first)
     */
    findAll(): IStoredEpisode[];
    /**
     * Get the count of stored episodes
     *
     * @returns The number of episodes in storage
     */
    count(): number;
    /**
     * Delete an episode by ID
     *
     * RULE-016 VIOLATION: Episodes are append-only. DELETE operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @param _episodeId - The episode ID (unused - operation forbidden)
     * @throws Error Always throws - DELETE is forbidden per RULE-016
     */
    delete(_episodeId: string): never;
    /**
     * Clear all episodes
     *
     * RULE-016 VIOLATION: Episodes are append-only. DELETE/CLEAR operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @throws Error Always throws - CLEAR is forbidden per RULE-016
     */
    clear(): never;
    /**
     * Check if an episode exists
     *
     * @param episodeId - The episode ID to check
     * @returns True if the episode exists
     */
    exists(episodeId: string): boolean;
    /**
     * Serialize Float32Array[] to Buffer for SQLite BLOB storage
     */
    private serializeEmbeddings;
    /**
     * Deserialize Buffer from SQLite BLOB to Float32Array[]
     */
    private deserializeEmbeddings;
    /**
     * Convert a database row to an IStoredEpisode
     */
    private rowToEpisode;
    /**
     * Get storage statistics
     */
    getStats(): {
        episodeCount: number;
        totalQueryChunks: number;
        totalAnswerChunks: number;
        avgQueryChunksPerEpisode: number;
        avgAnswerChunksPerEpisode: number;
    };
}
//# sourceMappingURL=episode-dao.d.ts.map