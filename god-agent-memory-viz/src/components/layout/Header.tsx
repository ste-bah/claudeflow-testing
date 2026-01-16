/**
 * Header Component
 *
 * Application header with navigation, search, and controls.
 *
 * @module components/layout/Header
 */

import { useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Menu,
  Search,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  HelpCircle,
  Settings,
  Database,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useGraphStore } from '../../stores/graphStore';
import type { Theme } from '../../types/ui';
import './Header.css';

// ============================================================================
// Types
// ============================================================================

interface HeaderProps {
  className?: string;
}

// ============================================================================
// Theme Icon Map
// ============================================================================

const themeIcons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const themeLabels: Record<Theme, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

// ============================================================================
// Component
// ============================================================================

export function Header({ className }: HeaderProps): JSX.Element {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const theme = useUIStore((state) => state.theme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const cycleTheme = useUIStore((state) => state.cycleTheme);
  const toggleSearchPanel = useUIStore((state) => state.toggleSearchPanel);
  const toggleSettingsModal = useUIStore((state) => state.toggleSettingsModal);

  const isLoading = useGraphStore((state) => state.isLoading);
  const refreshData = useGraphStore((state) => state.refreshData);

  const handleRefresh = useCallback(() => {
    if (!isLoading) {
      refreshData();
    }
  }, [isLoading, refreshData]);

  const handleHelp = useCallback(() => {
    useUIStore.getState().openModal('help');
  }, []);

  const ThemeIcon = themeIcons[theme];

  return (
    <header className={clsx('header', className)}>
      {/* Left section */}
      <div className="header__left">
        <button
          className={clsx('header__menu-btn', {
            'header__menu-btn--active': !sidebarCollapsed,
          })}
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
        >
          <Menu size={20} />
        </button>

        <div className="header__brand">
          <Database size={24} className="header__logo" />
          <div className="header__title-group">
            <h1 className="header__title">God Agent Memory</h1>
            <span className="header__subtitle">Visualization</span>
          </div>
        </div>
      </div>

      {/* Center section - Search */}
      <div className="header__center">
        <button
          className="header__search-btn"
          onClick={toggleSearchPanel}
          title="Search (Ctrl+K)"
          aria-label="Open search"
        >
          <Search size={16} />
          <span className="header__search-text">Search nodes, events...</span>
          <kbd className="header__search-kbd">
            <span>Ctrl</span>
            <span>K</span>
          </kbd>
        </button>
      </div>

      {/* Right section - Actions */}
      <div className="header__right">
        <button
          className={clsx('header__action-btn', {
            'header__action-btn--loading': isLoading,
          })}
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <RefreshCw size={18} className={clsx({ 'animate-spin': isLoading })} />
        </button>

        <button
          className="header__action-btn"
          onClick={cycleTheme}
          title={`Theme: ${themeLabels[theme]}`}
          aria-label={`Change theme. Current: ${themeLabels[theme]}`}
        >
          <ThemeIcon size={18} />
        </button>

        <button
          className="header__action-btn"
          onClick={handleHelp}
          title="Help & Keyboard shortcuts"
          aria-label="Help"
        >
          <HelpCircle size={18} />
        </button>

        <button
          className="header__action-btn"
          onClick={toggleSettingsModal}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
