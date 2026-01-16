/**
 * Keyboard Shortcuts Hook
 *
 * Provides configurable keyboard shortcut handling with:
 * - Scope-aware shortcuts (global vs component-level)
 * - Modifier key support (Ctrl, Cmd, Alt, Shift)
 * - Platform detection (Mac vs Windows/Linux)
 * - Enable/disable individual shortcuts
 * - Prevent default handling
 *
 * @module hooks/useKeyboardShortcuts
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Modifier keys that can be used in shortcuts
 */
export type ModifierKey = 'ctrl' | 'cmd' | 'alt' | 'shift' | 'meta';

/**
 * Scope of a keyboard shortcut
 */
export type ShortcutScope = 'global' | 'graph' | 'modal' | 'search' | 'panel';

/**
 * Category for organizing shortcuts in help modal
 */
export type ShortcutCategory =
  | 'navigation'
  | 'selection'
  | 'view'
  | 'editing'
  | 'general';

/**
 * Definition of a keyboard shortcut
 */
export interface ShortcutDefinition {
  /** Unique identifier for the shortcut */
  id: string;
  /** Display name for the shortcut */
  name: string;
  /** Description of what the shortcut does */
  description: string;
  /** The key to trigger the shortcut (lowercase) */
  key: string;
  /** Required modifier keys */
  modifiers?: ModifierKey[];
  /** Scope where the shortcut is active */
  scope?: ShortcutScope;
  /** Category for grouping in help modal */
  category: ShortcutCategory;
  /** Whether the shortcut is enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** The callback to execute when triggered */
  action: () => void;
}

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Array of shortcut definitions */
  shortcuts: ShortcutDefinition[];
  /** Current active scope */
  scope?: ShortcutScope;
  /** Whether all shortcuts are globally enabled */
  enabled?: boolean;
  /** Element to attach listeners to (defaults to window) */
  target?: HTMLElement | Window | null;
}

/**
 * Return type for useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsReturn {
  /** All registered shortcuts */
  shortcuts: ShortcutDefinition[];
  /** Enable a specific shortcut by ID */
  enableShortcut: (id: string) => void;
  /** Disable a specific shortcut by ID */
  disableShortcut: (id: string) => void;
  /** Toggle a specific shortcut by ID */
  toggleShortcut: (id: string) => void;
  /** Check if a shortcut is enabled */
  isShortcutEnabled: (id: string) => boolean;
  /** Get shortcuts by category */
  getShortcutsByCategory: (category: ShortcutCategory) => ShortcutDefinition[];
  /** Get shortcut display string (e.g., "Cmd+F") */
  getShortcutDisplay: (shortcut: ShortcutDefinition) => string;
  /** Check if running on Mac */
  isMac: boolean;
}

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect if the current platform is macOS
 */
const detectIsMac = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
};

// ============================================================================
// Key Display Mapping
// ============================================================================

/**
 * Display names for special keys
 */
const keyDisplayMap: Record<string, string> = {
  arrowup: '\u2191',
  arrowdown: '\u2193',
  arrowleft: '\u2190',
  arrowright: '\u2192',
  escape: 'Esc',
  enter: '\u21B5',
  backspace: '\u232B',
  delete: 'Del',
  tab: '\u21B9',
  space: 'Space',
  ' ': 'Space',
};

/**
 * Display names for modifier keys
 */
const modifierDisplayMap: Record<ModifierKey, { mac: string; other: string }> = {
  ctrl: { mac: '\u2303', other: 'Ctrl' },
  cmd: { mac: '\u2318', other: 'Ctrl' },
  meta: { mac: '\u2318', other: 'Win' },
  alt: { mac: '\u2325', other: 'Alt' },
  shift: { mac: '\u21E7', other: 'Shift' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if the event matches the shortcut's modifier requirements
 */
const matchesModifiers = (
  event: KeyboardEvent,
  modifiers: ModifierKey[] = [],
  isMac: boolean
): boolean => {
  const hasCtrl = event.ctrlKey;
  const hasMeta = event.metaKey;
  const hasAlt = event.altKey;
  const hasShift = event.shiftKey;

  // Check each possible modifier
  const requiresCtrl = modifiers.includes('ctrl');
  const requiresCmd = modifiers.includes('cmd') || modifiers.includes('meta');
  const requiresAlt = modifiers.includes('alt');
  const requiresShift = modifiers.includes('shift');

  // On Mac, 'cmd' maps to metaKey; on other platforms, it maps to ctrlKey
  const cmdKeyPressed = isMac ? hasMeta : hasCtrl;

  // Check required modifiers are pressed
  if (requiresCtrl && !hasCtrl) return false;
  if (requiresCmd && !cmdKeyPressed) return false;
  if (requiresAlt && !hasAlt) return false;
  if (requiresShift && !hasShift) return false;

  // Check no extra modifiers are pressed (unless required)
  // Special case: On non-Mac, cmd is handled via ctrl, so don't check ctrl separately
  if (isMac) {
    if (hasCtrl && !requiresCtrl) return false;
    if (hasMeta && !requiresCmd) return false;
  } else {
    // On non-Mac, only check ctrl if both ctrl and cmd aren't required
    if (hasCtrl && !requiresCtrl && !requiresCmd) return false;
    if (hasMeta && !requiresCmd) return false;
  }
  if (hasAlt && !requiresAlt) return false;
  if (hasShift && !requiresShift) return false;

  return true;
};

/**
 * Normalize a key for comparison
 */
const normalizeKey = (key: string): string => {
  return key.toLowerCase();
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing keyboard shortcuts
 *
 * @example
 * ```tsx
 * const { shortcuts, getShortcutDisplay, isMac } = useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       id: 'search',
 *       name: 'Search',
 *       description: 'Focus search input',
 *       key: 'f',
 *       modifiers: ['cmd'],
 *       category: 'navigation',
 *       action: () => searchInputRef.current?.focus(),
 *     },
 *   ],
 *   scope: 'global',
 * });
 * ```
 */
export function useKeyboardShortcuts({
  shortcuts: initialShortcuts,
  scope = 'global',
  enabled = true,
  target = typeof window !== 'undefined' ? window : null,
}: UseKeyboardShortcutsOptions): UseKeyboardShortcutsReturn {
  const isMac = useRef(detectIsMac()).current;
  const [shortcutStates, setShortcutStates] = useState<Record<string, boolean>>(
    () => {
      const states: Record<string, boolean> = {};
      initialShortcuts.forEach((s) => {
        states[s.id] = s.enabled !== false;
      });
      return states;
    }
  );

  // Merge shortcut definitions with current enabled states
  const shortcuts = initialShortcuts.map((s) => ({
    ...s,
    enabled: shortcutStates[s.id] ?? s.enabled !== false,
  }));

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields (unless specifically scoped)
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const normalizedKey = normalizeKey(event.key);

      for (const shortcut of shortcuts) {
        // Skip disabled shortcuts
        if (!shortcut.enabled) continue;

        // Check scope
        if (shortcut.scope && shortcut.scope !== 'global' && shortcut.scope !== scope) {
          continue;
        }

        // Skip shortcuts with modifiers when in input fields
        // (unless the shortcut explicitly uses cmd/ctrl)
        if (isInputField) {
          const hasCommandModifier =
            shortcut.modifiers?.includes('cmd') ||
            shortcut.modifiers?.includes('ctrl') ||
            shortcut.modifiers?.includes('meta');
          if (!hasCommandModifier) continue;
        }

        // Check if key matches
        if (normalizedKey !== normalizeKey(shortcut.key)) continue;

        // Check if modifiers match
        if (!matchesModifiers(event, shortcut.modifiers, isMac)) continue;

        // Execute the action
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        return;
      }
    },
    [enabled, shortcuts, scope, isMac]
  );

  /**
   * Attach/detach event listeners
   */
  useEffect(() => {
    if (!target) return;

    const eventTarget = target as EventTarget;
    eventTarget.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      eventTarget.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [target, handleKeyDown]);

  /**
   * Enable a specific shortcut
   */
  const enableShortcut = useCallback((id: string) => {
    setShortcutStates((prev) => ({ ...prev, [id]: true }));
  }, []);

  /**
   * Disable a specific shortcut
   */
  const disableShortcut = useCallback((id: string) => {
    setShortcutStates((prev) => ({ ...prev, [id]: false }));
  }, []);

  /**
   * Toggle a specific shortcut
   */
  const toggleShortcut = useCallback((id: string) => {
    setShortcutStates((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Check if a shortcut is enabled
   */
  const isShortcutEnabled = useCallback(
    (id: string): boolean => {
      return shortcutStates[id] ?? true;
    },
    [shortcutStates]
  );

  /**
   * Get shortcuts filtered by category
   */
  const getShortcutsByCategory = useCallback(
    (category: ShortcutCategory): ShortcutDefinition[] => {
      return shortcuts.filter((s) => s.category === category);
    },
    [shortcuts]
  );

  /**
   * Get display string for a shortcut (e.g., "Cmd+F" or "Ctrl+F")
   */
  const getShortcutDisplay = useCallback(
    (shortcut: ShortcutDefinition): string => {
      const parts: string[] = [];

      // Add modifier keys in standard order
      if (shortcut.modifiers) {
        const modifierOrder: ModifierKey[] = ['ctrl', 'alt', 'shift', 'cmd', 'meta'];
        for (const mod of modifierOrder) {
          if (shortcut.modifiers.includes(mod)) {
            // Skip 'ctrl' if 'cmd' is also present (they're equivalent for display)
            if (mod === 'ctrl' && shortcut.modifiers.includes('cmd')) continue;
            // Skip 'meta' if 'cmd' is also present
            if (mod === 'meta' && shortcut.modifiers.includes('cmd')) continue;

            const display = modifierDisplayMap[mod];
            parts.push(isMac ? display.mac : display.other);
          }
        }
      }

      // Add the main key
      const keyLower = shortcut.key.toLowerCase();
      const keyDisplay =
        keyDisplayMap[keyLower] || shortcut.key.toUpperCase();
      parts.push(keyDisplay);

      return isMac ? parts.join('') : parts.join('+');
    },
    [isMac]
  );

  return {
    shortcuts,
    enableShortcut,
    disableShortcut,
    toggleShortcut,
    isShortcutEnabled,
    getShortcutsByCategory,
    getShortcutDisplay,
    isMac,
  };
}

// ============================================================================
// Default Shortcuts Factory
// ============================================================================

/**
 * Parameters for creating default graph shortcuts
 */
export interface DefaultShortcutsParams {
  /** Focus search input */
  onFocusSearch?: () => void;
  /** Select all nodes */
  onSelectAll?: () => void;
  /** Clear selection / close modal */
  onEscape?: () => void;
  /** Delete selected items */
  onDelete?: () => void;
  /** Zoom in */
  onZoomIn?: () => void;
  /** Zoom out */
  onZoomOut?: () => void;
  /** Reset zoom */
  onResetZoom?: () => void;
  /** Fit to viewport */
  onFitToViewport?: () => void;
  /** Toggle grid layout */
  onToggleGrid?: () => void;
  /** Show help modal */
  onShowHelp?: () => void;
  /** Pan graph up */
  onPanUp?: () => void;
  /** Pan graph down */
  onPanDown?: () => void;
  /** Pan graph left */
  onPanLeft?: () => void;
  /** Pan graph right */
  onPanRight?: () => void;
  /** Undo last action */
  onUndo?: () => void;
  /** Redo last action */
  onRedo?: () => void;
  /** Export graph */
  onExport?: () => void;
  /** Refresh data */
  onRefresh?: () => void;
}

/**
 * Create default shortcuts for the graph visualization
 */
export function createDefaultShortcuts(
  params: DefaultShortcutsParams
): ShortcutDefinition[] {
  const shortcuts: ShortcutDefinition[] = [];

  // Navigation shortcuts
  if (params.onFocusSearch) {
    shortcuts.push({
      id: 'focus-search',
      name: 'Search',
      description: 'Focus the search input',
      key: 'f',
      modifiers: ['cmd'],
      category: 'navigation',
      action: params.onFocusSearch,
    });
  }

  if (params.onShowHelp) {
    shortcuts.push({
      id: 'show-help',
      name: 'Help',
      description: 'Show keyboard shortcuts help',
      key: 'h',
      category: 'general',
      scope: 'global',
      action: params.onShowHelp,
    });

    shortcuts.push({
      id: 'show-help-alt',
      name: 'Help',
      description: 'Show keyboard shortcuts help',
      key: '?',
      modifiers: ['shift'],
      category: 'general',
      scope: 'global',
      action: params.onShowHelp,
    });
  }

  // Selection shortcuts
  if (params.onSelectAll) {
    shortcuts.push({
      id: 'select-all',
      name: 'Select All',
      description: 'Select all nodes in the graph',
      key: 'a',
      modifiers: ['cmd'],
      category: 'selection',
      scope: 'graph',
      action: params.onSelectAll,
    });
  }

  if (params.onEscape) {
    shortcuts.push({
      id: 'escape',
      name: 'Clear/Close',
      description: 'Clear selection or close modal',
      key: 'Escape',
      category: 'general',
      scope: 'global',
      preventDefault: true,
      action: params.onEscape,
    });
  }

  if (params.onDelete) {
    shortcuts.push({
      id: 'delete',
      name: 'Delete',
      description: 'Delete selected items',
      key: 'Delete',
      category: 'editing',
      scope: 'graph',
      action: params.onDelete,
    });

    shortcuts.push({
      id: 'delete-backspace',
      name: 'Delete',
      description: 'Delete selected items',
      key: 'Backspace',
      category: 'editing',
      scope: 'graph',
      action: params.onDelete,
    });
  }

  // View shortcuts
  if (params.onZoomIn) {
    shortcuts.push({
      id: 'zoom-in',
      name: 'Zoom In',
      description: 'Zoom in on the graph',
      key: '=',
      modifiers: ['cmd'],
      category: 'view',
      scope: 'graph',
      action: params.onZoomIn,
    });

    shortcuts.push({
      id: 'zoom-in-plus',
      name: 'Zoom In',
      description: 'Zoom in on the graph',
      key: '+',
      category: 'view',
      scope: 'graph',
      action: params.onZoomIn,
    });
  }

  if (params.onZoomOut) {
    shortcuts.push({
      id: 'zoom-out',
      name: 'Zoom Out',
      description: 'Zoom out of the graph',
      key: '-',
      modifiers: ['cmd'],
      category: 'view',
      scope: 'graph',
      action: params.onZoomOut,
    });

    shortcuts.push({
      id: 'zoom-out-minus',
      name: 'Zoom Out',
      description: 'Zoom out of the graph',
      key: '-',
      category: 'view',
      scope: 'graph',
      action: params.onZoomOut,
    });
  }

  if (params.onResetZoom) {
    shortcuts.push({
      id: 'reset-zoom',
      name: 'Reset Zoom',
      description: 'Reset zoom to default level',
      key: '0',
      modifiers: ['cmd'],
      category: 'view',
      scope: 'graph',
      action: params.onResetZoom,
    });

    shortcuts.push({
      id: 'reset-zoom-key',
      name: 'Reset Zoom',
      description: 'Reset zoom to default level',
      key: '0',
      category: 'view',
      scope: 'graph',
      action: params.onResetZoom,
    });
  }

  if (params.onFitToViewport) {
    shortcuts.push({
      id: 'fit-viewport',
      name: 'Fit to View',
      description: 'Fit graph to viewport',
      key: 'f',
      category: 'view',
      scope: 'graph',
      action: params.onFitToViewport,
    });
  }

  if (params.onToggleGrid) {
    shortcuts.push({
      id: 'toggle-grid',
      name: 'Toggle Grid',
      description: 'Toggle grid layout',
      key: 'g',
      category: 'view',
      scope: 'graph',
      action: params.onToggleGrid,
    });
  }

  // Pan shortcuts
  if (params.onPanUp) {
    shortcuts.push({
      id: 'pan-up',
      name: 'Pan Up',
      description: 'Pan the graph up',
      key: 'ArrowUp',
      category: 'navigation',
      scope: 'graph',
      action: params.onPanUp,
    });
  }

  if (params.onPanDown) {
    shortcuts.push({
      id: 'pan-down',
      name: 'Pan Down',
      description: 'Pan the graph down',
      key: 'ArrowDown',
      category: 'navigation',
      scope: 'graph',
      action: params.onPanDown,
    });
  }

  if (params.onPanLeft) {
    shortcuts.push({
      id: 'pan-left',
      name: 'Pan Left',
      description: 'Pan the graph left',
      key: 'ArrowLeft',
      category: 'navigation',
      scope: 'graph',
      action: params.onPanLeft,
    });
  }

  if (params.onPanRight) {
    shortcuts.push({
      id: 'pan-right',
      name: 'Pan Right',
      description: 'Pan the graph right',
      key: 'ArrowRight',
      category: 'navigation',
      scope: 'graph',
      action: params.onPanRight,
    });
  }

  // Editing shortcuts
  if (params.onUndo) {
    shortcuts.push({
      id: 'undo',
      name: 'Undo',
      description: 'Undo last action',
      key: 'z',
      modifiers: ['cmd'],
      category: 'editing',
      scope: 'global',
      action: params.onUndo,
    });
  }

  if (params.onRedo) {
    shortcuts.push({
      id: 'redo',
      name: 'Redo',
      description: 'Redo last undone action',
      key: 'z',
      modifiers: ['cmd', 'shift'],
      category: 'editing',
      scope: 'global',
      action: params.onRedo,
    });

    shortcuts.push({
      id: 'redo-y',
      name: 'Redo',
      description: 'Redo last undone action',
      key: 'y',
      modifiers: ['cmd'],
      category: 'editing',
      scope: 'global',
      action: params.onRedo,
    });
  }

  // General shortcuts
  if (params.onExport) {
    shortcuts.push({
      id: 'export',
      name: 'Export',
      description: 'Export the graph',
      key: 'e',
      modifiers: ['cmd'],
      category: 'general',
      scope: 'global',
      action: params.onExport,
    });
  }

  if (params.onRefresh) {
    shortcuts.push({
      id: 'refresh',
      name: 'Refresh',
      description: 'Refresh data',
      key: 'r',
      modifiers: ['cmd'],
      category: 'general',
      scope: 'global',
      action: params.onRefresh,
    });
  }

  return shortcuts;
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

/** Singleton announcer element to prevent memory leaks from multiple creations */
let globalAnnouncer: HTMLElement | null = null;
/** Current announcement timeout to prevent overlapping timeouts */
let announcementTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcer = getOrCreateAnnouncer();
  announcer.setAttribute('aria-live', priority);
  announcer.textContent = message;

  // Clear any existing timeout to prevent memory buildup
  if (announcementTimeout !== null) {
    clearTimeout(announcementTimeout);
  }

  // Clear after announcement
  announcementTimeout = setTimeout(() => {
    announcer.textContent = '';
    announcementTimeout = null;
  }, 1000);
}

/**
 * Get or create the singleton screen reader announcer element
 */
function getOrCreateAnnouncer(): HTMLElement {
  // Return existing global announcer if available
  if (globalAnnouncer && document.body.contains(globalAnnouncer)) {
    return globalAnnouncer;
  }

  // Check if one already exists in the DOM
  const existing = document.getElementById('sr-announcer');
  if (existing) {
    globalAnnouncer = existing;
    return existing;
  }

  // Create new announcer
  const announcer = document.createElement('div');
  announcer.id = 'sr-announcer';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(announcer);
  globalAnnouncer = announcer;
  return announcer;
}

/**
 * Clean up the screen reader announcer (call on app unmount if needed)
 */
export function cleanupScreenReaderAnnouncer(): void {
  if (announcementTimeout !== null) {
    clearTimeout(announcementTimeout);
    announcementTimeout = null;
  }
  if (globalAnnouncer && document.body.contains(globalAnnouncer)) {
    document.body.removeChild(globalAnnouncer);
    globalAnnouncer = null;
  }
}

// ============================================================================
// Focus Management Utilities
// ============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

/**
 * Trap focus within a container
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Move focus to the first focusable element in a container
 */
export function focusFirstElement(container: HTMLElement): void {
  const focusableElements = getFocusableElements(container);
  focusableElements[0]?.focus();
}

/**
 * Create a skip link for accessibility
 */
export function createSkipLink(targetId: string, label: string): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = label;
  skipLink.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView();
    }
  });
  return skipLink;
}

export default useKeyboardShortcuts;
