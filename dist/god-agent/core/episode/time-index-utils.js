/**
 * God Agent Time Index Utilities
 *
 * Implements: TASK-EPISODE-002
 * Referenced by: TimeIndex
 *
 * Provides utility functions for B+ tree persistence and statistics.
 * Split from time-index.ts to comply with 500-line limit.
 */
import * as fs from 'fs';
/**
 * Serialize node for persistence
 */
export function serializeNode(node) {
    return {
        isLeaf: node.isLeaf,
        keys: node.keys,
        values: node.isLeaf ? node.values : undefined,
        children: !node.isLeaf ? node.children.map(c => serializeNode(c)) : undefined,
    };
}
/**
 * Deserialize node from JSON
 */
export function deserializeNode(data, prevLeaf) {
    const node = {
        isLeaf: data.isLeaf,
        keys: data.keys,
        values: data.isLeaf ? data.values : undefined,
        children: undefined,
    };
    if (data.isLeaf) {
        // Link to previous leaf
        if (prevLeaf) {
            prevLeaf.next = node;
            node.prev = prevLeaf;
        }
    }
    else {
        // Recursively deserialize children
        node.children = [];
        let lastLeaf = null;
        for (const childData of data.children) {
            const child = deserializeNode(childData, lastLeaf);
            node.children.push(child);
            // Track last leaf for linking
            if (child.isLeaf) {
                lastLeaf = child;
            }
        }
    }
    return node;
}
/**
 * Persist index to disk
 *
 * @param path - File path for serialization
 * @param order - B+ tree order
 * @param height - Tree height
 * @param size - Total episode references
 * @param root - Root node
 */
export function persistIndex(path, order, height, size, root) {
    const data = {
        order,
        height,
        size,
        root: serializeNode(root),
    };
    fs.writeFileSync(path, JSON.stringify(data), 'utf-8');
}
/**
 * Restore index from disk
 *
 * @param path - File path for deserialization
 * @returns Restored index data
 */
export function restoreIndex(path) {
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
    return {
        order: data.order,
        height: data.height,
        size: data.size,
        root: deserializeNode(data.root, null),
    };
}
/**
 * Collect statistics recursively
 */
export function collectStats(node) {
    let leafCount = 0;
    let internalCount = 0;
    let totalKeys = node.keys.length;
    let totalNodes = 1;
    if (node.isLeaf) {
        leafCount = 1;
    }
    else {
        internalCount = 1;
        for (const child of node.children) {
            const childStats = collectStats(child);
            leafCount += childStats.leafCount;
            internalCount += childStats.internalCount;
            totalKeys += childStats.totalKeys;
            totalNodes += childStats.totalNodes;
        }
    }
    return { leafCount, internalCount, totalKeys, totalNodes };
}
/**
 * Get index statistics
 */
export function getStats(root, height, size, order) {
    const stats = collectStats(root);
    return {
        size,
        height,
        order,
        leafCount: stats.leafCount,
        internalCount: stats.internalCount,
        avgKeysPerNode: stats.totalNodes > 0 ? stats.totalKeys / stats.totalNodes : 0,
    };
}
/**
 * Find leaf node that could contain timestamp
 */
export function findLeafNode(node, timestamp, findKeyIndex) {
    if (node.isLeaf) {
        return node;
    }
    const idx = findKeyIndex(node, timestamp);
    let childIdx = idx;
    if (childIdx < node.keys.length && timestamp >= node.keys[childIdx]) {
        childIdx++;
    }
    if (childIdx >= node.children.length) {
        childIdx = node.children.length - 1;
    }
    return findLeafNode(node.children[childIdx], timestamp, findKeyIndex);
}
/**
 * Find index for key in node (binary search)
 */
export function findKeyIndex(node, key) {
    let left = 0;
    let right = node.keys.length;
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (node.keys[mid] < key) {
            left = mid + 1;
        }
        else {
            right = mid;
        }
    }
    return left;
}
//# sourceMappingURL=time-index-utils.js.map