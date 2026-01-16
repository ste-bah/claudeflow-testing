/**
 * Keyboard shortcut constants for God Agent Memory Visualization
 *
 * Defines all keyboard shortcuts, their descriptions, and formatting utilities.
 *
 * @module constants/keyboard
 */

/**
 * Modifier key types
 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key to press (e.g., 'f', 'Escape', '+') */
  key: string;
  /** Required modifier keys */
  modifiers?: ModifierKey[];
  /** Human-readable description */
  description: string;
  /** Action identifier for handler mapping */
  action: string;
  /** Whether this shortcut is disabled */
  disabled?: boolean;
}

/**
 * All keyboard shortcuts organized by category
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: 'f', modifiers: ['ctrl'], description: 'Focus search', action: 'focusSearch' },
  { key: 'Escape', description: 'Clear selection / Close panel', action: 'clearOrClose' },

  // Graph controls
  { key: '0', modifiers: ['ctrl'], description: 'Fit graph to screen', action: 'fitToScreen' },
  { key: '+', modifiers: ['ctrl'], description: 'Zoom in', action: 'zoomIn' },
  { key: '=', modifiers: ['ctrl'], description: 'Zoom in', action: 'zoomIn' },
  { key: '-', modifiers: ['ctrl'], description: 'Zoom out', action: 'zoomOut' },
  { key: 'l', modifiers: ['ctrl'], description: 'Cycle layout', action: 'cycleLayout' },
  { key: 'c', modifiers: ['ctrl', 'shift'], description: 'Center on selection', action: 'centerOnSelection' },

  // Selection
  { key: 'a', modifiers: ['ctrl'], description: 'Select all visible', action: 'selectAll' },
  { key: 'd', modifiers: ['ctrl'], description: 'Deselect all', action: 'deselectAll' },
  { key: 'i', modifiers: ['ctrl'], description: 'Invert selection', action: 'invertSelection' },
  { key: 'Delete', description: 'Hide selected nodes', action: 'hideSelected' },
  { key: 'Backspace', description: 'Hide selected nodes', action: 'hideSelected' },

  // Panels
  { key: 'b', modifiers: ['ctrl'], description: 'Toggle sidebar', action: 'toggleSidebar' },
  { key: 'p', modifiers: ['ctrl'], description: 'Toggle details panel', action: 'toggleDetailsPanel' },
  { key: 'm', modifiers: ['ctrl'], description: 'Toggle minimap', action: 'toggleMinimap' },
  { key: 'g', modifiers: ['ctrl'], description: 'Toggle grid', action: 'toggleGrid' },

  // Actions
  { key: 'e', modifiers: ['ctrl'], description: 'Export graph', action: 'exportGraph' },
  { key: 'r', modifiers: ['ctrl'], description: 'Refresh data', action: 'refreshData' },
  { key: '?', modifiers: ['shift'], description: 'Show keyboard shortcuts', action: 'showShortcuts' },
  { key: 'F1', description: 'Show help', action: 'showHelp' },

  // Navigation between nodes
  { key: 'ArrowUp', description: 'Select previous node', action: 'selectPrevious' },
  { key: 'ArrowDown', description: 'Select next node', action: 'selectNext' },
  { key: 'ArrowLeft', description: 'Navigate to parent', action: 'navigateParent' },
  { key: 'ArrowRight', description: 'Navigate to child', action: 'navigateChild' },
  { key: 'Tab', description: 'Cycle through connected nodes', action: 'cycleConnected' },
  { key: 'Tab', modifiers: ['shift'], description: 'Cycle backwards through connected nodes', action: 'cycleConnectedReverse' },

  // Tools
  { key: 'v', description: 'Select tool', action: 'toolSelect' },
  { key: 'h', description: 'Pan tool', action: 'toolPan' },
  { key: 'z', description: 'Zoom tool', action: 'toolZoom' },
  { key: 's', description: 'Lasso select tool', action: 'toolLasso' },
];

/**
 * Shortcut categories for organized display
 */
export const SHORTCUT_CATEGORIES: Record<string, string[]> = {
  navigation: ['focusSearch', 'clearOrClose'],
  graph: ['fitToScreen', 'zoomIn', 'zoomOut', 'cycleLayout', 'centerOnSelection'],
  selection: ['selectAll', 'deselectAll', 'invertSelection', 'hideSelected', 'selectPrevious', 'selectNext', 'navigateParent', 'navigateChild', 'cycleConnected', 'cycleConnectedReverse'],
  panels: ['toggleSidebar', 'toggleDetailsPanel', 'toggleMinimap', 'toggleGrid'],
  actions: ['exportGraph', 'refreshData', 'showShortcuts', 'showHelp'],
  tools: ['toolSelect', 'toolPan', 'toolZoom', 'toolLasso'],
};

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  graph: 'Graph Controls',
  selection: 'Selection',
  panels: 'Panels',
  actions: 'Actions',
  tools: 'Tools',
};

/**
 * Format a shortcut for display
 * @param shortcut - The shortcut to format
 * @returns Formatted string like "Ctrl+F" or "Escape"
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers?.includes('ctrl')) parts.push('Ctrl');
  if (shortcut.modifiers?.includes('alt')) parts.push('Alt');
  if (shortcut.modifiers?.includes('shift')) parts.push('Shift');
  if (shortcut.modifiers?.includes('meta')) parts.push(isMac() ? '\u2318' : 'Win');

  // Format special keys
  const keyDisplay = formatKey(shortcut.key);
  parts.push(keyDisplay);

  return parts.join('+');
}

/**
 * Format a key for display
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'ArrowUp': '\u2191',
    'ArrowDown': '\u2193',
    'ArrowLeft': '\u2190',
    'ArrowRight': '\u2192',
    'Escape': 'Esc',
    'Delete': 'Del',
    'Backspace': '\u232B',
    'Tab': '\u21B9',
    'Enter': '\u21B5',
    ' ': 'Space',
  };

  return keyMap[key] ?? key.toUpperCase();
}

/**
 * Check if running on Mac
 */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Find a shortcut by its action name
 */
export function findShortcutByAction(action: string): KeyboardShortcut | undefined {
  return KEYBOARD_SHORTCUTS.find((s) => s.action === action && !s.disabled);
}

/**
 * Get all shortcuts for a category
 */
export function getShortcutsByCategory(category: string): KeyboardShortcut[] {
  const actions = SHORTCUT_CATEGORIES[category] ?? [];
  return KEYBOARD_SHORTCUTS.filter((s) => actions.includes(s.action) && !s.disabled);
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (shortcut.disabled) return false;

  const modifiers = shortcut.modifiers ?? [];

  const ctrlRequired = modifiers.includes('ctrl');
  const altRequired = modifiers.includes('alt');
  const shiftRequired = modifiers.includes('shift');
  const metaRequired = modifiers.includes('meta');

  const ctrlMatch = event.ctrlKey === ctrlRequired || event.metaKey === ctrlRequired;
  const altMatch = event.altKey === altRequired;
  const shiftMatch = event.shiftKey === shiftRequired;
  const metaMatch = event.metaKey === metaRequired;

  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                   event.key === shortcut.key;

  return ctrlMatch && altMatch && shiftMatch && metaMatch && keyMatch;
}
