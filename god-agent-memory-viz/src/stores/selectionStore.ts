/**
 * Selection Store (Re-exports from graphStore)
 *
 * Selection functionality is integrated into graphStore for better
 * coordination between selection and graph state. This file provides
 * convenience re-exports.
 *
 * @module stores/selectionStore
 */

export {
  type SelectionState,
  selectSelection,
  selectSelectedNodes,
  selectSelectedEdges,
} from './graphStore';

// Re-export selection-related actions from graphStore for convenience
export const selectionActions = {
  selectNode: 'useGraphStore.getState().selectNode',
  selectNodes: 'useGraphStore.getState().selectNodes',
  selectEdge: 'useGraphStore.getState().selectEdge',
  selectEdges: 'useGraphStore.getState().selectEdges',
  deselectNode: 'useGraphStore.getState().deselectNode',
  deselectEdge: 'useGraphStore.getState().deselectEdge',
  clearSelection: 'useGraphStore.getState().clearSelection',
  selectAll: 'useGraphStore.getState().selectAll',
  setHoveredNode: 'useGraphStore.getState().setHoveredNode',
  setHoveredEdge: 'useGraphStore.getState().setHoveredEdge',
  setFocusedNode: 'useGraphStore.getState().setFocusedNode',
} as const;
