/**
 * GraphDB Error Classes
 * Custom errors for graph database operations
 */
import type { NodeID, HyperedgeID } from './types.js';
/**
 * Error thrown when a node is not found
 */
export declare class NodeNotFoundError extends Error {
    constructor(nodeId: NodeID);
}
/**
 * Error thrown when a hyperedge is invalid (< 3 nodes)
 */
export declare class InvalidHyperedgeError extends Error {
    constructor(nodeCount: number, hyperedgeId?: HyperedgeID);
}
/**
 * Error thrown when attempting to create an orphan node
 */
export declare class OrphanNodeError extends Error {
    constructor(nodeId?: NodeID);
}
/**
 * Re-export GraphDimensionMismatchError from validation module
 * Used for embedding dimension validation
 */
export { GraphDimensionMismatchError } from '../validation/index.js';
//# sourceMappingURL=errors.d.ts.map