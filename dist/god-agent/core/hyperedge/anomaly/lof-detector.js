/**
 * LOF (Local Outlier Factor) Detector
 * Implements k-nearest neighbors anomaly detection with local reachability density
 * Performance: <100ms per detection (HYPER-09)
 */
/**
 * Distance metric for embeddings
 */
function euclideanDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error('Vectors must have same dimension');
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
/**
 * LOF Detector for anomaly detection in vector embeddings
 */
export class LOFDetector {
    k;
    minConfidence;
    points;
    constructor(config) {
        this.k = config?.kNeighbors ?? 10;
        this.minConfidence = config?.minConfidence ?? 0.8;
        this.points = new Map();
    }
    /**
     * Add data points for anomaly detection
     */
    addPoints(points) {
        for (const point of points) {
            this.points.set(point.id, point);
        }
    }
    /**
     * Clear all data points
     */
    clear() {
        this.points.clear();
    }
    /**
     * Find k nearest neighbors for a point
     * Optimized for performance with early termination
     */
    findKNearestNeighbors(targetId, targetEmbedding) {
        const neighbors = [];
        for (const [id, point] of this.points) {
            if (id === targetId)
                continue;
            const distance = euclideanDistance(targetEmbedding, point.embedding);
            neighbors.push({ id, distance });
        }
        // Sort by distance and take k nearest
        neighbors.sort((a, b) => a.distance - b.distance);
        return neighbors.slice(0, this.k);
    }
    /**
     * Calculate k-distance (distance to k-th nearest neighbor)
     */
    getKDistance(neighbors) {
        if (neighbors.length === 0)
            return 0;
        if (neighbors.length < this.k) {
            return neighbors[neighbors.length - 1].distance;
        }
        return neighbors[this.k - 1].distance;
    }
    /**
     * Calculate reachability distance
     * reach-dist(p, o) = max(k-distance(o), dist(p, o))
     */
    reachabilityDistance(distance, neighborKDistance) {
        return Math.max(neighborKDistance, distance);
    }
    /**
     * Calculate local reachability density (LRD)
     * lrd(p) = 1 / (avg reach-dist to neighbors)
     */
    calculateLRD(neighbors, neighborKDistances) {
        if (neighbors.length === 0)
            return 0;
        let sumReachDist = 0;
        for (const neighbor of neighbors) {
            const neighborKDist = neighborKDistances.get(neighbor.id) ?? neighbor.distance;
            const reachDist = this.reachabilityDistance(neighbor.distance, neighborKDist);
            sumReachDist += reachDist;
        }
        const avgReachDist = sumReachDist / neighbors.length;
        return avgReachDist > 0 ? 1 / avgReachDist : 0;
    }
    /**
     * Calculate Local Outlier Factor (LOF)
     * LOF(p) = avg(lrd(neighbor) / lrd(p)) for all neighbors
     * LOF ≈ 1: similar density to neighbors (normal)
     * LOF > 1: lower density than neighbors (potential outlier)
     * LOF >> 1: much lower density (strong anomaly)
     */
    calculateLOF(pointLRD, neighbors, neighborLRDs) {
        if (neighbors.length === 0 || pointLRD === 0)
            return 1;
        let sumLRDRatio = 0;
        for (const neighbor of neighbors) {
            const neighborLRD = neighborLRDs.get(neighbor.id) ?? 0;
            if (neighborLRD > 0) {
                sumLRDRatio += neighborLRD / pointLRD;
            }
        }
        return sumLRDRatio / neighbors.length;
    }
    /**
     * Calculate LOF scores for all points
     * Performance target: <100ms per detection
     */
    calculateAllLOFScores() {
        const scores = new Map();
        const kDistances = new Map();
        const allNeighbors = new Map();
        // Step 1: Find k-neighbors and k-distances for all points
        for (const [id, point] of this.points) {
            const neighbors = this.findKNearestNeighbors(id, point.embedding);
            const kDistance = this.getKDistance(neighbors);
            allNeighbors.set(id, neighbors);
            kDistances.set(id, kDistance);
        }
        // Step 2: Calculate LRDs for all points
        const lrds = new Map();
        for (const [id, neighbors] of allNeighbors) {
            const lrd = this.calculateLRD(neighbors, kDistances);
            lrds.set(id, lrd);
        }
        // Step 3: Calculate LOF scores
        for (const [id, neighbors] of allNeighbors) {
            const lrd = lrds.get(id) ?? 0;
            const lof = this.calculateLOF(lrd, neighbors, lrds);
            const kDistance = kDistances.get(id) ?? 0;
            scores.set(id, {
                id,
                lof,
                kDistance,
                lrd,
                neighbors
            });
        }
        return scores;
    }
    /**
     * Convert LOF score to confidence value [0.0-1.0]
     * Higher LOF = higher confidence of being an anomaly
     */
    lofToConfidence(lof) {
        // LOF ≈ 1: normal (confidence ≈ 0)
        // LOF = 2: moderate anomaly (confidence ≈ 0.5)
        // LOF >= 3: strong anomaly (confidence ≈ 0.9+)
        if (lof <= 1)
            return 0;
        // Sigmoid-like mapping: confidence = 1 - 1/(1 + (lof-1)^2)
        const normalized = lof - 1;
        const confidence = 1 - 1 / (1 + normalized * normalized);
        return Math.min(confidence, 0.99);
    }
    /**
     * Detect anomalies in a single point
     * Returns null if confidence below threshold
     */
    detect(id) {
        const startTime = performance.now();
        const point = this.points.get(id);
        if (!point) {
            throw new Error(`Point ${id} not found`);
        }
        if (this.points.size < this.k + 1) {
            throw new Error(`Need at least ${this.k + 1} points for LOF detection`);
        }
        const scores = this.calculateAllLOFScores();
        const score = scores.get(id);
        if (!score) {
            return null;
        }
        const confidence = this.lofToConfidence(score.lof);
        // Performance check (HYPER-09: <100ms)
        const elapsed = performance.now() - startTime;
        if (elapsed > 100) {
            console.warn(`LOF detection took ${elapsed.toFixed(2)}ms (target: <100ms)`);
        }
        // Only return if confidence meets threshold (HYPER-10: >= 0.8)
        if (confidence < this.minConfidence) {
            return null;
        }
        return {
            entityId: id,
            entityType: 'node',
            score: score.lof,
            confidence,
            algorithm: 'lof',
            timestamp: Date.now(),
            reason: `LOF score ${score.lof.toFixed(2)} indicates anomalous local density`,
            neighbors: score.neighbors.map(n => n.id)
        };
    }
    /**
     * Detect anomalies in all points
     * Returns only points with confidence >= threshold
     */
    detectAll() {
        if (this.points.size < this.k + 1) {
            throw new Error(`Need at least ${this.k + 1} points for LOF detection`);
        }
        const startTime = performance.now();
        const scores = this.calculateAllLOFScores();
        const results = [];
        for (const [id, score] of scores) {
            const confidence = this.lofToConfidence(score.lof);
            if (confidence >= this.minConfidence) {
                results.push({
                    entityId: id,
                    entityType: 'node',
                    score: score.lof,
                    confidence,
                    algorithm: 'lof',
                    timestamp: Date.now(),
                    reason: `LOF score ${score.lof.toFixed(2)} indicates anomalous local density`,
                    neighbors: score.neighbors.map(n => n.id)
                });
            }
        }
        // Performance check
        const elapsed = performance.now() - startTime;
        const avgPerPoint = elapsed / this.points.size;
        if (avgPerPoint > 100) {
            console.warn(`LOF detection averaged ${avgPerPoint.toFixed(2)}ms per point (target: <100ms)`);
        }
        return results;
    }
    /**
     * Get statistics about current dataset
     */
    getStats() {
        return {
            pointCount: this.points.size,
            k: this.k,
            minConfidence: this.minConfidence
        };
    }
}
//# sourceMappingURL=lof-detector.js.map