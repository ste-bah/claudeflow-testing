/**
 * GraphService - High-level graph operations
 *
 * Provides business logic layer for graph operations, coordinating between
 * the CytoscapeManager, stores, and the rest of the application.
 *
 * @module services/graph/GraphService
 */

import type {
  GraphNode,
  GraphEdge,
  GraphData,
  LayoutType,
  NodeType,
  EdgeType,
  Position,
  GraphStats,
} from '@/types/graph';
import {
  CytoscapeManager,
  type CytoscapeEventType,
  type CytoscapeEventListener,
  type NodeEventPayload,
  type EdgeEventPayload,
  type SelectionEventPayload,
} from './CytoscapeManager';
import { createLayoutOptions } from './layouts';
import { getDefaultStylesheet, getDarkModeStylesheet } from './styles';
import { computeGraphStats, findShortestPath, computeNodeCentrality } from './analytics';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the GraphService
 */
export interface GraphServiceConfig {
  /** HTML container element for the graph */
  container: HTMLElement;
  /** Initial graph data */
  initialData?: GraphData;
  /** Initial layout type */
  initialLayout?: LayoutType;
  /** Whether to use dark mode */
  darkMode?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
}

/**
 * Graph query options for filtering
 */
export interface GraphQueryOptions {
  nodeTypes?: NodeType[];
  edgeTypes?: EdgeType[];
  sessionIds?: string[];
  timeRange?: { start: Date; end: Date };
  searchTerm?: string;
}

/**
 * Result of a graph search
 */
export interface GraphSearchResult {
  nodeIds: string[];
  edgeIds: string[];
  matchCount: number;
  query: string;
}

/**
 * Node neighborhood information
 */
export interface NodeNeighborhood {
  nodeId: string;
  neighbors: string[];
  incomingEdges: string[];
  outgoingEdges: string[];
  degree: number;
}

/**
 * Path between two nodes
 */
export interface GraphPath {
  nodeIds: string[];
  edgeIds: string[];
  length: number;
  exists: boolean;
}

// ============================================================================
// GraphService Class
// ============================================================================

/**
 * High-level service for graph operations
 */
export class GraphService {
  private cytoscapeManager: CytoscapeManager;
  private currentData: GraphData | null = null;
  private currentLayout: LayoutType = 'force';
  private isDarkMode = false;
  private isInitialized = false;

  constructor() {
    this.cytoscapeManager = new CytoscapeManager();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the graph service
   */
  async initialize(config: GraphServiceConfig): Promise<void> {
    const stylesheet = config.darkMode
      ? getDarkModeStylesheet()
      : getDefaultStylesheet();

    this.isDarkMode = config.darkMode ?? false;
    this.currentLayout = config.initialLayout ?? 'force';

    await this.cytoscapeManager.init({
      container: config.container,
      data: config.initialData,
      style: stylesheet,
      layout: this.currentLayout,
      minZoom: config.minZoom ?? 0.1,
      maxZoom: config.maxZoom ?? 3,
    });

    if (config.initialData) {
      this.currentData = config.initialData;
    }

    this.isInitialized = true;
  }

  /**
   * Destroy the graph service
   */
  destroy(): void {
    this.cytoscapeManager.destroy();
    this.currentData = null;
    this.isInitialized = false;
  }

  /**
   * Check if service is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the CytoscapeManager instance
   */
  getCytoscapeManager(): CytoscapeManager {
    return this.cytoscapeManager;
  }

  // ============================================================================
  // Data Operations
  // ============================================================================

  /**
   * Load graph data
   */
  async loadData(data: GraphData): Promise<void> {
    this.currentData = data;
    await this.cytoscapeManager.loadData(data, true);
  }

  /**
   * Get current graph data
   */
  getData(): GraphData | null {
    return this.currentData;
  }

  /**
   * Clear all graph data
   */
  clear(): void {
    this.cytoscapeManager.clear();
    this.currentData = { nodes: [], edges: [] };
  }

  /**
   * Add nodes to the graph
   */
  addNodes(nodes: GraphNode[]): void {
    this.cytoscapeManager.addNodes(nodes);
    if (this.currentData) {
      this.currentData.nodes.push(...nodes);
    }
  }

  /**
   * Add edges to the graph
   */
  addEdges(edges: GraphEdge[]): void {
    this.cytoscapeManager.addEdges(edges);
    if (this.currentData) {
      this.currentData.edges.push(...edges);
    }
  }

  /**
   * Remove nodes from the graph
   */
  removeNodes(nodeIds: string[]): void {
    this.cytoscapeManager.removeNodes(nodeIds);
    if (this.currentData) {
      const nodeIdSet = new Set(nodeIds);
      this.currentData.nodes = this.currentData.nodes.filter(
        (n) => !nodeIdSet.has(n.id)
      );
      this.currentData.edges = this.currentData.edges.filter(
        (e) => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)
      );
    }
  }

  /**
   * Remove edges from the graph
   */
  removeEdges(edgeIds: string[]): void {
    this.cytoscapeManager.removeEdges(edgeIds);
    if (this.currentData) {
      const edgeIdSet = new Set(edgeIds);
      this.currentData.edges = this.currentData.edges.filter(
        (e) => !edgeIdSet.has(e.id)
      );
    }
  }

  /**
   * Update a node's data
   */
  updateNode(nodeId: string, updates: Partial<GraphNode>): void {
    this.cytoscapeManager.updateNode(nodeId, updates.data ?? {});
    if (this.currentData) {
      const node = this.currentData.nodes.find((n) => n.id === nodeId);
      if (node) {
        Object.assign(node, updates);
      }
    }
  }

  /**
   * Update an edge's data
   */
  updateEdge(edgeId: string, updates: Partial<GraphEdge>): void {
    this.cytoscapeManager.updateEdge(edgeId, updates.data ?? {});
    if (this.currentData) {
      const edge = this.currentData.edges.find((e) => e.id === edgeId);
      if (edge) {
        Object.assign(edge, updates);
      }
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): GraphNode | null {
    return this.currentData?.nodes.find((n) => n.id === nodeId) ?? null;
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): GraphEdge | null {
    return this.currentData?.edges.find((e) => e.id === edgeId) ?? null;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: NodeType): GraphNode[] {
    return this.currentData?.nodes.filter((n) => n.type === type) ?? [];
  }

  /**
   * Get edges by type
   */
  getEdgesByType(type: EdgeType): GraphEdge[] {
    return this.currentData?.edges.filter((e) => e.type === type) ?? [];
  }

  /**
   * Query nodes with filters
   */
  queryNodes(options: GraphQueryOptions): GraphNode[] {
    if (!this.currentData) return [];

    let nodes = [...this.currentData.nodes];

    // Filter by node types
    if (options.nodeTypes && options.nodeTypes.length > 0) {
      const typeSet = new Set(options.nodeTypes);
      nodes = nodes.filter((n) => typeSet.has(n.type));
    }

    // Filter by session IDs
    if (options.sessionIds && options.sessionIds.length > 0) {
      const sessionSet = new Set(options.sessionIds);
      nodes = nodes.filter((n) => n.data.sessionId && sessionSet.has(n.data.sessionId));
    }

    // Filter by time range
    if (options.timeRange) {
      const { start, end } = options.timeRange;
      nodes = nodes.filter((n) => {
        if (!n.data.timestamp) return true;
        const ts = new Date(n.data.timestamp);
        return ts >= start && ts <= end;
      });
    }

    // Filter by search term
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      nodes = nodes.filter((n) => {
        const label = n.label.toLowerCase();
        const id = n.id.toLowerCase();
        return label.includes(term) || id.includes(term);
      });
    }

    return nodes;
  }

  /**
   * Search the graph
   */
  search(query: string): GraphSearchResult {
    const term = query.toLowerCase().trim();

    if (!term || !this.currentData) {
      return { nodeIds: [], edgeIds: [], matchCount: 0, query };
    }

    const matchingNodeIds: string[] = [];
    const matchingEdgeIds: string[] = [];

    // Search nodes
    for (const node of this.currentData.nodes) {
      const searchableText = [
        node.id,
        node.label,
        node.type,
        node.data.sessionId,
        node.data.agentId,
        node.data.memoryKey,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchableText.includes(term)) {
        matchingNodeIds.push(node.id);
      }
    }

    // Search edges
    for (const edge of this.currentData.edges) {
      const searchableText = [edge.id, edge.type, edge.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchableText.includes(term)) {
        matchingEdgeIds.push(edge.id);
      }
    }

    return {
      nodeIds: matchingNodeIds,
      edgeIds: matchingEdgeIds,
      matchCount: matchingNodeIds.length + matchingEdgeIds.length,
      query,
    };
  }

  /**
   * Get node neighborhood information
   */
  getNodeNeighborhood(nodeId: string): NodeNeighborhood | null {
    if (!this.currentData) return null;

    const incomingEdges: string[] = [];
    const outgoingEdges: string[] = [];
    const neighbors = new Set<string>();

    for (const edge of this.currentData.edges) {
      if (edge.source === nodeId) {
        outgoingEdges.push(edge.id);
        neighbors.add(edge.target);
      }
      if (edge.target === nodeId) {
        incomingEdges.push(edge.id);
        neighbors.add(edge.source);
      }
    }

    return {
      nodeId,
      neighbors: Array.from(neighbors),
      incomingEdges,
      outgoingEdges,
      degree: neighbors.size,
    };
  }

  /**
   * Find path between two nodes
   */
  findPath(sourceId: string, targetId: string): GraphPath {
    if (!this.currentData) {
      return { nodeIds: [], edgeIds: [], length: -1, exists: false };
    }

    const result = findShortestPath(this.currentData, sourceId, targetId);

    return {
      nodeIds: result.path,
      edgeIds: result.edges,
      length: result.distance,
      exists: result.distance >= 0,
    };
  }

  // ============================================================================
  // Layout Operations
  // ============================================================================

  /**
   * Apply a layout
   */
  async applyLayout(layoutType: LayoutType, options?: Record<string, unknown>): Promise<void> {
    this.currentLayout = layoutType;
    const layoutOptions = createLayoutOptions(layoutType, options);
    await this.cytoscapeManager.runLayout(layoutType, layoutOptions);
  }

  /**
   * Get current layout type
   */
  getCurrentLayout(): LayoutType {
    return this.currentLayout;
  }

  /**
   * Stop any running layout
   */
  stopLayout(): void {
    this.cytoscapeManager.stopLayout();
  }

  // ============================================================================
  // Selection Operations
  // ============================================================================

  /**
   * Select nodes
   */
  selectNodes(nodeIds: string[], additive = false): void {
    this.cytoscapeManager.selectNodes(nodeIds, additive);
  }

  /**
   * Select edges
   */
  selectEdges(edgeIds: string[], additive = false): void {
    this.cytoscapeManager.selectEdges(edgeIds, additive);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.cytoscapeManager.clearSelection();
  }

  /**
   * Select all elements
   */
  selectAll(): void {
    this.cytoscapeManager.selectAll();
  }

  /**
   * Get selected node IDs
   */
  getSelectedNodeIds(): string[] {
    return this.cytoscapeManager.getSelectedNodeIds();
  }

  /**
   * Get selected edge IDs
   */
  getSelectedEdgeIds(): string[] {
    return this.cytoscapeManager.getSelectedEdgeIds();
  }

  /**
   * Select neighbors of a node
   */
  selectNeighbors(nodeId: string): void {
    const neighbors = this.cytoscapeManager.getNeighbors(nodeId);
    this.selectNodes([nodeId, ...neighbors]);
  }

  // ============================================================================
  // Viewport Operations
  // ============================================================================

  /**
   * Fit graph to viewport
   */
  fitToViewport(padding = 50): void {
    this.cytoscapeManager.fit(padding);
  }

  /**
   * Center on nodes
   */
  centerOnNodes(nodeIds: string[], zoom?: number): void {
    this.cytoscapeManager.centerOnNodes(nodeIds, zoom);
  }

  /**
   * Zoom in
   */
  zoomIn(factor = 1.2): void {
    this.cytoscapeManager.zoomIn(factor);
  }

  /**
   * Zoom out
   */
  zoomOut(factor = 1.2): void {
    this.cytoscapeManager.zoomOut(factor);
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.cytoscapeManager.setZoom(zoom);
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.cytoscapeManager.getZoom();
  }

  /**
   * Pan to position
   */
  panTo(position: Position): void {
    this.cytoscapeManager.setPan(position);
  }

  /**
   * Reset viewport
   */
  resetViewport(): void {
    this.cytoscapeManager.resetViewport();
  }

  // ============================================================================
  // Highlighting Operations
  // ============================================================================

  /**
   * Highlight nodes temporarily
   */
  highlightNodes(nodeIds: string[], duration = 1000): void {
    this.cytoscapeManager.highlightNodes(nodeIds, duration);
  }

  /**
   * Highlight edges temporarily
   */
  highlightEdges(edgeIds: string[], duration = 1000): void {
    this.cytoscapeManager.highlightEdges(edgeIds, duration);
  }

  /**
   * Dim non-highlighted elements
   */
  dimOthers(nodeIds: string[]): void {
    this.cytoscapeManager.dimOthers(nodeIds);
  }

  /**
   * Remove all dim effects
   */
  undimAll(): void {
    this.cytoscapeManager.undimAll();
  }

  /**
   * Focus on a node (highlight it and its neighbors)
   */
  focusOnNode(nodeId: string): void {
    const neighbors = this.cytoscapeManager.getNeighbors(nodeId);
    this.dimOthers([nodeId, ...neighbors]);
    this.highlightNodes([nodeId], 2000);
  }

  // ============================================================================
  // Statistics Operations
  // ============================================================================

  /**
   * Get graph statistics
   */
  getStats(): GraphStats | null {
    if (!this.currentData) return null;
    return computeGraphStats(this.currentData);
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.currentData?.nodes.length ?? 0;
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    return this.currentData?.edges.length ?? 0;
  }

  /**
   * Compute centrality for all nodes
   */
  computeCentrality(): Map<string, number> {
    if (!this.currentData) return new Map();
    return computeNodeCentrality(this.currentData);
  }

  // ============================================================================
  // Theme Operations
  // ============================================================================

  /**
   * Toggle dark mode
   */
  setDarkMode(enabled: boolean): void {
    this.isDarkMode = enabled;
    const stylesheet = enabled ? getDarkModeStylesheet() : getDefaultStylesheet();
    this.cytoscapeManager.setStylesheet(stylesheet);
  }

  /**
   * Get dark mode state
   */
  getIsDarkMode(): boolean {
    return this.isDarkMode;
  }

  // ============================================================================
  // Export Operations
  // ============================================================================

  /**
   * Export graph as PNG
   */
  exportPNG(options?: { scale?: number; bg?: string }): string | null {
    return this.cytoscapeManager.exportPNG(options);
  }

  /**
   * Export graph as SVG
   */
  exportSVG(): string | null {
    return this.cytoscapeManager.exportSVG();
  }

  /**
   * Export graph data as JSON
   */
  exportJSON(): GraphData | null {
    return this.currentData;
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to graph events
   */
  on<T>(event: CytoscapeEventType, listener: CytoscapeEventListener<T>): () => void {
    return this.cytoscapeManager.on(event, listener);
  }

  /**
   * Subscribe to node click events
   */
  onNodeClick(listener: CytoscapeEventListener<NodeEventPayload>): () => void {
    return this.on('node:click', listener);
  }

  /**
   * Subscribe to node double-click events
   */
  onNodeDoubleClick(listener: CytoscapeEventListener<NodeEventPayload>): () => void {
    return this.on('node:dblclick', listener);
  }

  /**
   * Subscribe to node hover events
   */
  onNodeHover(listener: CytoscapeEventListener<NodeEventPayload>): () => void {
    return this.on('node:hover', listener);
  }

  /**
   * Subscribe to node leave events
   */
  onNodeLeave(listener: CytoscapeEventListener<NodeEventPayload>): () => void {
    return this.on('node:leave', listener);
  }

  /**
   * Subscribe to edge click events
   */
  onEdgeClick(listener: CytoscapeEventListener<EdgeEventPayload>): () => void {
    return this.on('edge:click', listener);
  }

  /**
   * Subscribe to selection change events
   */
  onSelectionChange(listener: CytoscapeEventListener<SelectionEventPayload>): () => void {
    return this.on('select', listener);
  }
}

// Export singleton instance
export const graphService = new GraphService();
