/**
 * Vector Service - IPC wrapper for NativeHNSW/FallbackHNSW
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes vector database operations via JSON-RPC 2.0
 */
import type { IHNSWBackend } from '../../vector-db/hnsw-backend.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * Vector service parameters
 */
export interface IVectorAddParams {
    id: string;
    vector: number[];
}
export interface IVectorSearchParams {
    query: number[];
    k: number;
    includeVectors?: boolean;
}
export interface IVectorGetParams {
    id: string;
}
export interface IVectorDeleteParams {
    id: string;
}
/**
 * Vector service responses
 */
export interface IVectorSearchResult {
    id: string;
    similarity: number;
    vector?: number[];
}
export interface IVectorStatsResult {
    count: number;
    dimension: number;
}
/**
 * Create vector service handler
 *
 * @param backend - HNSW backend implementation (FallbackHNSW or NativeHNSW)
 * @returns Service handler with method map
 */
export declare function createVectorService(backend: IHNSWBackend): ServiceHandler;
//# sourceMappingURL=vector-service.d.ts.map