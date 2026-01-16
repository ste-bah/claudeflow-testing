/**
 * JSON Exporter
 *
 * Exports graph data as JSON format for data interchange,
 * backup, and restoration purposes.
 *
 * @module services/export/formatters/jsonExporter
 */

import type { Core } from 'cytoscape';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
} from '@/types/graph';
import type {
  JSONExportOptions,
  JSONExportResult,
  ExportMetadata,
  ExportProgressCallback,
} from '../types';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_JSON_OPTIONS: Required<Omit<JSONExportOptions, 'filename' | 'includeTimestamp' | 'excludeFields' | 'includeOnlyFields'>> = {
  includePositions: true,
  includeStyles: false,
  includeCytoscapeData: false,
  includeMetadata: true,
  pretty: true,
  indent: 2,
  scope: 'full',
};

// ============================================================================
// JSON Exporter Class
// ============================================================================

/**
 * Exports graph data as JSON
 */
export class JSONExporter {
  /**
   * Export the graph as JSON
   */
  async export(
    cy: Core,
    options: JSONExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<JSONExportResult> {
    const timestamp = new Date();
    const mergedOptions = { ...DEFAULT_JSON_OPTIONS, ...options };

    try {
      onProgress?.({
        format: 'json',
        percentage: 10,
        stage: 'Preparing export',
        complete: false,
      });

      // Get elements based on scope
      const elements = this.getElementsForScope(cy, mergedOptions.scope);

      if (elements.length === 0) {
        return this.createErrorResult('No elements to export', options.filename, timestamp);
      }

      onProgress?.({
        format: 'json',
        percentage: 30,
        stage: 'Processing nodes',
        complete: false,
      });

      // Convert elements to GraphData format
      const nodes = this.extractNodes(elements, mergedOptions);

      onProgress?.({
        format: 'json',
        percentage: 50,
        stage: 'Processing edges',
        complete: false,
      });

      const edges = this.extractEdges(elements, mergedOptions);

      onProgress?.({
        format: 'json',
        percentage: 70,
        stage: 'Building export data',
        complete: false,
      });

      // Build the export object
      const exportData: GraphExportData = {
        nodes,
        edges,
      };

      // Add metadata if requested
      if (mergedOptions.includeMetadata) {
        exportData.metadata = this.createMetadata(nodes, edges, mergedOptions.scope, timestamp);
      }

      // Add Cytoscape-specific data if requested
      if (mergedOptions.includeCytoscapeData) {
        exportData.cytoscape = cy.json();
      }

      onProgress?.({
        format: 'json',
        percentage: 90,
        stage: 'Serializing JSON',
        complete: false,
      });

      // Serialize to JSON
      const jsonString = mergedOptions.pretty
        ? JSON.stringify(exportData, null, mergedOptions.indent)
        : JSON.stringify(exportData);

      onProgress?.({
        format: 'json',
        percentage: 100,
        stage: 'Export complete',
        complete: true,
      });

      const filename = this.generateFilename(options.filename, options.includeTimestamp, timestamp);

      return {
        success: true,
        data: jsonString,
        format: 'json',
        filename,
        mimeType: 'application/json',
        size: new Blob([jsonString]).size,
        timestamp,
        parsedData: exportData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during JSON export';

      onProgress?.({
        format: 'json',
        percentage: 0,
        stage: 'Export failed',
        complete: true,
        error: errorMessage,
      });

      return this.createErrorResult(errorMessage, options.filename, timestamp);
    }
  }

  /**
   * Export as a plain object (not stringified)
   */
  exportAsObject(cy: Core, options: JSONExportOptions = {}): GraphExportData | null {
    const mergedOptions = { ...DEFAULT_JSON_OPTIONS, ...options };

    try {
      const elements = this.getElementsForScope(cy, mergedOptions.scope);
      const nodes = this.extractNodes(elements, mergedOptions);
      const edges = this.extractEdges(elements, mergedOptions);

      const exportData: GraphExportData = { nodes, edges };

      if (mergedOptions.includeMetadata) {
        exportData.metadata = this.createMetadata(nodes, edges, mergedOptions.scope, new Date());
      }

      return exportData;
    } catch {
      return null;
    }
  }

  /**
   * Export Cytoscape's native JSON format
   */
  exportCytoscapeJSON(cy: Core): object | null {
    try {
      return cy.json();
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get elements based on scope
   */
  private getElementsForScope(cy: Core, scope: JSONExportOptions['scope']) {
    switch (scope) {
      case 'selected':
        return cy.elements(':selected');
      case 'visible':
        const extent = cy.extent();
        return cy.elements().filter(ele => {
          if (ele.isNode()) {
            const pos = ele.position();
            return pos.x >= extent.x1 && pos.x <= extent.x2 &&
                   pos.y >= extent.y1 && pos.y <= extent.y2;
          }
          return true;
        });
      case 'full':
      default:
        return cy.elements();
    }
  }

  /**
   * Extract nodes from Cytoscape elements
   */
  private extractNodes(
    elements: cytoscape.Collection,
    options: Required<Omit<JSONExportOptions, 'filename' | 'includeTimestamp' | 'excludeFields' | 'includeOnlyFields'>> & { excludeFields?: string[]; includeOnlyFields?: string[] }
  ): GraphNode[] {
    const nodes: GraphNode[] = [];

    elements.nodes().forEach(node => {
      const data = node.data();

      const graphNode: GraphNode = {
        id: node.id(),
        type: (data.type as NodeType) || 'trajectory',
        label: data.label || node.id(),
        data: this.filterData(data, options),
      };

      // Include position if requested
      if (options.includePositions) {
        graphNode.position = {
          x: node.position('x'),
          y: node.position('y'),
        };
      }

      // Include styles if requested
      if (options.includeStyles) {
        graphNode.style = {
          backgroundColor: node.style('background-color'),
          borderColor: node.style('border-color'),
          borderWidth: parseFloat(node.style('border-width')),
          width: parseFloat(node.style('width')),
          height: parseFloat(node.style('height')),
        };
      }

      nodes.push(graphNode);
    });

    return nodes;
  }

  /**
   * Extract edges from Cytoscape elements
   */
  private extractEdges(
    elements: cytoscape.Collection,
    options: Required<Omit<JSONExportOptions, 'filename' | 'includeTimestamp' | 'excludeFields' | 'includeOnlyFields'>> & { excludeFields?: string[]; includeOnlyFields?: string[] }
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];

    elements.edges().forEach(edge => {
      const data = edge.data();

      const graphEdge: GraphEdge = {
        id: edge.id(),
        source: edge.source().id(),
        target: edge.target().id(),
        type: (data.type as EdgeType) || 'linked_to',
        label: data.label,
        data: this.filterData(data, options),
      };

      // Include styles if requested
      if (options.includeStyles) {
        graphEdge.style = {
          lineColor: edge.style('line-color'),
          width: parseFloat(edge.style('width')),
        };
      }

      edges.push(graphEdge);
    });

    return edges;
  }

  /**
   * Filter data based on include/exclude field options
   */
  private filterData(
    data: Record<string, unknown>,
    options: { excludeFields?: string[]; includeOnlyFields?: string[] }
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    // Remove internal Cytoscape fields
    const internalFields = ['id', 'source', 'target', 'parent'];

    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (internalFields.includes(key)) continue;

      // Check exclusion list
      if (options.excludeFields?.includes(key)) continue;

      // Check inclusion list (if specified)
      if (options.includeOnlyFields && !options.includeOnlyFields.includes(key)) continue;

      filtered[key] = value;
    }

    return filtered;
  }

  /**
   * Create export metadata
   */
  private createMetadata(
    nodes: GraphNode[],
    edges: GraphEdge[],
    scope: string,
    timestamp: Date
  ): ExportMetadata {
    return {
      exportedAt: timestamp.toISOString(),
      appVersion: '1.0.0',
      scope: scope as 'full' | 'visible' | 'selected',
      nodeCount: nodes.length,
      edgeCount: edges.length,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
  }

  /**
   * Generate filename
   */
  private generateFilename(
    customName?: string,
    includeTimestamp?: boolean,
    timestamp?: Date
  ): string {
    const baseName = customName || 'graph-export';

    if (includeTimestamp && timestamp) {
      const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      return `${baseName}-${dateStr}.json`;
    }

    return `${baseName}.json`;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    filename?: string,
    timestamp?: Date
  ): JSONExportResult {
    return {
      success: false,
      format: 'json',
      filename: filename ? `${filename}.json` : 'export-failed.json',
      mimeType: 'application/json',
      timestamp: timestamp || new Date(),
      error,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Structure of exported JSON data
 */
export interface GraphExportData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: ExportMetadata;
  cytoscape?: object;
}

// ============================================================================
// Singleton Export
// ============================================================================

export const jsonExporter = new JSONExporter();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick export function for simple use cases
 */
export async function exportToJSON(
  cy: Core,
  options?: JSONExportOptions
): Promise<JSONExportResult> {
  return jsonExporter.export(cy, options);
}

/**
 * Export and immediately download
 */
export async function exportAndDownloadJSON(
  cy: Core,
  options?: JSONExportOptions
): Promise<JSONExportResult> {
  const result = await jsonExporter.export(cy, options);

  if (result.success && result.data) {
    downloadString(result.data, result.filename, 'application/json');
  }

  return result;
}

/**
 * Download a string as a file
 */
function downloadString(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Parse JSON export data back into GraphData format
 */
export function parseJSONExport(jsonString: string): GraphData | null {
  try {
    const data = JSON.parse(jsonString) as GraphExportData;

    return {
      nodes: data.nodes,
      edges: data.edges,
      metadata: data.metadata ? {
        nodeCount: data.metadata.nodeCount,
        edgeCount: data.metadata.edgeCount,
        generatedAt: new Date(data.metadata.exportedAt),
      } : undefined,
    };
  } catch {
    return null;
  }
}
