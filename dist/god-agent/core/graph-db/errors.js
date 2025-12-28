/**
 * GraphDB Error Classes
 * Custom errors for graph database operations
 */
/**
 * Error thrown when a node is not found
 */
export class NodeNotFoundError extends Error {
    constructor(nodeId) {
        super(`Node not found: ${nodeId}`);
        this.name = 'NodeNotFoundError';
        Object.setPrototypeOf(this, NodeNotFoundError.prototype);
    }
}
/**
 * Error thrown when a hyperedge is invalid (< 3 nodes)
 */
export class InvalidHyperedgeError extends Error {
    constructor(nodeCount, hyperedgeId) {
        const id = hyperedgeId ? ` (${hyperedgeId})` : '';
        super(`Invalid hyperedge${id}: requires at least 3 nodes, got ${nodeCount}`);
        this.name = 'InvalidHyperedgeError';
        Object.setPrototypeOf(this, InvalidHyperedgeError.prototype);
    }
}
/**
 * Error thrown when attempting to create an orphan node
 */
export class OrphanNodeError extends Error {
    constructor(nodeId) {
        const id = nodeId ? ` (${nodeId})` : '';
        super(`Orphan node creation prevented${id}: nodes must be linked to existing nodes. Use linkTo parameter.`);
        this.name = 'OrphanNodeError';
        Object.setPrototypeOf(this, OrphanNodeError.prototype);
    }
}
/**
 * Re-export GraphDimensionMismatchError from validation module
 * Used for embedding dimension validation
 */
export { GraphDimensionMismatchError } from '../validation/index.js';
//# sourceMappingURL=errors.js.map