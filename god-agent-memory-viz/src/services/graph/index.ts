/**
 * Graph Services Index
 *
 * Re-exports all graph-related services, utilities, and types.
 *
 * @module services/graph
 */

// Core manager
export {
  CytoscapeManager,
  cytoscapeManager,
  type CytoscapeManagerConfig,
  type CytoscapeEventType,
  type CytoscapeEventListener,
  type NodeEventPayload,
  type EdgeEventPayload,
  type CanvasEventPayload,
  type ViewportEventPayload,
  type SelectionEventPayload,
} from './CytoscapeManager';

// High-level service
export {
  GraphService,
  graphService,
  type GraphServiceConfig,
  type GraphQueryOptions,
  type GraphSearchResult,
  type NodeNeighborhood,
  type GraphPath,
} from './GraphService';

// Layouts
export * from './layouts';

// Styles
export {
  getBaseNodeStyles,
  getNodeTypeStyles,
  getVisualNodeTypeStyles,
  getNodeStyles,
  getBaseEdgeStyles,
  getEdgeTypeStyles,
  getAdditionalEdgeStyles,
  getEdgeStyles,
  getSelectedStyles,
  getHoverStyles,
  getHighlightStyles,
  getDimmedStyles,
  getFocusStyles,
  getDarkModeNodeStyles,
  getDarkModeEdgeStyles,
  getDefaultStylesheet,
  getDarkModeStylesheet,
  createCustomStylesheet,
  getNodeTypeStyle,
  getEdgeTypeStyle,
  toStyleObject,
  mergeStylesheets,
} from './styles';

// Analytics
export {
  // Basic statistics
  computeGraphStats,
  countNodesByType,
  countEdgesByType,
  computeAverageDegree,
  computeNodeDegrees,
  computeInDegrees,
  computeOutDegrees,
  computeDensity,
  // Connectivity
  countConnectedComponents,
  getConnectedComponents,
  areNodesConnected,
  // Path finding
  findShortestPath,
  buildAdjacencyList,
  findAllPaths,
  type ShortestPathResult,
  // Centrality
  computeDegreeCentrality,
  computeBetweennessCentrality,
  computeClosenessCentrality,
  computeNodeCentrality,
  // Clustering
  computeLocalClusteringCoefficient,
  computeAverageClusteringCoefficient,
  // Neighbor analysis
  getNeighbors,
  getNeighborsAtDistance,
  getCommonNeighbors,
  // Graph comparison
  compareGraphs,
  // Subgraph extraction
  extractSubgraph,
  extractEgoNetwork,
} from './analytics';
