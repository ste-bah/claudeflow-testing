/**
 * Export Service
 *
 * Unified service for exporting graph visualizations and data in multiple formats.
 * Provides a single interface for PNG, SVG, JSON, and CSV exports.
 *
 * @module services/export/ExportService
 */

import type { Core } from 'cytoscape';
import { CytoscapeManager } from '@/services/graph/CytoscapeManager';
import { pngExporter } from './formatters/pngExporter';
import { svgExporter } from './formatters/svgExporter';
import { jsonExporter, type GraphExportData } from './formatters/jsonExporter';
import { csvExporter } from './formatters/csvExporter';
import type {
  ExportFormat,
  PNGExportOptions,
  PNGExportResult,
  SVGExportOptions,
  SVGExportResult,
  JSONExportOptions,
  JSONExportResult,
  CSVExportOptions,
  CSVExportResult,
  BatchExportOptions,
  BatchExportResult,
  ExportResult,
  ExportProgressCallback,
} from './types';

// ============================================================================
// Export Service Class
// ============================================================================

/**
 * Unified export service for graph data and visualizations
 */
export class ExportService {
  private cytoscapeManager: CytoscapeManager | null = null;

  /**
   * Create export service with optional CytoscapeManager reference
   */
  constructor(cytoscapeManager?: CytoscapeManager) {
    this.cytoscapeManager = cytoscapeManager ?? null;
  }

  /**
   * Set the Cytoscape manager reference
   */
  setCytoscapeManager(manager: CytoscapeManager): void {
    this.cytoscapeManager = manager;
  }

  /**
   * Get the Cytoscape Core instance
   */
  private getCytoscape(): Core | null {
    return this.cytoscapeManager?.getCy() ?? null;
  }

  // ============================================================================
  // PNG Export
  // ============================================================================

  /**
   * Export graph as PNG image
   */
  async exportPNG(
    options: PNGExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<PNGExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'png',
        filename: 'export-failed.png',
        mimeType: 'image/png',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return pngExporter.export(cy, options, onProgress);
  }

  /**
   * Export PNG as data URL (for preview)
   */
  exportPNGAsDataUrl(options: PNGExportOptions = {}): string | null {
    const cy = this.getCytoscape();
    if (!cy) return null;

    return pngExporter.exportAsDataUrl(cy, options);
  }

  /**
   * Export PNG and download
   */
  async exportAndDownloadPNG(options: PNGExportOptions = {}): Promise<PNGExportResult> {
    const result = await this.exportPNG(options);

    if (result.success && result.data) {
      this.downloadBlob(result.data, result.filename);
    }

    return result;
  }

  // ============================================================================
  // SVG Export
  // ============================================================================

  /**
   * Export graph as SVG
   */
  async exportSVG(
    options: SVGExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<SVGExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'svg',
        filename: 'export-failed.svg',
        mimeType: 'image/svg+xml',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return svgExporter.export(cy, options, onProgress);
  }

  /**
   * Export SVG as data URL (for preview)
   */
  exportSVGAsDataUrl(options: SVGExportOptions = {}): string | null {
    const cy = this.getCytoscape();
    if (!cy) return null;

    return svgExporter.exportAsDataUrl(cy, options);
  }

  /**
   * Export SVG and download
   */
  async exportAndDownloadSVG(options: SVGExportOptions = {}): Promise<SVGExportResult> {
    const result = await this.exportSVG(options);

    if (result.success && result.data) {
      this.downloadString(result.data, result.filename, 'image/svg+xml');
    }

    return result;
  }

  // ============================================================================
  // JSON Export
  // ============================================================================

  /**
   * Export graph as JSON
   */
  async exportJSON(
    options: JSONExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<JSONExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'json',
        filename: 'export-failed.json',
        mimeType: 'application/json',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return jsonExporter.export(cy, options, onProgress);
  }

  /**
   * Export JSON as object (not stringified)
   */
  exportJSONAsObject(options: JSONExportOptions = {}): GraphExportData | null {
    const cy = this.getCytoscape();
    if (!cy) return null;

    return jsonExporter.exportAsObject(cy, options);
  }

  /**
   * Export Cytoscape's native JSON format
   */
  exportCytoscapeJSON(): object | null {
    const cy = this.getCytoscape();
    if (!cy) return null;

    return jsonExporter.exportCytoscapeJSON(cy);
  }

  /**
   * Export JSON and download
   */
  async exportAndDownloadJSON(options: JSONExportOptions = {}): Promise<JSONExportResult> {
    const result = await this.exportJSON(options);

    if (result.success && result.data) {
      this.downloadString(result.data, result.filename, 'application/json');
    }

    return result;
  }

  // ============================================================================
  // CSV Export
  // ============================================================================

  /**
   * Export graph as CSV
   */
  async exportCSV(
    options: CSVExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<CSVExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'csv',
        filename: 'export-failed.csv',
        mimeType: 'text/csv',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return csvExporter.export(cy, options, onProgress);
  }

  /**
   * Export only nodes as CSV
   */
  async exportNodesCSV(options: CSVExportOptions = {}): Promise<CSVExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'csv',
        filename: 'export-failed.csv',
        mimeType: 'text/csv',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return csvExporter.exportNodesOnly(cy, options);
  }

  /**
   * Export only edges as CSV
   */
  async exportEdgesCSV(options: CSVExportOptions = {}): Promise<CSVExportResult> {
    const cy = this.getCytoscape();
    if (!cy) {
      return {
        success: false,
        format: 'csv',
        filename: 'export-failed.csv',
        mimeType: 'text/csv',
        timestamp: new Date(),
        error: 'Cytoscape instance not available',
      };
    }

    return csvExporter.exportEdgesOnly(cy, options);
  }

  /**
   * Export CSV and download
   */
  async exportAndDownloadCSV(options: CSVExportOptions = {}): Promise<CSVExportResult> {
    const result = await this.exportCSV(options);

    if (result.success && result.data) {
      this.downloadString(result.data, result.filename, 'text/csv');
    }

    return result;
  }

  // ============================================================================
  // Batch Export
  // ============================================================================

  /**
   * Export multiple formats at once
   */
  async exportBatch(
    options: BatchExportOptions,
    onProgress?: ExportProgressCallback
  ): Promise<BatchExportResult> {
    const results = new Map<ExportFormat, ExportResult>();
    let successCount = 0;
    let failureCount = 0;

    const totalFormats = options.formats.length;
    let completedFormats = 0;

    for (const format of options.formats) {
      // Calculate progress
      const baseProgress = (completedFormats / totalFormats) * 100;

      onProgress?.({
        format,
        percentage: baseProgress,
        stage: `Exporting ${format.toUpperCase()}`,
        complete: false,
      });

      let result: ExportResult;
      const filename = options.filename;

      switch (format) {
        case 'png':
          result = await this.exportPNG({ ...options.pngOptions, filename });
          break;
        case 'svg':
          result = await this.exportSVG({ ...options.svgOptions, filename });
          break;
        case 'json':
          result = await this.exportJSON({ ...options.jsonOptions, filename });
          break;
        case 'csv':
          result = await this.exportCSV({ ...options.csvOptions, filename });
          break;
        default:
          result = {
            success: false,
            format: format as ExportFormat,
            filename: `${filename || 'export'}.${format}`,
            mimeType: 'application/octet-stream',
            timestamp: new Date(),
            error: `Unknown format: ${format}`,
          };
      }

      results.set(format, result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      completedFormats++;
    }

    onProgress?.({
      format: 'json', // placeholder
      percentage: 100,
      stage: 'Batch export complete',
      complete: true,
    });

    return {
      results,
      allSuccessful: failureCount === 0,
      successCount,
      failureCount,
    };
  }

  /**
   * Export all formats and download as zip (requires external library)
   * For now, downloads each file individually
   */
  async exportAndDownloadAll(
    baseFilename: string = 'graph-export',
    options?: {
      png?: PNGExportOptions;
      svg?: SVGExportOptions;
      json?: JSONExportOptions;
      csv?: CSVExportOptions;
    }
  ): Promise<BatchExportResult> {
    const result = await this.exportBatch({
      formats: ['png', 'svg', 'json', 'csv'],
      filename: baseFilename,
      pngOptions: options?.png,
      svgOptions: options?.svg,
      jsonOptions: options?.json,
      csvOptions: options?.csv,
    });

    // Download each successful export
    for (const [format, exportResult] of result.results) {
      if (exportResult.success && exportResult.data) {
        switch (format) {
          case 'png':
            this.downloadBlob(exportResult.data as Blob, exportResult.filename);
            break;
          case 'svg':
          case 'json':
          case 'csv':
            this.downloadString(
              exportResult.data as string,
              exportResult.filename,
              exportResult.mimeType
            );
            break;
        }
      }
    }

    return result;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get available export formats
   */
  getAvailableFormats(): ExportFormat[] {
    return ['png', 'svg', 'json', 'csv'];
  }

  /**
   * Check if a format is supported
   */
  isFormatSupported(format: string): format is ExportFormat {
    return ['png', 'svg', 'json', 'csv'].includes(format);
  }

  /**
   * Get MIME type for a format
   */
  getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      png: 'image/png',
      svg: 'image/svg+xml',
      json: 'application/json',
      csv: 'text/csv',
    };
    return mimeTypes[format];
  }

  /**
   * Get file extension for a format
   */
  getFileExtension(format: ExportFormat): string {
    return `.${format}`;
  }

  /**
   * Download a Blob as a file
   */
  downloadBlob(blob: Blob, filename: string): void {
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
   * Download a string as a file
   */
  downloadString(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  /**
   * Generate a filename with optional timestamp
   */
  generateFilename(
    baseName: string,
    format: ExportFormat,
    includeTimestamp: boolean = false
  ): string {
    if (includeTimestamp) {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      return `${baseName}-${dateStr}.${format}`;
    }
    return `${baseName}.${format}`;
  }

  /**
   * Get export statistics for current graph
   */
  getExportStats(): { nodeCount: number; edgeCount: number } | null {
    const cy = this.getCytoscape();
    if (!cy) return null;

    return {
      nodeCount: cy.nodes().length,
      edgeCount: cy.edges().length,
    };
  }

  /**
   * Estimate export file sizes (rough estimates)
   */
  estimateFileSizes(): Record<ExportFormat, string> | null {
    const stats = this.getExportStats();
    if (!stats) return null;

    const { nodeCount, edgeCount } = stats;
    const totalElements = nodeCount + edgeCount;

    // Rough estimates based on typical element sizes
    const pngEstimate = Math.max(50, totalElements * 2); // KB
    const svgEstimate = Math.max(10, totalElements * 0.5); // KB
    const jsonEstimate = Math.max(5, totalElements * 0.3); // KB
    const csvEstimate = Math.max(2, totalElements * 0.1); // KB

    return {
      png: `~${pngEstimate} KB`,
      svg: `~${svgEstimate} KB`,
      json: `~${jsonEstimate} KB`,
      csv: `~${csvEstimate} KB`,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const exportService = new ExportService();

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ExportService instance
 */
export function createExportService(cytoscapeManager?: CytoscapeManager): ExportService {
  return new ExportService(cytoscapeManager);
}
