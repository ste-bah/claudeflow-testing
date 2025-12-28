/**
 * God Agent Fallback HNSW Implementation
 *
 * Implements: TASK-VDB-001
 * Referenced by: VectorDB
 *
 * Pure TypeScript fallback implementation using brute-force search.
 * Optimized HNSW will be added later with native bindings.
 *
 * Storage format (.agentdb/vectors.bin):
 * - 4 bytes: version (uint32)
 * - 4 bytes: dimension (uint32)
 * - 4 bytes: count (uint32)
 * - For each vector:
 *   - 4 bytes: ID length (uint32)
 *   - N bytes: ID string (UTF-8)
 *   - dimension * 4 bytes: vector data (float32)
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { DistanceMetric } from './types.js';
import { getMetricFunction, isSimilarityMetric } from './distance-metrics.js';
const STORAGE_VERSION = 1;
/**
 * Pure TypeScript HNSW fallback implementation
 * Uses brute-force k-NN search (will be optimized with native HNSW later)
 */
export class FallbackHNSW {
    vectors;
    dimension;
    metric;
    metricFn;
    isSimilarity;
    constructor(dimension, metric = DistanceMetric.COSINE) {
        this.vectors = new Map();
        this.dimension = dimension;
        this.metric = metric;
        this.metricFn = getMetricFunction(metric);
        this.isSimilarity = isSimilarityMetric(metric);
    }
    insert(id, vector) {
        // Create a copy to avoid external modifications
        const vectorCopy = new Float32Array(vector);
        this.vectors.set(id, vectorCopy);
    }
    search(query, k, includeVectors = false) {
        if (this.vectors.size === 0) {
            return [];
        }
        // Calculate similarity/distance to all vectors
        const scores = [];
        for (const [id, vector] of this.vectors.entries()) {
            const score = this.metricFn(query, vector);
            scores.push({ id, score, vector });
        }
        // Sort by score (descending for similarity, ascending for distance)
        scores.sort((a, b) => {
            return this.isSimilarity ? b.score - a.score : a.score - b.score;
        });
        // Return top k results
        const results = scores.slice(0, Math.min(k, scores.length));
        return results.map(({ id, score, vector }) => ({
            id,
            similarity: score,
            vector: includeVectors ? new Float32Array(vector) : undefined
        }));
    }
    getVector(id) {
        const vector = this.vectors.get(id);
        // Return a copy to prevent external modifications
        return vector ? new Float32Array(vector) : undefined;
    }
    delete(id) {
        return this.vectors.delete(id);
    }
    count() {
        return this.vectors.size;
    }
    async save(filePath) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        // Calculate buffer size
        const count = this.vectors.size;
        let totalSize = 12; // version + dimension + count
        const entries = Array.from(this.vectors.entries());
        for (const [id] of entries) {
            const idBytes = Buffer.byteLength(id, 'utf-8');
            totalSize += 4 + idBytes + this.dimension * 4;
        }
        // Create buffer and write header
        const buffer = Buffer.allocUnsafe(totalSize);
        let offset = 0;
        buffer.writeUInt32LE(STORAGE_VERSION, offset);
        offset += 4;
        buffer.writeUInt32LE(this.dimension, offset);
        offset += 4;
        buffer.writeUInt32LE(count, offset);
        offset += 4;
        // Write vectors
        for (const [id, vector] of entries) {
            // Write ID length and string
            const idBytes = Buffer.from(id, 'utf-8');
            buffer.writeUInt32LE(idBytes.length, offset);
            offset += 4;
            idBytes.copy(buffer, offset);
            offset += idBytes.length;
            // Write vector data
            for (let i = 0; i < vector.length; i++) {
                buffer.writeFloatLE(vector[i], offset);
                offset += 4;
            }
        }
        // Write to file
        await fs.writeFile(filePath, buffer);
    }
    async load(filePath) {
        try {
            // Check if file exists
            await fs.access(filePath);
        }
        catch {
            // File doesn't exist
            return false;
        }
        // Read file
        const buffer = await fs.readFile(filePath);
        let offset = 0;
        // Read header
        const version = buffer.readUInt32LE(offset);
        offset += 4;
        if (version !== STORAGE_VERSION) {
            throw new Error(`Unsupported storage version: ${version} (expected ${STORAGE_VERSION})`);
        }
        const dimension = buffer.readUInt32LE(offset);
        offset += 4;
        if (dimension !== this.dimension) {
            throw new Error(`Dimension mismatch: file has ${dimension}D, expected ${this.dimension}D`);
        }
        const count = buffer.readUInt32LE(offset);
        offset += 4;
        // Clear existing vectors
        this.vectors.clear();
        // Read vectors
        for (let i = 0; i < count; i++) {
            // Read ID
            const idLength = buffer.readUInt32LE(offset);
            offset += 4;
            const id = buffer.toString('utf-8', offset, offset + idLength);
            offset += idLength;
            // Read vector data
            const vector = new Float32Array(dimension);
            for (let j = 0; j < dimension; j++) {
                vector[j] = buffer.readFloatLE(offset);
                offset += 4;
            }
            this.vectors.set(id, vector);
        }
        return true;
    }
    clear() {
        this.vectors.clear();
    }
}
//# sourceMappingURL=fallback-hnsw.js.map