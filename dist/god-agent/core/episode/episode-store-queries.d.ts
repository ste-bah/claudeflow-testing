/**
 * God Agent Episode Store Queries
 *
 * Implements: TASK-EPISODE-001
 * Referenced by: EpisodeStore
 *
 * Provides query methods for episode retrieval.
 * Split from episode-store.ts to comply with 500-line limit.
 */
import type Database from 'better-sqlite3';
import { IHNSWBackend } from '../vector-db/hnsw-backend.js';
import { Episode, TimeRangeQuery, SimilarityQuery } from './episode-types.js';
/**
 * SQLite row structure for episodes table
 */
export interface EpisodeRow {
    id: string;
    task_id: string;
    start_time: number;
    end_time: number | null;
    metadata: string;
    created_at: number;
    updated_at: number;
}
/**
 * Query episodes by time range
 *
 * @param db - Database instance
 * @param vectorBackend - Vector backend for embeddings
 * @param getLinksStmt - Prepared statement for getting links
 * @param query - Time range query parameters
 * @returns Array of matching episodes
 */
export declare function queryByTimeRange(db: Database.Database, vectorBackend: IHNSWBackend | null, getLinksStmt: Database.Statement, query: TimeRangeQuery): Promise<Episode[]>;
/**
 * Search episodes by embedding similarity
 *
 * @param vectorBackend - Vector backend for similarity search
 * @param getById - Function to retrieve episode by ID
 * @param query - Similarity query parameters
 * @returns Array of similar episodes, sorted by similarity
 */
export declare function searchBySimilarity(vectorBackend: IHNSWBackend | null, getById: (id: string) => Promise<Episode | null>, query: SimilarityQuery): Promise<Episode[]>;
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
export declare function getById(_db: Database.Database, vectorBackend: IHNSWBackend | null, getEpisodeStmt: Database.Statement, getLinksStmt: Database.Statement, id: string): Promise<Episode | null>;
//# sourceMappingURL=episode-store-queries.d.ts.map