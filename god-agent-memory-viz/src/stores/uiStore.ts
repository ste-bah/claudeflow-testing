/**
 * UI Store - Phase 1 Stub Implementation
 *
 * This store manages UI state including sidebar, panels, theme, and active views.
 * Will be fully implemented in Phase 3 (TASK-021-030).
 *
 * @module stores/uiStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme, SidebarTab, ModalType } from '../types/ui';

// ============================================================================
// Types
// ============================================================================

interface UIStore {
  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeSidebarTab: SidebarTab;

  // Panel visibility
  rightPanelOpen: boolean;
  leftPanelOpen: boolean;
  searchPanelOpen: boolean;
  filterPanelOpen: boolean;
  statsPanelOpen: boolean;

  // Theme
  theme: Theme;

  // Active view
  activeView: 'graph' | 'dashboard' | 'memory' | 'statistics';

  // Modal state
  modalOpen: boolean;
  modalType: ModalType | null;
  modalData: unknown;

  // Settings modal
  settingsModalOpen: boolean;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;

  // Actions - Panels
  toggleRightPanel: () => void;
  toggleLeftPanel: () => void;
  toggleSearchPanel: () => void;
  toggleFilterPanel: () => void;
  toggleStatsPanel: () => void;

  // Actions - Theme
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;

  // Actions - Views
  setActiveView: (view: 'graph' | 'dashboard' | 'memory' | 'statistics') => void;

  // Actions - Modal
  openModal: (type: ModalType, data?: unknown) => void;
  closeModal: () => void;
  toggleSettingsModal: () => void;
}

// ============================================================================
// Theme Helpers
// ============================================================================

const themeOrder: Theme[] = ['light', 'dark', 'system'];

function getNextTheme(current: Theme): Theme {
  const currentIndex = themeOrder.indexOf(current);
  return themeOrder[(currentIndex + 1) % themeOrder.length];
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark');

  // Apply appropriate theme
  if (theme === 'system') {
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  } else {
    root.classList.add(`theme-${theme}`);
  }

  // Store theme preference
  root.setAttribute('data-theme', theme);
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state - Sidebar
      sidebarCollapsed: false,
      sidebarWidth: 280,
      activeSidebarTab: 'details',

      // Initial state - Panels
      rightPanelOpen: true,
      leftPanelOpen: true,
      searchPanelOpen: false,
      filterPanelOpen: true,
      statsPanelOpen: false,

      // Initial state - Theme
      theme: 'system',

      // Initial state - Views
      activeView: 'graph',

      // Initial state - Modal
      modalOpen: false,
      modalType: null,
      modalData: undefined,
      settingsModalOpen: false,

      // Actions - Sidebar
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      setSidebarWidth: (width) => {
        set({ sidebarWidth: Math.max(200, Math.min(600, width)) });
      },

      setActiveSidebarTab: (tab) => {
        set({ activeSidebarTab: tab });
      },

      // Actions - Panels
      toggleRightPanel: () => {
        set((state) => ({ rightPanelOpen: !state.rightPanelOpen }));
      },

      toggleLeftPanel: () => {
        set((state) => ({ leftPanelOpen: !state.leftPanelOpen }));
      },

      toggleSearchPanel: () => {
        set((state) => ({ searchPanelOpen: !state.searchPanelOpen }));
      },

      toggleFilterPanel: () => {
        set((state) => ({ filterPanelOpen: !state.filterPanelOpen }));
      },

      toggleStatsPanel: () => {
        set((state) => ({ statsPanelOpen: !state.statsPanelOpen }));
      },

      // Actions - Theme
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      cycleTheme: () => {
        const nextTheme = getNextTheme(get().theme);
        applyTheme(nextTheme);
        set({ theme: nextTheme });
      },

      // Actions - Views
      setActiveView: (view) => {
        set({ activeView: view });
      },

      // Actions - Modal
      openModal: (type, data) => {
        set({ modalOpen: true, modalType: type, modalData: data });
      },

      closeModal: () => {
        set({ modalOpen: false, modalType: null, modalData: undefined });
      },

      toggleSettingsModal: () => {
        set((state) => ({ settingsModalOpen: !state.settingsModalOpen }));
      },
    }),
    {
      name: 'god-agent-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        activeView: state.activeView,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// ============================================================================
// Selectors (for optimization)
// ============================================================================

export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;
export const selectTheme = (state: UIStore) => state.theme;
export const selectActiveView = (state: UIStore) => state.activeView;

export default useUIStore;
