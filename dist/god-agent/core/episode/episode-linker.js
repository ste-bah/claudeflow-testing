/**
 * God Agent Episode Linker Implementation
 *
 * Implements: TASK-EPISODE-003
 * Referenced by: God Agent memory system
 *
 * Provides episode linking and context retrieval:
 * - Episode relationship management (sequence, reference, continuation)
 * - Cycle detection for sequence links (DAG enforcement)
 * - Context retrieval (direct, temporal, semantic)
 * - Maximum 100 links per episode
 */
import { EpisodeValidator, EpisodeValidationError, EpisodeStorageError, } from './episode-types.js';
import { getEpisodeContext } from './episode-linker-context.js';
/**
 * EpisodeLinker - Episode relationship and context management
 *
 * Performance targets:
 * - Create link: <10ms p95
 * - Remove link: <5ms p95
 * - Get linked (10): <20ms p95
 * - Get linked (100): <50ms p95
 * - Cycle detection: <30ms (1k nodes)
 * - Context retrieval: <100ms combined
 */
export class EpisodeLinker {
    store;
    timeIndex;
    adjacencyList;
    maxLinksPerEpisode = 100;
    constructor(store, timeIndex) {
        this.store = store;
        this.timeIndex = timeIndex;
        this.adjacencyList = {
            outgoing: new Map(),
            incoming: new Map(),
        };
    }
    /**
     * Initialize adjacency list from existing links in database
     */
    async initialize() {
        this.adjacencyList.outgoing.clear();
        this.adjacencyList.incoming.clear();
    }
    /**
     * Create a link between two episodes
     */
    async linkEpisodes(sourceId, targetId, type) {
        EpisodeValidator.validateId(sourceId);
        EpisodeValidator.validateId(targetId);
        if (sourceId === targetId) {
            throw new EpisodeValidationError('Cannot create self-link');
        }
        const [source, target] = await Promise.all([
            this.store.getById(sourceId),
            this.store.getById(targetId),
        ]);
        if (!source)
            throw new EpisodeStorageError(`Source episode not found: ${sourceId}`);
        if (!target)
            throw new EpisodeStorageError(`Target episode not found: ${targetId}`);
        const outgoingLinks = this.adjacencyList.outgoing.get(sourceId);
        if (outgoingLinks && outgoingLinks.size >= this.maxLinksPerEpisode) {
            throw new EpisodeValidationError(`Episode ${sourceId} already has maximum ${this.maxLinksPerEpisode} links`);
        }
        if (type === 'sequence' && this.detectCycles(sourceId, targetId)) {
            throw new EpisodeValidationError(`Creating sequence link from ${sourceId} to ${targetId} would create a cycle`);
        }
        this.addToAdjacencyList(sourceId, targetId, type);
        await this.persistLink(sourceId, targetId, type);
    }
    /**
     * Add link to in-memory adjacency list
     */
    addToAdjacencyList(sourceId, targetId, type) {
        if (!this.adjacencyList.outgoing.has(sourceId)) {
            this.adjacencyList.outgoing.set(sourceId, new Map());
        }
        this.adjacencyList.outgoing.get(sourceId).set(targetId, type);
        if (!this.adjacencyList.incoming.has(targetId)) {
            this.adjacencyList.incoming.set(targetId, new Map());
        }
        this.adjacencyList.incoming.get(targetId).set(sourceId, type);
    }
    /**
     * Remove link from in-memory adjacency list
     */
    removeFromAdjacencyList(sourceId, targetId) {
        const outgoing = this.adjacencyList.outgoing.get(sourceId);
        if (outgoing) {
            outgoing.delete(targetId);
            if (outgoing.size === 0)
                this.adjacencyList.outgoing.delete(sourceId);
        }
        const incoming = this.adjacencyList.incoming.get(targetId);
        if (incoming) {
            incoming.delete(sourceId);
            if (incoming.size === 0)
                this.adjacencyList.incoming.delete(targetId);
        }
    }
    /**
     * Persist link to database
     */
    async persistLink(sourceId, targetId, _type) {
        const episode = await this.store.getById(sourceId);
        if (!episode)
            throw new EpisodeStorageError(`Episode not found: ${sourceId}`);
        if (!episode.linkedEpisodes.includes(targetId)) {
            await this.store.update(sourceId, { linkedEpisodes: [...episode.linkedEpisodes, targetId] });
        }
    }
    /**
     * Remove link from database
     */
    async unpersistLink(sourceId, targetId) {
        const episode = await this.store.getById(sourceId);
        if (!episode)
            return;
        const updatedLinks = episode.linkedEpisodes.filter(id => id !== targetId);
        if (updatedLinks.length !== episode.linkedEpisodes.length) {
            await this.store.update(sourceId, { linkedEpisodes: updatedLinks });
        }
    }
    /**
     * Remove a link between two episodes
     */
    async unlinkEpisodes(sourceId, targetId) {
        EpisodeValidator.validateId(sourceId);
        EpisodeValidator.validateId(targetId);
        this.removeFromAdjacencyList(sourceId, targetId);
        await this.unpersistLink(sourceId, targetId);
    }
    /**
     * Get linked episodes
     */
    async getLinkedEpisodes(id, direction = 'outgoing') {
        EpisodeValidator.validateId(id);
        const linkedIds = new Set();
        if (direction === 'outgoing' || direction === 'both') {
            const outgoing = this.adjacencyList.outgoing.get(id);
            if (outgoing) {
                for (const targetId of outgoing.keys()) {
                    linkedIds.add(targetId);
                }
            }
        }
        if (direction === 'incoming' || direction === 'both') {
            const incoming = this.adjacencyList.incoming.get(id);
            if (incoming) {
                for (const sourceId of incoming.keys()) {
                    linkedIds.add(sourceId);
                }
            }
        }
        if (linkedIds.size === 0) {
            const episode = await this.store.getById(id);
            if (episode) {
                episode.linkedEpisodes.forEach(linkedId => linkedIds.add(linkedId));
            }
        }
        const episodes = [];
        for (const linkedId of linkedIds) {
            const episode = await this.store.getById(linkedId);
            if (episode)
                episodes.push(episode);
        }
        return episodes;
    }
    /**
     * Detect cycles in sequence links using DFS
     */
    detectCycles(sourceId, targetId) {
        const visited = new Set();
        const stack = [targetId];
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === sourceId)
                return true;
            if (visited.has(current))
                continue;
            visited.add(current);
            const outgoing = this.adjacencyList.outgoing.get(current);
            if (outgoing) {
                for (const [target, type] of outgoing) {
                    if (type === 'sequence')
                        stack.push(target);
                }
            }
        }
        return false;
    }
    /**
     * Get episode context for task-aware memory retrieval (delegates to context module)
     */
    async getEpisodeContext(taskId) {
        return getEpisodeContext(this.store, this.timeIndex, taskId);
    }
    /**
     * Get all outgoing links for an episode
     */
    getOutgoingLinks(episodeId, linkType) {
        const outgoing = this.adjacencyList.outgoing.get(episodeId);
        if (!outgoing)
            return [];
        const results = [];
        for (const [targetId, type] of outgoing) {
            if (!linkType || type === linkType)
                results.push(targetId);
        }
        return results;
    }
    /**
     * Get all incoming links for an episode
     */
    getIncomingLinks(episodeId, linkType) {
        const incoming = this.adjacencyList.incoming.get(episodeId);
        if (!incoming)
            return [];
        const results = [];
        for (const [sourceId, type] of incoming) {
            if (!linkType || type === linkType)
                results.push(sourceId);
        }
        return results;
    }
    /**
     * Get link statistics
     */
    getStats() {
        const episodesWithLinks = new Set();
        let totalLinks = 0;
        for (const [episodeId, links] of this.adjacencyList.outgoing) {
            episodesWithLinks.add(episodeId);
            totalLinks += links.size;
        }
        for (const episodeId of this.adjacencyList.incoming.keys()) {
            episodesWithLinks.add(episodeId);
        }
        return {
            totalLinks,
            episodesWithLinks: episodesWithLinks.size,
            avgLinksPerEpisode: episodesWithLinks.size > 0 ? totalLinks / episodesWithLinks.size : 0,
        };
    }
    /**
     * Clear all links (for testing)
     */
    clear() {
        this.adjacencyList.outgoing.clear();
        this.adjacencyList.incoming.clear();
    }
}
//# sourceMappingURL=episode-linker.js.map