/**
 * SVG Exporter
 *
 * Exports graph visualizations as SVG (Scalable Vector Graphics) files.
 * Produces resolution-independent vector output.
 *
 * @module services/export/formatters/svgExporter
 */

import type { Core } from 'cytoscape';
import type {
  SVGExportOptions,
  SVGExportResult,
  ExportProgressCallback,
} from '../types';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_SVG_OPTIONS: Required<Omit<SVGExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'customCSS'>> = {
  scale: 1,
  full: true,
  embedFonts: false,
  inlineStyles: true,
  optimize: false,
  scope: 'full',
};

// ============================================================================
// SVG Exporter Class
// ============================================================================

/**
 * Exports graph as SVG vector image
 */
export class SVGExporter {
  /**
   * Export the graph as an SVG image
   */
  async export(
    cy: Core,
    options: SVGExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<SVGExportResult> {
    const timestamp = new Date();
    const mergedOptions = { ...DEFAULT_SVG_OPTIONS, ...options };

    try {
      onProgress?.({
        format: 'svg',
        percentage: 10,
        stage: 'Preparing export',
        complete: false,
      });

      // Determine which elements to export
      const elements = this.getElementsForScope(cy, mergedOptions.scope);

      if (elements.length === 0) {
        return this.createErrorResult('No elements to export', options.filename, timestamp);
      }

      onProgress?.({
        format: 'svg',
        percentage: 30,
        stage: 'Generating SVG',
        complete: false,
      });

      // Generate SVG content
      // Note: Cytoscape.js svg() method may not be available by default
      // We'll implement a custom SVG generator
      let svgContent = this.generateSVG(cy, mergedOptions);

      onProgress?.({
        format: 'svg',
        percentage: 60,
        stage: 'Processing styles',
        complete: false,
      });

      // Add custom CSS if provided
      if (options.customCSS) {
        svgContent = this.injectCustomCSS(svgContent, options.customCSS);
      }

      // Optimize if requested
      if (mergedOptions.optimize) {
        onProgress?.({
          format: 'svg',
          percentage: 80,
          stage: 'Optimizing SVG',
          complete: false,
        });
        svgContent = this.optimizeSVG(svgContent);
      }

      onProgress?.({
        format: 'svg',
        percentage: 100,
        stage: 'Export complete',
        complete: true,
      });

      const filename = this.generateFilename(options.filename, options.includeTimestamp, timestamp);

      return {
        success: true,
        data: svgContent,
        format: 'svg',
        filename,
        mimeType: 'image/svg+xml',
        size: new Blob([svgContent]).size,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during SVG export';

      onProgress?.({
        format: 'svg',
        percentage: 0,
        stage: 'Export failed',
        complete: true,
        error: errorMessage,
      });

      return this.createErrorResult(errorMessage, options.filename, timestamp);
    }
  }

  /**
   * Export as data URL (for previews)
   */
  exportAsDataUrl(cy: Core, options: SVGExportOptions = {}): string | null {
    try {
      const svgContent = this.generateSVG(cy, { ...DEFAULT_SVG_OPTIONS, ...options });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
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
  private getElementsForScope(cy: Core, scope: SVGExportOptions['scope']) {
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
   * Generate SVG content from Cytoscape graph
   */
  private generateSVG(cy: Core, options: Required<Omit<SVGExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'customCSS'>>): string {
    // Try to use Cytoscape's built-in SVG export if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cyAny = cy as any;
    if (typeof cyAny.svg === 'function') {
      return cyAny.svg({
        scale: options.scale,
        full: options.full,
      });
    }

    // Fallback: Generate SVG manually from graph data
    return this.generateSVGManually(cy, options);
  }

  /**
   * Manually generate SVG from graph elements
   */
  private generateSVGManually(cy: Core, options: Required<Omit<SVGExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata' | 'customCSS'>>): string {
    const bb = cy.elements().boundingBox();
    const padding = 50;
    const scale = options.scale;

    const width = (bb.w + padding * 2) * scale;
    const height = (bb.h + padding * 2) * scale;

    const offsetX = -bb.x1 + padding;
    const offsetY = -bb.y1 + padding;

    const lines: string[] = [];

    // SVG header
    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

    // Styles
    if (options.inlineStyles) {
      lines.push(`<defs>`);
      lines.push(`  <style type="text/css">`);
      lines.push(`    .node { fill: #666; stroke: #333; stroke-width: 2; }`);
      lines.push(`    .node.trajectory { fill: #4F46E5; }`);
      lines.push(`    .node.pattern { fill: #059669; }`);
      lines.push(`    .node.episode { fill: #D97706; }`);
      lines.push(`    .node.feedback { fill: #DC2626; }`);
      lines.push(`    .node.reasoning_step { fill: #7C3AED; }`);
      lines.push(`    .node.checkpoint { fill: #0891B2; }`);
      lines.push(`    .edge { stroke: #94A3B8; stroke-width: 2; fill: none; }`);
      lines.push(`    .label { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }`);
      lines.push(`  </style>`);
      lines.push(`</defs>`);
    }

    // Transform group
    lines.push(`<g transform="scale(${scale}) translate(${offsetX}, ${offsetY})">`);

    // Draw edges first (behind nodes)
    cy.edges().forEach(edge => {
      const sourcePos = edge.source().position();
      const targetPos = edge.target().position();
      const edgeType = edge.data('type') || 'default';

      lines.push(`  <line class="edge ${edgeType}" x1="${sourcePos.x}" y1="${sourcePos.y}" x2="${targetPos.x}" y2="${targetPos.y}" />`);
    });

    // Draw nodes
    cy.nodes().forEach(node => {
      const pos = node.position();
      const nodeType = node.data('type') || 'default';
      const label = node.data('label') || node.id();

      // Get node dimensions (default to 30x30)
      const width = 30;
      const height = 30;

      // Draw node shape
      lines.push(`  <ellipse class="node ${nodeType}" cx="${pos.x}" cy="${pos.y}" rx="${width / 2}" ry="${height / 2}" />`);

      // Draw label
      lines.push(`  <text class="label" x="${pos.x}" y="${pos.y + height / 2 + 15}" text-anchor="middle">${this.escapeXml(label)}</text>`);
    });

    lines.push(`</g>`);
    lines.push(`</svg>`);

    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Inject custom CSS into SVG
   */
  private injectCustomCSS(svgContent: string, customCSS: string): string {
    const styleTag = `<style type="text/css">${customCSS}</style>`;

    // Find the defs section or create one
    if (svgContent.includes('<defs>')) {
      return svgContent.replace('<defs>', `<defs>${styleTag}`);
    }

    // Insert after opening svg tag
    return svgContent.replace(/<svg([^>]*)>/, `<svg$1><defs>${styleTag}</defs>`);
  }

  /**
   * Optimize SVG content for smaller file size
   */
  private optimizeSVG(svgContent: string): string {
    // Basic optimization - remove unnecessary whitespace
    let optimized = svgContent
      .replace(/>\s+</g, '><')  // Remove whitespace between tags
      .replace(/\s+/g, ' ')     // Collapse multiple spaces
      .replace(/\s*=\s*/g, '=') // Remove spaces around =
      .trim();

    // Remove unnecessary precision from numbers
    optimized = optimized.replace(/(\d+\.\d{3})\d+/g, '$1');

    return optimized;
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
      return `${baseName}-${dateStr}.svg`;
    }

    return `${baseName}.svg`;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    filename?: string,
    timestamp?: Date
  ): SVGExportResult {
    return {
      success: false,
      format: 'svg',
      filename: filename ? `${filename}.svg` : 'export-failed.svg',
      mimeType: 'image/svg+xml',
      timestamp: timestamp || new Date(),
      error,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const svgExporter = new SVGExporter();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick export function for simple use cases
 */
export async function exportToSVG(
  cy: Core,
  options?: SVGExportOptions
): Promise<SVGExportResult> {
  return svgExporter.export(cy, options);
}

/**
 * Export and immediately download
 */
export async function exportAndDownloadSVG(
  cy: Core,
  options?: SVGExportOptions
): Promise<SVGExportResult> {
  const result = await svgExporter.export(cy, options);

  if (result.success && result.data) {
    downloadString(result.data, result.filename, 'image/svg+xml');
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
