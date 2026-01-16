/**
 * useNodeInteraction Hook
 *
 * React hook for managing node interactions including selection,
 * hover states, focus, and keyboard navigation.
 *
 * @module hooks/useNodeInteraction
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GraphNode, Position } from '@/types/graph';
import { CytoscapeManager } from '@/services/graph/CytoscapeManager';
import type { NodeEventPayload, EdgeEventPayload } from '@/services/graph/CytoscapeManager';
import { useGraphStore } from '@/stores/graphStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useNodeInteraction hook
 */
export interface UseNodeInteractionOptions {
  /** CytoscapeManager instance */
  manager: CytoscapeManager | null;
  /** Whether multi-select is enabled */
  multiSelect?: boolean;
  /** Whether to show hover tooltips */
  showTooltip?: boolean;
  /** Tooltip delay in ms */
  tooltipDelay?: number;
  /** Whether keyboard navigation is enabled */
  keyboardNavigation?: boolean;
  /** Callback when a node is selected */
  onSelect?: (nodeId: string, node: GraphNode | null) => void;
  /** Callback when selection changes */
  onSelectionChange?: (nodeIds: string[]) => void;
  /** Callback when a node is double-clicked */
  onDoubleClick?: (nodeId: string, node: GraphNode | null) => void;
  /** Callback when hover starts */
  onHoverStart?: (nodeId: string, position: Position) => void;
  /** Callback when hover ends */
  onHoverEnd?: () => void;
  /** Callback when a node is focused */
  onFocus?: (nodeId: string) => void;
}

/**
 * Tooltip state
 */
export interface TooltipState {
  visible: boolean;
  nodeId: string | null;
  position: Position;
  content: GraphNode | null;
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  visible: boolean;
  nodeId: string | null;
  position: Position;
}

/**
 * Return type of useNodeInteraction hook
 */
export interface UseNodeInteractionReturn {
  /** Currently selected node IDs */
  selectedNodeIds: string[];
  /** Currently selected nodes */
  selectedNodes: GraphNode[];
  /** Currently hovered node ID */
  hoveredNodeId: string | null;
  /** Currently focused node ID (keyboard navigation) */
  focusedNodeId: string | null;
  /** Tooltip state */
  tooltip: TooltipState;
  /** Context menu state */
  contextMenu: ContextMenuState;
  /** Select a node */
  selectNode: (nodeId: string, additive?: boolean) => void;
  /** Select multiple nodes */
  selectNodes: (nodeIds: string[], replace?: boolean) => void;
  /** Deselect a node */
  deselectNode: (nodeId: string) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select all nodes */
  selectAll: () => void;
  /** Select neighbors of a node */
  selectNeighbors: (nodeId: string) => void;
  /** Invert selection */
  invertSelection: () => void;
  /** Set hovered node */
  setHovered: (nodeId: string | null) => void;
  /** Set focused node (keyboard navigation) */
  setFocused: (nodeId: string | null) => void;
  /** Move focus to next node */
  focusNext: () => void;
  /** Move focus to previous node */
  focusPrevious: () => void;
  /** Select the focused node */
  selectFocused: () => void;
  /** Show context menu */
  showContextMenu: (nodeId: string, position: Position) => void;
  /** Hide context menu */
  hideContextMenu: () => void;
  /** Hide tooltip */
  hideTooltip: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for managing node interactions
 */
export function useNodeInteraction(
  options: UseNodeInteractionOptions
): UseNodeInteractionReturn {
  const {
    manager,
    multiSelect = true,
    showTooltip = true,
    tooltipDelay = 500,
    keyboardNavigation = true,
    onSelect,
    onSelectionChange,
    onDoubleClick,
    onHoverStart,
    onHoverEnd,
    onFocus,
  } = options;

  // Store state
  const {
    nodes,
    selection,
    selectNode: storeSelectNode,
    selectNodes: storeSelectNodes,
    deselectNode: storeDeselectNode,
    clearSelection: storeClearSelection,
    selectAll: storeSelectAll,
    setHoveredNode: storeSetHoveredNode,
    setFocusedNode: storeSetFocusedNode,
  } = useGraphStore();

  // Local state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<GraphNode[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    nodeId: null,
    position: { x: 0, y: 0 },
    content: null,
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    nodeId: null,
    position: { x: 0, y: 0 },
  });

  // Refs
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeIndexRef = useRef<number>(-1);

  // Sync with store
  useEffect(() => {
    const ids = Array.from(selection.selectedNodeIds);
    setSelectedNodeIds(ids);
    const selectedNodeData = nodes.filter((n) => selection.selectedNodeIds.has(n.id));
    setSelectedNodes(selectedNodeData);
  }, [selection.selectedNodeIds, nodes]);

  useEffect(() => {
    setHoveredNodeId(selection.hoveredNodeId);
  }, [selection.hoveredNodeId]);

  useEffect(() => {
    setFocusedNodeId(selection.focusedNodeId);
  }, [selection.focusedNodeId]);

  // Select a node
  const selectNode = useCallback(
    (nodeId: string, additive = false) => {
      const shouldAdd = multiSelect && additive;
      storeSelectNode(nodeId, shouldAdd);
      manager?.selectNodes([nodeId], shouldAdd);

      const node = nodes.find((n) => n.id === nodeId) ?? null;
      onSelect?.(nodeId, node);

      const newSelection = shouldAdd
        ? [...selectedNodeIds, nodeId]
        : [nodeId];
      onSelectionChange?.(newSelection);
    },
    [multiSelect, storeSelectNode, manager, nodes, onSelect, onSelectionChange, selectedNodeIds]
  );

  // Select multiple nodes
  const selectNodes = useCallback(
    (nodeIds: string[], replace = true) => {
      storeSelectNodes(nodeIds, replace);
      manager?.selectNodes(nodeIds, !replace);
      onSelectionChange?.(nodeIds);
    },
    [storeSelectNodes, manager, onSelectionChange]
  );

  // Deselect a node
  const deselectNode = useCallback(
    (nodeId: string) => {
      storeDeselectNode(nodeId);
      manager?.deselectNodes([nodeId]);
      const newSelection = selectedNodeIds.filter((id) => id !== nodeId);
      onSelectionChange?.(newSelection);
    },
    [storeDeselectNode, manager, selectedNodeIds, onSelectionChange]
  );

  // Clear all selections
  const clearSelection = useCallback(() => {
    storeClearSelection();
    manager?.clearSelection();
    onSelectionChange?.([]);
  }, [storeClearSelection, manager, onSelectionChange]);

  // Select all nodes
  const selectAll = useCallback(() => {
    storeSelectAll();
    manager?.selectAll();
    const allIds = nodes.map((n) => n.id);
    onSelectionChange?.(allIds);
  }, [storeSelectAll, manager, nodes, onSelectionChange]);

  // Select neighbors of a node
  const selectNeighbors = useCallback(
    (nodeId: string) => {
      if (!manager) return;
      const neighbors = manager.getNeighbors(nodeId);
      selectNodes([nodeId, ...neighbors], true);
    },
    [manager, selectNodes]
  );

  // Invert selection
  const invertSelection = useCallback(() => {
    const currentSet = new Set(selectedNodeIds);
    const invertedIds = nodes
      .filter((n) => !currentSet.has(n.id))
      .map((n) => n.id);
    selectNodes(invertedIds, true);
  }, [nodes, selectedNodeIds, selectNodes]);

  // Set hovered node
  const setHovered = useCallback(
    (nodeId: string | null) => {
      // Clear any pending tooltip
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }

      storeSetHoveredNode(nodeId);

      if (nodeId === null) {
        setTooltip((prev) => ({ ...prev, visible: false }));
        onHoverEnd?.();
      }
    },
    [storeSetHoveredNode, onHoverEnd]
  );

  // Set focused node (keyboard navigation)
  const setFocused = useCallback(
    (nodeId: string | null) => {
      storeSetFocusedNode(nodeId);
      if (nodeId) {
        nodeIndexRef.current = nodes.findIndex((n) => n.id === nodeId);
        onFocus?.(nodeId);

        // Center on focused node
        manager?.centerOnNodes([nodeId]);
      }
    },
    [storeSetFocusedNode, nodes, onFocus, manager]
  );

  // Focus next node
  const focusNext = useCallback(() => {
    if (nodes.length === 0) return;

    let nextIndex = nodeIndexRef.current + 1;
    if (nextIndex >= nodes.length) {
      nextIndex = 0;
    }

    const nextNode = nodes[nextIndex];
    if (nextNode) {
      setFocused(nextNode.id);
    }
  }, [nodes, setFocused]);

  // Focus previous node
  const focusPrevious = useCallback(() => {
    if (nodes.length === 0) return;

    let prevIndex = nodeIndexRef.current - 1;
    if (prevIndex < 0) {
      prevIndex = nodes.length - 1;
    }

    const prevNode = nodes[prevIndex];
    if (prevNode) {
      setFocused(prevNode.id);
    }
  }, [nodes, setFocused]);

  // Select the focused node
  const selectFocused = useCallback(() => {
    if (focusedNodeId) {
      selectNode(focusedNodeId);
    }
  }, [focusedNodeId, selectNode]);

  // Show context menu
  const showContextMenu = useCallback((nodeId: string, position: Position) => {
    setContextMenu({
      visible: true,
      nodeId,
      position,
    });
  }, []);

  // Hide context menu
  const hideContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!manager) return;

    const unsubscribers: Array<() => void> = [];

    // Node click
    unsubscribers.push(
      manager.on<NodeEventPayload>('node:click', (payload) => {
        selectNode(payload.nodeId);
      })
    );

    // Node double-click
    unsubscribers.push(
      manager.on<NodeEventPayload>('node:dblclick', (payload) => {
        const node = nodes.find((n) => n.id === payload.nodeId) ?? null;
        onDoubleClick?.(payload.nodeId, node);
      })
    );

    // Node hover
    unsubscribers.push(
      manager.on<NodeEventPayload>('node:hover', (payload) => {
        setHovered(payload.nodeId);
        onHoverStart?.(payload.nodeId, payload.position);

        // Show tooltip after delay
        if (showTooltip) {
          tooltipTimeoutRef.current = setTimeout(() => {
            const node = nodes.find((n) => n.id === payload.nodeId) ?? null;
            setTooltip({
              visible: true,
              nodeId: payload.nodeId,
              position: payload.position,
              content: node,
            });
          }, tooltipDelay);
        }
      })
    );

    // Node leave
    unsubscribers.push(
      manager.on<NodeEventPayload>('node:leave', () => {
        setHovered(null);
      })
    );

    // Canvas click (clear selection)
    unsubscribers.push(
      manager.on('canvas:click', () => {
        clearSelection();
        hideContextMenu();
        hideTooltip();
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    manager,
    nodes,
    selectNode,
    setHovered,
    clearSelection,
    hideContextMenu,
    hideTooltip,
    showTooltip,
    tooltipDelay,
    onDoubleClick,
    onHoverStart,
  ]);

  // Keyboard navigation
  useEffect(() => {
    if (!keyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          focusNext();
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          focusPrevious();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          selectFocused();
          break;
        case 'Escape':
          e.preventDefault();
          clearSelection();
          setFocused(null);
          break;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            selectAll();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    keyboardNavigation,
    focusNext,
    focusPrevious,
    selectFocused,
    clearSelection,
    selectAll,
    setFocused,
  ]);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return {
    selectedNodeIds,
    selectedNodes,
    hoveredNodeId,
    focusedNodeId,
    tooltip,
    contextMenu,
    selectNode,
    selectNodes,
    deselectNode,
    clearSelection,
    selectAll,
    selectNeighbors,
    invertSelection,
    setHovered,
    setFocused,
    focusNext,
    focusPrevious,
    selectFocused,
    showContextMenu,
    hideContextMenu,
    hideTooltip,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for simple selection state
 */
export function useSimpleSelection(manager: CytoscapeManager | null) {
  const {
    selectedNodeIds,
    selectNode,
    clearSelection,
    selectAll,
  } = useNodeInteraction({ manager });

  return {
    selectedNodeIds,
    selectNode,
    clearSelection,
    selectAll,
    hasSelection: selectedNodeIds.length > 0,
    selectionCount: selectedNodeIds.length,
  };
}

/**
 * Hook for hover state only
 */
export function useNodeHover(manager: CytoscapeManager | null) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<Position>({ x: 0, y: 0 });

  useEffect(() => {
    if (!manager) return;

    const unsubHover = manager.on<NodeEventPayload>('node:hover', (payload) => {
      setHoveredNodeId(payload.nodeId);
      setHoverPosition(payload.position);
    });

    const unsubLeave = manager.on<NodeEventPayload>('node:leave', () => {
      setHoveredNodeId(null);
    });

    return () => {
      unsubHover();
      unsubLeave();
    };
  }, [manager]);

  return {
    hoveredNodeId,
    hoverPosition,
    isHovering: hoveredNodeId !== null,
  };
}

/**
 * Hook for edge interactions
 */
export function useEdgeInteraction(manager: CytoscapeManager | null) {
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const { selectEdge, deselectEdge, setHoveredEdge } = useGraphStore();

  useEffect(() => {
    if (!manager) return;

    const unsubClick = manager.on<EdgeEventPayload>('edge:click', (payload) => {
      selectEdge(payload.edgeId);
      setSelectedEdgeIds((prev) => [...prev, payload.edgeId]);
    });

    const unsubHover = manager.on<EdgeEventPayload>('edge:hover', (payload) => {
      setHoveredEdgeId(payload.edgeId);
      setHoveredEdge(payload.edgeId);
    });

    const unsubLeave = manager.on<EdgeEventPayload>('edge:leave', () => {
      setHoveredEdgeId(null);
      setHoveredEdge(null);
    });

    return () => {
      unsubClick();
      unsubHover();
      unsubLeave();
    };
  }, [manager, selectEdge, setHoveredEdge]);

  const clearEdgeSelection = useCallback(() => {
    selectedEdgeIds.forEach((id) => deselectEdge(id));
    setSelectedEdgeIds([]);
  }, [selectedEdgeIds, deselectEdge]);

  return {
    selectedEdgeIds,
    hoveredEdgeId,
    clearEdgeSelection,
    hasEdgeSelection: selectedEdgeIds.length > 0,
  };
}
