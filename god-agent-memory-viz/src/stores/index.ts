/**
 * Stores barrel export
 *
 * @module stores
 */

// UI Store
export { useUIStore, selectSidebarCollapsed, selectTheme, selectActiveView } from './uiStore';

// Graph Store
export {
  useGraphStore,
  type SelectionState,
  selectNodes,
  selectEdges,
  selectIsLoading,
  selectCurrentLayout,
  selectZoom,
  selectViewport,
  selectSelection,
  selectNodeById,
  selectEdgeById,
  selectSelectedNodes,
  selectSelectedEdges,
  selectVisibleNodes,
  selectVisibleEdges,
  selectNodesByType,
  selectEdgesByType,
  selectConnectedEdges,
  selectNeighborNodes,
  selectGraphStats,
} from './graphStore';

// Database Store
export {
  useDatabaseStore,
  selectIsConnected,
  selectHasData,
  selectEventCount,
  selectMemoryEntryCount,
  selectSessionCount,
  selectUniqueAgents,
  selectUniqueNamespaces,
  selectDateRange,
} from './databaseStore';

// Filter Store
export {
  useFilterStore,
  type TimeRange,
  type SearchQuery,
  type FilterPreset,
  type SavedFilters,
  type FilterState,
  type FilterActions,
  selectEnabledNodeTypes,
  selectEnabledEdgeTypes,
  selectTimeRange,
  selectSearchQuery,
  selectSearchResults,
  selectPresets,
  selectActivePreset,
  selectHasActiveFilters,
} from './filterStore';

// Selection Store (re-exports from graphStore)
export { selectionActions } from './selectionStore';
