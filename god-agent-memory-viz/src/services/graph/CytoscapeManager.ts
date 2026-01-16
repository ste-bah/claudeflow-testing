/**
 * CytoscapeManager - Core Cytoscape.js wrapper class
 *
 * Manages Cytoscape.js instance lifecycle, data loading, event handling,
 * and viewport operations. This is the primary interface between the
 * application and Cytoscape.js rendering engine.
 *
 * @module services/graph/CytoscapeManager
 */

import cytoscape, {
  Core,
  NodeSingular,
  EdgeSingular,
  EventObject,
  LayoutOptions as CyLayoutOptions,
  ElementDefinition,
  NodeDefinition,
  EdgeDefinition,
  Position as CyPosition,
} from 'cytoscape';

// Stylesheet interface compatible with Cytoscape's StylesheetStyle
interface Stylesheet {
  selector: string;
  style: Record<string, unknown>;
}
// @ts-expect-error - cytoscape-dagre does not have types
import dagre from 'cytoscape-dagre';
// @ts-expect-error - cytoscape-fcose does not have types
import fcose from 'cytoscape-fcose';
// @ts-expect-error - cytoscape-cola does not have types
import cola from 'cytoscape-cola';

import type {
  GraphNode,
  GraphEdge,
  GraphData,
  LayoutType,
  Position,
  BoundingBox,
  Viewport,
} from '@/types/graph';
import { getNodeStyles, getEdgeStyles, getSelectedStyles, getHoverStyles } from './styles';
import type { LayoutName } from '@/constants/layouts';

// Register layout extensions
cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(cola);

// ============================================================================
// Types
// ============================================================================

/**
 * Event types emitted by CytoscapeManager
 */
export type CytoscapeEventType =
  | 'node:click'
  | 'node:dblclick'
  | 'node:hover'
  | 'node:leave'
  | 'node:drag:start'
  | 'node:drag'
  | 'node:drag:end'
  | 'edge:click'
  | 'edge:hover'
  | 'edge:leave'
  | 'canvas:click'
  | 'canvas:dblclick'
  | 'viewport:pan'
  | 'viewport:zoom'
  | 'layout:start'
  | 'layout:stop'
  | 'select'
  | 'unselect'
  | 'ready';

/**
 * Event payload for node events
 */
export interface NodeEventPayload {
  nodeId: string;
  position: Position;
  originalEvent?: MouseEvent;
}

/**
 * Event payload for edge events
 */
export interface EdgeEventPayload {
  edgeId: string;
  sourceId: string;
  targetId: string;
  originalEvent?: MouseEvent;
}

/**
 * Event payload for canvas events
 */
export interface CanvasEventPayload {
  position: Position;
  originalEvent?: MouseEvent;
}

/**
 * Event payload for viewport events
 */
export interface ViewportEventPayload {
  zoom: number;
  pan: Position;
}

/**
 * Event payload for selection events
 */
export interface SelectionEventPayload {
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * Event listener callback type
 */
export type CytoscapeEventListener<T = unknown> = (payload: T) => void;

/**
 * Configuration options for CytoscapeManager initialization
 */
export interface CytoscapeManagerConfig {
  /** Container element or selector */
  container: HTMLElement | string;
  /** Initial graph data */
  data?: GraphData;
  /** Initial stylesheet */
  style?: Stylesheet[];
  /** Initial layout type */
  layout?: LayoutType;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Initial zoom level */
  zoom?: number;
  /** Initial pan position */
  pan?: Position;
  /** Whether to enable box selection */
  boxSelectionEnabled?: boolean;
  /** Whether nodes are selectable */
  selectionType?: 'single' | 'additive';
  /** Whether to auto-ungrabify nodes during layout */
  autoungrabifyDuringLayout?: boolean;
}

// ============================================================================
// CytoscapeManager Class
// ============================================================================

/**
 * Manages Cytoscape.js instance and provides a clean API for graph operations
 */
export class CytoscapeManager {
  private cy: Core | null = null;
  private container: HTMLElement | null = null;
  private listeners: Map<CytoscapeEventType, Set<CytoscapeEventListener<unknown>>> = new Map();
  private isDestroyed = false;
  private currentLayoutName: LayoutName = 'fcose';
  /** Track highlight timeouts to prevent memory leaks */
  private highlightTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  /**
   * Initialize the Cytoscape instance
   */
  async init(config: CytoscapeManagerConfig): Promise<void> {
    if (this.cy) {
      this.destroy();
    }

    // Resolve container
    if (typeof config.container === 'string') {
      this.container = document.querySelector(config.container);
      if (!this.container) {
        throw new Error(`Container element not found: ${config.container}`);
      }
    } else {
      this.container = config.container;
    }

    // Convert graph data to Cytoscape elements
    const elements = config.data ? this.convertToElements(config.data) : [];

    // Create Cytoscape instance
    this.cy = cytoscape({
      container: this.container,
      elements,
      style: config.style ?? this.getDefaultStylesheet(),
      layout: { name: 'preset' }, // We'll run layout separately
      minZoom: config.minZoom ?? 0.1,
      maxZoom: config.maxZoom ?? 3,
      zoom: config.zoom ?? 1,
      pan: config.pan ?? { x: 0, y: 0 },
      boxSelectionEnabled: config.boxSelectionEnabled ?? true,
      selectionType: config.selectionType ?? 'single',
      autoungrabify: false,
    });

    this.isDestroyed = false;
    this.setupEventListeners();

    // Emit ready event
    this.emit('ready', undefined);

    // Run initial layout if data provided
    if (config.data && config.data.nodes.length > 0) {
      await this.runLayout(config.layout ?? 'force');
    }
  }

  /**
   * Destroy the Cytoscape instance and clean up
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.listeners.clear();

    // Clear all pending highlight timeouts to prevent memory leaks
    for (const timeout of this.highlightTimeouts) {
      clearTimeout(timeout);
    }
    this.highlightTimeouts.clear();

    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }

    this.container = null;
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.cy !== null && !this.isDestroyed;
  }

  /**
   * Get the Cytoscape Core instance (for advanced operations)
   */
  getCy(): Core | null {
    return this.cy;
  }

  // ============================================================================
  // Data Operations
  // ============================================================================

  /**
   * Load graph data into Cytoscape
   */
  async loadData(data: GraphData, runLayout = true): Promise<void> {
    if (!this.cy) return;

    const elements = this.convertToElements(data);

    // Clear existing elements and add new ones
    this.cy.elements().remove();
    this.cy.add(elements);

    if (runLayout) {
      await this.runLayout(this.currentLayoutName as LayoutType);
    }
  }

  /**
   * Add nodes to the graph
   */
  addNodes(nodes: GraphNode[]): void {
    if (!this.cy) return;

    const elements = nodes.map((node) => this.convertNodeToElement(node));
    this.cy.add(elements);
  }

  /**
   * Add edges to the graph
   */
  addEdges(edges: GraphEdge[]): void {
    if (!this.cy) return;

    const elements = edges.map((edge) => this.convertEdgeToElement(edge));
    this.cy.add(elements);
  }

  /**
   * Remove nodes by IDs
   */
  removeNodes(nodeIds: string[]): void {
    if (!this.cy) return;

    for (const id of nodeIds) {
      this.cy.getElementById(id).remove();
    }
  }

  /**
   * Remove edges by IDs
   */
  removeEdges(edgeIds: string[]): void {
    if (!this.cy) return;

    for (const id of edgeIds) {
      this.cy.getElementById(id).remove();
    }
  }

  /**
   * Update node data
   */
  updateNode(nodeId: string, data: Partial<GraphNode['data']>): void {
    if (!this.cy) return;

    const node = this.cy.getElementById(nodeId);
    if (node.length > 0) {
      node.data(data);
    }
  }

  /**
   * Update edge data
   */
  updateEdge(edgeId: string, data: Partial<GraphEdge['data']>): void {
    if (!this.cy) return;

    const edge = this.cy.getElementById(edgeId);
    if (edge.length > 0) {
      edge.data(data);
    }
  }

  /**
   * Clear all elements from the graph
   */
  clear(): void {
    if (!this.cy) return;
    this.cy.elements().remove();
  }

  /**
   * Get all node IDs
   */
  getNodeIds(): string[] {
    if (!this.cy) return [];
    return this.cy.nodes().map((node) => node.id());
  }

  /**
   * Get all edge IDs
   */
  getEdgeIds(): string[] {
    if (!this.cy) return [];
    return this.cy.edges().map((edge) => edge.id());
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): NodeSingular | null {
    if (!this.cy) return null;
    const node = this.cy.getElementById(nodeId);
    return node.length > 0 && node.isNode() ? (node as NodeSingular) : null;
  }

  /**
   * Get edge by ID
   */
  getEdge(edgeId: string): EdgeSingular | null {
    if (!this.cy) return null;
    const edge = this.cy.getElementById(edgeId);
    return edge.length > 0 && edge.isEdge() ? (edge as EdgeSingular) : null;
  }

  // ============================================================================
  // Layout Operations
  // ============================================================================

  /**
   * Run a layout algorithm
   */
  async runLayout(layoutType: LayoutType, options?: CyLayoutOptions): Promise<void> {
    if (!this.cy) return;

    const layoutName = this.mapLayoutTypeToName(layoutType);
    this.currentLayoutName = layoutName;

    const layoutOptions = this.getLayoutOptions(layoutName, options);

    return new Promise((resolve) => {
      this.emit('layout:start', { layout: layoutType });

      const layout = this.cy!.layout(layoutOptions);

      layout.on('layoutstop', () => {
        this.emit('layout:stop', { layout: layoutType });
        resolve();
      });

      layout.run();
    });
  }

  /**
   * Map LayoutType to Cytoscape layout name
   */
  private mapLayoutTypeToName(layoutType: LayoutType): LayoutName {
    const mapping: Record<LayoutType, LayoutName> = {
      force: 'fcose',
      hierarchical: 'dagre',
      radial: 'concentric',
      timeline: 'dagre', // Use dagre with LR direction for timeline
      grid: 'grid',
      concentric: 'concentric',
    };
    return mapping[layoutType] ?? 'fcose';
  }

  /**
   * Layout-specific options type for each supported layout algorithm
   */
  private getLayoutOptions(
    layoutName: LayoutName,
    customOptions?: CyLayoutOptions
  ): CyLayoutOptions {
    /**
     * Base options for each layout algorithm.
     * These extend the core CyLayoutOptions with layout-specific properties.
     */
    const baseOptions: Record<LayoutName, CyLayoutOptions & Record<string, unknown>> = {
      fcose: {
        name: 'fcose',
        quality: 'default',
        randomize: false,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 0.45,
        gravity: 0.25,
        numIter: 2500,
      },
      dagre: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 50,
        rankSep: 100,
        edgeSep: 10,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 50,
      },
      cola: {
        name: 'cola',
        animate: true,
        maxSimulationTime: 2000,
        fit: true,
        padding: 50,
        nodeDimensionsIncludeLabels: true,
        randomize: false,
        avoidOverlap: true,
        handleDisconnected: true,
        nodeSpacing: () => 20,
      },
      concentric: {
        name: 'concentric',
        fit: true,
        padding: 50,
        startAngle: (3 / 2) * Math.PI,
        clockwise: true,
        equidistant: false,
        minNodeSpacing: 50,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true,
        concentric: (node: NodeSingular) => node.degree(),
        levelWidth: () => 2,
        animate: true,
        animationDuration: 500,
      },
      breadthfirst: {
        name: 'breadthfirst',
        fit: true,
        directed: true,
        padding: 50,
        circle: false,
        grid: false,
        spacingFactor: 1.5,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true,
        animate: true,
        animationDuration: 500,
      },
      grid: {
        name: 'grid',
        fit: true,
        padding: 50,
        avoidOverlap: true,
        avoidOverlapPadding: 10,
        nodeDimensionsIncludeLabels: true,
        spacingFactor: 1,
        condense: false,
        animate: true,
        animationDuration: 500,
      },
    };

    return {
      ...baseOptions[layoutName],
      ...customOptions,
    } as CyLayoutOptions;
  }

  /**
   * Stop any running layout
   */
  stopLayout(): void {
    if (!this.cy) return;
    this.cy.stop();
  }

  // ============================================================================
  // Selection Operations
  // ============================================================================

  /**
   * Select nodes by IDs
   */
  selectNodes(nodeIds: string[], additive = false): void {
    if (!this.cy) return;

    if (!additive) {
      this.cy.elements().unselect();
    }

    for (const id of nodeIds) {
      this.cy.getElementById(id).select();
    }
  }

  /**
   * Select edges by IDs
   */
  selectEdges(edgeIds: string[], additive = false): void {
    if (!this.cy) return;

    if (!additive) {
      this.cy.elements().unselect();
    }

    for (const id of edgeIds) {
      this.cy.getElementById(id).select();
    }
  }

  /**
   * Deselect nodes by IDs
   */
  deselectNodes(nodeIds: string[]): void {
    if (!this.cy) return;

    for (const id of nodeIds) {
      this.cy.getElementById(id).unselect();
    }
  }

  /**
   * Deselect edges by IDs
   */
  deselectEdges(edgeIds: string[]): void {
    if (!this.cy) return;

    for (const id of edgeIds) {
      this.cy.getElementById(id).unselect();
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    if (!this.cy) return;
    this.cy.elements().unselect();
  }

  /**
   * Select all elements
   */
  selectAll(): void {
    if (!this.cy) return;
    this.cy.elements().select();
  }

  /**
   * Get selected node IDs
   */
  getSelectedNodeIds(): string[] {
    if (!this.cy) return [];
    return this.cy.nodes(':selected').map((node) => node.id());
  }

  /**
   * Get selected edge IDs
   */
  getSelectedEdgeIds(): string[] {
    if (!this.cy) return [];
    return this.cy.edges(':selected').map((edge) => edge.id());
  }

  // ============================================================================
  // Viewport Operations
  // ============================================================================

  /**
   * Get current viewport state
   */
  getViewport(): Viewport | null {
    if (!this.cy) return null;

    const extent = this.cy.extent();
    const zoom = this.cy.zoom();
    const pan = this.cy.pan();

    return {
      zoom,
      pan: { x: pan.x, y: pan.y },
      bounds: {
        x1: extent.x1,
        y1: extent.y1,
        x2: extent.x2,
        y2: extent.y2,
        width: extent.w,
        height: extent.h,
      },
    };
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number, position?: Position): void {
    if (!this.cy) return;

    if (position) {
      this.cy.zoom({
        level: zoom,
        position: position as CyPosition,
      });
    } else {
      this.cy.zoom(zoom);
    }
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.cy?.zoom() ?? 1;
  }

  /**
   * Set pan position
   */
  setPan(position: Position): void {
    if (!this.cy) return;
    this.cy.pan(position as CyPosition);
  }

  /**
   * Get current pan position
   */
  getPan(): Position {
    const pan = this.cy?.pan();
    return pan ? { x: pan.x, y: pan.y } : { x: 0, y: 0 };
  }

  /**
   * Zoom in by a factor
   */
  zoomIn(factor = 1.2): void {
    if (!this.cy) return;
    const currentZoom = this.cy.zoom();
    this.cy.zoom(currentZoom * factor);
  }

  /**
   * Zoom out by a factor
   */
  zoomOut(factor = 1.2): void {
    if (!this.cy) return;
    const currentZoom = this.cy.zoom();
    this.cy.zoom(currentZoom / factor);
  }

  /**
   * Fit all elements in the viewport
   */
  fit(padding = 50): void {
    if (!this.cy) return;
    this.cy.fit(undefined, padding);
  }

  /**
   * Center on specific node(s)
   */
  centerOnNodes(nodeIds: string[], zoom?: number): void {
    if (!this.cy || nodeIds.length === 0) return;

    // Collect nodes using getElementById
    const nodes = this.cy.collection();
    for (const id of nodeIds) {
      const node = this.cy.getElementById(id);
      if (node.length > 0) {
        nodes.merge(node);
      }
    }

    if (nodes.length > 0) {
      if (zoom !== undefined) {
        this.cy.zoom(zoom);
      }
      this.cy.center(nodes);
    }
  }

  /**
   * Animate to a specific viewport state
   */
  animateTo(options: { zoom?: number; pan?: Position; duration?: number }): Promise<void> {
    if (!this.cy) return Promise.resolve();

    return new Promise((resolve) => {
      this.cy!.animate(
        {
          zoom: options.zoom,
          pan: options.pan as CyPosition,
        },
        {
          duration: options.duration ?? 300,
          complete: resolve,
        }
      );
    });
  }

  /**
   * Reset viewport to default
   */
  resetViewport(): void {
    this.fit();
  }

  // ============================================================================
  // Styling Operations
  // ============================================================================

  /**
   * Apply a stylesheet
   */
  setStylesheet(stylesheet: Stylesheet[]): void {
    if (!this.cy) return;
    this.cy.style(stylesheet);
  }

  /**
   * Add styles to existing stylesheet
   */
  addStyles(styles: Stylesheet[]): void {
    if (!this.cy) return;
    // Get current style and append new styles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentStyle = (this.cy.style() as any).json() as Stylesheet[];
    this.cy.style([...currentStyle, ...styles]);
  }

  /**
   * Apply temporary highlight to nodes
   */
  highlightNodes(nodeIds: string[], duration = 1000): void {
    if (!this.cy) return;

    // Collect nodes using getElementById
    const nodes = this.cy.collection();
    for (const id of nodeIds) {
      const node = this.cy.getElementById(id);
      if (node.length > 0) {
        nodes.merge(node);
      }
    }

    nodes.addClass('highlighted');

    const timeout = setTimeout(() => {
      nodes.removeClass('highlighted');
      this.highlightTimeouts.delete(timeout);
    }, duration);
    this.highlightTimeouts.add(timeout);
  }

  /**
   * Apply temporary highlight to edges
   */
  highlightEdges(edgeIds: string[], duration = 1000): void {
    if (!this.cy) return;

    // Collect edges using getElementById
    const edges = this.cy.collection();
    for (const id of edgeIds) {
      const edge = this.cy.getElementById(id);
      if (edge.length > 0) {
        edges.merge(edge);
      }
    }

    edges.addClass('highlighted');

    const timeout = setTimeout(() => {
      edges.removeClass('highlighted');
      this.highlightTimeouts.delete(timeout);
    }, duration);
    this.highlightTimeouts.add(timeout);
  }

  /**
   * Dim non-selected/non-highlighted elements
   */
  dimOthers(nodeIds: string[]): void {
    if (!this.cy) return;

    // Remove existing dim classes
    this.cy.elements().removeClass('dimmed');

    // Collect highlighted nodes using getElementById
    const highlightedNodes = this.cy.collection();
    for (const id of nodeIds) {
      const node = this.cy.getElementById(id);
      if (node.length > 0) {
        highlightedNodes.merge(node);
      }
    }
    const connectedEdges = highlightedNodes.connectedEdges();

    this.cy
      .elements()
      .difference(highlightedNodes)
      .difference(connectedEdges)
      .addClass('dimmed');
  }

  /**
   * Remove all dim effects
   */
  undimAll(): void {
    if (!this.cy) return;
    this.cy.elements().removeClass('dimmed');
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to an event
   */
  on<T>(event: CytoscapeEventType, listener: CytoscapeEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as CytoscapeEventListener<unknown>);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Unsubscribe from an event
   */
  off<T>(event: CytoscapeEventType, listener: CytoscapeEventListener<T>): void {
    this.listeners.get(event)?.delete(listener as CytoscapeEventListener<unknown>);
  }

  /**
   * Emit an event to all listeners
   */
  private emit<T>(event: CytoscapeEventType, payload: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(payload));
    }
  }

  /**
   * Setup internal Cytoscape event listeners
   */
  private setupEventListeners(): void {
    if (!this.cy) return;

    // Node events
    this.cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:click', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
        originalEvent: evt.originalEvent as MouseEvent,
      });
    });

    this.cy.on('dbltap', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:dblclick', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
        originalEvent: evt.originalEvent as MouseEvent,
      });
    });

    this.cy.on('mouseover', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:hover', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
      });
    });

    this.cy.on('mouseout', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:leave', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
      });
    });

    this.cy.on('grab', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:drag:start', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
      });
    });

    this.cy.on('drag', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:drag', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
      });
    });

    this.cy.on('free', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      this.emit<NodeEventPayload>('node:drag:end', {
        nodeId: node.id(),
        position: { x: node.position('x'), y: node.position('y') },
      });
    });

    // Edge events
    this.cy.on('tap', 'edge', (evt: EventObject) => {
      const edge = evt.target as EdgeSingular;
      this.emit<EdgeEventPayload>('edge:click', {
        edgeId: edge.id(),
        sourceId: edge.source().id(),
        targetId: edge.target().id(),
        originalEvent: evt.originalEvent as MouseEvent,
      });
    });

    this.cy.on('mouseover', 'edge', (evt: EventObject) => {
      const edge = evt.target as EdgeSingular;
      this.emit<EdgeEventPayload>('edge:hover', {
        edgeId: edge.id(),
        sourceId: edge.source().id(),
        targetId: edge.target().id(),
      });
    });

    this.cy.on('mouseout', 'edge', (evt: EventObject) => {
      const edge = evt.target as EdgeSingular;
      this.emit<EdgeEventPayload>('edge:leave', {
        edgeId: edge.id(),
        sourceId: edge.source().id(),
        targetId: edge.target().id(),
      });
    });

    // Canvas events
    this.cy.on('tap', (evt: EventObject) => {
      if (evt.target === this.cy) {
        const position = evt.position ?? { x: 0, y: 0 };
        this.emit<CanvasEventPayload>('canvas:click', {
          position: { x: position.x, y: position.y },
          originalEvent: evt.originalEvent as MouseEvent,
        });
      }
    });

    this.cy.on('dbltap', (evt: EventObject) => {
      if (evt.target === this.cy) {
        const position = evt.position ?? { x: 0, y: 0 };
        this.emit<CanvasEventPayload>('canvas:dblclick', {
          position: { x: position.x, y: position.y },
          originalEvent: evt.originalEvent as MouseEvent,
        });
      }
    });

    // Viewport events
    this.cy.on('pan', () => {
      const pan = this.cy!.pan();
      this.emit<ViewportEventPayload>('viewport:pan', {
        zoom: this.cy!.zoom(),
        pan: { x: pan.x, y: pan.y },
      });
    });

    this.cy.on('zoom', () => {
      const pan = this.cy!.pan();
      this.emit<ViewportEventPayload>('viewport:zoom', {
        zoom: this.cy!.zoom(),
        pan: { x: pan.x, y: pan.y },
      });
    });

    // Selection events
    this.cy.on('select', () => {
      this.emit<SelectionEventPayload>('select', {
        nodeIds: this.getSelectedNodeIds(),
        edgeIds: this.getSelectedEdgeIds(),
      });
    });

    this.cy.on('unselect', () => {
      this.emit<SelectionEventPayload>('unselect', {
        nodeIds: this.getSelectedNodeIds(),
        edgeIds: this.getSelectedEdgeIds(),
      });
    });
  }

  // ============================================================================
  // Data Conversion Helpers
  // ============================================================================

  /**
   * Convert GraphData to Cytoscape elements
   */
  private convertToElements(data: GraphData): ElementDefinition[] {
    const nodeElements = data.nodes.map((node) => this.convertNodeToElement(node));
    const edgeElements = data.edges.map((edge) => this.convertEdgeToElement(edge));
    return [...nodeElements, ...edgeElements];
  }

  /**
   * Convert GraphNode to Cytoscape node definition
   */
  private convertNodeToElement(node: GraphNode): NodeDefinition {
    return {
      group: 'nodes',
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        ...node.data,
      },
      position: node.position,
      classes: node.type,
    };
  }

  /**
   * Convert GraphEdge to Cytoscape edge definition
   */
  private convertEdgeToElement(edge: GraphEdge): EdgeDefinition {
    return {
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label,
        ...edge.data,
      },
      classes: edge.type,
    };
  }

  /**
   * Get default stylesheet
   */
  private getDefaultStylesheet(): Stylesheet[] {
    return [
      ...getNodeStyles(),
      ...getEdgeStyles(),
      ...getSelectedStyles(),
      ...getHoverStyles(),
    ];
  }

  // ============================================================================
  // Export Operations
  // ============================================================================

  /**
   * Export graph as PNG image
   */
  exportPNG(options?: { scale?: number; bg?: string }): string | null {
    if (!this.cy) return null;

    return this.cy.png({
      scale: options?.scale ?? 2,
      bg: options?.bg ?? '#ffffff',
      full: true,
    });
  }

  /**
   * Export graph as SVG
   */
  exportSVG(): string | null {
    if (!this.cy) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.cy as any).svg({ scale: 1, full: true });
  }

  /**
   * Export graph data as JSON
   */
  exportJSON(): object | null {
    if (!this.cy) return null;
    return this.cy.json();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get bounding box of all elements or specified elements
   */
  getBoundingBox(nodeIds?: string[]): BoundingBox | null {
    if (!this.cy) return null;

    let elements;
    if (nodeIds && nodeIds.length > 0) {
      // Collect nodes using getElementById
      elements = this.cy.collection();
      for (const id of nodeIds) {
        const node = this.cy.getElementById(id);
        if (node.length > 0) {
          elements.merge(node);
        }
      }
    } else {
      elements = this.cy.elements();
    }

    if (elements.length === 0) return null;

    const bb = elements.boundingBox();
    return {
      x1: bb.x1,
      y1: bb.y1,
      x2: bb.x2,
      y2: bb.y2,
      width: bb.w,
      height: bb.h,
    };
  }

  /**
   * Get node position
   */
  getNodePosition(nodeId: string): Position | null {
    const node = this.getNode(nodeId);
    if (!node) return null;
    return { x: node.position('x'), y: node.position('y') };
  }

  /**
   * Set node position
   */
  setNodePosition(nodeId: string, position: Position): void {
    const node = this.getNode(nodeId);
    if (node) {
      node.position(position as CyPosition);
    }
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string): string[] {
    const node = this.getNode(nodeId);
    if (!node) return [];
    return node.neighborhood('node').map((n) => n.id());
  }

  /**
   * Get edges connected to a node
   */
  getConnectedEdges(nodeId: string): string[] {
    const node = this.getNode(nodeId);
    if (!node) return [];
    return node.connectedEdges().map((e) => e.id());
  }

  /**
   * Check if two nodes are connected
   */
  areConnected(nodeId1: string, nodeId2: string): boolean {
    if (!this.cy) return false;
    const edges = this.cy.edges(`[source="${nodeId1}"][target="${nodeId2}"], [source="${nodeId2}"][target="${nodeId1}"]`);
    return edges.length > 0;
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.cy?.nodes().length ?? 0;
  }

  /**
   * Get edge count
   */
  getEdgeCount(): number {
    return this.cy?.edges().length ?? 0;
  }

  /**
   * Lock a node's position (prevent dragging)
   */
  lockNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (node) {
      node.lock();
    }
  }

  /**
   * Unlock a node's position
   */
  unlockNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (node) {
      node.unlock();
    }
  }

  /**
   * Lock all nodes
   */
  lockAllNodes(): void {
    if (!this.cy) return;
    this.cy.nodes().lock();
  }

  /**
   * Unlock all nodes
   */
  unlockAllNodes(): void {
    if (!this.cy) return;
    this.cy.nodes().unlock();
  }
}

// Export singleton instance
export const cytoscapeManager = new CytoscapeManager();
