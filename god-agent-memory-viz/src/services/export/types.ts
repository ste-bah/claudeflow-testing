/**
 * Export Service Types
 *
 * Type definitions for export functionality including options,
 * formats, and metadata.
 *
 * @module services/export/types
 */

import type { GraphData, GraphNode, GraphEdge } from '@/types/graph';

// ============================================================================
// Export Format Types
// ============================================================================

/**
 * Supported export formats
 */
export type ExportFormat = 'png' | 'svg' | 'json' | 'csv';

/**
 * Export scope - what to include in export
 */
export type ExportScope = 'full' | 'visible' | 'selected';

// ============================================================================
// Common Export Options
// ============================================================================

/**
 * Base options for all export operations
 */
export interface BaseExportOptions {
  /** Custom filename (without extension) */
  filename?: string;
  /** Whether to include metadata in export */
  includeMetadata?: boolean;
  /** Export scope - full graph, visible area, or selected elements */
  scope?: ExportScope;
  /** Timestamp to include in filename */
  includeTimestamp?: boolean;
}

// ============================================================================
// Image Export Options
// ============================================================================

/**
 * Options for PNG export
 */
export interface PNGExportOptions extends BaseExportOptions {
  /** Scale factor for the exported image (1 = 100%, 2 = 200%, etc.) */
  scale?: number;
  /** Background color (CSS color string or 'transparent') */
  backgroundColor?: string;
  /** Whether to export full graph or just visible portion */
  full?: boolean;
  /** Maximum width in pixels (will scale down if needed) */
  maxWidth?: number;
  /** Maximum height in pixels (will scale down if needed) */
  maxHeight?: number;
  /** Image quality (0-1, for formats that support it) */
  quality?: number;
}

/**
 * Options for SVG export
 */
export interface SVGExportOptions extends BaseExportOptions {
  /** Scale factor for the exported SVG */
  scale?: number;
  /** Whether to export full graph or just visible portion */
  full?: boolean;
  /** Whether to embed fonts */
  embedFonts?: boolean;
  /** Whether to include CSS styles inline */
  inlineStyles?: boolean;
  /** Custom CSS to include */
  customCSS?: string;
  /** Whether to optimize SVG for smaller file size */
  optimize?: boolean;
}

// ============================================================================
// Data Export Options
// ============================================================================

/**
 * Options for JSON export
 */
export interface JSONExportOptions extends BaseExportOptions {
  /** Whether to include node positions */
  includePositions?: boolean;
  /** Whether to include visual styles */
  includeStyles?: boolean;
  /** Whether to include Cytoscape-specific data */
  includeCytoscapeData?: boolean;
  /** Whether to pretty-print the JSON */
  pretty?: boolean;
  /** Indentation for pretty printing (spaces) */
  indent?: number;
  /** Custom fields to exclude from export */
  excludeFields?: string[];
  /** Only include specific fields */
  includeOnlyFields?: string[];
}

/**
 * Options for CSV export
 */
export interface CSVExportOptions extends BaseExportOptions {
  /** Delimiter character */
  delimiter?: ',' | ';' | '\t' | '|';
  /** Whether to include header row */
  includeHeader?: boolean;
  /** What to export: nodes, edges, or both */
  content?: 'nodes' | 'edges' | 'both';
  /** Fields to include in node export */
  nodeFields?: (keyof GraphNode | string)[];
  /** Fields to include in edge export */
  edgeFields?: (keyof GraphEdge | string)[];
  /** Whether to quote all values */
  quoteAll?: boolean;
  /** Line ending style */
  lineEnding?: 'unix' | 'windows';
}

// ============================================================================
// Export Result Types
// ============================================================================

/**
 * Result of an export operation
 */
export interface ExportResult<T = unknown> {
  /** Whether the export was successful */
  success: boolean;
  /** The exported data */
  data?: T;
  /** Export format used */
  format: ExportFormat;
  /** Generated filename */
  filename: string;
  /** MIME type of the exported content */
  mimeType: string;
  /** Size of the exported content in bytes */
  size?: number;
  /** Export timestamp */
  timestamp: Date;
  /** Error message if export failed */
  error?: string;
}

/**
 * PNG export result
 */
export interface PNGExportResult extends ExportResult<Blob> {
  format: 'png';
  mimeType: 'image/png';
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * SVG export result
 */
export interface SVGExportResult extends ExportResult<string> {
  format: 'svg';
  mimeType: 'image/svg+xml';
}

/**
 * JSON export result
 */
export interface JSONExportResult extends ExportResult<string> {
  format: 'json';
  mimeType: 'application/json';
  /** Parsed data for convenience */
  parsedData?: GraphData | object;
}

/**
 * CSV export result
 */
export interface CSVExportResult extends ExportResult<string> {
  format: 'csv';
  mimeType: 'text/csv';
  /** Number of rows exported */
  rowCount?: number;
}

// ============================================================================
// Export Metadata
// ============================================================================

/**
 * Metadata included in exports
 */
export interface ExportMetadata {
  /** Export timestamp */
  exportedAt: string;
  /** Application version */
  appVersion?: string;
  /** Source database or file */
  source?: string;
  /** Export scope */
  scope: ExportScope;
  /** Total node count */
  nodeCount: number;
  /** Total edge count */
  edgeCount: number;
  /** User agent */
  userAgent?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Batch Export Types
// ============================================================================

/**
 * Options for batch export (multiple formats at once)
 */
export interface BatchExportOptions {
  /** Formats to export */
  formats: ExportFormat[];
  /** Base filename (format-specific extensions will be added) */
  filename?: string;
  /** Options for PNG export */
  pngOptions?: Omit<PNGExportOptions, 'filename'>;
  /** Options for SVG export */
  svgOptions?: Omit<SVGExportOptions, 'filename'>;
  /** Options for JSON export */
  jsonOptions?: Omit<JSONExportOptions, 'filename'>;
  /** Options for CSV export */
  csvOptions?: Omit<CSVExportOptions, 'filename'>;
}

/**
 * Result of batch export operation
 */
export interface BatchExportResult {
  /** Results for each format */
  results: Map<ExportFormat, ExportResult>;
  /** Whether all exports succeeded */
  allSuccessful: boolean;
  /** Count of successful exports */
  successCount: number;
  /** Count of failed exports */
  failureCount: number;
}

// ============================================================================
// Export Progress Types
// ============================================================================

/**
 * Progress callback for long-running exports
 */
export type ExportProgressCallback = (progress: ExportProgress) => void;

/**
 * Export progress information
 */
export interface ExportProgress {
  /** Export format */
  format: ExportFormat;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current stage description */
  stage: string;
  /** Whether export is complete */
  complete: boolean;
  /** Whether export was cancelled */
  cancelled?: boolean;
  /** Error if any */
  error?: string;
}
