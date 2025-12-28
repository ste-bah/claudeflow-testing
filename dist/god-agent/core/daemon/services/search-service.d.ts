/**
 * Search Service - IPC wrapper for UnifiedSearch
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes quad-fusion search operations via JSON-RPC 2.0
 */
import type { UnifiedSearch } from '../../search/unified-search.js';
import type { QuadFusionOptions, SourceWeights } from '../../search/search-types.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * Search service parameters
 */
export interface ISearchQueryParams {
    query: string;
    embedding?: number[];
    options?: Partial<QuadFusionOptions>;
}
export interface ISearchUpdateWeightsParams {
    weights: Partial<SourceWeights>;
}
/**
 * Create search service handler
 *
 * @param unifiedSearch - UnifiedSearch instance
 * @returns Service handler with method map
 */
export declare function createSearchService(unifiedSearch: UnifiedSearch): ServiceHandler;
//# sourceMappingURL=search-service.d.ts.map