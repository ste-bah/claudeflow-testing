/**
 * AppLayout Component
 *
 * Main application layout with header, sidebar, and content areas.
 * Provides responsive layout with collapsible panels.
 *
 * @module components/layout/AppLayout
 */

import { ReactNode, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { ErrorBoundary, SectionErrorFallback } from '../common/ErrorBoundary';
import { LoadingOverlay } from '../common/Loading';
import { useUIStore } from '../../stores/uiStore';
import { useGraphStore } from '../../stores/graphStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import './AppLayout.css';

// ============================================================================
// Types
// ============================================================================

interface AppLayoutProps {
  children: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function AppLayout({ children }: AppLayoutProps): JSX.Element {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen);
  const leftPanelOpen = useUIStore((state) => state.leftPanelOpen);
  const isLoading = useGraphStore((state) => state.isLoading);
  const loadingMessage = useGraphStore((state) => state.loadingMessage);
  const loadingProgress = useGraphStore((state) => state.loadingProgress);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for modifier keys
    const isMod = e.metaKey || e.ctrlKey;

    // Toggle sidebar: Cmd/Ctrl + B
    if (isMod && e.key === 'b') {
      e.preventDefault();
      useUIStore.getState().toggleSidebar();
    }

    // Toggle search: Cmd/Ctrl + K
    if (isMod && e.key === 'k') {
      e.preventDefault();
      useUIStore.getState().toggleSearchPanel();
    }

    // Escape to close modals/panels
    if (e.key === 'Escape') {
      const state = useUIStore.getState();
      if (state.modalOpen) {
        state.closeModal();
      } else if (state.settingsModalOpen) {
        state.toggleSettingsModal();
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={clsx('app-layout', {
        'app-layout--sidebar-collapsed': sidebarCollapsed,
        'app-layout--right-panel-closed': !rightPanelOpen,
        'app-layout--left-panel-closed': !leftPanelOpen,
      })}
    >
      {/* Header */}
      <ErrorBoundary
        fallback={
          <div className="app-layout__header app-layout__header--error">
            <SectionErrorFallback
              title="Header Error"
              message="Failed to load header"
              onRetry={() => window.location.reload()}
            />
          </div>
        }
      >
        <Header className="app-layout__header" />
      </ErrorBoundary>

      {/* Main container */}
      <div className="app-layout__container">
        {/* Sidebar */}
        <ErrorBoundary
          fallback={
            <aside className="app-layout__sidebar app-layout__sidebar--error">
              <SectionErrorFallback
                title="Sidebar Error"
                message="Failed to load sidebar"
              />
            </aside>
          }
        >
          <Sidebar className="app-layout__sidebar" />
        </ErrorBoundary>

        {/* Main content area */}
        <main className="app-layout__main">
          <ErrorBoundary
            fallback={
              <div className="app-layout__content app-layout__content--error">
                <SectionErrorFallback
                  title="Content Error"
                  message="Failed to load content"
                  onRetry={() => window.location.reload()}
                />
              </div>
            }
          >
            <div className="app-layout__content">{children}</div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Loading overlay */}
      <LoadingOverlay
        isLoading={isLoading}
        message={loadingMessage || undefined}
        progress={loadingProgress || undefined}
      />
    </div>
  );
}

// ============================================================================
// Sub-layouts for different views
// ============================================================================

interface ContentPanelProps {
  children: ReactNode;
  className?: string;
}

export function ContentPanel({ children, className }: ContentPanelProps): JSX.Element {
  return <div className={clsx('content-panel', className)}>{children}</div>;
}

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string | number;
  className?: string;
}

export function SplitLayout({
  left,
  right,
  leftWidth = '50%',
  className,
}: SplitLayoutProps): JSX.Element {
  return (
    <div className={clsx('split-layout', className)}>
      <div className="split-layout__left" style={{ width: leftWidth }}>
        {left}
      </div>
      <div className="split-layout__right">{right}</div>
    </div>
  );
}

interface StackLayoutProps {
  children: ReactNode;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StackLayout({
  children,
  gap = 'md',
  className,
}: StackLayoutProps): JSX.Element {
  return (
    <div className={clsx('stack-layout', `stack-layout--gap-${gap}`, className)}>
      {children}
    </div>
  );
}

export default AppLayout;
