/**
 * God Agent Episode Store Implementation
 *
 * Implements: TASK-EPISODE-001
 * Referenced by: God Agent memory system
 *
 * Provides hybrid SQLite + HNSW storage for episodic memory with:
 * - Time-based indexing for temporal queries
 * - Vector similarity search for semantic retrieval
 * - Episode relationship tracking
 */
import { Episode, EpisodeUpdateData, CreateEpisodeOptions, TimeRangeQuery, SimilarityQuery, EpisodeLink } from './episode-types.js';
/**
 * Configuration options for EpisodeStore
 */
export interface EpisodeStoreOptions {
    /** Directory for storage files (default: .god-agent) */
    storageDir?: string;
    /** SQLite database path (default: storageDir/episodes.db) */
    dbPath?: string;
    /** Vector index path (default: storageDir/episode-vectors.bin) */
    vectorPath?: string;
    /** Enable verbose logging */
    verbose?: boolean;
}
/**
 * EpisodeStore - Hybrid SQL + Vector storage for episodic memory
 *
 * Performance targets (from Constitution):
 * - Create: <5ms (p95)
 * - Time range query: <20ms (1k results)
 * - Similarity search: <50ms (top-10)
 */
export declare class EpisodeStore {
    private db;
    private vectorBackend;
    private readonly storageDir;
    private readonly dbPath;
    private readonly vectorPath;
    private readonly verbose;
    private insertEpisodeStmt?;
    private insertLinkStmt?;
    private getEpisodeStmt?;
    private updateEpisodeStmt?;
    private deleteEpisodeStmt?;
    private deleteLinksStmt?;
    private getLinksStmt?;
    constructor(options?: EpisodeStoreOptions);
    /**
     * Initialize SQLite database schema and WAL mode
     */
    private initializeDatabase;
    /**
     * Initialize vector backend (async, called lazily)
     */
    private initializeVectorBackend;
    /**
     * Create a new episode
     *
     * @param options - Episode creation options
     * @returns Episode ID
     * @throws {EpisodeValidationError} If validation fails
     * @throws {EpisodeStorageError} If storage operation fails
     */
    createEpisode(options: CreateEpisodeOptions): Promise<string>;
    /**
     * Retrieve episode by ID (delegates to query module)
     */
    getById(id: string): Promise<Episode | null>;
    /**
     * Query episodes by time range (delegates to query module)
     */
    queryByTimeRange(query: TimeRangeQuery): Promise<Episode[]>;
    /**
     * Search episodes by embedding similarity (delegates to query module)
     */
    searchBySimilarity(query: SimilarityQuery): Promise<Episode[]>;
    /**
     * Update an existing episode
     */
    update(id: string, updates: EpisodeUpdateData): Promise<void>;
    /**
     * Delete an episode and cleanup associated data
     */
    delete(id: string): Promise<void>;
    /**
     * Get all links for an episode
     */
    getLinks(episodeId: string): Promise<EpisodeLink[]>;
    /**
     * Save vector index to disk
     *
     * Implements: TASK-ERR-004, RULE-072 (file operations must retry)
     */
    save(): Promise<void>;
    /**
     * Get storage statistics
     */
    getStats(): {
        episodeCount: number;
        vectorCount: number;
        dbSizeBytes: number;
    };
    /**
     * Close database and save vectors
     */
    close(): Promise<void>;
}
//# sourceMappingURL=episode-store.d.ts.map