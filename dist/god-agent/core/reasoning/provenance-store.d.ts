/**
 * ProvenanceStore
 * TASK-PRV-001 - Source Registration and Citation Graph
 *
 * Tracks derivation paths from sources to insights, enabling
 * "How did you know this?" queries with citation graph traversal.
 *
 * Performance targets:
 * - Source storage: <5ms
 * - Provenance creation: <15ms
 * - 5-hop traversal: <10ms
 * - 10-hop traversal: <20ms
 */
import type { VectorDB } from '../vector-db/vector-db.js';
import type { SourceID, ProvenanceID, ISourceInput, ISource, IProvenanceInput, IProvenance, ICitationPath, ITraversalOptions, ILScoreResult, ISerializedSource, ISerializedProvenance } from './provenance-types.js';
/**
 * Configuration for ProvenanceStore
 */
export interface ProvenanceStoreConfig {
    /** Enable L-Score enforcement */
    enforceLScore?: boolean;
    /** Auto-persist changes */
    autoPersist?: boolean;
    /** Enable performance logging */
    trackPerformance?: boolean;
}
/**
 * ProvenanceStore - Source tracking and citation graph management
 */
export declare class ProvenanceStore {
    private sources;
    private provenances;
    private vectorDB;
    private config;
    private initialized;
    constructor(vectorDB: VectorDB, config?: ProvenanceStoreConfig);
    /**
     * Initialize the ProvenanceStore
     */
    initialize(): Promise<void>;
    /**
     * Store a new source
     *
     * @param input - Source input data
     * @returns Generated SourceID
     * @throws ProvenanceValidationError if validation fails
     */
    storeSource(input: ISourceInput): Promise<SourceID>;
    /**
     * Create a provenance chain
     *
     * @param input - Provenance input data
     * @returns Generated ProvenanceID
     * @throws ProvenanceValidationError if validation fails
     * @throws LScoreRejectionError if L-Score below threshold (when enforcement enabled)
     */
    createProvenance(input: IProvenanceInput): Promise<ProvenanceID>;
    /**
     * Traverse citation graph from a provenance ID
     *
     * @param provenanceId - Starting provenance ID
     * @param options - Traversal options
     * @returns Citation path with sources and derivation steps
     */
    traverseCitationGraph(provenanceId: ProvenanceID, options?: ITraversalOptions): Promise<ICitationPath>;
    /**
     * Calculate L-Score for a provenance chain
     *
     * @param provenanceId - Provenance ID to calculate for
     * @returns L-Score calculation result
     */
    calculateLScore(provenanceId: ProvenanceID): Promise<ILScoreResult>;
    /**
     * Get a provenance by ID
     */
    getProvenance(id: ProvenanceID): IProvenance | undefined;
    /**
     * Get a source by ID
     */
    getSource(id: SourceID): ISource | undefined;
    /**
     * Get all provenances
     */
    getAllProvenances(): IProvenance[];
    /**
     * Get all sources
     */
    getAllSources(): ISource[];
    /**
     * Get provenances by domain
     */
    getProvenancesByDomain(domain: string): IProvenance[];
    /**
     * Find sources similar to an embedding
     *
     * @param embedding - Query embedding (VECTOR_DIM (1536D))
     * @param k - Number of results
     * @returns Similar sources with scores
     */
    findSimilarSources(embedding: Float32Array, k?: number): Promise<Array<{
        source: ISource;
        similarity: number;
    }>>;
    /**
     * Get child provenances (provenances that have this as parent)
     */
    getChildProvenances(provenanceId: ProvenanceID): IProvenance[];
    /**
     * Get statistics about the provenance store
     */
    getStats(): {
        sourceCount: number;
        provenanceCount: number;
        avgDepth: number;
        domainDistribution: Record<string, number>;
    };
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Export to JSON for persistence
     */
    toJSON(): {
        sources: ISerializedSource[];
        provenances: ISerializedProvenance[];
    };
    /**
     * Import from JSON
     */
    fromJSON(data: {
        sources: ISerializedSource[];
        provenances: ISerializedProvenance[];
    }): void;
}
//# sourceMappingURL=provenance-store.d.ts.map