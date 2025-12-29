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
import { promises as fs } from 'fs';
import * as path from 'path';
import { ObservabilityBus } from '../core/observability/bus.js';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';
const logger = createComponentLogger('InteractionStore', {
    minLevel: LogLevel.WARN,
    handlers: [new ConsoleLogHandler({ useStderr: true })]
});
// ==================== Serialization Helpers ====================
/**
 * Convert Float32Array embeddings to regular arrays for JSON serialization
 */
function serializeInteraction(interaction) {
    return {
        ...interaction,
        embedding: interaction.embedding ? Array.from(interaction.embedding) : undefined,
    };
}
/**
 * Convert array embeddings back to Float32Array
 */
function deserializeInteraction(data) {
    return {
        ...data,
        embedding: data.embedding ? new Float32Array(data.embedding) : undefined,
    };
}
// ==================== InteractionStore ====================
export class InteractionStore {
    config;
    // LRU Cache: Map maintains insertion order
    interactions = new Map();
    // Knowledge entries
    knowledge = new Map();
    // Tracking
    insertionOrder = [];
    constructor(config) {
        this.config = {
            maxInteractions: config.maxInteractions ?? 1000,
            highQualityThreshold: config.highQualityThreshold ?? 0.7,
            rollingWindowDays: config.rollingWindowDays ?? 7,
            persistCount: config.persistCount ?? 100,
            storageDir: config.storageDir,
        };
    }
    // ==================== Interaction Management ====================
    /**
     * Add an interaction to the store with LRU eviction
     */
    add(interaction) {
        // Remove if already exists (update case)
        if (this.interactions.has(interaction.id)) {
            this.remove(interaction.id);
        }
        // Add to store
        this.interactions.set(interaction.id, interaction);
        this.insertionOrder.push(interaction.id);
        // LRU eviction if over limit
        if (this.interactions.size > this.config.maxInteractions) {
            const oldestId = this.insertionOrder.shift();
            if (oldestId) {
                this.interactions.delete(oldestId);
            }
        }
        // Auto-prune old interactions
        this.pruneOldInteractions();
    }
    /**
     * Get an interaction by ID
     */
    get(id) {
        return this.interactions.get(id);
    }
    /**
     * Get the N most recent interactions
     */
    getRecent(count) {
        const recent = this.insertionOrder.slice(-count);
        return recent
            .map(id => this.interactions.get(id))
            .filter((i) => i !== undefined)
            .reverse(); // Most recent first
    }
    /**
     * Get all high-quality interactions (quality > threshold)
     */
    getHighQuality() {
        return Array.from(this.interactions.values()).filter(i => this.calculateQuality(i) > this.config.highQualityThreshold);
    }
    /**
     * Update feedback for an interaction
     */
    updateFeedback(id, feedback) {
        const interaction = this.interactions.get(id);
        if (interaction) {
            interaction.feedback = feedback;
            this.interactions.set(id, interaction);
        }
    }
    /**
     * Remove an interaction from the store
     */
    remove(id) {
        this.interactions.delete(id);
        const index = this.insertionOrder.indexOf(id);
        if (index !== -1) {
            this.insertionOrder.splice(index, 1);
        }
    }
    // ==================== Knowledge Management ====================
    /**
     * Add a knowledge entry
     */
    addKnowledge(entry) {
        this.knowledge.set(entry.id, entry);
        // Implements [REQ-OBS-16]: Emit memory_stored event
        ObservabilityBus.getInstance().emit({
            component: 'memory',
            operation: 'memory_stored',
            status: 'success',
            metadata: {
                entryId: entry.id,
                domain: entry.domain,
                type: entry.type,
                tags: entry.tags || [],
                contentLength: entry.content.length,
            },
        });
    }
    /**
     * Get all knowledge entries
     */
    getKnowledge() {
        return Array.from(this.knowledge.values());
    }
    /**
     * Get knowledge entries by domain
     */
    getKnowledgeByDomain(domain) {
        return Array.from(this.knowledge.values()).filter(k => k.domain === domain);
    }
    // ==================== Persistence ====================
    /**
     * Load interactions and knowledge from disk
     */
    async load() {
        await this.ensureStorageDir();
        // Load recent interactions
        try {
            const interactionsPath = path.join(this.config.storageDir, 'interactions.json');
            const data = await fs.readFile(interactionsPath, 'utf-8');
            const loaded = JSON.parse(data);
            for (const item of loaded) {
                const interaction = deserializeInteraction(item);
                this.interactions.set(interaction.id, interaction);
                this.insertionOrder.push(interaction.id);
            }
        }
        catch (error) {
            // File doesn't exist yet, that's okay
            if (error.code !== 'ENOENT') {
                logger.warn('Failed to load interactions', { error: String(error) });
            }
        }
        // Load high-quality interactions
        try {
            const highQualityPath = path.join(this.config.storageDir, 'high-quality.json');
            const data = await fs.readFile(highQualityPath, 'utf-8');
            const loaded = JSON.parse(data);
            for (const item of loaded) {
                const interaction = deserializeInteraction(item);
                // Only add if not already present
                if (!this.interactions.has(interaction.id)) {
                    this.interactions.set(interaction.id, interaction);
                    this.insertionOrder.push(interaction.id);
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn('Failed to load high-quality interactions', { error: String(error) });
            }
        }
        // Load knowledge
        try {
            const knowledgePath = path.join(this.config.storageDir, 'session-knowledge.json');
            const data = await fs.readFile(knowledgePath, 'utf-8');
            const loaded = JSON.parse(data);
            for (const entry of loaded) {
                this.knowledge.set(entry.id, entry);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn('Failed to load knowledge', { error: String(error) });
            }
        }
        // Prune after loading
        this.pruneOldInteractions();
    }
    /**
     * Save interactions and knowledge to disk
     */
    async save() {
        await this.ensureStorageDir();
        // Save recent interactions (last N)
        const recent = this.getRecent(this.config.persistCount);
        const interactionsPath = path.join(this.config.storageDir, 'interactions.json');
        await fs.writeFile(interactionsPath, JSON.stringify(recent.map(serializeInteraction), null, 2), 'utf-8');
        // Save high-quality interactions
        const highQuality = this.getHighQuality();
        const highQualityPath = path.join(this.config.storageDir, 'high-quality.json');
        await fs.writeFile(highQualityPath, JSON.stringify(highQuality.map(serializeInteraction), null, 2), 'utf-8');
        // Save knowledge
        const knowledgePath = path.join(this.config.storageDir, 'session-knowledge.json');
        await fs.writeFile(knowledgePath, JSON.stringify(this.getKnowledge(), null, 2), 'utf-8');
    }
    /**
     * Ensure storage directory exists
     */
    async ensureStorageDir() {
        try {
            await fs.mkdir(this.config.storageDir, { recursive: true });
        }
        catch (error) {
            logger.warn('Failed to create storage directory', { storageDir: this.config.storageDir, error: String(error) });
        }
    }
    // ==================== Statistics ====================
    /**
     * Get statistics about the store
     */
    getStats() {
        const interactions = Array.from(this.interactions.values());
        const timestamps = interactions.map(i => i.timestamp);
        return {
            totalInteractions: this.interactions.size,
            highQualityCount: this.getHighQuality().length,
            knowledgeCount: this.knowledge.size,
            oldestInteraction: timestamps.length > 0 ? Math.min(...timestamps) : null,
            newestInteraction: timestamps.length > 0 ? Math.max(...timestamps) : null,
        };
    }
    // ==================== Cleanup ====================
    /**
     * Prune interactions older than rolling window
     * @returns Number of interactions pruned
     */
    prune() {
        return this.pruneOldInteractions();
    }
    /**
     * Clear all interactions and knowledge
     */
    clear() {
        this.interactions.clear();
        this.insertionOrder = [];
        this.knowledge.clear();
    }
    // ==================== Private Helpers ====================
    /**
     * Calculate quality score for an interaction
     */
    calculateQuality(interaction) {
        if (interaction.feedback?.rating !== undefined) {
            return interaction.feedback.rating;
        }
        // Default quality based on output length and presence of embedding
        let quality = 0.5;
        if (interaction.output.length > 100)
            quality += 0.1;
        if (interaction.output.length > 500)
            quality += 0.1;
        if (interaction.embedding)
            quality += 0.1;
        return Math.min(quality, 1.0);
    }
    /**
     * Prune interactions older than rolling window
     */
    pruneOldInteractions() {
        const cutoffTime = Date.now() - (this.config.rollingWindowDays * 24 * 60 * 60 * 1000);
        let pruned = 0;
        // Convert to array to avoid iterator issues
        const entries = Array.from(this.interactions.entries());
        for (const [id, interaction] of entries) {
            if (interaction.timestamp < cutoffTime) {
                this.remove(id);
                pruned++;
            }
        }
        return pruned;
    }
}
//# sourceMappingURL=interaction-store.js.map