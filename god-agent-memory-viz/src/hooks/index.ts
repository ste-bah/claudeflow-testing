/**
 * Hooks Index
 *
 * Re-exports all custom React hooks for the application.
 *
 * @module hooks
 */

// Database hooks
export * from './useDatabase';

// Search hooks
export * from './useSearch';

// Keyboard hooks
export * from './useKeyboard';

// Error handling hooks
export * from './useErrorHandler';

// Loading state hooks
export * from './useLoading';

// Graph hooks
export {
  useCytoscape,
  useCytoscapeEvent,
  useCytoscapeSelection,
  useCytoscapeViewport,
  type UseCytoscapeOptions,
  type UseCytoscapeReturn,
} from './useCytoscape';

export {
  useGraphLayout,
  useQuickLayout,
  useLayoutPresets,
  useAutoLayout,
  type UseGraphLayoutOptions,
  type LayoutOptionsOverrides,
  type UseGraphLayoutReturn,
} from './useGraphLayout';

export {
  useNodeInteraction,
  useSimpleSelection,
  useNodeHover,
  useEdgeInteraction,
  type UseNodeInteractionOptions,
  type TooltipState,
  type ContextMenuState,
  type UseNodeInteractionReturn,
} from './useNodeInteraction';

// Export hooks
export {
  useExport,
  type UseExportOptions,
  type UseExportReturn,
} from './useExport';
