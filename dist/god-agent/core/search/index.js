/**
 * Search Module
 *
 * Provides search capabilities for the God Agent including:
 * - Web search (WebSearch, Perplexity MCP)
 * - Quad-Fusion unified search (Vector + Graph + Memory + Pattern)
 *
 * PRD: PRD-GOD-AGENT-001
 */
export { HybridSearchProvider, } from './hybrid-search-provider.js';
// Quad-Fusion Search Types (PRD-GOD-AGENT-001)
export { 
// Constants
DEFAULT_OPTIONS, MAX_TOP_K, MAX_GRAPH_DEPTH, MAX_SOURCE_TIMEOUT_MS, 
// Enums
SearchErrorCode, 
// Functions
createSearchError, validateOptions, normalizeWeights, mergeOptions, } from './search-types.js';
// Utils (PRD-GOD-AGENT-001 / TASK-SEARCH-004)
export { TimeoutError, withTimeout, computeContentHash, measureTime, generateResultId, normalizeScore, } from './utils.js';
// Source Adapters (PRD-GOD-AGENT-001 / TASK-SEARCH-004)
export { VectorSourceAdapter, GraphSourceAdapter, MemorySourceAdapter, PatternSourceAdapter, } from './adapters/index.js';
// Fusion Scorer (PRD-GOD-AGENT-001 / TASK-SEARCH-002)
export { FusionScorer } from './fusion-scorer.js';
// Unified Search (PRD-GOD-AGENT-001 / TASK-SEARCH-001)
export { UnifiedSearch } from './unified-search.js';
//# sourceMappingURL=index.js.map