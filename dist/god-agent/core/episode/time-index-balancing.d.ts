/**
 * God Agent Time Index B+ Tree Balancing Operations
 *
 * Implements: TASK-EPISODE-002
 * Referenced by: TimeIndex
 *
 * Provides B+ tree node balancing operations.
 * Split from time-index.ts to comply with 500-line limit.
 */
import { BPlusNode } from './time-index-utils.js';
/**
 * Borrow key from left sibling
 */
export declare function borrowFromLeft(parent: BPlusNode, childIdx: number): void;
/**
 * Borrow key from right sibling
 */
export declare function borrowFromRight(parent: BPlusNode, childIdx: number): void;
/**
 * Merge with left sibling
 */
export declare function mergeWithLeft(parent: BPlusNode, childIdx: number): void;
/**
 * Merge with right sibling
 */
export declare function mergeWithRight(parent: BPlusNode, childIdx: number): void;
/**
 * Rebalance child node (merge or borrow from siblings)
 */
export declare function rebalanceChild(parent: BPlusNode, childIdx: number, order: number): void;
//# sourceMappingURL=time-index-balancing.d.ts.map