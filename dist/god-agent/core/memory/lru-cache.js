/**
 * LRU Cache with O(1) operations using doubly-linked list + Map
 * Target: <50µs p95 latency for cache hits
 */
export class LRUCache {
    capacity;
    cache;
    head = null; // Most recently used
    tail = null; // Least recently used
    memoryPressureThreshold = 0.80; // 80%
    evictionBatchSize;
    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.cache = new Map();
        this.evictionBatchSize = Math.floor(capacity / 2); // 50%
    }
    get(key) {
        if (!this.cache.has(key))
            return null;
        const node = this.cache.get(key);
        node.accessedAt = Date.now();
        this.moveToHead(node);
        return node.value;
    }
    set(key, value) {
        this.checkMemoryPressure();
        if (this.cache.has(key)) {
            const node = this.cache.get(key);
            node.value = value;
            node.accessedAt = Date.now();
            this.moveToHead(node);
            return;
        }
        const newNode = {
            key, value, prev: null, next: null, accessedAt: Date.now()
        };
        this.cache.set(key, newNode);
        this.addToHead(newNode);
        if (this.cache.size > this.capacity) {
            const removed = this.removeTail();
            if (removed)
                this.cache.delete(removed.key);
        }
    }
    delete(key) {
        if (!this.cache.has(key))
            return false;
        const node = this.cache.get(key);
        this.removeNode(node);
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
    }
    size() {
        return this.cache.size;
    }
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Get cache statistics for monitoring
     */
    getStats() {
        return {
            size: this.cache.size,
            capacity: this.capacity,
            utilizationPercent: (this.cache.size / this.capacity) * 100
        };
    }
    // Private doubly-linked list methods
    moveToHead(node) {
        this.removeNode(node);
        this.addToHead(node);
    }
    addToHead(node) {
        node.prev = null;
        node.next = this.head;
        if (this.head)
            this.head.prev = node;
        this.head = node;
        if (!this.tail)
            this.tail = node;
    }
    removeNode(node) {
        if (node.prev)
            node.prev.next = node.next;
        else
            this.head = node.next;
        if (node.next)
            node.next.prev = node.prev;
        else
            this.tail = node.prev;
    }
    removeTail() {
        const removed = this.tail;
        if (this.tail)
            this.removeNode(this.tail);
        return removed;
    }
    checkMemoryPressure() {
        const memUsage = process.memoryUsage();
        const ratio = memUsage.heapUsed / memUsage.heapTotal;
        if (ratio > this.memoryPressureThreshold) {
            this.evictBatch(this.evictionBatchSize);
        }
    }
    evictBatch(count) {
        let evicted = 0;
        while (evicted < count && this.tail) {
            const removed = this.removeTail();
            if (removed)
                this.cache.delete(removed.key);
            evicted++;
        }
    }
}
//# sourceMappingURL=lru-cache.js.map