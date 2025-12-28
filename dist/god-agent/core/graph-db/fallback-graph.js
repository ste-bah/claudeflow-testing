/**
 * Fallback Graph Backend
 * In-memory storage with JSON persistence
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';
import { QueryDirection } from './types.js';
/**
 * FallbackGraph - In-memory graph storage with JSON persistence
 */
export class FallbackGraph {
    nodes;
    edges;
    hyperedges;
    dataDir;
    dataFile;
    lockTimeout;
    enablePersistence;
    constructor(dataDir = '.agentdb/graphs', lockTimeout = 5000, enablePersistence = true) {
        this.nodes = new Map();
        this.edges = new Map();
        this.hyperedges = new Map();
        this.dataDir = dataDir;
        this.dataFile = path.join(dataDir, 'graph.json');
        this.lockTimeout = lockTimeout;
        this.enablePersistence = enablePersistence;
    }
    // Node Operations
    async insertNode(node) {
        this.nodes.set(node.id, node);
        await this.save();
    }
    async getNode(id) {
        return this.nodes.get(id) || null;
    }
    async updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node)
            return;
        const updatedNode = {
            ...node,
            ...updates,
            id: node.id, // Preserve ID
            updatedAt: Date.now()
        };
        this.nodes.set(id, updatedNode);
        await this.save();
    }
    async deleteNode(id) {
        this.nodes.delete(id);
        await this.save();
    }
    async getAllNodes() {
        return Array.from(this.nodes.values());
    }
    async nodeExists(id) {
        return this.nodes.has(id);
    }
    // Edge Operations
    async insertEdge(edge) {
        this.edges.set(edge.id, edge);
        await this.save();
    }
    async getEdge(id) {
        return this.edges.get(id) || null;
    }
    async getEdges(nodeId, direction) {
        const edges = Array.from(this.edges.values());
        switch (direction) {
            case QueryDirection.Incoming:
                return edges.filter(e => e.target === nodeId);
            case QueryDirection.Outgoing:
                return edges.filter(e => e.source === nodeId);
            case QueryDirection.Both:
                return edges.filter(e => e.source === nodeId || e.target === nodeId);
            default:
                return [];
        }
    }
    async deleteEdge(id) {
        this.edges.delete(id);
        await this.save();
    }
    async getAllEdges() {
        return Array.from(this.edges.values());
    }
    // Hyperedge Operations
    async insertHyperedge(hyperedge) {
        this.hyperedges.set(hyperedge.id, hyperedge);
        await this.save();
    }
    async getHyperedge(id) {
        return this.hyperedges.get(id) || null;
    }
    async getHyperedgesByNode(nodeId) {
        return Array.from(this.hyperedges.values()).filter(h => h.nodes.includes(nodeId));
    }
    async deleteHyperedge(id) {
        this.hyperedges.delete(id);
        await this.save();
    }
    async getAllHyperedges() {
        return Array.from(this.hyperedges.values());
    }
    // Utility Operations
    async clear() {
        this.nodes.clear();
        this.edges.clear();
        this.hyperedges.clear();
        await this.save();
    }
    // Persistence Operations
    async save() {
        if (!this.enablePersistence)
            return;
        try {
            // Ensure directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            // Convert Maps to objects for JSON serialization
            const data = {
                nodes: Object.fromEntries(this.nodes),
                edges: Object.fromEntries(this.edges),
                hyperedges: Object.fromEntries(this.hyperedges),
                version: '1.0.0',
                timestamp: Date.now()
            };
            const jsonData = JSON.stringify(data, null, 2);
            // Acquire lock and write
            let release = null;
            try {
                // Check if file exists, create if not
                try {
                    await fs.access(this.dataFile);
                }
                catch {
                    await fs.writeFile(this.dataFile, '{}', 'utf-8');
                }
                release = await lockfile.lock(this.dataFile, {
                    retries: {
                        retries: 5,
                        minTimeout: 100,
                        maxTimeout: this.lockTimeout
                    }
                });
                await fs.writeFile(this.dataFile, jsonData, 'utf-8');
            }
            finally {
                if (release)
                    await release();
            }
        }
        catch (error) {
            // Silent fail for persistence errors - in-memory data remains intact
            console.warn('Failed to persist graph data:', error);
        }
    }
    async load() {
        if (!this.enablePersistence)
            return;
        try {
            // Check if file exists
            try {
                await fs.access(this.dataFile);
            }
            catch {
                // File doesn't exist, nothing to load
                return;
            }
            // Acquire lock and read
            let release = null;
            try {
                release = await lockfile.lock(this.dataFile, {
                    retries: {
                        retries: 5,
                        minTimeout: 100,
                        maxTimeout: this.lockTimeout
                    }
                });
                const jsonData = await fs.readFile(this.dataFile, 'utf-8');
                const data = JSON.parse(jsonData);
                // Convert objects back to Maps
                this.nodes = new Map(Object.entries(data.nodes || {}));
                this.edges = new Map(Object.entries(data.edges || {}));
                this.hyperedges = new Map(Object.entries(data.hyperedges || {}));
            }
            finally {
                if (release)
                    await release();
            }
        }
        catch (error) {
            // Silent fail for load errors - start with empty graph
            console.warn('Failed to load graph data:', error);
            this.nodes.clear();
            this.edges.clear();
            this.hyperedges.clear();
        }
    }
}
//# sourceMappingURL=fallback-graph.js.map