/**
 * Filter Store
 *
 * Zustand store for managing filter state including node/edge type filters,
 * time range, search queries, and session/agent filters.
 *
 * @module stores/filterStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Time range filter
 */
export interface TimeRange {
  start: Date | null;
  end: Date | null;
}

/**
 * Search query configuration
 */
export interface SearchQuery {
  /** Search text */
  text: string;
  /** Fields to search in */
  fields: ('label' | 'id' | 'data')[];
  /** Case sensitive search */
  caseSensitive: boolean;
  /** Use regex matching */
  useRegex: boolean;
}

/**
 * Filter preset for saving/loading filter configurations
 */
export interface FilterPreset {
  id: string;
  name: string;
  filters: SavedFilters;
  createdAt: Date;
}

/**
 * Saved filter configuration
 */
export interface SavedFilters {
  nodeTypes: string[];
  edgeTypes: string[];
  sessionIds: string[];
  agentIds: string[];
  timeRange: TimeRange;
  searchQuery: SearchQuery | null;
}

/**
 * Filter store state
 */
export interface FilterState {
  // Node type filters
  enabledNodeTypes: Set<string>;

  // Edge type filters
  enabledEdgeTypes: Set<string>;

  // Session filters
  enabledSessionIds: Set<string>;
  allSessionIds: string[];

  // Agent filters
  enabledAgentIds: Set<string>;
  allAgentIds: string[];

  // Namespace filters
  enabledNamespaces: Set<string>;
  allNamespaces: string[];

  // Time range
  timeRange: TimeRange;

  // Search
  searchQuery: SearchQuery | null;
  searchResults: string[]; // Node IDs matching search

  // Filter presets
  presets: FilterPreset[];
  activePresetId: string | null;

  // Quick filters
  showOrphans: boolean; // Nodes with no connections
  showHighlighted: boolean; // Only show highlighted nodes
  minAccessCount: number; // For memory nodes
}

/**
 * Filter store actions
 */
export interface FilterActions {
  // Node type filters
  setEnabledNodeTypes: (types: Set<string>) => void;
  toggleNodeType: (type: string) => void;
  enableAllNodeTypes: () => void;
  disableAllNodeTypes: () => void;

  // Edge type filters
  setEnabledEdgeTypes: (types: Set<string>) => void;
  toggleEdgeType: (type: string) => void;
  enableAllEdgeTypes: () => void;
  disableAllEdgeTypes: () => void;

  // Session filters
  setAvailableSessions: (sessionIds: string[]) => void;
  setEnabledSessionIds: (ids: Set<string>) => void;
  toggleSession: (sessionId: string) => void;
  enableAllSessions: () => void;
  disableAllSessions: () => void;

  // Agent filters
  setAvailableAgents: (agentIds: string[]) => void;
  setEnabledAgentIds: (ids: Set<string>) => void;
  toggleAgent: (agentId: string) => void;
  enableAllAgents: () => void;
  disableAllAgents: () => void;

  // Namespace filters
  setAvailableNamespaces: (namespaces: string[]) => void;
  setEnabledNamespaces: (namespaces: Set<string>) => void;
  toggleNamespace: (namespace: string) => void;
  enableAllNamespaces: () => void;
  disableAllNamespaces: () => void;

  // Time range
  setTimeRange: (range: TimeRange) => void;
  clearTimeRange: () => void;

  // Search
  setSearchQuery: (query: SearchQuery | null) => void;
  setSearchText: (text: string) => void;
  setSearchResults: (nodeIds: string[]) => void;
  clearSearch: () => void;

  // Presets
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;

  // Quick filters
  setShowOrphans: (show: boolean) => void;
  setShowHighlighted: (show: boolean) => void;
  setMinAccessCount: (count: number) => void;

  // Reset
  resetAllFilters: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_NODE_TYPES: string[] = [
  'trajectory',
  'pattern',
  'episode',
  'feedback',
  'reasoning_step',
  'checkpoint',
  'session',
  'agent',
  'namespace',
];

const ALL_EDGE_TYPES: string[] = [
  'uses_pattern',
  'creates_pattern',
  'linked_to',
  'informed_by_feedback',
  'belongs_to_route',
  'has_step',
  'has_checkpoint',
  'temporal',
  'membership',
  'reference',
  'similarity',
];

// ============================================================================
// Initial State
// ============================================================================

const initialTimeRange: TimeRange = {
  start: null,
  end: null,
};

const initialState: FilterState = {
  enabledNodeTypes: new Set(ALL_NODE_TYPES),
  enabledEdgeTypes: new Set(ALL_EDGE_TYPES),
  enabledSessionIds: new Set(),
  allSessionIds: [],
  enabledAgentIds: new Set(),
  allAgentIds: [],
  enabledNamespaces: new Set(),
  allNamespaces: [],
  timeRange: initialTimeRange,
  searchQuery: null,
  searchResults: [],
  presets: [],
  activePresetId: null,
  showOrphans: true,
  showHighlighted: false,
  minAccessCount: 0,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useFilterStore = create<FilterState & FilterActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Node type filters
      setEnabledNodeTypes: (types) =>
        set((draft) => {
          draft.enabledNodeTypes = types;
          draft.activePresetId = null;
        }),

      toggleNodeType: (type) =>
        set((draft) => {
          if (draft.enabledNodeTypes.has(type)) {
            draft.enabledNodeTypes.delete(type);
          } else {
            draft.enabledNodeTypes.add(type);
          }
          draft.activePresetId = null;
        }),

      enableAllNodeTypes: () =>
        set((draft) => {
          draft.enabledNodeTypes = new Set(ALL_NODE_TYPES);
          draft.activePresetId = null;
        }),

      disableAllNodeTypes: () =>
        set((draft) => {
          draft.enabledNodeTypes.clear();
          draft.activePresetId = null;
        }),

      // Edge type filters
      setEnabledEdgeTypes: (types) =>
        set((draft) => {
          draft.enabledEdgeTypes = types;
          draft.activePresetId = null;
        }),

      toggleEdgeType: (type) =>
        set((draft) => {
          if (draft.enabledEdgeTypes.has(type)) {
            draft.enabledEdgeTypes.delete(type);
          } else {
            draft.enabledEdgeTypes.add(type);
          }
          draft.activePresetId = null;
        }),

      enableAllEdgeTypes: () =>
        set((draft) => {
          draft.enabledEdgeTypes = new Set(ALL_EDGE_TYPES);
          draft.activePresetId = null;
        }),

      disableAllEdgeTypes: () =>
        set((draft) => {
          draft.enabledEdgeTypes.clear();
          draft.activePresetId = null;
        }),

      // Session filters
      setAvailableSessions: (sessionIds) =>
        set((draft) => {
          draft.allSessionIds = sessionIds;
          draft.enabledSessionIds = new Set(sessionIds);
        }),

      setEnabledSessionIds: (ids) =>
        set((draft) => {
          draft.enabledSessionIds = ids;
          draft.activePresetId = null;
        }),

      toggleSession: (sessionId) =>
        set((draft) => {
          if (draft.enabledSessionIds.has(sessionId)) {
            draft.enabledSessionIds.delete(sessionId);
          } else {
            draft.enabledSessionIds.add(sessionId);
          }
          draft.activePresetId = null;
        }),

      enableAllSessions: () =>
        set((draft) => {
          draft.enabledSessionIds = new Set(draft.allSessionIds);
          draft.activePresetId = null;
        }),

      disableAllSessions: () =>
        set((draft) => {
          draft.enabledSessionIds.clear();
          draft.activePresetId = null;
        }),

      // Agent filters
      setAvailableAgents: (agentIds) =>
        set((draft) => {
          draft.allAgentIds = agentIds;
          draft.enabledAgentIds = new Set(agentIds);
        }),

      setEnabledAgentIds: (ids) =>
        set((draft) => {
          draft.enabledAgentIds = ids;
          draft.activePresetId = null;
        }),

      toggleAgent: (agentId) =>
        set((draft) => {
          if (draft.enabledAgentIds.has(agentId)) {
            draft.enabledAgentIds.delete(agentId);
          } else {
            draft.enabledAgentIds.add(agentId);
          }
          draft.activePresetId = null;
        }),

      enableAllAgents: () =>
        set((draft) => {
          draft.enabledAgentIds = new Set(draft.allAgentIds);
          draft.activePresetId = null;
        }),

      disableAllAgents: () =>
        set((draft) => {
          draft.enabledAgentIds.clear();
          draft.activePresetId = null;
        }),

      // Namespace filters
      setAvailableNamespaces: (namespaces) =>
        set((draft) => {
          draft.allNamespaces = namespaces;
          draft.enabledNamespaces = new Set(namespaces);
        }),

      setEnabledNamespaces: (namespaces) =>
        set((draft) => {
          draft.enabledNamespaces = namespaces;
          draft.activePresetId = null;
        }),

      toggleNamespace: (namespace) =>
        set((draft) => {
          if (draft.enabledNamespaces.has(namespace)) {
            draft.enabledNamespaces.delete(namespace);
          } else {
            draft.enabledNamespaces.add(namespace);
          }
          draft.activePresetId = null;
        }),

      enableAllNamespaces: () =>
        set((draft) => {
          draft.enabledNamespaces = new Set(draft.allNamespaces);
          draft.activePresetId = null;
        }),

      disableAllNamespaces: () =>
        set((draft) => {
          draft.enabledNamespaces.clear();
          draft.activePresetId = null;
        }),

      // Time range
      setTimeRange: (range) =>
        set((draft) => {
          draft.timeRange = range;
          draft.activePresetId = null;
        }),

      clearTimeRange: () =>
        set((draft) => {
          draft.timeRange = initialTimeRange;
          draft.activePresetId = null;
        }),

      // Search
      setSearchQuery: (query) =>
        set((draft) => {
          draft.searchQuery = query;
          if (!query) {
            draft.searchResults = [];
          }
        }),

      setSearchText: (text) =>
        set((draft) => {
          if (draft.searchQuery) {
            draft.searchQuery.text = text;
          } else {
            draft.searchQuery = {
              text,
              fields: ['label', 'id', 'data'],
              caseSensitive: false,
              useRegex: false,
            };
          }
        }),

      setSearchResults: (nodeIds) =>
        set((draft) => {
          draft.searchResults = nodeIds;
        }),

      clearSearch: () =>
        set((draft) => {
          draft.searchQuery = null;
          draft.searchResults = [];
        }),

      // Presets
      savePreset: (name) =>
        set((draft) => {
          const state = get();
          const preset: FilterPreset = {
            id: `preset_${Date.now()}`,
            name,
            filters: {
              nodeTypes: Array.from(state.enabledNodeTypes),
              edgeTypes: Array.from(state.enabledEdgeTypes),
              sessionIds: Array.from(state.enabledSessionIds),
              agentIds: Array.from(state.enabledAgentIds),
              timeRange: state.timeRange,
              searchQuery: state.searchQuery,
            },
            createdAt: new Date(),
          };
          draft.presets.push(preset);
          draft.activePresetId = preset.id;
        }),

      loadPreset: (presetId) =>
        set((draft) => {
          const preset = draft.presets.find((p) => p.id === presetId);
          if (preset) {
            draft.enabledNodeTypes = new Set(preset.filters.nodeTypes);
            draft.enabledEdgeTypes = new Set(preset.filters.edgeTypes);
            draft.enabledSessionIds = new Set(preset.filters.sessionIds);
            draft.enabledAgentIds = new Set(preset.filters.agentIds);
            draft.timeRange = preset.filters.timeRange;
            draft.searchQuery = preset.filters.searchQuery;
            draft.activePresetId = presetId;
          }
        }),

      deletePreset: (presetId) =>
        set((draft) => {
          draft.presets = draft.presets.filter((p) => p.id !== presetId);
          if (draft.activePresetId === presetId) {
            draft.activePresetId = null;
          }
        }),

      // Quick filters
      setShowOrphans: (show) =>
        set((draft) => {
          draft.showOrphans = show;
        }),

      setShowHighlighted: (show) =>
        set((draft) => {
          draft.showHighlighted = show;
        }),

      setMinAccessCount: (count) =>
        set((draft) => {
          draft.minAccessCount = Math.max(0, count);
        }),

      // Reset
      resetAllFilters: () =>
        set((draft) => {
          draft.enabledNodeTypes = new Set(ALL_NODE_TYPES);
          draft.enabledEdgeTypes = new Set(ALL_EDGE_TYPES);
          draft.enabledSessionIds = new Set(draft.allSessionIds);
          draft.enabledAgentIds = new Set(draft.allAgentIds);
          draft.enabledNamespaces = new Set(draft.allNamespaces);
          draft.timeRange = initialTimeRange;
          draft.searchQuery = null;
          draft.searchResults = [];
          draft.activePresetId = null;
          draft.showOrphans = true;
          draft.showHighlighted = false;
          draft.minAccessCount = 0;
        }),
    })),
    {
      name: 'god-agent-filter-storage',
      partialize: (state) => ({
        presets: state.presets,
        showOrphans: state.showOrphans,
        minAccessCount: state.minAccessCount,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectEnabledNodeTypes = (state: FilterState) => state.enabledNodeTypes;
export const selectEnabledEdgeTypes = (state: FilterState) => state.enabledEdgeTypes;
export const selectTimeRange = (state: FilterState) => state.timeRange;
export const selectSearchQuery = (state: FilterState) => state.searchQuery;
export const selectSearchResults = (state: FilterState) => state.searchResults;
export const selectPresets = (state: FilterState) => state.presets;
export const selectActivePreset = (state: FilterState) =>
  state.presets.find((p) => p.id === state.activePresetId) || null;

export const selectHasActiveFilters = (state: FilterState) =>
  state.enabledNodeTypes.size < ALL_NODE_TYPES.length ||
  state.enabledEdgeTypes.size < ALL_EDGE_TYPES.length ||
  state.enabledSessionIds.size < state.allSessionIds.length ||
  state.enabledAgentIds.size < state.allAgentIds.length ||
  state.timeRange.start !== null ||
  state.timeRange.end !== null ||
  state.searchQuery !== null ||
  state.minAccessCount > 0;

export default useFilterStore;
