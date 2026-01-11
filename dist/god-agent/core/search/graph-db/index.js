/**
 * GraphDB Module
 * Hypergraph database with temporal features and embedding validation
 */
// Main GraphDB class
export { GraphDB } from './graph-db.js';
// Backend class (value export)
export { FallbackGraph } from './fallback-graph.js';
export { Granularity, QueryDirection } from './types.js';
// Errors
export { NodeNotFoundError, InvalidHyperedgeError, OrphanNodeError, GraphDimensionMismatchError } from './errors.js';
//# sourceMappingURL=index.js.map