/**
 * Graph Store
 *
 * Zustand store for managing graph visualization state including
 * nodes, edges, selection, viewport, and layout configuration.
 *
 * @module stores/graphStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GraphNode, GraphEdge, GraphData, LayoutType, LayoutOptions, ViewportState } from '../types/graph';

// ============================================================================
// Types
// ============================================================================

/**
 * Selection state for graph elements
 */
export interface SelectionState {
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  focusedNodeId: string | null;
}

/**
 * All node types from constitution
 */
const ALL_NODE_TYPES = new Set([
  'trajectory',
  'pattern',
  'episode',
  'feedback',
  'reasoning_step',
  'checkpoint',
  'session',
  'agent',
  'namespace',
]);

/**
 * All edge types from constitution
 */
const ALL_EDGE_TYPES = new Set([
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
]);

interface GraphStore {
  // Graph data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Selection state
  selection: SelectionState;

  // Visibility filters
  visibleNodeTypes: Set<string>;
  visibleEdgeTypes: Set<string>;

  // Loading state
  isLoading: boolean;
  loadingMessage: string | null;
  loadingProgress: number | null;

  // Error state
  error: Error | null;

  // Layout
  currentLayout: LayoutType;
  layoutOptions: LayoutOptions;
  isLayouting: boolean;

  // Viewport
  viewport: ViewportState;

  // Actions - Data
  setGraphData: (data: GraphData) => void;
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  addNode: (node: GraphNode) => void;
  addNodes: (nodes: GraphNode[]) => void;
  addEdge: (edge: GraphEdge) => void;
  addEdges: (edges: GraphEdge[]) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[]) => void;
  removeEdge: (edgeId: string) => void;
  removeEdges: (edgeIds: string[]) => void;
  updateNode: (nodeId: string, updates: Partial<GraphNode>) => void;
  updateEdge: (edgeId: string, updates: Partial<GraphEdge>) => void;
  clearGraph: () => void;

  // Actions - Selection
  selectNode: (nodeId: string, addToSelection?: boolean) => void;
  selectNodes: (nodeIds: string[], replace?: boolean) => void;
  selectEdge: (edgeId: string, addToSelection?: boolean) => void;
  selectEdges: (edgeIds: string[], replace?: boolean) => void;
  deselectNode: (nodeId: string) => void;
  deselectEdge: (edgeId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  setHoveredEdge: (edgeId: string | null) => void;
  setFocusedNode: (nodeId: string | null) => void;

  // Actions - Visibility
  setVisibleNodeTypes: (types: Set<string>) => void;
  setVisibleEdgeTypes: (types: Set<string>) => void;
  toggleNodeTypeVisibility: (type: string) => void;
  toggleEdgeTypeVisibility: (type: string) => void;
  showAllNodeTypes: () => void;
  showAllEdgeTypes: () => void;

  // Actions - Loading
  setLoading: (isLoading: boolean, message?: string) => void;
  setLoadingProgress: (progress: number | null) => void;

  // Actions - Error
  setError: (error: Error | null) => void;
  clearError: () => void;

  // Actions - Layout
  setLayout: (layout: LayoutType) => void;
  setLayoutOptions: (options: Partial<LayoutOptions>) => void;
  setLayouting: (isLayouting: boolean) => void;

  // Actions - Viewport
  setViewport: (viewport: Partial<ViewportState>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetViewport: () => void;
  panTo: (x: number, y: number) => void;

  // Actions - Data refresh
  refreshData: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialSelection: SelectionState = {
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  hoveredNodeId: null,
  hoveredEdgeId: null,
  focusedNodeId: null,
};

const defaultViewport: ViewportState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  minZoom: 0.1,
  maxZoom: 3,
};

const defaultLayoutOptions: LayoutOptions = {
  name: 'cose',
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 50,
  nodeSpacing: 100,
  edgeLength: 150,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useGraphStore = create<GraphStore>()(
  immer((set, get) => ({
    // Initial state - Graph data
    nodes: [],
    edges: [],

    // Initial state - Selection
    selection: initialSelection,

    // Initial state - Visibility
    visibleNodeTypes: new Set(ALL_NODE_TYPES),
    visibleEdgeTypes: new Set(ALL_EDGE_TYPES),

    // Initial state - Loading
    isLoading: false,
    loadingMessage: null,
    loadingProgress: null,

    // Initial state - Error
    error: null,

    // Initial state - Layout
    currentLayout: 'force',
    layoutOptions: defaultLayoutOptions,
    isLayouting: false,

    // Initial state - Viewport
    viewport: defaultViewport,

    // Actions - Data
    setGraphData: (data) => {
      set((draft) => {
        draft.nodes = data.nodes;
        draft.edges = data.edges;
        draft.selection = initialSelection;
      });
    },

    setNodes: (nodes) => {
      set((draft) => {
        draft.nodes = nodes;
      });
    },

    setEdges: (edges) => {
      set((draft) => {
        draft.edges = edges;
      });
    },

    addNode: (node) => {
      set((draft) => {
        draft.nodes.push(node);
      });
    },

    addNodes: (nodes) => {
      set((draft) => {
        draft.nodes.push(...nodes);
      });
    },

    addEdge: (edge) => {
      set((draft) => {
        draft.edges.push(edge);
      });
    },

    addEdges: (edges) => {
      set((draft) => {
        draft.edges.push(...edges);
      });
    },

    removeNode: (nodeId) => {
      set((draft) => {
        draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
        draft.edges = draft.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        );
        draft.selection.selectedNodeIds.delete(nodeId);
      });
    },

    removeNodes: (nodeIds) => {
      set((draft) => {
        const idsToRemove = new Set(nodeIds);
        draft.nodes = draft.nodes.filter((n) => !idsToRemove.has(n.id));
        draft.edges = draft.edges.filter(
          (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)
        );
        for (const id of nodeIds) {
          draft.selection.selectedNodeIds.delete(id);
        }
      });
    },

    removeEdge: (edgeId) => {
      set((draft) => {
        draft.edges = draft.edges.filter((e) => e.id !== edgeId);
        draft.selection.selectedEdgeIds.delete(edgeId);
      });
    },

    removeEdges: (edgeIds) => {
      set((draft) => {
        const idsToRemove = new Set(edgeIds);
        draft.edges = draft.edges.filter((e) => !idsToRemove.has(e.id));
        for (const id of edgeIds) {
          draft.selection.selectedEdgeIds.delete(id);
        }
      });
    },

    updateNode: (nodeId, updates) => {
      set((draft) => {
        const node = draft.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      });
    },

    updateEdge: (edgeId, updates) => {
      set((draft) => {
        const edge = draft.edges.find((e) => e.id === edgeId);
        if (edge) {
          Object.assign(edge, updates);
        }
      });
    },

    clearGraph: () => {
      set((draft) => {
        draft.nodes = [];
        draft.edges = [];
        draft.selection = initialSelection;
      });
    },

    // Actions - Selection
    selectNode: (nodeId, addToSelection = false) => {
      set((draft) => {
        if (!addToSelection) {
          draft.selection.selectedNodeIds.clear();
          draft.selection.selectedEdgeIds.clear();
        }
        draft.selection.selectedNodeIds.add(nodeId);
      });
    },

    selectNodes: (nodeIds, replace = true) => {
      set((draft) => {
        if (replace) {
          draft.selection.selectedNodeIds = new Set(nodeIds);
          draft.selection.selectedEdgeIds.clear();
        } else {
          for (const id of nodeIds) {
            draft.selection.selectedNodeIds.add(id);
          }
        }
      });
    },

    selectEdge: (edgeId, addToSelection = false) => {
      set((draft) => {
        if (!addToSelection) {
          draft.selection.selectedNodeIds.clear();
          draft.selection.selectedEdgeIds.clear();
        }
        draft.selection.selectedEdgeIds.add(edgeId);
      });
    },

    selectEdges: (edgeIds, replace = true) => {
      set((draft) => {
        if (replace) {
          draft.selection.selectedEdgeIds = new Set(edgeIds);
          draft.selection.selectedNodeIds.clear();
        } else {
          for (const id of edgeIds) {
            draft.selection.selectedEdgeIds.add(id);
          }
        }
      });
    },

    deselectNode: (nodeId) => {
      set((draft) => {
        draft.selection.selectedNodeIds.delete(nodeId);
      });
    },

    deselectEdge: (edgeId) => {
      set((draft) => {
        draft.selection.selectedEdgeIds.delete(edgeId);
      });
    },

    clearSelection: () => {
      set((draft) => {
        draft.selection.selectedNodeIds.clear();
        draft.selection.selectedEdgeIds.clear();
        draft.selection.focusedNodeId = null;
      });
    },

    selectAll: () => {
      set((draft) => {
        draft.selection.selectedNodeIds = new Set(draft.nodes.map((n) => n.id));
        draft.selection.selectedEdgeIds = new Set(draft.edges.map((e) => e.id));
      });
    },

    setHoveredNode: (nodeId) => {
      set((draft) => {
        draft.selection.hoveredNodeId = nodeId;
      });
    },

    setHoveredEdge: (edgeId) => {
      set((draft) => {
        draft.selection.hoveredEdgeId = edgeId;
      });
    },

    setFocusedNode: (nodeId) => {
      set((draft) => {
        draft.selection.focusedNodeId = nodeId;
      });
    },

    // Actions - Visibility
    setVisibleNodeTypes: (types) => {
      set((draft) => {
        draft.visibleNodeTypes = types;
      });
    },

    setVisibleEdgeTypes: (types) => {
      set((draft) => {
        draft.visibleEdgeTypes = types;
      });
    },

    toggleNodeTypeVisibility: (type) => {
      set((draft) => {
        if (draft.visibleNodeTypes.has(type)) {
          draft.visibleNodeTypes.delete(type);
        } else {
          draft.visibleNodeTypes.add(type);
        }
      });
    },

    toggleEdgeTypeVisibility: (type) => {
      set((draft) => {
        if (draft.visibleEdgeTypes.has(type)) {
          draft.visibleEdgeTypes.delete(type);
        } else {
          draft.visibleEdgeTypes.add(type);
        }
      });
    },

    showAllNodeTypes: () => {
      set((draft) => {
        draft.visibleNodeTypes = new Set(ALL_NODE_TYPES);
      });
    },

    showAllEdgeTypes: () => {
      set((draft) => {
        draft.visibleEdgeTypes = new Set(ALL_EDGE_TYPES);
      });
    },

    // Actions - Loading
    setLoading: (isLoading, message) => {
      set((draft) => {
        draft.isLoading = isLoading;
        draft.loadingMessage = message || null;
        draft.loadingProgress = isLoading ? 0 : null;
      });
    },

    setLoadingProgress: (progress) => {
      set((draft) => {
        draft.loadingProgress = progress;
      });
    },

    // Actions - Error
    setError: (error) => {
      set((draft) => {
        draft.error = error;
        draft.isLoading = false;
      });
    },

    clearError: () => {
      set((draft) => {
        draft.error = null;
      });
    },

    // Actions - Layout
    setLayout: (layout) => {
      set((draft) => {
        draft.currentLayout = layout;
      });
    },

    setLayoutOptions: (options) => {
      set((draft) => {
        Object.assign(draft.layoutOptions, options);
      });
    },

    setLayouting: (isLayouting) => {
      set((draft) => {
        draft.isLayouting = isLayouting;
      });
    },

    // Actions - Viewport
    setViewport: (viewport) => {
      set((draft) => {
        Object.assign(draft.viewport, viewport);
      });
    },

    zoomIn: () => {
      set((draft) => {
        const newZoom = Math.min(draft.viewport.zoom * 1.2, draft.viewport.maxZoom);
        draft.viewport.zoom = newZoom;
      });
    },

    zoomOut: () => {
      set((draft) => {
        const newZoom = Math.max(draft.viewport.zoom / 1.2, draft.viewport.minZoom);
        draft.viewport.zoom = newZoom;
      });
    },

    zoomToFit: () => {
      set((draft) => {
        // Placeholder - actual implementation requires Cytoscape instance
        draft.viewport.zoom = 1;
        draft.viewport.pan = { x: 0, y: 0 };
      });
    },

    resetViewport: () => {
      set((draft) => {
        draft.viewport = defaultViewport;
      });
    },

    panTo: (x, y) => {
      set((draft) => {
        draft.viewport.pan = { x, y };
      });
    },

    // Actions - Data refresh
    refreshData: () => {
      const { isLoading } = get();
      if (isLoading) return;

      set((draft) => {
        draft.isLoading = true;
        draft.loadingMessage = 'Refreshing data...';
      });

      // This will be connected to actual data fetching
      setTimeout(() => {
        set((draft) => {
          draft.isLoading = false;
          draft.loadingMessage = null;
          draft.loadingProgress = null;
        });
      }, 500);
    },
  }))
);

// ============================================================================
// Selectors (for optimization)
// ============================================================================

export const selectNodes = (state: GraphStore) => state.nodes;
export const selectEdges = (state: GraphStore) => state.edges;
export const selectIsLoading = (state: GraphStore) => state.isLoading;
export const selectCurrentLayout = (state: GraphStore) => state.currentLayout;
export const selectZoom = (state: GraphStore) => state.viewport.zoom;
export const selectViewport = (state: GraphStore) => state.viewport;
export const selectSelection = (state: GraphStore) => state.selection;

export const selectNodeById = (state: GraphStore, nodeId: string) =>
  state.nodes.find((n) => n.id === nodeId);

export const selectEdgeById = (state: GraphStore, edgeId: string) =>
  state.edges.find((e) => e.id === edgeId);

export const selectSelectedNodes = (state: GraphStore) =>
  state.nodes.filter((n) => state.selection.selectedNodeIds.has(n.id));

export const selectSelectedEdges = (state: GraphStore) =>
  state.edges.filter((e) => state.selection.selectedEdgeIds.has(e.id));

export const selectVisibleNodes = (state: GraphStore) =>
  state.nodes.filter((n) => state.visibleNodeTypes.has(n.type));

export const selectVisibleEdges = (state: GraphStore) => {
  // Pre-build node lookup map for O(1) lookups instead of O(n) find() calls
  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
  return state.edges.filter((e) => {
    if (!state.visibleEdgeTypes.has(e.type)) return false;
    const sourceNode = nodeMap.get(e.source);
    const targetNode = nodeMap.get(e.target);
    if (!sourceNode || !targetNode) return false;
    return (
      state.visibleNodeTypes.has(sourceNode.type) &&
      state.visibleNodeTypes.has(targetNode.type)
    );
  });
};

export const selectNodesByType = (state: GraphStore, type: string) =>
  state.nodes.filter((n) => n.type === type);

export const selectEdgesByType = (state: GraphStore, type: string) =>
  state.edges.filter((e) => e.type === type);

export const selectConnectedEdges = (state: GraphStore, nodeId: string) =>
  state.edges.filter((e) => e.source === nodeId || e.target === nodeId);

export const selectNeighborNodes = (state: GraphStore, nodeId: string) => {
  const connectedEdges = selectConnectedEdges(state, nodeId);
  const neighborIds = new Set<string>();
  for (const edge of connectedEdges) {
    if (edge.source === nodeId) neighborIds.add(edge.target);
    if (edge.target === nodeId) neighborIds.add(edge.source);
  }
  return state.nodes.filter((n) => neighborIds.has(n.id));
};

export const selectGraphStats = (state: GraphStore) => ({
  nodeCount: state.nodes.length,
  edgeCount: state.edges.length,
  selectedNodeCount: state.selection.selectedNodeIds.size,
  selectedEdgeCount: state.selection.selectedEdgeIds.size,
  visibleNodeCount: selectVisibleNodes(state).length,
  visibleEdgeCount: selectVisibleEdges(state).length,
});

export default useGraphStore;
