/**
 * Sidebar Component
 *
 * Navigation sidebar with collapsible sections.
 *
 * @module components/layout/Sidebar
 */

import { useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Network,
  Database,
  BarChart3,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import './Sidebar.css';

// ============================================================================
// Types
// ============================================================================

interface SidebarProps {
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  view: 'graph' | 'dashboard' | 'memory' | 'statistics';
  badge?: number;
}

// ============================================================================
// Navigation Items
// ============================================================================

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    view: 'dashboard',
  },
  {
    id: 'graph',
    label: 'Graph View',
    icon: Network,
    view: 'graph',
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    view: 'memory',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    icon: BarChart3,
    view: 'statistics',
  },
];

interface ToolItem {
  id: string;
  label: string;
  icon: typeof Filter;
  action: () => void;
  badge?: number;
}

// ============================================================================
// Component
// ============================================================================

export function Sidebar({ className }: SidebarProps): JSX.Element {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const activeView = useUIStore((state) => state.activeView);
  const filterPanelOpen = useUIStore((state) => state.filterPanelOpen);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleFilterPanel = useUIStore((state) => state.toggleFilterPanel);

  const handleNavClick = useCallback(
    (view: NavItem['view']) => {
      setActiveView(view);
    },
    [setActiveView]
  );

  const toolItems: ToolItem[] = useMemo(
    () => [
      {
        id: 'filters',
        label: 'Filters',
        icon: Filter,
        action: toggleFilterPanel,
        badge: filterPanelOpen ? undefined : 0, // Could show active filter count
      },
      {
        id: 'layers',
        label: 'Layers',
        icon: Layers,
        action: () => {
          // Layer management - to be implemented
          console.log('Layer management - to be implemented');
        },
      },
    ],
    [filterPanelOpen, toggleFilterPanel]
  );

  return (
    <aside
      className={clsx('sidebar', className, {
        'sidebar--collapsed': sidebarCollapsed,
      })}
      aria-label="Main navigation"
    >
      {/* Navigation section */}
      <nav className="sidebar__nav">
        <div className="sidebar__section">
          {!sidebarCollapsed && (
            <h2 className="sidebar__section-title">Navigation</h2>
          )}
          <ul className="sidebar__nav-list" role="menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;

              return (
                <li key={item.id} role="none">
                  <button
                    className={clsx('sidebar__nav-item', {
                      'sidebar__nav-item--active': isActive,
                    })}
                    onClick={() => handleNavClick(item.view)}
                    role="menuitem"
                    aria-current={isActive ? 'page' : undefined}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className="sidebar__nav-icon"
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="sidebar__nav-label">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="sidebar__nav-badge">{item.badge}</span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Tools section */}
        <div className="sidebar__section">
          {!sidebarCollapsed && (
            <h2 className="sidebar__section-title">Tools</h2>
          )}
          <ul className="sidebar__nav-list" role="menu">
            {toolItems.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.id} role="none">
                  <button
                    className="sidebar__nav-item"
                    onClick={item.action}
                    role="menuitem"
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className="sidebar__nav-icon"
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="sidebar__nav-label">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="sidebar__nav-badge">{item.badge}</span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="sidebar__footer">
        <button
          className="sidebar__collapse-btn"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={20} />
          ) : (
            <>
              <ChevronLeft size={20} />
              <span className="sidebar__collapse-text">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
