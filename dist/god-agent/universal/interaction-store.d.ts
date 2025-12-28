/**
 * InteractionStore - LRU Cache with Persistence for God Agent Interactions
 *
 * Features:
 * - LRU eviction: Maximum 1000 interactions, oldest evicted first
 * - High-quality persistence: Interactions with quality > 0.7 saved separately
 * - Rolling window: Only keeps last 7 days of interactions
 * - File storage: interactions.json, high-quality.json, session-knowledge.json
 *
 * @module interaction-store
 */
import type { Interaction, KnowledgeEntry } from './universal-agent.js';
export interface InteractionStoreConfig {
    /** Maximum number of interactions to keep in memory (default: 1000) */
    maxInteractions?: number;
    /** Quality threshold for high-quality storage (default: 0.7) */
    highQualityThreshold?: number;
    /** Number of days to keep interactions (default: 7) */
    rollingWindowDays?: number;
    /** Number of recent interactions to persist (default: 100) */
    persistCount?: number;
    /** Storage directory for persistence files */
    storageDir: string;
}
export interface InteractionStats {
    totalInteractions: number;
    highQualityCount: number;
    knowledgeCount: number;
    oldestInteraction: number | null;
    newestInteraction: number | null;
}
export declare class InteractionStore {
    private config;
    private interactions;
    private knowledge;
    private insertionOrder;
    constructor(config: InteractionStoreConfig);
    /**
     * Add an interaction to the store with LRU eviction
     */
    add(interaction: Interaction): void;
    /**
     * Get an interaction by ID
     */
    get(id: string): Interaction | undefined;
    /**
     * Get the N most recent interactions
     */
    getRecent(count: number): Interaction[];
    /**
     * Get all high-quality interactions (quality > threshold)
     */
    getHighQuality(): Interaction[];
    /**
     * Update feedback for an interaction
     */
    updateFeedback(id: string, feedback: Interaction['feedback']): void;
    /**
     * Remove an interaction from the store
     */
    private remove;
    /**
     * Add a knowledge entry
     */
    addKnowledge(entry: KnowledgeEntry): void;
    /**
     * Get all knowledge entries
     */
    getKnowledge(): KnowledgeEntry[];
    /**
     * Get knowledge entries by domain
     */
    getKnowledgeByDomain(domain: string): KnowledgeEntry[];
    /**
     * Load interactions and knowledge from disk
     */
    load(): Promise<void>;
    /**
     * Save interactions and knowledge to disk
     */
    save(): Promise<void>;
    /**
     * Ensure storage directory exists
     */
    private ensureStorageDir;
    /**
     * Get statistics about the store
     */
    getStats(): InteractionStats;
    /**
     * Prune interactions older than rolling window
     * @returns Number of interactions pruned
     */
    prune(): number;
    /**
     * Clear all interactions and knowledge
     */
    clear(): void;
    /**
     * Calculate quality score for an interaction
     */
    private calculateQuality;
    /**
     * Prune interactions older than rolling window
     */
    private pruneOldInteractions;
}
//# sourceMappingURL=interaction-store.d.ts.map