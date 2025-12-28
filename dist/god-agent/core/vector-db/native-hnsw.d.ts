/**
 * Native HNSW Stub
 *
 * This module provides a stub for native Rust HNSW bindings.
 * When actual native bindings are compiled, they will replace this.
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { DistanceMetric, SearchResult, VectorID } from './types.js';
/**
 * Flag indicating if native HNSW is actually available
 * Stub exports false, real implementation exports true
 */
export declare const NATIVE_AVAILABLE = false;
/**
 * Native HNSW implementation (stub - throws error as native not available)
 */
export declare class NativeHNSW implements IHNSWBackend {
    constructor(_dimension: number, _metric: DistanceMetric);
    insert(_id: VectorID, _vector: Float32Array): void;
    search(_query: Float32Array, _k: number, _includeVectors?: boolean): SearchResult[];
    getVector(_id: VectorID): Float32Array | undefined;
    delete(_id: VectorID): boolean;
    count(): number;
    save(_path: string): Promise<void>;
    load(_path: string): Promise<boolean>;
    clear(): void;
}
//# sourceMappingURL=native-hnsw.d.ts.map