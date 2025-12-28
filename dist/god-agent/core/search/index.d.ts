/**
 * Search Module
 *
 * Provides search capabilities for the God Agent including:
 * - Web search (WebSearch, Perplexity MCP)
 * - Quad-Fusion unified search (Vector + Graph + Memory + Pattern)
 *
 * PRD: PRD-GOD-AGENT-001
 */
export type { ISearchResult, ISearchOptions, IWebSearchProvider, } from './web-search-provider.js';
export { HybridSearchProvider, type McpToolInvocation, } from './hybrid-search-provider.js';
export { type SearchSource, type SourceWeights, type QuadFusionOptions, type SourceAttribution, type FusedSearchResult, type SearchMetadata, type SourceStat, type SourceStatistics, type QuadFusionResult, type RawSourceResult, type SourceSuccessResult, type SourceTimeoutResult, type SourceErrorResult, type SourceExecutionResult, type AggregatedResults, type SearchError, DEFAULT_OPTIONS, MAX_TOP_K, MAX_GRAPH_DEPTH, MAX_SOURCE_TIMEOUT_MS, SearchErrorCode, createSearchError, validateOptions, normalizeWeights, mergeOptions, } from './search-types.js';
export { TimeoutError, withTimeout, computeContentHash, measureTime, generateResultId, normalizeScore, } from './utils.js';
export { VectorSourceAdapter, GraphSourceAdapter, MemorySourceAdapter, PatternSourceAdapter, } from './adapters/index.js';
export { FusionScorer } from './fusion-scorer.js';
export { UnifiedSearch } from './unified-search.js';
//# sourceMappingURL=index.d.ts.map