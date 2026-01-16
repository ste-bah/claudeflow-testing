/**
 * GraphCanvas Component
 *
 * Core visualization canvas using Cytoscape.js for rendering the
 * God Agent memory graph. Manages Cytoscape instance lifecycle,
 * syncs with graphStore, and handles user interactions.
 *
 * @module components/graph/GraphCanvas
 */

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
  useMemo,
} from 'react';
import {
  cytoscapeManager,
  type NodeEventPayload,
  type EdgeEventPayload,
  type ViewportEventPayload,
  type SelectionEventPayload,
} from '@/services/graph/CytoscapeManager';
import { getDefaultStylesheet, getDarkModeStylesheet } from '@/services/graph/styles';
import { useGraphStore } from '@/stores/graphStore';
import type { ViewportState, LayoutType, GraphData } from '@/types/graph';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the GraphCanvas component
 */
export interface GraphCanvasProps {
  /** Additional CSS class names */
  className?: string;
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Callback when a node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeId: string) => void;
  /** Callback when the background canvas is clicked */
  onBackgroundClick?: () => void;
  /** Callback when viewport changes (zoom/pan) */
  onViewportChange?: (viewport: ViewportState) => void;
  /** Whether to use dark mode styles */
  darkMode?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Initial zoom level */
  initialZoom?: number;
  /** Whether to animate layout transitions */
  animateLayout?: boolean;
  /** Layout animation duration in ms */
  animationDuration?: number;
}

/**
 * Ref handle exposed by GraphCanvas for external control
 */
export interface GraphCanvasHandle {
  /** Fit all elements in viewport */
  fit: (padding?: number) => void;
  /** Center on specific node(s) */
  centerOnNodes: (nodeIds: string[], zoom?: number) => void;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Get current zoom level */
  getZoom: () => number;
  /** Run layout algorithm */
  runLayout: (layoutType: LayoutType) => Promise<void>;
  /** Export graph as PNG */
  exportPNG: (options?: { scale?: number; bg?: string }) => string | null;
  /** Export graph as JSON */
  exportJSON: () => object | null;
  /** Highlight specific nodes */
  highlightNodes: (nodeIds: string[], duration?: number) => void;
  /** Clear all highlights */
  clearHighlights: () => void;
  /** Get the CytoscapeManager instance */
  getManager: () => typeof cytoscapeManager;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * GraphCanvas - Core graph visualization component
 *
 * Uses Cytoscape.js to render the memory graph visualization.
 * Integrates with graphStore for state management and provides
 * a clean API for external control via ref.
 */
export const GraphCanvas = memo(
  forwardRef<GraphCanvasHandle, GraphCanvasProps>(
    (
      {
        className,
        onNodeClick,
        onNodeDoubleClick,
        onEdgeClick,
        onBackgroundClick,
        onViewportChange,
        darkMode = false,
        minZoom = 0.1,
        maxZoom = 3,
        initialZoom = 1,
        animateLayout = true,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        animationDuration: _animationDuration = 500,
      },
      ref
    ) => {
      // Container ref for Cytoscape mounting
      const containerRef = useRef<HTMLDivElement>(null);
      // Track initialization state
      const isInitializedRef = useRef(false);
      // Track if we're in the middle of syncing to prevent loops
      const isSyncingRef = useRef(false);

      // Store selectors - use raw data and memoize filtering to avoid infinite loops
      const allNodes = useGraphStore((state) => state.nodes);
      const allEdges = useGraphStore((state) => state.edges);
      const visibleNodeTypes = useGraphStore((state) => state.visibleNodeTypes);
      const visibleEdgeTypes = useGraphStore((state) => state.visibleEdgeTypes);
      const currentLayout = useGraphStore((state) => state.currentLayout);
      const selection = useGraphStore((state) => state.selection);
      const viewport = useGraphStore((state) => state.viewport);

      // Memoize filtered nodes/edges to prevent infinite render loops
      const nodes = useMemo(
        () => allNodes.filter((n) => visibleNodeTypes.has(n.type)),
        [allNodes, visibleNodeTypes]
      );

      const edges = useMemo(() => {
        const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
        return allEdges.filter((e) => {
          if (!visibleEdgeTypes.has(e.type)) return false;
          const sourceNode = nodeMap.get(e.source);
          const targetNode = nodeMap.get(e.target);
          if (!sourceNode || !targetNode) return false;
          return visibleNodeTypes.has(sourceNode.type) && visibleNodeTypes.has(targetNode.type);
        });
      }, [allNodes, allEdges, visibleNodeTypes, visibleEdgeTypes]);

      // Store actions
      const selectNode = useGraphStore((state) => state.selectNode);
      const selectEdge = useGraphStore((state) => state.selectEdge);
      const clearSelection = useGraphStore((state) => state.clearSelection);
      const setHoveredNode = useGraphStore((state) => state.setHoveredNode);
      const setHoveredEdge = useGraphStore((state) => state.setHoveredEdge);
      const setViewport = useGraphStore((state) => state.setViewport);
      const setLayouting = useGraphStore((state) => state.setLayouting);

      // ========================================================================
      // Event Handlers
      // ========================================================================

      /**
       * Handle node click events
       */
      const handleNodeClick = useCallback(
        (payload: NodeEventPayload) => {
          const isMultiSelect = payload.originalEvent?.shiftKey || payload.originalEvent?.metaKey;
          selectNode(payload.nodeId, isMultiSelect);
          onNodeClick?.(payload.nodeId);
        },
        [selectNode, onNodeClick]
      );

      /**
       * Handle node double-click events
       */
      const handleNodeDoubleClick = useCallback(
        (payload: NodeEventPayload) => {
          onNodeDoubleClick?.(payload.nodeId);
        },
        [onNodeDoubleClick]
      );

      /**
       * Handle edge click events
       */
      const handleEdgeClick = useCallback(
        (payload: EdgeEventPayload) => {
          selectEdge(payload.edgeId);
          onEdgeClick?.(payload.edgeId);
        },
        [selectEdge, onEdgeClick]
      );

      /**
       * Handle background click events
       */
      const handleBackgroundClick = useCallback(() => {
        clearSelection();
        onBackgroundClick?.();
      }, [clearSelection, onBackgroundClick]);

      /**
       * Handle node hover events
       */
      const handleNodeHover = useCallback(
        (payload: NodeEventPayload) => {
          setHoveredNode(payload.nodeId);
        },
        [setHoveredNode]
      );

      /**
       * Handle node leave events
       */
      const handleNodeLeave = useCallback(() => {
        setHoveredNode(null);
      }, [setHoveredNode]);

      /**
       * Handle edge hover events
       */
      const handleEdgeHover = useCallback(
        (payload: EdgeEventPayload) => {
          setHoveredEdge(payload.edgeId);
        },
        [setHoveredEdge]
      );

      /**
       * Handle edge leave events
       */
      const handleEdgeLeave = useCallback(() => {
        setHoveredEdge(null);
      }, [setHoveredEdge]);

      /**
       * Handle viewport changes (zoom/pan)
       */
      const handleViewportChange = useCallback(
        (payload: ViewportEventPayload) => {
          if (isSyncingRef.current) return;

          const newViewport: Partial<ViewportState> = {
            zoom: payload.zoom,
            pan: payload.pan,
          };

          setViewport(newViewport);
          onViewportChange?.({
            ...viewport,
            ...newViewport,
          });
        },
        [setViewport, onViewportChange, viewport]
      );

      /**
       * Handle selection sync from Cytoscape
       */
      const handleSelectionChange = useCallback(
        (payload: SelectionEventPayload) => {
          if (isSyncingRef.current) return;

          // Sync selection state back to store if needed
          // This handles box selection and other Cytoscape-initiated selections
          if (payload.nodeIds.length > 0) {
            isSyncingRef.current = true;
            // Note: The store will be updated via selectNodes
            // For now we just let the click handlers manage selection
            isSyncingRef.current = false;
          }
        },
        []
      );

      /**
       * Handle layout start
       */
      const handleLayoutStart = useCallback(() => {
        setLayouting(true);
      }, [setLayouting]);

      /**
       * Handle layout stop
       */
      const handleLayoutStop = useCallback(() => {
        setLayouting(false);
      }, [setLayouting]);

      // ========================================================================
      // Initialization
      // ========================================================================

      /**
       * Initialize Cytoscape instance
       */
      useEffect(() => {
        if (!containerRef.current || isInitializedRef.current) return;

        const initCytoscape = async () => {
          try {
            const graphData: GraphData = { nodes, edges };
            const stylesheet = darkMode ? getDarkModeStylesheet() : getDefaultStylesheet();

            await cytoscapeManager.init({
              container: containerRef.current!,
              data: graphData,
              style: stylesheet,
              layout: currentLayout,
              minZoom,
              maxZoom,
              zoom: initialZoom,
              boxSelectionEnabled: true,
              selectionType: 'single',
            });

            // Register event listeners
            cytoscapeManager.on<NodeEventPayload>('node:click', handleNodeClick);
            cytoscapeManager.on<NodeEventPayload>('node:dblclick', handleNodeDoubleClick);
            cytoscapeManager.on<EdgeEventPayload>('edge:click', handleEdgeClick);
            cytoscapeManager.on('canvas:click', handleBackgroundClick);
            cytoscapeManager.on<NodeEventPayload>('node:hover', handleNodeHover);
            cytoscapeManager.on<NodeEventPayload>('node:leave', handleNodeLeave);
            cytoscapeManager.on<EdgeEventPayload>('edge:hover', handleEdgeHover);
            cytoscapeManager.on<EdgeEventPayload>('edge:leave', handleEdgeLeave);
            cytoscapeManager.on<ViewportEventPayload>('viewport:pan', handleViewportChange);
            cytoscapeManager.on<ViewportEventPayload>('viewport:zoom', handleViewportChange);
            cytoscapeManager.on<SelectionEventPayload>('select', handleSelectionChange);
            cytoscapeManager.on('layout:start', handleLayoutStart);
            cytoscapeManager.on('layout:stop', handleLayoutStop);

            isInitializedRef.current = true;
          } catch (error) {
            console.error('Failed to initialize Cytoscape:', error);
          }
        };

        initCytoscape();

        // Cleanup on unmount
        return () => {
          if (cytoscapeManager.isInitialized()) {
            cytoscapeManager.destroy();
          }
          isInitializedRef.current = false;
        };
        // Only run on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // ========================================================================
      // Sync Effects
      // ========================================================================

      /**
       * Sync nodes and edges changes to Cytoscape with debouncing to prevent race conditions
       */
      useEffect(() => {
        if (!isInitializedRef.current || !cytoscapeManager.isInitialized()) return;

        // Debounce data sync to prevent race conditions when rapid updates occur
        const timeoutId = setTimeout(() => {
          const syncData = async () => {
            isSyncingRef.current = true;
            try {
              await cytoscapeManager.loadData({ nodes, edges }, animateLayout);
            } catch (error) {
              console.error('Failed to sync graph data:', error);
            } finally {
              isSyncingRef.current = false;
            }
          };

          syncData();
        }, 100);

        return () => clearTimeout(timeoutId);
      }, [nodes, edges, animateLayout]);

      /**
       * Sync layout changes to Cytoscape with error recovery
       */
      useEffect(() => {
        if (!isInitializedRef.current || !cytoscapeManager.isInitialized()) return;

        const runLayout = async () => {
          try {
            await cytoscapeManager.runLayout(currentLayout);
          } catch (error) {
            console.error('Failed to run layout:', error);
            // Attempt recovery by fitting to viewport
            try {
              cytoscapeManager.fit();
            } catch (recoveryError) {
              console.error('Layout recovery failed:', recoveryError);
            }
          }
        };

        runLayout();
      }, [currentLayout]);

      /**
       * Sync selection changes to Cytoscape with error handling
       */
      useEffect(() => {
        if (!isInitializedRef.current || !cytoscapeManager.isInitialized()) return;
        if (isSyncingRef.current) return;

        isSyncingRef.current = true;

        try {
          // Clear current Cytoscape selection
          cytoscapeManager.clearSelection();

          // Select nodes in Cytoscape
          const selectedNodeIds = Array.from(selection.selectedNodeIds);
          if (selectedNodeIds.length > 0) {
            cytoscapeManager.selectNodes(selectedNodeIds);
          }

          // Select edges in Cytoscape
          const selectedEdgeIds = Array.from(selection.selectedEdgeIds);
          if (selectedEdgeIds.length > 0) {
            cytoscapeManager.selectEdges(selectedEdgeIds, true);
          }
        } catch (error) {
          console.error('Failed to sync selection to Cytoscape:', error);
        } finally {
          isSyncingRef.current = false;
        }
      }, [selection.selectedNodeIds, selection.selectedEdgeIds]);

      /**
       * Sync dark mode stylesheet changes
       */
      useEffect(() => {
        if (!isInitializedRef.current || !cytoscapeManager.isInitialized()) return;

        const stylesheet = darkMode ? getDarkModeStylesheet() : getDefaultStylesheet();
        cytoscapeManager.setStylesheet(stylesheet);
      }, [darkMode]);

      /**
       * Handle container resize
       */
      useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
          if (cytoscapeManager.isInitialized()) {
            cytoscapeManager.fit();
          }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }, []);

      // ========================================================================
      // Imperative Handle (Ref API)
      // ========================================================================

      useImperativeHandle(
        ref,
        () => ({
          fit: (padding?: number) => {
            if (cytoscapeManager.isInitialized()) {
              cytoscapeManager.fit(padding);
            }
          },

          centerOnNodes: (nodeIds: string[], zoom?: number) => {
            if (cytoscapeManager.isInitialized()) {
              cytoscapeManager.centerOnNodes(nodeIds, zoom);
            }
          },

          setZoom: (zoom: number) => {
            if (cytoscapeManager.isInitialized()) {
              cytoscapeManager.setZoom(zoom);
            }
          },

          getZoom: () => {
            return cytoscapeManager.getZoom();
          },

          runLayout: async (layoutType: LayoutType) => {
            if (cytoscapeManager.isInitialized()) {
              await cytoscapeManager.runLayout(layoutType);
            }
          },

          exportPNG: (options?: { scale?: number; bg?: string }) => {
            return cytoscapeManager.exportPNG(options);
          },

          exportJSON: () => {
            return cytoscapeManager.exportJSON();
          },

          highlightNodes: (nodeIds: string[], duration?: number) => {
            if (cytoscapeManager.isInitialized()) {
              cytoscapeManager.highlightNodes(nodeIds, duration);
            }
          },

          clearHighlights: () => {
            if (cytoscapeManager.isInitialized()) {
              cytoscapeManager.undimAll();
            }
          },

          getManager: () => cytoscapeManager,
        }),
        []
      );

      // ========================================================================
      // Render
      // ========================================================================

      return (
        <div
          ref={containerRef}
          className={cn(
            'graph-canvas',
            'relative w-full h-full',
            'bg-gray-50 dark:bg-slate-900',
            'overflow-hidden',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            className
          )}
          tabIndex={0}
          role="img"
          aria-label="Memory graph visualization"
        />
      );
    }
  )
);

GraphCanvas.displayName = 'GraphCanvas';

export default GraphCanvas;
