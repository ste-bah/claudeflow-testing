/**
 * useCytoscape Hook
 *
 * React hook for integrating Cytoscape.js with React components.
 * Handles initialization, cleanup, and syncing with React state.
 *
 * @module hooks/useCytoscape
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Core } from 'cytoscape';
import type { GraphData, LayoutType, Position } from '@/types/graph';
import {
  CytoscapeManager,
  type CytoscapeManagerConfig,
  type CytoscapeEventType,
  type CytoscapeEventListener,
  type NodeEventPayload,
  type EdgeEventPayload,
  type SelectionEventPayload,
  type ViewportEventPayload,
} from '@/services/graph/CytoscapeManager';
import { useGraphStore } from '@/stores/graphStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useCytoscape hook
 */
export interface UseCytoscapeOptions {
  /** Initial graph data */
  data?: GraphData;
  /** Initial layout type */
  layout?: LayoutType;
  /** Whether to use dark mode */
  darkMode?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Whether to sync selection with store */
  syncSelection?: boolean;
  /** Whether to sync viewport with store */
  syncViewport?: boolean;
  /** Callback when a node is clicked */
  onNodeClick?: (payload: NodeEventPayload) => void;
  /** Callback when a node is double-clicked */
  onNodeDoubleClick?: (payload: NodeEventPayload) => void;
  /** Callback when hovering over a node */
  onNodeHover?: (payload: NodeEventPayload) => void;
  /** Callback when leaving a node */
  onNodeLeave?: (payload: NodeEventPayload) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (payload: EdgeEventPayload) => void;
  /** Callback when selection changes */
  onSelectionChange?: (payload: SelectionEventPayload) => void;
  /** Callback when viewport changes */
  onViewportChange?: (payload: ViewportEventPayload) => void;
  /** Callback when graph is ready */
  onReady?: () => void;
}

/**
 * Return type of useCytoscape hook
 */
export interface UseCytoscapeReturn {
  /** Ref to attach to container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** CytoscapeManager instance */
  manager: CytoscapeManager | null;
  /** Cytoscape Core instance */
  cy: Core | null;
  /** Whether the graph is initialized */
  isInitialized: boolean;
  /** Whether a layout is running */
  isLayouting: boolean;
  /** Current zoom level */
  zoom: number;
  /** Current pan position */
  pan: Position;
  /** Load new graph data */
  loadData: (data: GraphData) => Promise<void>;
  /** Run a layout */
  runLayout: (layout: LayoutType) => Promise<void>;
  /** Fit graph to viewport */
  fit: (padding?: number) => void;
  /** Center on specific nodes */
  centerOn: (nodeIds: string[]) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Pan to position */
  panTo: (position: Position) => void;
  /** Select nodes */
  selectNodes: (nodeIds: string[], additive?: boolean) => void;
  /** Select edges */
  selectEdges: (edgeIds: string[], additive?: boolean) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Highlight nodes */
  highlightNodes: (nodeIds: string[], duration?: number) => void;
  /** Dim other elements */
  dimOthers: (nodeIds: string[]) => void;
  /** Undim all elements */
  undimAll: () => void;
  /** Export as PNG */
  exportPNG: () => string | null;
  /** Export as SVG */
  exportSVG: () => string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for Cytoscape.js integration
 */
export function useCytoscape(options: UseCytoscapeOptions = {}): UseCytoscapeReturn {
  const {
    data,
    layout = 'force',
    // darkMode is intentionally unused for now - stylesheet handled externally
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    darkMode: _darkMode = false,
    minZoom = 0.1,
    maxZoom = 3,
    syncSelection = true,
    syncViewport = true,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onNodeLeave,
    onEdgeClick,
    onSelectionChange,
    onViewportChange,
    onReady,
  } = options;

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<CytoscapeManager | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLayouting, setIsLayouting] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [pan, setPanState] = useState<Position>({ x: 0, y: 0 });

  // Store actions
  const {
    selectNode,
    selectNodes: selectNodesStore,
    clearSelection: clearSelectionStore,
    setHoveredNode,
    setViewport: setViewportStore,
    setLayouting: setLayoutingStore,
  } = useGraphStore();

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new CytoscapeManager();
    managerRef.current = manager;

    const config: CytoscapeManagerConfig = {
      container: containerRef.current,
      data,
      layout,
      minZoom,
      maxZoom,
    };

    // Initialize
    manager.init(config).then(() => {
      setIsInitialized(true);
      onReady?.();
    });

    // Cleanup
    return () => {
      // Unsubscribe from all events
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];

      manager.destroy();
      managerRef.current = null;
      setIsInitialized(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup event listeners
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !isInitialized) return;

    const unsubscribers: Array<() => void> = [];

    // Node click
    if (onNodeClick || syncSelection) {
      unsubscribers.push(
        manager.on<NodeEventPayload>('node:click', (payload) => {
          onNodeClick?.(payload);
          if (syncSelection) {
            selectNode(payload.nodeId);
          }
        })
      );
    }

    // Node double-click
    if (onNodeDoubleClick) {
      unsubscribers.push(
        manager.on<NodeEventPayload>('node:dblclick', (payload) => {
          onNodeDoubleClick(payload);
        })
      );
    }

    // Node hover
    if (onNodeHover || syncSelection) {
      unsubscribers.push(
        manager.on<NodeEventPayload>('node:hover', (payload) => {
          onNodeHover?.(payload);
          if (syncSelection) {
            setHoveredNode(payload.nodeId);
          }
        })
      );
    }

    // Node leave
    if (onNodeLeave || syncSelection) {
      unsubscribers.push(
        manager.on<NodeEventPayload>('node:leave', () => {
          onNodeLeave?.({ nodeId: '', position: { x: 0, y: 0 } });
          if (syncSelection) {
            setHoveredNode(null);
          }
        })
      );
    }

    // Edge click
    if (onEdgeClick) {
      unsubscribers.push(
        manager.on<EdgeEventPayload>('edge:click', (payload) => {
          onEdgeClick(payload);
        })
      );
    }

    // Selection change
    if (onSelectionChange || syncSelection) {
      unsubscribers.push(
        manager.on<SelectionEventPayload>('select', (payload) => {
          onSelectionChange?.(payload);
          if (syncSelection) {
            selectNodesStore(payload.nodeIds);
          }
        })
      );
    }

    // Viewport change
    if (onViewportChange || syncViewport) {
      const handleViewport = (payload: ViewportEventPayload) => {
        setZoomState(payload.zoom);
        setPanState(payload.pan);
        onViewportChange?.(payload);
        if (syncViewport) {
          setViewportStore({ zoom: payload.zoom, pan: payload.pan });
        }
      };

      unsubscribers.push(
        manager.on<ViewportEventPayload>('viewport:zoom', handleViewport)
      );
      unsubscribers.push(
        manager.on<ViewportEventPayload>('viewport:pan', handleViewport)
      );
    }

    // Layout events
    unsubscribers.push(
      manager.on('layout:start', () => {
        setIsLayouting(true);
        setLayoutingStore(true);
      })
    );
    unsubscribers.push(
      manager.on('layout:stop', () => {
        setIsLayouting(false);
        setLayoutingStore(false);
      })
    );

    unsubscribersRef.current = unsubscribers;

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    isInitialized,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onNodeLeave,
    onEdgeClick,
    onSelectionChange,
    onViewportChange,
    syncSelection,
    syncViewport,
    selectNode,
    selectNodesStore,
    setHoveredNode,
    setViewportStore,
    setLayoutingStore,
  ]);

  // Update data when it changes
  useEffect(() => {
    if (managerRef.current && isInitialized && data) {
      managerRef.current.loadData(data, true);
    }
  }, [data, isInitialized]);

  // Callbacks
  const loadData = useCallback(async (newData: GraphData) => {
    if (managerRef.current) {
      await managerRef.current.loadData(newData, true);
    }
  }, []);

  const runLayout = useCallback(async (layoutType: LayoutType) => {
    if (managerRef.current) {
      await managerRef.current.runLayout(layoutType);
    }
  }, []);

  const fit = useCallback((padding = 50) => {
    managerRef.current?.fit(padding);
  }, []);

  const centerOn = useCallback((nodeIds: string[]) => {
    managerRef.current?.centerOnNodes(nodeIds);
  }, []);

  const zoomIn = useCallback(() => {
    managerRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    managerRef.current?.zoomOut();
  }, []);

  const setZoom = useCallback((newZoom: number) => {
    managerRef.current?.setZoom(newZoom);
  }, []);

  const panTo = useCallback((position: Position) => {
    managerRef.current?.setPan(position);
  }, []);

  const selectNodes = useCallback((nodeIds: string[], additive = false) => {
    managerRef.current?.selectNodes(nodeIds, additive);
  }, []);

  const selectEdges = useCallback((edgeIds: string[], additive = false) => {
    managerRef.current?.selectEdges(edgeIds, additive);
  }, []);

  const clearSelection = useCallback(() => {
    managerRef.current?.clearSelection();
    clearSelectionStore();
  }, [clearSelectionStore]);

  const highlightNodes = useCallback((nodeIds: string[], duration = 1000) => {
    managerRef.current?.highlightNodes(nodeIds, duration);
  }, []);

  const dimOthers = useCallback((nodeIds: string[]) => {
    managerRef.current?.dimOthers(nodeIds);
  }, []);

  const undimAll = useCallback(() => {
    managerRef.current?.undimAll();
  }, []);

  const exportPNG = useCallback(() => {
    return managerRef.current?.exportPNG() ?? null;
  }, []);

  const exportSVG = useCallback(() => {
    return managerRef.current?.exportSVG() ?? null;
  }, []);

  return {
    containerRef,
    manager: managerRef.current,
    cy: managerRef.current?.getCy() ?? null,
    isInitialized,
    isLayouting,
    zoom,
    pan,
    loadData,
    runLayout,
    fit,
    centerOn,
    zoomIn,
    zoomOut,
    setZoom,
    panTo,
    selectNodes,
    selectEdges,
    clearSelection,
    highlightNodes,
    dimOthers,
    undimAll,
    exportPNG,
    exportSVG,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Subscribe to a specific Cytoscape event
 */
export function useCytoscapeEvent<T>(
  manager: CytoscapeManager | null,
  event: CytoscapeEventType,
  listener: CytoscapeEventListener<T>
): void {
  useEffect(() => {
    if (!manager) return;
    return manager.on(event, listener);
  }, [manager, event, listener]);
}

/**
 * Get current selection from Cytoscape
 */
export function useCytoscapeSelection(manager: CytoscapeManager | null): {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
} {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!manager) return;

    const handleSelect = (payload: SelectionEventPayload) => {
      setSelectedNodeIds(payload.nodeIds);
      setSelectedEdgeIds(payload.edgeIds);
    };

    const handleUnselect = (payload: SelectionEventPayload) => {
      setSelectedNodeIds(payload.nodeIds);
      setSelectedEdgeIds(payload.edgeIds);
    };

    const unsub1 = manager.on<SelectionEventPayload>('select', handleSelect);
    const unsub2 = manager.on<SelectionEventPayload>('unselect', handleUnselect);

    return () => {
      unsub1();
      unsub2();
    };
  }, [manager]);

  return { selectedNodeIds, selectedEdgeIds };
}

/**
 * Get current viewport state from Cytoscape
 */
export function useCytoscapeViewport(manager: CytoscapeManager | null): {
  zoom: number;
  pan: Position;
} {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });

  useEffect(() => {
    if (!manager) return;

    const handleViewport = (payload: ViewportEventPayload) => {
      setZoom(payload.zoom);
      setPan(payload.pan);
    };

    const unsub1 = manager.on<ViewportEventPayload>('viewport:zoom', handleViewport);
    const unsub2 = manager.on<ViewportEventPayload>('viewport:pan', handleViewport);

    return () => {
      unsub1();
      unsub2();
    };
  }, [manager]);

  return { zoom, pan };
}
