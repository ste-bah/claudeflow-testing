/**
 * useGraphLayout Hook
 *
 * React hook for managing graph layouts. Provides layout switching,
 * configuration, and animation control.
 *
 * @module hooks/useGraphLayout
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { LayoutType } from '@/types/graph';
import { CytoscapeManager } from '@/services/graph/CytoscapeManager';
import {
  createLayoutOptions,
  getDefaultLayoutOptions,
  LAYOUT_METADATA,
  getRecommendedLayout,
  type LayoutMetadata,
} from '@/services/graph/layouts';
import { useGraphStore } from '@/stores/graphStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useGraphLayout hook
 */
export interface UseGraphLayoutOptions {
  /** CytoscapeManager instance */
  manager: CytoscapeManager | null;
  /** Initial layout type */
  initialLayout?: LayoutType;
  /** Whether to auto-fit after layout */
  autoFit?: boolean;
  /** Animation duration override */
  animationDuration?: number;
  /** Callback when layout starts */
  onLayoutStart?: (layout: LayoutType) => void;
  /** Callback when layout completes */
  onLayoutComplete?: (layout: LayoutType, duration: number) => void;
}

/**
 * Layout options that can be modified
 */
export interface LayoutOptionsOverrides {
  /** Whether to animate */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Whether to fit after layout */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Layout-specific options */
  [key: string]: unknown;
}

/**
 * Return type of useGraphLayout hook
 */
export interface UseGraphLayoutReturn {
  /** Current layout type */
  currentLayout: LayoutType;
  /** Whether a layout is currently running */
  isLayouting: boolean;
  /** Available layouts with metadata */
  availableLayouts: LayoutMetadata[];
  /** Current layout options */
  currentOptions: Record<string, unknown>;
  /** Apply a layout */
  applyLayout: (layout: LayoutType, options?: LayoutOptionsOverrides) => Promise<void>;
  /** Re-run current layout */
  rerunLayout: (options?: LayoutOptionsOverrides) => Promise<void>;
  /** Stop running layout */
  stopLayout: () => void;
  /** Set layout options without running */
  setLayoutOptions: (options: LayoutOptionsOverrides) => void;
  /** Get recommended layout for a use case */
  getRecommended: (useCase: string) => LayoutType;
  /** Reset options to defaults */
  resetOptions: () => void;
  /** Toggle animation */
  toggleAnimation: () => void;
  /** Whether animation is enabled */
  isAnimationEnabled: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for managing graph layouts
 */
export function useGraphLayout(options: UseGraphLayoutOptions): UseGraphLayoutReturn {
  const {
    manager,
    initialLayout = 'force',
    autoFit = true,
    animationDuration,
    onLayoutStart,
    onLayoutComplete,
  } = options;

  // Store state
  const {
    currentLayout: storeLayout,
    isLayouting: storeIsLayouting,
    setLayout: setStoreLayout,
    setLayouting: setStoreLayouting,
    setLayoutOptions: setStoreLayoutOptions,
  } = useGraphStore();

  // Local state
  const [currentLayout, setCurrentLayout] = useState<LayoutType>(initialLayout);
  const [isLayouting, setIsLayouting] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<Record<string, unknown>>(
    getDefaultLayoutOptions(initialLayout) as Record<string, unknown>
  );
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(true);

  // Sync with store
  useEffect(() => {
    setCurrentLayout(storeLayout);
  }, [storeLayout]);

  useEffect(() => {
    setIsLayouting(storeIsLayouting);
  }, [storeIsLayouting]);

  // Available layouts
  const availableLayouts = useMemo(() => LAYOUT_METADATA, []);

  // Apply layout
  const applyLayout = useCallback(
    async (layout: LayoutType, overrides?: LayoutOptionsOverrides): Promise<void> => {
      if (!manager) return;

      const startTime = Date.now();
      setIsLayouting(true);
      setStoreLayouting(true);
      onLayoutStart?.(layout);

      try {
        // Merge options
        const baseOptions = getDefaultLayoutOptions(layout);
        const mergedOptions: Record<string, unknown> = {
          ...baseOptions,
          ...currentOptions,
          ...overrides,
        };

        // Override animation duration if specified
        if (animationDuration !== undefined) {
          mergedOptions.animationDuration = animationDuration;
        }

        // Respect animation toggle
        if (!isAnimationEnabled) {
          mergedOptions.animate = false;
        }

        // Create layout options
        const layoutOptions = createLayoutOptions(layout, mergedOptions);

        // Run layout
        await manager.runLayout(layout, layoutOptions);

        // Auto-fit if enabled
        if (autoFit) {
          manager.fit(mergedOptions.padding as number ?? 50);
        }

        // Update state
        setCurrentLayout(layout);
        setStoreLayout(layout);
        setCurrentOptions(mergedOptions);
        setStoreLayoutOptions(mergedOptions);

        const duration = Date.now() - startTime;
        onLayoutComplete?.(layout, duration);
      } finally {
        setIsLayouting(false);
        setStoreLayouting(false);
      }
    },
    [
      manager,
      currentOptions,
      animationDuration,
      isAnimationEnabled,
      autoFit,
      setStoreLayout,
      setStoreLayouting,
      setStoreLayoutOptions,
      onLayoutStart,
      onLayoutComplete,
    ]
  );

  // Re-run current layout
  const rerunLayout = useCallback(
    async (overrides?: LayoutOptionsOverrides): Promise<void> => {
      await applyLayout(currentLayout, overrides);
    },
    [applyLayout, currentLayout]
  );

  // Stop layout
  const stopLayout = useCallback(() => {
    manager?.stopLayout();
    setIsLayouting(false);
    setStoreLayouting(false);
  }, [manager, setStoreLayouting]);

  // Set layout options without running
  const setLayoutOptions = useCallback(
    (overrides: LayoutOptionsOverrides) => {
      setCurrentOptions((prev) => ({ ...prev, ...overrides }));
      setStoreLayoutOptions(overrides);
    },
    [setStoreLayoutOptions]
  );

  // Get recommended layout
  const getRecommended = useCallback((useCase: string): LayoutType => {
    return getRecommendedLayout(useCase);
  }, []);

  // Reset options to defaults
  const resetOptions = useCallback(() => {
    const defaults = getDefaultLayoutOptions(currentLayout) as Record<string, unknown>;
    setCurrentOptions(defaults);
    setStoreLayoutOptions(defaults);
  }, [currentLayout, setStoreLayoutOptions]);

  // Toggle animation
  const toggleAnimation = useCallback(() => {
    setIsAnimationEnabled((prev) => !prev);
  }, []);

  return {
    currentLayout,
    isLayouting,
    availableLayouts,
    currentOptions,
    applyLayout,
    rerunLayout,
    stopLayout,
    setLayoutOptions,
    getRecommended,
    resetOptions,
    toggleAnimation,
    isAnimationEnabled,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for quick layout switching
 */
export function useQuickLayout(manager: CytoscapeManager | null) {
  const { applyLayout, currentLayout, isLayouting } = useGraphLayout({
    manager,
  });

  const switchToForce = useCallback(() => applyLayout('force'), [applyLayout]);
  const switchToHierarchical = useCallback(() => applyLayout('hierarchical'), [applyLayout]);
  const switchToRadial = useCallback(() => applyLayout('radial'), [applyLayout]);
  const switchToTimeline = useCallback(() => applyLayout('timeline'), [applyLayout]);
  const switchToGrid = useCallback(() => applyLayout('grid'), [applyLayout]);
  const switchToConcentric = useCallback(() => applyLayout('concentric'), [applyLayout]);

  return {
    currentLayout,
    isLayouting,
    switchToForce,
    switchToHierarchical,
    switchToRadial,
    switchToTimeline,
    switchToGrid,
    switchToConcentric,
  };
}

/**
 * Hook for layout presets
 */
export function useLayoutPresets(manager: CytoscapeManager | null) {
  const { applyLayout } = useGraphLayout({ manager });

  const applyCompactForce = useCallback(
    () =>
      applyLayout('force', {
        nodeRepulsion: 3000,
        idealEdgeLength: 60,
        gravity: 0.5,
        padding: 30,
      }),
    [applyLayout]
  );

  const applySpreadForce = useCallback(
    () =>
      applyLayout('force', {
        nodeRepulsion: 6000,
        idealEdgeLength: 150,
        gravity: 0.15,
        padding: 80,
      }),
    [applyLayout]
  );

  const applyTopDown = useCallback(
    () =>
      applyLayout('hierarchical', {
        direction: 'TB',
        rankSep: 100,
        nodeSep: 50,
      }),
    [applyLayout]
  );

  const applyLeftRight = useCallback(
    () =>
      applyLayout('hierarchical', {
        direction: 'LR',
        rankSep: 120,
        nodeSep: 40,
      }),
    [applyLayout]
  );

  const applyDenseGrid = useCallback(
    () =>
      applyLayout('grid', {
        condense: true,
        spacingFactor: 0.8,
        padding: 30,
      }),
    [applyLayout]
  );

  return {
    applyCompactForce,
    applySpreadForce,
    applyTopDown,
    applyLeftRight,
    applyDenseGrid,
  };
}

/**
 * Hook for auto-layout based on graph characteristics
 */
export function useAutoLayout(
  manager: CytoscapeManager | null,
  nodeCount: number,
  edgeCount: number
): {
  suggestedLayout: LayoutType;
  applySuggested: () => Promise<void>;
} {
  const { applyLayout } = useGraphLayout({ manager });

  const suggestedLayout = useMemo((): LayoutType => {
    // Calculate graph density
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

    // Suggest based on characteristics
    if (nodeCount <= 10) {
      return 'force'; // Small graphs work well with force
    }

    if (density > 0.3) {
      return 'grid'; // Dense graphs need structured layout
    }

    if (density < 0.1) {
      return 'hierarchical'; // Sparse graphs often have hierarchy
    }

    if (nodeCount > 100) {
      return 'force'; // Large graphs benefit from force-directed
    }

    return 'force'; // Default
  }, [nodeCount, edgeCount]);

  const applySuggested = useCallback(() => {
    return applyLayout(suggestedLayout);
  }, [applyLayout, suggestedLayout]);

  return { suggestedLayout, applySuggested };
}
