/**
 * UI types for God Agent Memory Visualization
 *
 * This module defines types for UI state management including
 * selection, panels, modals, notifications, and theming.
 *
 * @module types/ui
 */

import type { GraphNode, GraphEdge, Position } from './graph';

// ============================================================================
// Theme
// ============================================================================

/**
 * Application theme options
 */
export type Theme = 'light' | 'dark' | 'system';

// ============================================================================
// Selection State
// ============================================================================

/**
 * Current selection state in the graph
 */
export interface SelectionState {
  /** IDs of selected nodes */
  selectedNodes: string[];
  /** IDs of selected edges */
  selectedEdges: string[];
  /** ID of currently hovered node */
  hoveredNode: string | null;
  /** ID of currently hovered edge */
  hoveredEdge: string | null;
  /** Whether multi-select mode is active (e.g., shift key held) */
  multiSelect: boolean;
}

// ============================================================================
// Panel State
// ============================================================================

/**
 * Visibility state of UI panels
 */
export interface PanelState {
  /** Details/inspector panel */
  detailsPanel: boolean;
  /** Search panel */
  searchPanel: boolean;
  /** Statistics panel */
  statsPanel: boolean;
  /** Filter panel */
  filterPanel: boolean;
}

// ============================================================================
// Modal State
// ============================================================================

/**
 * Types of modals in the application
 */
export type ModalType =
  | 'export'
  | 'settings'
  | 'help'
  | 'nodeDetails'
  | 'confirm';

/**
 * Modal state
 */
export interface ModalState {
  /** Whether a modal is currently open */
  isOpen: boolean;
  /** Type of currently open modal */
  type: ModalType | null;
  /** Data to pass to the modal */
  data?: unknown;
}

// ============================================================================
// Context Menu
// ============================================================================

/**
 * Target of a context menu
 */
export interface ContextMenuTarget {
  /** Type of element right-clicked */
  type: 'node' | 'edge' | 'canvas';
  /** ID of the element if applicable */
  id?: string;
  /** Full data of the element */
  data?: GraphNode | GraphEdge;
}

/**
 * Context menu state
 */
export interface ContextMenuState {
  /** Whether context menu is open */
  isOpen: boolean;
  /** Screen position of context menu */
  position: Position;
  /** Target element that was right-clicked */
  target: ContextMenuTarget | null;
}

// ============================================================================
// Loading State
// ============================================================================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  /** Whether currently loading */
  isLoading: boolean;
  /** Optional loading message */
  message?: string;
  /** Optional progress (0-100) */
  progress?: number;
}

// ============================================================================
// Error State
// ============================================================================

/**
 * Error state for error handling
 */
export interface ErrorState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The error object */
  error: Error | null;
  /** Context/location where error occurred */
  context?: string;
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * Notification severity levels
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification/toast message
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Severity type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Optional detailed message */
  message?: string;
  /** Auto-dismiss duration in milliseconds */
  duration?: number;
  /** Whether user can manually dismiss */
  dismissible?: boolean;
}

// ============================================================================
// Sidebar State
// ============================================================================

/**
 * Sidebar visibility and width
 */
export interface SidebarState {
  /** Whether sidebar is visible */
  isOpen: boolean;
  /** Sidebar width in pixels */
  width: number;
  /** Which tab is active in sidebar */
  activeTab: SidebarTab;
}

/**
 * Available sidebar tabs
 */
export type SidebarTab =
  | 'details'
  | 'filters'
  | 'stats'
  | 'search'
  | 'settings';

// ============================================================================
// Toolbar State
// ============================================================================

/**
 * Toolbar tool options
 */
export type ToolbarTool =
  | 'select'
  | 'pan'
  | 'zoom'
  | 'lasso';

/**
 * Toolbar state
 */
export interface ToolbarState {
  /** Currently active tool */
  activeTool: ToolbarTool;
  /** Whether minimap is visible */
  showMinimap: boolean;
  /** Whether grid is visible */
  showGrid: boolean;
}

// ============================================================================
// Complete UI State
// ============================================================================

/**
 * Complete UI state for the application
 */
export interface UIState {
  /** Current theme */
  theme: Theme;
  /** Panel visibility */
  panels: PanelState;
  /** Selection state */
  selection: SelectionState;
  /** Modal state */
  modal: ModalState;
  /** Context menu state */
  contextMenu: ContextMenuState;
  /** Loading state */
  loading: LoadingState;
  /** Error state */
  error: ErrorState;
  /** Active notifications */
  notifications: Notification[];
  /** Sidebar state */
  sidebar: SidebarState;
  /** Toolbar state */
  toolbar: ToolbarState;
}

// ============================================================================
// UI Actions
// ============================================================================

/**
 * Actions that can modify UI state
 */
export type UIAction =
  // Theme
  | { type: 'SET_THEME'; payload: Theme }
  // Selection
  | { type: 'SELECT_NODES'; payload: string[] }
  | { type: 'SELECT_EDGES'; payload: string[] }
  | { type: 'ADD_TO_SELECTION'; payload: { nodes?: string[]; edges?: string[] } }
  | { type: 'REMOVE_FROM_SELECTION'; payload: { nodes?: string[]; edges?: string[] } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_HOVERED_NODE'; payload: string | null }
  | { type: 'SET_HOVERED_EDGE'; payload: string | null }
  | { type: 'SET_MULTI_SELECT'; payload: boolean }
  // Panels
  | { type: 'TOGGLE_PANEL'; payload: keyof PanelState }
  | { type: 'SET_PANEL'; payload: { panel: keyof PanelState; visible: boolean } }
  // Modal
  | { type: 'OPEN_MODAL'; payload: { type: ModalType; data?: unknown } }
  | { type: 'CLOSE_MODAL' }
  // Context Menu
  | { type: 'OPEN_CONTEXT_MENU'; payload: { position: Position; target: ContextMenuTarget } }
  | { type: 'CLOSE_CONTEXT_MENU' }
  // Loading
  | { type: 'SET_LOADING'; payload: LoadingState }
  | { type: 'START_LOADING'; payload?: string }
  | { type: 'STOP_LOADING' }
  // Error
  | { type: 'SET_ERROR'; payload: { error: Error; context?: string } }
  | { type: 'CLEAR_ERROR' }
  // Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  // Sidebar
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_TAB'; payload: SidebarTab }
  | { type: 'SET_SIDEBAR_WIDTH'; payload: number }
  // Toolbar
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolbarTool }
  | { type: 'TOGGLE_MINIMAP' }
  | { type: 'TOGGLE_GRID' };

// ============================================================================
// Default UI State
// ============================================================================

/**
 * Create default UI state
 */
export const createDefaultUIState = (): UIState => ({
  theme: 'system',
  panels: {
    detailsPanel: true,
    searchPanel: false,
    statsPanel: false,
    filterPanel: true,
  },
  selection: {
    selectedNodes: [],
    selectedEdges: [],
    hoveredNode: null,
    hoveredEdge: null,
    multiSelect: false,
  },
  modal: {
    isOpen: false,
    type: null,
    data: undefined,
  },
  contextMenu: {
    isOpen: false,
    position: { x: 0, y: 0 },
    target: null,
  },
  loading: {
    isLoading: false,
    message: undefined,
    progress: undefined,
  },
  error: {
    hasError: false,
    error: null,
    context: undefined,
  },
  notifications: [],
  sidebar: {
    isOpen: true,
    width: 320,
    activeTab: 'details',
  },
  toolbar: {
    activeTool: 'select',
    showMinimap: true,
    showGrid: false,
  },
});
