/**
 * God Agent VectorDB Type Definitions
 *
 * Implements: TASK-VDB-001
 * Referenced by: God Agent core system
 */
/**
 * Distance metric for vector similarity/distance calculations
 */
export var DistanceMetric;
(function (DistanceMetric) {
    /** Cosine similarity (recommended for normalized vectors) */
    DistanceMetric["COSINE"] = "cosine";
    /** Euclidean distance (L2 distance) */
    DistanceMetric["EUCLIDEAN"] = "euclidean";
    /** Dot product (assumes normalized vectors) */
    DistanceMetric["DOT"] = "dot";
    /** Manhattan distance (L1 distance) */
    DistanceMetric["MANHATTAN"] = "manhattan";
})(DistanceMetric || (DistanceMetric = {}));
//# sourceMappingURL=types.js.map