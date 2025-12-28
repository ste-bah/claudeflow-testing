/**
 * LRU Cache with O(1) operations using doubly-linked list + Map
 * Target: <50µs p95 latency for cache hits
 */
export declare class LRUCache<K, V> {
    private capacity;
    private cache;
    private head;
    private tail;
    private memoryPressureThreshold;
    private evictionBatchSize;
    constructor(capacity?: number);
    get(key: K): V | null;
    set(key: K, value: V): void;
    delete(key: K): boolean;
    clear(): void;
    size(): number;
    has(key: K): boolean;
    /**
     * Get cache statistics for monitoring
     */
    getStats(): {
        size: number;
        capacity: number;
        utilizationPercent: number;
    };
    private moveToHead;
    private addToHead;
    private removeNode;
    private removeTail;
    private checkMemoryPressure;
    private evictBatch;
}
//# sourceMappingURL=lru-cache.d.ts.map