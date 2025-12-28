/**
 * Memory Engine Module
 * Unified semantic memory with vector search and graph relationships
 */
export { MemoryEngine } from './memory-engine.js';
export { LRUCache } from './lru-cache.js';
export type { IStoreOptions, IRetrieveOptions, ISearchOptions, MemorySearchResult, IEmbeddingProvider, RelationType } from './types.js';
export interface MemoryEngineConfig {
    vectorDB: any;
    graphDB: any;
    embeddingProvider: any;
    cacheSize?: number;
    cacheMaxAge?: number;
}
export { StorageTransactionError, NamespaceValidationError, OrphanNodeError } from './errors.js';
export { validateNamespace, validateOrphanPrevention, isRootNamespace, ROOT_NAMESPACES } from './validation.js';
export { encodeValue, decodeValue } from './encoding.js';
export { MockEmbeddingProvider } from './embedding-provider.js';
//# sourceMappingURL=index.d.ts.map