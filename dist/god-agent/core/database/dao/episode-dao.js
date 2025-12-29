/**
 * EpisodeDAO - Data Access Object for Episode persistence
 *
 * Implements: GAP-DESC-001, GAP-DESC-004, GAP-DESC-007
 * Constitution: RULE-011 (SQLite for all episode data), RULE-016 (append-only), RULE-023 (indexes)
 *
 * This DAO provides SQLite-backed persistence for DESC episodes.
 * CRITICAL: All episode data MUST be stored in SQLite (RULE-011)
 */
import { withRetrySync } from '../../validation/index.js';
/**
 * EpisodeDAO - SQLite-backed episode persistence
 *
 * Provides CRUD operations for DESC episodes with proper serialization
 * of Float32Array embeddings to/from SQLite BLOB storage.
 */
export class EpisodeDAO {
    db;
    insertStmt = null;
    selectByIdStmt = null;
    selectAllStmt = null;
    countStmt = null;
    // RULE-016 COMPLIANCE: DELETE statements removed - episodes are append-only
    constructor(db) {
        this.db = db;
        this.ensureSchema();
        this.prepareStatements();
    }
    /**
     * Ensure the DESC episodes table exists
     * Uses separate table from main episodes to avoid schema conflicts
     */
    ensureSchema() {
        this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS desc_episodes (
        id TEXT PRIMARY KEY NOT NULL,
        query_text TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        query_embeddings BLOB NOT NULL,
        answer_embeddings BLOB NOT NULL,
        query_chunk_count INTEGER NOT NULL,
        answer_chunk_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT,
        trajectory_id TEXT,
        reasoning_trace TEXT,
        trajectory_linked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_desc_episodes_created
        ON desc_episodes(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_desc_episodes_trajectory
        ON desc_episodes(trajectory_id)
        WHERE trajectory_id IS NOT NULL;
    `);
    }
    /**
     * Prepare SQL statements for performance
     */
    prepareStatements() {
        this.insertStmt = this.db.prepare(`
      INSERT INTO desc_episodes (
        id, query_text, answer_text, query_embeddings, answer_embeddings,
        query_chunk_count, answer_chunk_count, created_at, metadata,
        trajectory_id, reasoning_trace, trajectory_linked_at
      ) VALUES (
        @id, @queryText, @answerText, @queryEmbeddings, @answerEmbeddings,
        @queryChunkCount, @answerChunkCount, @createdAt, @metadata,
        @trajectoryId, @reasoningTrace, @trajectoryLinkedAt
      )
    `);
        this.selectByIdStmt = this.db.prepare(`
      SELECT * FROM desc_episodes WHERE id = ?
    `);
        this.selectAllStmt = this.db.prepare(`
      SELECT * FROM desc_episodes ORDER BY created_at DESC
    `);
        this.countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM desc_episodes
    `);
        // RULE-016 COMPLIANCE: No DELETE statements prepared
        // Episodes are append-only per Constitution RULE-016
    }
    /**
     * Insert an episode into SQLite
     *
     * Implements: TASK-ERR-004, RULE-072 (database retry on failure)
     * Uses exponential backoff: 100ms, 200ms, 400ms
     *
     * @param episode - The stored episode to persist
     * @throws Error if insert fails after all retry attempts
     */
    insert(episode) {
        const params = {
            id: episode.episodeId,
            queryText: episode.queryText,
            answerText: episode.answerText,
            queryEmbeddings: this.serializeEmbeddings(episode.queryChunkEmbeddings),
            answerEmbeddings: this.serializeEmbeddings(episode.answerChunkEmbeddings),
            queryChunkCount: episode.queryChunkCount,
            answerChunkCount: episode.answerChunkCount,
            createdAt: episode.createdAt.toISOString(),
            metadata: episode.metadata ? JSON.stringify(episode.metadata) : null,
            trajectoryId: episode.trajectoryId ?? null,
            reasoningTrace: episode.reasoningTrace ?? null,
            trajectoryLinkedAt: episode.trajectoryLinkedAt?.toISOString() ?? null
        };
        // RULE-072: Database operations MUST retry on failure (max 3 attempts)
        withRetrySync(() => this.insertStmt.run(params), { operationName: 'EpisodeDAO.insert' });
    }
    /**
     * Find an episode by ID
     *
     * @param episodeId - The episode ID to find
     * @returns The stored episode or null if not found
     */
    findById(episodeId) {
        const row = this.selectByIdStmt.get(episodeId);
        if (!row)
            return null;
        return this.rowToEpisode(row);
    }
    /**
     * Get all stored episodes
     *
     * @returns Array of all stored episodes (newest first)
     */
    findAll() {
        const rows = this.selectAllStmt.all();
        return rows.map(row => this.rowToEpisode(row));
    }
    /**
     * Get the count of stored episodes
     *
     * @returns The number of episodes in storage
     */
    count() {
        const result = this.countStmt.get();
        return result.count;
    }
    /**
     * Delete an episode by ID
     *
     * RULE-016 VIOLATION: Episodes are append-only. DELETE operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @param _episodeId - The episode ID (unused - operation forbidden)
     * @throws Error Always throws - DELETE is forbidden per RULE-016
     */
    delete(_episodeId) {
        throw new Error('RULE-016 VIOLATION: Episodes are append-only. DELETE operations are FORBIDDEN. ' +
            'Exception: Compaction with explicit human approval requires separate implementation.');
    }
    /**
     * Clear all episodes
     *
     * RULE-016 VIOLATION: Episodes are append-only. DELETE/CLEAR operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @throws Error Always throws - CLEAR is forbidden per RULE-016
     */
    clear() {
        throw new Error('RULE-016 VIOLATION: Episodes are append-only. CLEAR operations are FORBIDDEN. ' +
            'Exception: Compaction with explicit human approval requires separate implementation.');
    }
    /**
     * Check if an episode exists
     *
     * @param episodeId - The episode ID to check
     * @returns True if the episode exists
     */
    exists(episodeId) {
        return this.findById(episodeId) !== null;
    }
    /**
     * Serialize Float32Array[] to Buffer for SQLite BLOB storage
     */
    serializeEmbeddings(embeddings) {
        // Format: [count:4bytes][length1:4bytes][data1:length1*4bytes][length2:4bytes][data2:length2*4bytes]...
        const count = embeddings.length;
        let totalBytes = 4; // count header
        for (const emb of embeddings) {
            totalBytes += 4 + emb.length * 4; // length header + data
        }
        const buffer = Buffer.alloc(totalBytes);
        let offset = 0;
        // Write count
        buffer.writeUInt32LE(count, offset);
        offset += 4;
        // Write each embedding
        for (const emb of embeddings) {
            buffer.writeUInt32LE(emb.length, offset);
            offset += 4;
            for (let i = 0; i < emb.length; i++) {
                buffer.writeFloatLE(emb[i], offset);
                offset += 4;
            }
        }
        return buffer;
    }
    /**
     * Deserialize Buffer from SQLite BLOB to Float32Array[]
     */
    deserializeEmbeddings(buffer) {
        const embeddings = [];
        let offset = 0;
        // Read count
        const count = buffer.readUInt32LE(offset);
        offset += 4;
        // Read each embedding
        for (let i = 0; i < count; i++) {
            const length = buffer.readUInt32LE(offset);
            offset += 4;
            const embedding = new Float32Array(length);
            for (let j = 0; j < length; j++) {
                embedding[j] = buffer.readFloatLE(offset);
                offset += 4;
            }
            embeddings.push(embedding);
        }
        return embeddings;
    }
    /**
     * Convert a database row to an IStoredEpisode
     */
    rowToEpisode(row) {
        return {
            episodeId: row.id,
            queryText: row.query_text,
            answerText: row.answer_text,
            queryChunkEmbeddings: this.deserializeEmbeddings(row.query_embeddings),
            answerChunkEmbeddings: this.deserializeEmbeddings(row.answer_embeddings),
            queryChunkCount: row.query_chunk_count,
            answerChunkCount: row.answer_chunk_count,
            createdAt: new Date(row.created_at),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            trajectoryId: row.trajectory_id ?? undefined,
            reasoningTrace: row.reasoning_trace ?? undefined,
            trajectoryLinkedAt: row.trajectory_linked_at ? new Date(row.trajectory_linked_at) : undefined
        };
    }
    /**
     * Get storage statistics
     */
    getStats() {
        const countResult = this.db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(query_chunk_count), 0) as total_query,
        COALESCE(SUM(answer_chunk_count), 0) as total_answer
      FROM desc_episodes
    `).get();
        const episodeCount = countResult.count;
        const totalQueryChunks = countResult.total_query;
        const totalAnswerChunks = countResult.total_answer;
        return {
            episodeCount,
            totalQueryChunks,
            totalAnswerChunks,
            avgQueryChunksPerEpisode: episodeCount > 0 ? totalQueryChunks / episodeCount : 0,
            avgAnswerChunksPerEpisode: episodeCount > 0 ? totalAnswerChunks / episodeCount : 0
        };
    }
}
//# sourceMappingURL=episode-dao.js.map