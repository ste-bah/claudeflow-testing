/**
 * App Component - Main Application Entry Point
 *
 * Integrates all components for the God Agent Memory Visualization.
 * Manages routing between views, global state, keyboard shortcuts,
 * and file drop for database loading.
 *
 * @module App
 */

import { useCallback, useEffect, useRef, useMemo, useState, type RefObject } from 'react';
import { Toaster, toast } from 'react-hot-toast';

// Layout components
import { AppLayout } from './components/layout/AppLayout';

// View components
import { Dashboard } from './components/dashboard/Dashboard';
import { GraphCanvas, type GraphCanvasHandle } from './components/graph/GraphCanvas';

// Control components
import { ZoomControls } from './components/graph/controls/ZoomControls';
import { LayoutSelector, type ExtendedLayoutType } from './components/graph/controls/LayoutSelector';
import { FilterPanel } from './components/graph/controls/FilterPanel';

// Panel components
import { DetailsPanel } from './components/panels/DetailsPanel';
import { SearchPanel } from './components/panels/SearchPanel';
import { StatsPanel } from './components/panels/StatsPanel';

// Common components
import { Modal } from './components/common/Modal';
import { FileDropZone } from './components/common/FileDropZone';
import { KeyboardShortcutsHelp } from './components/common/KeyboardShortcutsHelp';
import { ErrorBoundary, SectionErrorFallback } from './components/common/ErrorBoundary';
import { Button } from './components/common/Button';

// Hooks
import {
  useKeyboardShortcuts,
  createDefaultShortcuts,
  type ShortcutDefinition,
} from './hooks/useKeyboardShortcuts';
import { useExport } from './hooks/useExport';

// Stores
import { useUIStore } from './stores/uiStore';
import { useGraphStore } from './stores/graphStore';
import { useDatabaseStore, selectIsConnected } from './stores/databaseStore';
import { useFilterStore, selectHasActiveFilters } from './stores/filterStore';

// Database services and transformers
import { DatabaseService } from './services/database/DatabaseService';
import { getEvents } from './services/database/queries/eventQueries';
import { getMemoryEntries } from './services/database/queries/memoryQueries';
import { transformToGraphData } from './services/database/transformers';

// API service for backend connection
import { apiService, type ApiEvent } from './services/api/ApiService';

// Note: Using ExtendedLayoutType from LayoutSelector for compatibility

// ============================================================================
// Constants
// ============================================================================

const PAN_STEP = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps backend component/operation to frontend event type
 * @param component - Event component (e.g., 'pipeline', 'memory')
 * @param operation - Event operation (e.g., 'step_started', 'memory_stored')
 * @returns Mapped event type
 */
function mapComponentToEventType(component: string, operation: string): import('@/types/database').EventType {
  const key = `${component}:${operation}`;
  const mapping: Record<string, string> = {
    // Pipeline events
    'pipeline:pipeline_started': 'session_start',
    'pipeline:pipeline_completed': 'session_end',
    'pipeline:step_started': 'task_start',
    'pipeline:step_completed': 'task_complete',
    'pipeline:step_failed': 'task_error',
    // Memory events
    'memory:memory_stored': 'memory_store',
    'memory:memory_retrieved': 'memory_retrieve',
    'memory:memory_deleted': 'memory_delete',
    // Agent events
    'agent:agent_started': 'agent_spawn',
    'agent:agent_completed': 'agent_terminate',
    'agent:agent_failed': 'task_error',
    // Learning/SONA events
    'learning:learning_feedback': 'learning_update',
    'learning:trajectory_stored': 'trajectory_end',
    'sona:sona_trajectory_created': 'trajectory_start',
    'sona:sona_feedback_processed': 'learning_update',
    // Routing events
    'routing:agent_selected': 'pattern_match',
    // Reasoning events
    'reasoning:reasoning_pattern_matched': 'pattern_match',
    'reasoning:reasoning_trajectory_stored': 'trajectory_end',
  };

  return (mapping[key] ?? 'custom') as import('@/types/database').EventType;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Graph view with canvas and controls
 */
interface GraphViewProps {
  graphRef: RefObject<GraphCanvasHandle>;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  isDarkMode: boolean;
}

function GraphView({
  graphRef,
  onNodeClick,
  onNodeDoubleClick,
  isDarkMode,
}: GraphViewProps): JSX.Element {
  const viewport = useGraphStore((state) => state.viewport);
  const currentLayout = useGraphStore((state) => state.currentLayout);
  const setViewport = useGraphStore((state) => state.setViewport);
  const setLayout = useGraphStore((state) => state.setLayout);

  // Track the pending layout for apply
  const [pendingLayout, setPendingLayout] = useState<ExtendedLayoutType>(
    currentLayout as ExtendedLayoutType
  );

  const handleZoomChange = useCallback(
    (zoom: number) => {
      setViewport({ zoom });
      graphRef.current?.setZoom(zoom);
    },
    [setViewport, graphRef]
  );

  const handleZoomToFit = useCallback(() => {
    graphRef.current?.fit();
  }, [graphRef]);

  const handleLayoutChange = useCallback(
    (layout: ExtendedLayoutType) => {
      setPendingLayout(layout);
      // Map extended types to base types where needed
      const baseLayout = layout as typeof currentLayout;
      setLayout(baseLayout);
    },
    [setLayout]
  );

  const handleApplyLayout = useCallback(() => {
    // Map extended layout types back to base LayoutType for GraphCanvas.runLayout
    // The GraphCanvas internally handles Cytoscape-specific layout mapping
    const layoutTypeMap: Record<ExtendedLayoutType, string> = {
      force: 'force',
      hierarchical: 'hierarchical',
      radial: 'radial',
      timeline: 'timeline',
      grid: 'grid',
      concentric: 'concentric',
      // Extended types map to closest base type
      circle: 'radial',
      breadthfirst: 'hierarchical',
      dagre: 'hierarchical',
      cose: 'force',
      cola: 'force',
    };
    const baseLayoutType = layoutTypeMap[pendingLayout] || 'force';
    // Cast to 'force' | 'hierarchical' | 'radial' | 'timeline' | 'grid' | 'concentric'
    graphRef.current?.runLayout(baseLayoutType as 'force' | 'hierarchical' | 'radial' | 'timeline' | 'grid' | 'concentric');
  }, [pendingLayout, graphRef]);

  return (
    <div className="graph-view">
      <ErrorBoundary
        fallback={
          <div className="graph-view__error">
            <SectionErrorFallback
              title="Graph Error"
              message="Failed to render the graph visualization"
              onRetry={() => window.location.reload()}
            />
          </div>
        }
      >
        <GraphCanvas
          ref={graphRef}
          className="graph-view__canvas"
          darkMode={isDarkMode}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          minZoom={viewport.minZoom}
          maxZoom={viewport.maxZoom}
        />
      </ErrorBoundary>

      {/* Zoom controls */}
      <ZoomControls
        zoom={viewport.zoom}
        minZoom={viewport.minZoom}
        maxZoom={viewport.maxZoom}
        onZoomChange={handleZoomChange}
        onZoomToFit={handleZoomToFit}
        zoomStep={0.25}
        showPercentage
        showSlider={false}
        showFitButton
        showKeyboardHints
        position="bottom-right"
        glass
        compact
      />

      {/* Layout selector */}
      <div className="graph-view__layout-selector">
        <LayoutSelector
          currentLayout={pendingLayout}
          onLayoutChange={handleLayoutChange}
          onApplyLayout={handleApplyLayout}
          autoApply
        />
      </div>
    </div>
  );
}

/**
 * Right sidebar panels component
 */
interface RightPanelsProps {
  onResultClick?: (nodeId: string) => void;
}

function RightPanels({ onResultClick }: RightPanelsProps): JSX.Element {
  const searchPanelOpen = useUIStore((state) => state.searchPanelOpen);
  const statsPanelOpen = useUIStore((state) => state.statsPanelOpen);
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen);

  if (!rightPanelOpen) {
    return <></>;
  }

  return (
    <div className="right-panels">
      {/* Details panel - always visible when right panel is open */}
      <ErrorBoundary
        fallback={
          <SectionErrorFallback
            title="Details Panel Error"
            message="Failed to load details"
          />
        }
      >
        <DetailsPanel className="right-panels__details" />
      </ErrorBoundary>

      {/* Search panel */}
      {searchPanelOpen && (
        <ErrorBoundary
          fallback={
            <SectionErrorFallback
              title="Search Panel Error"
              message="Failed to load search"
            />
          }
        >
          <SearchPanel
            className="right-panels__search"
            onResultClick={onResultClick}
          />
        </ErrorBoundary>
      )}

      {/* Stats panel */}
      {statsPanelOpen && (
        <ErrorBoundary
          fallback={
            <SectionErrorFallback
              title="Stats Panel Error"
              message="Failed to load statistics"
            />
          }
        >
          <StatsPanel className="right-panels__stats" />
        </ErrorBoundary>
      )}
    </div>
  );
}

/**
 * Left sidebar panels component (filters)
 */
function LeftPanels(): JSX.Element {
  const filterPanelOpen = useUIStore((state) => state.filterPanelOpen);
  const leftPanelOpen = useUIStore((state) => state.leftPanelOpen);

  if (!leftPanelOpen) {
    return <></>;
  }

  return (
    <div className="left-panels">
      {/* Filter panel */}
      {filterPanelOpen && (
        <ErrorBoundary
          fallback={
            <SectionErrorFallback
              title="Filter Panel Error"
              message="Failed to load filters"
            />
          }
        >
          <FilterPanel className="left-panels__filter" collapsible />
        </ErrorBoundary>
      )}
    </div>
  );
}

/**
 * Database connection status indicator
 */
function ConnectionStatus(): JSX.Element {
  const isConnected = useDatabaseStore(selectIsConnected);
  const connection = useDatabaseStore((state) => state.connection);

  return (
    <div
      className={`connection-status ${
        isConnected ? 'connection-status--connected' : 'connection-status--disconnected'
      }`}
      title={
        isConnected
          ? `Connected: ${connection.fileName || 'Database'}`
          : 'Not connected'
      }
    >
      <span className="connection-status__indicator" />
      <span className="connection-status__text">
        {isConnected ? connection.fileName || 'Connected' : 'No database'}
      </span>
    </div>
  );
}

/**
 * Export toolbar button
 */
interface ExportToolbarProps {
  graphRef: RefObject<GraphCanvasHandle>;
}

function ExportToolbar({ graphRef }: ExportToolbarProps): JSX.Element {
  const { downloadPNG, downloadSVG, downloadJSON, downloadCSV, isExporting } = useExport({
    cytoscapeManager: graphRef.current?.getManager?.() || null,
    defaultFilename: 'god-agent-memory-graph',
    includeTimestamp: true,
  });

  const handleExportPNG = useCallback(async () => {
    try {
      await downloadPNG();
      toast.success('PNG exported successfully');
    } catch {
      toast.error('Failed to export PNG');
    }
  }, [downloadPNG]);

  const handleExportSVG = useCallback(async () => {
    try {
      await downloadSVG();
      toast.success('SVG exported successfully');
    } catch {
      toast.error('Failed to export SVG');
    }
  }, [downloadSVG]);

  const handleExportJSON = useCallback(async () => {
    try {
      await downloadJSON();
      toast.success('JSON exported successfully');
    } catch {
      toast.error('Failed to export JSON');
    }
  }, [downloadJSON]);

  const handleExportCSV = useCallback(async () => {
    try {
      await downloadCSV();
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    }
  }, [downloadCSV]);

  return (
    <div className="export-toolbar" role="group" aria-label="Export options">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportPNG}
        disabled={isExporting}
        title="Export as PNG"
        aria-label="Export graph as PNG image"
      >
        PNG
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportSVG}
        disabled={isExporting}
        title="Export as SVG"
        aria-label="Export graph as SVG vector image"
      >
        SVG
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportJSON}
        disabled={isExporting}
        title="Export as JSON"
        aria-label="Export graph data as JSON"
      >
        JSON
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportCSV}
        disabled={isExporting}
        title="Export as CSV"
        aria-label="Export graph data as CSV"
      >
        CSV
      </Button>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

/**
 * Main application component that integrates all visualization features
 */
export function App(): JSX.Element {
  // Refs
  const graphRef = useRef<GraphCanvasHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Local state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isLoadDatabaseModalOpen, setIsLoadDatabaseModalOpen] = useState(false);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false);

  // Store state
  const theme = useUIStore((state) => state.theme);
  const activeView = useUIStore((state) => state.activeView);
  const modalOpen = useUIStore((state) => state.modalOpen);
  const modalType = useUIStore((state) => state.modalType);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const closeModal = useUIStore((state) => state.closeModal);
  const toggleSearchPanel = useUIStore((state) => state.toggleSearchPanel);

  const isConnected = useDatabaseStore(selectIsConnected);
  const connection = useDatabaseStore((state) => state.connection);
  const setConnectionInfo = useDatabaseStore((state) => state.setConnectionInfo);
  const setLoading = useDatabaseStore((state) => state.setLoading);
  const setEvents = useDatabaseStore((state) => state.setEvents);
  const setMemoryEntries = useDatabaseStore((state) => state.setMemoryEntries);

  const hasActiveFilters = useFilterStore(selectHasActiveFilters);
  const resetAllFilters = useFilterStore((state) => state.resetAllFilters);

  const graphSelection = useGraphStore((state) => state.selection);
  const selectNode = useGraphStore((state) => state.selectNode);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const selectAll = useGraphStore((state) => state.selectAll);
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode);
  const setGraphData = useGraphStore((state) => state.setGraphData);
  const zoomIn = useGraphStore((state) => state.zoomIn);
  const zoomOut = useGraphStore((state) => state.zoomOut);
  const viewport = useGraphStore((state) => state.viewport);

  // Determine dark mode
  const isDarkMode = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }, [theme]);

  // ========================================================================
  // Keyboard Shortcuts
  // ========================================================================

  const shortcutCallbacks = useMemo(
    () => ({
      onFocusSearch: () => {
        toggleSearchPanel();
        setTimeout(() => searchInputRef.current?.focus(), 100);
      },
      onSelectAll: () => selectAll(),
      onEscape: () => {
        if (isHelpModalOpen) {
          setIsHelpModalOpen(false);
        } else if (modalOpen) {
          closeModal();
        } else if (graphSelection.selectedNodeIds.size > 0) {
          clearSelection();
        }
      },
      onDelete: () => {
        // Delete functionality would go here if implemented
        console.log('Delete selected items');
      },
      onZoomIn: () => {
        zoomIn();
        graphRef.current?.setZoom(viewport.zoom * 1.2);
      },
      onZoomOut: () => {
        zoomOut();
        graphRef.current?.setZoom(viewport.zoom / 1.2);
      },
      onResetZoom: () => {
        graphRef.current?.setZoom(1);
      },
      onFitToViewport: () => {
        graphRef.current?.fit();
      },
      onToggleGrid: () => {
        // Grid toggle would go here if implemented
        console.log('Toggle grid');
      },
      onShowHelp: () => setIsHelpModalOpen(true),
      onPanUp: () => {
        const manager = graphRef.current?.getManager?.();
        if (manager) {
          const currentPan = manager.getPan();
          manager.setPan({ x: currentPan.x, y: currentPan.y + PAN_STEP });
        }
      },
      onPanDown: () => {
        const manager = graphRef.current?.getManager?.();
        if (manager) {
          const currentPan = manager.getPan();
          manager.setPan({ x: currentPan.x, y: currentPan.y - PAN_STEP });
        }
      },
      onPanLeft: () => {
        const manager = graphRef.current?.getManager?.();
        if (manager) {
          const currentPan = manager.getPan();
          manager.setPan({ x: currentPan.x + PAN_STEP, y: currentPan.y });
        }
      },
      onPanRight: () => {
        const manager = graphRef.current?.getManager?.();
        if (manager) {
          const currentPan = manager.getPan();
          manager.setPan({ x: currentPan.x - PAN_STEP, y: currentPan.y });
        }
      },
      onUndo: () => {
        // Undo functionality would go here if implemented
        console.log('Undo');
      },
      onRedo: () => {
        // Redo functionality would go here if implemented
        console.log('Redo');
      },
      onExport: () => {
        useUIStore.getState().openModal('export');
      },
      onRefresh: () => {
        useGraphStore.getState().refreshData();
      },
    }),
    [
      toggleSearchPanel,
      selectAll,
      isHelpModalOpen,
      modalOpen,
      closeModal,
      graphSelection.selectedNodeIds.size,
      clearSelection,
      zoomIn,
      zoomOut,
      viewport.zoom,
    ]
  );

  const defaultShortcuts = useMemo<ShortcutDefinition[]>(
    () => createDefaultShortcuts(shortcutCallbacks),
    [shortcutCallbacks]
  );

  const keyboardShortcuts = useKeyboardShortcuts({
    shortcuts: defaultShortcuts,
    scope: activeView === 'graph' ? 'graph' : 'global',
    enabled: true,
  });

  // ========================================================================
  // Event Handlers
  // ========================================================================

  /**
   * Handle navigation to graph view
   */
  const handleNavigateToGraph = useCallback(() => {
    setActiveView('graph');
  }, [setActiveView]);

  /**
   * Handle node click in graph
   */
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
    },
    [selectNode]
  );

  /**
   * Handle node double-click in graph
   */
  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      setFocusedNode(nodeId);
      graphRef.current?.centerOnNodes([nodeId], 1.5);
    },
    [setFocusedNode]
  );

  /**
   * Handle search result click
   */
  const handleSearchResultClick = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      setFocusedNode(nodeId);
      graphRef.current?.centerOnNodes([nodeId], 1.2);
    },
    [selectNode, setFocusedNode]
  );

  /**
   * Handle file drop for database loading
   * Loads SQLite database via sql.js, fetches events and memory entries,
   * transforms to graph data, and updates stores.
   */
  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsDatabaseLoading(true);
      setLoading(true);

      try {
        // Initialize and load the database using DatabaseService
        const db = DatabaseService.getInstance();
        await db.initialize();

        console.log('[App] Loading database file:', file.name, 'Size:', file.size);

        const validation = await db.loadFromFile(file);

        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid database schema');
        }

        console.log('[App] Database loaded successfully. Tables:', validation.foundTables);

        // Fetch events and memory entries from the database
        const events = getEvents({}, { limit: 10000 });
        const memoryEntries = getMemoryEntries({}, { limit: 10000 });

        console.log('[App] Fetched', events.length, 'events and', memoryEntries.length, 'memory entries');

        // Update database store with loaded data
        setEvents(events);
        setMemoryEntries(memoryEntries);

        // Transform to graph data
        const graphData = transformToGraphData(events, memoryEntries, {
          includeTemporalEdges: true,
          sessionScopedTemporal: true,
          includeSessionNodes: true,
          includeAgentNodes: true,
          includeNamespaceNodes: true,
          includeNamespaceMembership: true,
          includeKeyReferences: true,
          includeSimilarityEdges: false,
        });

        console.log('[App] Transformed to', graphData.nodes.length, 'nodes and', graphData.edges.length, 'edges');

        // Update graph store with transformed data
        setGraphData(graphData);

        // Update connection info
        const connectionInfo = db.getConnectionInfo();
        setConnectionInfo({
          state: connectionInfo.state,
          fileName: connectionInfo.fileName,
          fileSize: connectionInfo.fileSize,
          loadedAt: connectionInfo.loadedAt,
          error: connectionInfo.error,
        });

        toast.success(`Database loaded: ${file.name} (${events.length} events, ${memoryEntries.length} memory entries)`);
        setIsLoadDatabaseModalOpen(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load database';
        console.error('[App] Database loading error:', error);
        setConnectionInfo({
          state: 'error',
          error: errorMessage,
        });
        toast.error(errorMessage);
      } finally {
        setIsDatabaseLoading(false);
        setLoading(false);
      }
    },
    [setConnectionInfo, setLoading, setEvents, setMemoryEntries, setGraphData]
  );

  /**
   * Handle file drop error
   */
  const handleFileDropError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  // ========================================================================
  // Effects
  // ========================================================================

  /**
   * Handle modal type from store
   */
  useEffect(() => {
    if (modalOpen && modalType === 'help') {
      setIsHelpModalOpen(true);
      closeModal();
    }
  }, [modalOpen, modalType, closeModal]);

  /**
   * Apply theme to document
   */
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'system') {
      root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    } else {
      root.classList.add(`theme-${theme}`);
    }

    root.setAttribute('data-theme', theme);
  }, [theme]);

  /**
   * Auto-connect to backend server on mount
   * Attempts to connect to the Express observability server and load data.
   * Falls back to file picker if server is unavailable.
   */
  useEffect(() => {
    const autoConnect = async () => {
      try {
        setConnectionInfo({ state: 'initializing' });

        // Check if backend server is available
        const isHealthy = await apiService.health();
        if (!isHealthy) {
          console.log('[App] Backend server not available, falling back to file picker');
          setConnectionInfo({ state: 'ready' });
          return;
        }

        console.log('[App] Backend server detected at', apiService.getBaseUrl());
        setConnectionInfo({
          state: 'connecting',
          fileName: 'API Connection',
        });
        setLoading(true);

        // Fetch all data from backend in parallel
        const [apiEvents, agents, pipelines] = await Promise.all([
          apiService.getEvents(10000),
          apiService.getAgents(),
          apiService.getPipelines(),
        ]);

        console.log(
          `[App] Loaded from API: ${apiEvents.length} events, ${agents.length} agents, ${pipelines.length} pipelines`
        );

        // Transform API events to GodAgentEvent format
        const transformedEvents = apiEvents.map((e: ApiEvent) => ({
          id: e.id,
          eventType: mapComponentToEventType(e.component, e.operation),
          timestamp: new Date(e.timestamp),
          sessionId: (e.metadata?.sessionId as string) ?? (e.metadata?.pipelineId as string) ?? null,
          agentId: (e.metadata?.agentId as string) ?? (e.metadata?.stepName as string) ?? null,
          data: e.metadata ?? {},
          createdAt: new Date(e.created_at ?? e.timestamp),
        }));

        // Update database store with events
        setEvents(transformedEvents);

        // Transform to graph data
        const graphData = transformToGraphData(transformedEvents, [], {
          includeTemporalEdges: true,
          sessionScopedTemporal: true,
          includeSessionNodes: true,
          includeAgentNodes: true,
        });

        console.log(
          `[App] Transformed to ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`
        );

        // Update graph store
        setGraphData(graphData);

        // Update connection info to connected
        setConnectionInfo({
          state: 'connected',
          fileName: `API: ${apiService.getBaseUrl()}`,
          loadedAt: new Date(),
        });

        toast.success(
          `Connected to server: ${transformedEvents.length} events loaded`
        );
      } catch (error) {
        console.error('[App] Auto-connect failed:', error);
        setConnectionInfo({ state: 'ready' });
        // Silent fallback - user can still use file picker
      } finally {
        setLoading(false);
      }
    };

    autoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ========================================================================
  // Render
  // ========================================================================

  /**
   * Render the active view content
   */
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <ErrorBoundary
            fallback={
              <div className="view-error">
                <SectionErrorFallback
                  title="Dashboard Error"
                  message="Failed to load dashboard"
                  onRetry={() => window.location.reload()}
                />
              </div>
            }
          >
            <Dashboard
              className="app__dashboard"
              onNavigateToGraph={handleNavigateToGraph}
              showActivityFeed
            />
          </ErrorBoundary>
        );

      case 'graph':
        return (
          <div className="app__graph-container">
            <LeftPanels />
            <GraphView
              graphRef={graphRef}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              isDarkMode={isDarkMode}
            />
            <RightPanels onResultClick={handleSearchResultClick} />
          </div>
        );

      case 'memory':
        return (
          <div className="app__memory-view">
            <div className="app__placeholder">
              <h2>Memory View</h2>
              <p>Memory exploration view coming soon.</p>
              <Button onClick={handleNavigateToGraph}>Go to Graph View</Button>
            </div>
          </div>
        );

      case 'statistics':
        return (
          <div className="app__statistics-view">
            <ErrorBoundary
              fallback={
                <SectionErrorFallback
                  title="Statistics Error"
                  message="Failed to load statistics"
                />
              }
            >
              <StatsPanel className="app__stats-full" />
            </ErrorBoundary>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="app-error">
          <h1>Application Error</h1>
          <p>Something went wrong. Please refresh the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      }
    >
      <AppLayout>
        {/* Toolbar area */}
        <div className="app__toolbar">
          <ConnectionStatus />

          {activeView === 'graph' && (
            <>
              <ExportToolbar graphRef={graphRef} />

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  title="Clear all filters"
                >
                  Clear Filters
                </Button>
              )}
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsLoadDatabaseModalOpen(true)}
          >
            {isConnected ? 'Change Database' : 'Load Database'}
          </Button>
        </div>

        {/* Main content area */}
        <div className="app__content">{renderView()}</div>

        {/* Modals */}
        <KeyboardShortcutsHelp
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
          keyboardShortcuts={keyboardShortcuts}
        />

        <Modal
          isOpen={isLoadDatabaseModalOpen}
          onClose={() => setIsLoadDatabaseModalOpen(false)}
          title="Load Database"
          size="md"
        >
          <FileDropZone
            onFileSelect={handleFileSelect}
            onError={handleFileDropError}
            loading={isDatabaseLoading}
            currentFileName={connection.fileName || undefined}
          />
        </Modal>

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: isDarkMode ? '#1e293b' : '#ffffff',
              color: isDarkMode ? '#f1f5f9' : '#0f172a',
              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: isDarkMode ? '#1e293b' : '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: isDarkMode ? '#1e293b' : '#ffffff',
              },
            },
          }}
        />
      </AppLayout>
    </ErrorBoundary>
  );
}

export default App;
