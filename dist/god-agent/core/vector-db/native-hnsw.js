/**
 * Native HNSW Stub
 *
 * This module provides a stub for native Rust HNSW bindings.
 * When actual native bindings are compiled, they will replace this.
 */
/**
 * Flag indicating if native HNSW is actually available
 * Stub exports false, real implementation exports true
 */
export const NATIVE_AVAILABLE = false;
/**
 * Native HNSW implementation (stub - throws error as native not available)
 */
export class NativeHNSW {
    constructor(_dimension, _metric) {
        throw new Error('Native HNSW bindings not available. Use BackendSelector to auto-detect available backends.');
    }
    insert(_id, _vector) {
        throw new Error('Native HNSW not available');
    }
    search(_query, _k, _includeVectors) {
        throw new Error('Native HNSW not available');
    }
    getVector(_id) {
        throw new Error('Native HNSW not available');
    }
    delete(_id) {
        throw new Error('Native HNSW not available');
    }
    count() {
        throw new Error('Native HNSW not available');
    }
    save(_path) {
        throw new Error('Native HNSW not available');
    }
    load(_path) {
        throw new Error('Native HNSW not available');
    }
    clear() {
        throw new Error('Native HNSW not available');
    }
}
//# sourceMappingURL=native-hnsw.js.map