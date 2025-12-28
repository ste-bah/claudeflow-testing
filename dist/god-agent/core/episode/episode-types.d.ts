/**
 * God Agent Episode Store Type Definitions
 *
 * Implements: TASK-EPISODE-001
 * Referenced by: EpisodeStore, TimeIndex, EpisodeLinker
 *
 * Defines core types for episodic memory management.
 */
/**
 * Task outcome status for completed episodes
 */
export type TaskOutcome = 'success' | 'failure' | 'partial';
/**
 * Episode link type for relationship classification
 */
export type EpisodeLinkType = 'causal' | 'temporal' | 'semantic' | 'dependency';
/**
 * Episode metadata containing task context and execution information
 */
export interface EpisodeMetadata {
    /** Type of agent that executed this episode */
    agentType: string;
    /** Human-readable task description */
    taskDescription: string;
    /** Task execution outcome (optional for ongoing episodes) */
    outcome?: TaskOutcome;
    /** Custom tags for categorization and filtering */
    tags?: string[];
    /** Additional custom metadata fields */
    [key: string]: unknown;
}
/**
 * Core Episode interface representing a discrete memory unit
 *
 * Episodes capture temporal task execution with semantic embeddings
 * for similarity-based retrieval and relationship tracking.
 */
export interface Episode {
    /** Unique episode identifier (UUID v4) */
    id: string;
    /** Associated task identifier */
    taskId: string;
    /** Episode start timestamp (Unix ms) */
    startTime: number;
    /** Episode end timestamp (null for ongoing episodes) */
    endTime: number | null;
    /** 768-dimensional semantic embedding for similarity search */
    embedding: Float32Array;
    /** Episode metadata and context */
    metadata: EpisodeMetadata;
    /** IDs of linked/related episodes */
    linkedEpisodes: string[];
    /** Episode creation timestamp (Unix ms) */
    createdAt: number;
    /** Last update timestamp (Unix ms) */
    updatedAt: number;
}
/**
 * Partial episode data for updates
 * All fields optional except ID (specified separately)
 */
export interface EpisodeUpdateData {
    /** Update end time (e.g., to close an ongoing episode) */
    endTime?: number | null;
    /** Update embedding */
    embedding?: Float32Array;
    /** Update or merge metadata */
    metadata?: Partial<EpisodeMetadata>;
    /** Replace linked episodes */
    linkedEpisodes?: string[];
}
/**
 * Options for creating a new episode
 */
export interface CreateEpisodeOptions {
    /** Optional custom episode ID (UUID v4 generated if not provided) */
    id?: string;
    /** Task identifier */
    taskId: string;
    /** Start timestamp (defaults to Date.now()) */
    startTime?: number;
    /** End timestamp (null for ongoing) */
    endTime?: number | null;
    /** 768-dim embedding vector */
    embedding: Float32Array;
    /** Episode metadata */
    metadata: EpisodeMetadata;
    /** Initial linked episodes (defaults to []) */
    linkedEpisodes?: string[];
}
/**
 * Episode link relationship between source and target episodes
 */
export interface EpisodeLink {
    /** Source episode ID */
    sourceId: string;
    /** Target episode ID */
    targetId: string;
    /** Type of relationship */
    linkType: EpisodeLinkType;
    /** Link creation timestamp */
    createdAt: number;
}
/**
 * Time range query parameters
 */
export interface TimeRangeQuery {
    /** Start of time range (inclusive, Unix ms) */
    startTime: number;
    /** End of time range (inclusive, Unix ms) */
    endTime: number;
    /** Include ongoing episodes (endTime is null) */
    includeOngoing?: boolean;
    /** Optional limit on results */
    limit?: number;
}
/**
 * Similarity search query parameters
 */
export interface SimilarityQuery {
    /** Query embedding vector (768-dim) */
    embedding: Float32Array;
    /** Number of top results to return */
    k: number;
    /** Optional minimum similarity threshold */
    minSimilarity?: number;
    /** Optional filter by task IDs */
    taskIds?: string[];
}
/**
 * Validation error for episode data
 */
export declare class EpisodeValidationError extends Error {
    constructor(message: string);
}
/**
 * Storage error for episode operations
 */
export declare class EpisodeStorageError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
/**
 * Validator utilities for episode data
 */
export declare class EpisodeValidator {
    /** Expected embedding dimension (1536D per architecture diagram) */
    private static readonly EMBEDDING_DIM;
    /** Maximum linked episodes per episode */
    private static readonly MAX_LINKS;
    /** Maximum content size (approximate, for metadata JSON) */
    private static readonly MAX_CONTENT_SIZE;
    /**
     * Validate episode ID format (UUID v4)
     */
    static validateId(id: string): void;
    /**
     * Validate embedding vector
     */
    static validateEmbedding(embedding: Float32Array): void;
    /**
     * Validate timestamp
     */
    static validateTimestamp(timestamp: number, name: string): void;
    /**
     * Validate time range (startTime <= endTime)
     */
    static validateTimeRange(startTime: number, endTime: number | null): void;
    /**
     * Validate linked episodes array
     */
    static validateLinkedEpisodes(linkedEpisodes: string[]): void;
    /**
     * Validate metadata object
     */
    static validateMetadata(metadata: EpisodeMetadata): void;
    /**
     * Validate complete episode object
     */
    static validateEpisode(episode: Episode): void;
    /**
     * Validate create episode options
     */
    static validateCreateOptions(options: CreateEpisodeOptions): void;
}
//# sourceMappingURL=episode-types.d.ts.map