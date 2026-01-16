/**
 * PNG Exporter
 *
 * Exports graph visualizations as PNG images using Cytoscape.js
 * canvas rendering capabilities.
 *
 * @module services/export/formatters/pngExporter
 */

import type { Core } from 'cytoscape';
import type {
  PNGExportOptions,
  PNGExportResult,
  ExportProgressCallback,
} from '../types';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_PNG_OPTIONS: Required<Omit<PNGExportOptions, 'filename' | 'includeTimestamp' | 'includeMetadata'>> = {
  scale: 2,
  backgroundColor: '#ffffff',
  full: true,
  maxWidth: 4096,
  maxHeight: 4096,
  quality: 0.92,
  scope: 'full',
};

// ============================================================================
// PNG Exporter Class
// ============================================================================

/**
 * Exports graph as PNG image
 */
export class PNGExporter {
  /**
   * Export the graph as a PNG image
   */
  async export(
    cy: Core,
    options: PNGExportOptions = {},
    onProgress?: ExportProgressCallback
  ): Promise<PNGExportResult> {
    const timestamp = new Date();
    const mergedOptions = { ...DEFAULT_PNG_OPTIONS, ...options };

    try {
      onProgress?.({
        format: 'png',
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
        format: 'png',
        percentage: 30,
        stage: 'Rendering canvas',
        complete: false,
      });

      // Generate PNG data URL
      const pngDataUrl = cy.png({
        scale: mergedOptions.scale,
        bg: mergedOptions.backgroundColor === 'transparent' ? undefined : mergedOptions.backgroundColor,
        full: mergedOptions.full,
        maxWidth: mergedOptions.maxWidth,
        maxHeight: mergedOptions.maxHeight,
      });

      onProgress?.({
        format: 'png',
        percentage: 70,
        stage: 'Converting to blob',
        complete: false,
      });

      // Convert data URL to Blob
      const blob = await this.dataUrlToBlob(pngDataUrl);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(pngDataUrl);

      onProgress?.({
        format: 'png',
        percentage: 100,
        stage: 'Export complete',
        complete: true,
      });

      const filename = this.generateFilename(options.filename, options.includeTimestamp, timestamp);

      return {
        success: true,
        data: blob,
        format: 'png',
        filename,
        mimeType: 'image/png',
        size: blob.size,
        timestamp,
        dimensions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during PNG export';

      onProgress?.({
        format: 'png',
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
  exportAsDataUrl(cy: Core, options: PNGExportOptions = {}): string | null {
    const mergedOptions = { ...DEFAULT_PNG_OPTIONS, ...options };

    try {
      return cy.png({
        scale: mergedOptions.scale,
        bg: mergedOptions.backgroundColor === 'transparent' ? undefined : mergedOptions.backgroundColor,
        full: mergedOptions.full,
        maxWidth: mergedOptions.maxWidth,
        maxHeight: mergedOptions.maxHeight,
      });
    } catch {
      return null;
    }
  }

  /**
   * Export selected elements only
   */
  async exportSelected(
    cy: Core,
    options: PNGExportOptions = {}
  ): Promise<PNGExportResult> {
    return this.export(cy, { ...options, scope: 'selected' });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get elements based on scope
   */
  private getElementsForScope(cy: Core, scope: PNGExportOptions['scope']) {
    switch (scope) {
      case 'selected':
        return cy.elements(':selected');
      case 'visible':
        // Get elements in current viewport
        const extent = cy.extent();
        return cy.elements().filter(ele => {
          if (ele.isNode()) {
            const pos = ele.position();
            return pos.x >= extent.x1 && pos.x <= extent.x2 &&
                   pos.y >= extent.y1 && pos.y <= extent.y2;
          }
          return true; // Include all edges
        });
      case 'full':
      default:
        return cy.elements();
    }
  }

  /**
   * Convert data URL to Blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Extract base64 data
        const parts = dataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const base64Data = parts[1];

        // Decode base64
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });

        resolve(blob);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get image dimensions from data URL
   */
  private async getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for dimension calculation'));
      };

      img.src = dataUrl;
    });
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
      return `${baseName}-${dateStr}.png`;
    }

    return `${baseName}.png`;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    filename?: string,
    timestamp?: Date
  ): PNGExportResult {
    return {
      success: false,
      format: 'png',
      filename: filename ? `${filename}.png` : 'export-failed.png',
      mimeType: 'image/png',
      timestamp: timestamp || new Date(),
      error,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const pngExporter = new PNGExporter();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick export function for simple use cases
 */
export async function exportToPNG(
  cy: Core,
  options?: PNGExportOptions
): Promise<PNGExportResult> {
  return pngExporter.export(cy, options);
}

/**
 * Export and immediately download
 */
export async function exportAndDownloadPNG(
  cy: Core,
  options?: PNGExportOptions
): Promise<PNGExportResult> {
  const result = await pngExporter.export(cy, options);

  if (result.success && result.data) {
    downloadBlob(result.data, result.filename);
  }

  return result;
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
