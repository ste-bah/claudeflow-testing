/**
 * CSV Exporter
 *
 * Exports graph data as CSV (Comma-Separated Values) files.
 * Supports node lists, edge lists, or combined exports.
 *
 * @module services/export/formatters/csvExporter
 */

import type { Core } from 'cytoscape';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type {
  CSVExportOptions,
  CSVExportResult,
  ExportProgressCallback,
} from '../types';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_CSV_OPTIONS: Required<Omit<CSVExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'nodeFields' | 'edgeFields'>> = {
  delimiter: ',',
  includeHeader: true,
  content: 'both',
  quoteAll: false,
  lineEnding: 'unix',
  scope: 'full',
};

const DEFAULT_NODE_FIELDS = ['id', 'type', 'label', 'timestamp', 'sessionId', 'agentId'];
const DEFAULT_EDGE_FIELDS = ['id', 'source', 'target', 'type', 'label', 'weight'];

// ============================================================================
// CSV Exporter Class
// ============================================================================

/**
 * Exports graph data as CSV
 */
export class CSVExporter {
  /**
   * Export the graph as CSV
   */
  async export(
    cy: Core,
    options: CSVExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<CSVExportResult> {
    const timestamp = new Date();
    const mergedOptions = { ...DEFAULT_CSV_OPTIONS, ...options };

    try {
      onProgress?.({
        format: 'csv',
        percentage: 10,
        stage: 'Preparing export',
        complete: false,
      });

      // Get elements based on scope
      const elements = this.getElementsForScope(cy, mergedOptions.scope);

      if (elements.length === 0) {
        return this.createErrorResult('No elements to export', options.filename, timestamp);
      }

      let csvContent = '';
      let rowCount = 0;

      onProgress?.({
        format: 'csv',
        percentage: 30,
        stage: 'Processing data',
        complete: false,
      });

      // Generate content based on content type
      switch (mergedOptions.content) {
        case 'nodes': {
          const nodeFields = options.nodeFields || DEFAULT_NODE_FIELDS;
          const { content, count } = this.exportNodes(elements, nodeFields, mergedOptions);
          csvContent = content;
          rowCount = count;
          break;
        }
        case 'edges': {
          const edgeFields = options.edgeFields || DEFAULT_EDGE_FIELDS;
          const { content, count } = this.exportEdges(elements, edgeFields, mergedOptions);
          csvContent = content;
          rowCount = count;
          break;
        }
        case 'both':
        default: {
          const nodeFields = options.nodeFields || DEFAULT_NODE_FIELDS;
          const edgeFields = options.edgeFields || DEFAULT_EDGE_FIELDS;

          const nodesResult = this.exportNodes(elements, nodeFields, mergedOptions);
          const edgesResult = this.exportEdges(elements, edgeFields, mergedOptions);

          // Combine with a separator
          const lineEnding = mergedOptions.lineEnding === 'windows' ? '\r\n' : '\n';
          csvContent = `# NODES${lineEnding}${nodesResult.content}${lineEnding}${lineEnding}# EDGES${lineEnding}${edgesResult.content}`;
          rowCount = nodesResult.count + edgesResult.count;
          break;
        }
      }

      onProgress?.({
        format: 'csv',
        percentage: 100,
        stage: 'Export complete',
        complete: true,
      });

      const filename = this.generateFilename(options.filename, options.includeTimestamp, timestamp, mergedOptions.content);

      return {
        success: true,
        data: csvContent,
        format: 'csv',
        filename,
        mimeType: 'text/csv',
        size: new Blob([csvContent]).size,
        timestamp,
        rowCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during CSV export';

      onProgress?.({
        format: 'csv',
        percentage: 0,
        stage: 'Export failed',
        complete: true,
        error: errorMessage,
      });

      return this.createErrorResult(errorMessage, options.filename, timestamp);
    }
  }

  /**
   * Export only nodes as CSV
   */
  async exportNodesOnly(
    cy: Core,
    options: CSVExportOptions = {}
  ): Promise<CSVExportResult> {
    return this.export(cy, { ...options, content: 'nodes' });
  }

  /**
   * Export only edges as CSV
   */
  async exportEdgesOnly(
    cy: Core,
    options: CSVExportOptions = {}
  ): Promise<CSVExportResult> {
    return this.export(cy, { ...options, content: 'edges' });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get elements based on scope
   */
  private getElementsForScope(cy: Core, scope: CSVExportOptions['scope']) {
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
   * Export nodes as CSV
   */
  private exportNodes(
    elements: cytoscape.Collection,
    fields: (keyof GraphNode | string)[],
    options: Required<Omit<CSVExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'nodeFields' | 'edgeFields'>>
  ): { content: string; count: number } {
    const rows: string[] = [];
    const lineEnding = options.lineEnding === 'windows' ? '\r\n' : '\n';

    // Header row
    if (options.includeHeader) {
      rows.push(this.createRow(fields as string[], options));
    }

    // Data rows
    elements.nodes().forEach(node => {
      const data = node.data();
      const position = node.position();

      const values = fields.map(field => {
        if (field === 'x' || field === 'positionX') return position.x?.toString() ?? '';
        if (field === 'y' || field === 'positionY') return position.y?.toString() ?? '';
        if (field === 'id') return node.id();

        const value = data[field as string];
        return this.formatValue(value);
      });

      rows.push(this.createRow(values, options));
    });

    return {
      content: rows.join(lineEnding),
      count: elements.nodes().length,
    };
  }

  /**
   * Export edges as CSV
   */
  private exportEdges(
    elements: cytoscape.Collection,
    fields: (keyof GraphEdge | string)[],
    options: Required<Omit<CSVExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'nodeFields' | 'edgeFields'>>
  ): { content: string; count: number } {
    const rows: string[] = [];
    const lineEnding = options.lineEnding === 'windows' ? '\r\n' : '\n';

    // Header row
    if (options.includeHeader) {
      rows.push(this.createRow(fields as string[], options));
    }

    // Data rows
    elements.edges().forEach(edge => {
      const data = edge.data();

      const values = fields.map(field => {
        if (field === 'id') return edge.id();
        if (field === 'source') return edge.source().id();
        if (field === 'target') return edge.target().id();

        const value = data[field as string];
        return this.formatValue(value);
      });

      rows.push(this.createRow(values, options));
    });

    return {
      content: rows.join(lineEnding),
      count: elements.edges().length,
    };
  }

  /**
   * Create a CSV row from values
   */
  private createRow(
    values: string[],
    options: Required<Omit<CSVExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'nodeFields' | 'edgeFields'>>
  ): string {
    const formattedValues = values.map(value => {
      const needsQuoting =
        options.quoteAll ||
        value.includes(options.delimiter) ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r');

      if (needsQuoting) {
        // Escape quotes by doubling them
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      }

      return value;
    });

    return formattedValues.join(options.delimiter);
  }

  /**
   * Format a value for CSV output
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }

    return String(value);
  }

  /**
   * Generate filename
   */
  private generateFilename(
    customName?: string,
    includeTimestamp?: boolean,
    timestamp?: Date,
    content?: 'nodes' | 'edges' | 'both'
  ): string {
    let baseName = customName || 'graph-export';

    // Add content type suffix
    if (content === 'nodes') baseName += '-nodes';
    else if (content === 'edges') baseName += '-edges';

    if (includeTimestamp && timestamp) {
      const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      return `${baseName}-${dateStr}.csv`;
    }

    return `${baseName}.csv`;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    filename?: string,
    timestamp?: Date
  ): CSVExportResult {
    return {
      success: false,
      format: 'csv',
      filename: filename ? `${filename}.csv` : 'export-failed.csv',
      mimeType: 'text/csv',
      timestamp: timestamp || new Date(),
      error,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const csvExporter = new CSVExporter();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick export function for simple use cases
 */
export async function exportToCSV(
  cy: Core,
  options?: CSVExportOptions
): Promise<CSVExportResult> {
  return csvExporter.export(cy, options);
}

/**
 * Export and immediately download
 */
export async function exportAndDownloadCSV(
  cy: Core,
  options?: CSVExportOptions
): Promise<CSVExportResult> {
  const result = await csvExporter.export(cy, options);

  if (result.success && result.data) {
    downloadString(result.data, result.filename, 'text/csv');
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
 * Parse CSV content into arrays
 */
export function parseCSV(
  csvContent: string,
  options: { delimiter?: string; hasHeader?: boolean } = {}
): { headers?: string[]; rows: string[][] } {
  const delimiter = options.delimiter || ',';
  const hasHeader = options.hasHeader ?? true;

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  const rows: string[][] = [];
  let headers: string[] | undefined;

  for (let i = 0; i < lines.length; i++) {
    const row = parseCSVLine(lines[i], delimiter);

    if (i === 0 && hasHeader) {
      headers = row;
    } else {
      rows.push(row);
    }
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // End of quoted value
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Push last value
  values.push(current);

  return values;
}
