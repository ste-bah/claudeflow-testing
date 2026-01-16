/**
 * useExport Hook
 *
 * React hook for using the export service with Cytoscape graph.
 * Provides convenient methods for exporting graph in various formats.
 *
 * @module hooks/useExport
 */

import { useState, useCallback, useMemo } from 'react';
import type { CytoscapeManager } from '@/services/graph/CytoscapeManager';
import {
  ExportService,
  type ExportFormat,
  type PNGExportOptions,
  type SVGExportOptions,
  type JSONExportOptions,
  type CSVExportOptions,
  type PNGExportResult,
  type SVGExportResult,
  type JSONExportResult,
  type CSVExportResult,
  type BatchExportOptions,
  type BatchExportResult,
  type ExportProgress,
} from '@/services/export';

// ============================================================================
// Types
// ============================================================================

export interface UseExportOptions {
  /** CytoscapeManager instance from useCytoscape hook */
  cytoscapeManager?: CytoscapeManager | null;
  /** Default filename base for exports */
  defaultFilename?: string;
  /** Whether to include timestamps in filenames by default */
  includeTimestamp?: boolean;
}

export interface UseExportReturn {
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Current export progress */
  progress: ExportProgress | null;
  /** Last export error */
  error: string | null;

  // Export methods
  exportPNG: (options?: PNGExportOptions) => Promise<PNGExportResult>;
  exportSVG: (options?: SVGExportOptions) => Promise<SVGExportResult>;
  exportJSON: (options?: JSONExportOptions) => Promise<JSONExportResult>;
  exportCSV: (options?: CSVExportOptions) => Promise<CSVExportResult>;
  exportBatch: (options: BatchExportOptions) => Promise<BatchExportResult>;

  // Download methods (export + download)
  downloadPNG: (options?: PNGExportOptions) => Promise<PNGExportResult>;
  downloadSVG: (options?: SVGExportOptions) => Promise<SVGExportResult>;
  downloadJSON: (options?: JSONExportOptions) => Promise<JSONExportResult>;
  downloadCSV: (options?: CSVExportOptions) => Promise<CSVExportResult>;
  downloadAll: (options?: {
    png?: PNGExportOptions;
    svg?: SVGExportOptions;
    json?: JSONExportOptions;
    csv?: CSVExportOptions;
  }) => Promise<BatchExportResult>;

  // Preview methods
  getPNGPreview: (options?: PNGExportOptions) => string | null;
  getSVGPreview: (options?: SVGExportOptions) => string | null;

  // Utilities
  getAvailableFormats: () => ExportFormat[];
  getExportStats: () => { nodeCount: number; edgeCount: number } | null;
  estimateFileSizes: () => Record<ExportFormat, string> | null;
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for graph export functionality
 *
 * @example
 * ```tsx
 * const { manager } = useCytoscape();
 * const { downloadPNG, downloadSVG, isExporting } = useExport({ cytoscapeManager: manager });
 *
 * return (
 *   <button onClick={() => downloadPNG()} disabled={isExporting}>
 *     Export PNG
 *   </button>
 * );
 * ```
 */
export function useExport(options: UseExportOptions = {}): UseExportReturn {
  const {
    cytoscapeManager,
    defaultFilename = 'graph-export',
    includeTimestamp = false,
  } = options;

  // State
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create export service with manager
  const exportService = useMemo(() => {
    const service = new ExportService();
    if (cytoscapeManager) {
      service.setCytoscapeManager(cytoscapeManager);
    }
    return service;
  }, [cytoscapeManager]);

  // Progress callback
  const handleProgress = useCallback((progressUpdate: ExportProgress) => {
    setProgress(progressUpdate);
  }, []);

  // Merge default options
  const mergeOptions = useCallback(
    <T extends { filename?: string; includeTimestamp?: boolean }>(opts?: T): T => {
      return {
        filename: defaultFilename,
        includeTimestamp,
        ...opts,
      } as T;
    },
    [defaultFilename, includeTimestamp]
  );

  // Export PNG
  const exportPNG = useCallback(
    async (opts?: PNGExportOptions): Promise<PNGExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportPNG(
          mergeOptions(opts),
          handleProgress
        );
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
        setProgress(null);
      }
    },
    [exportService, mergeOptions, handleProgress]
  );

  // Export SVG
  const exportSVG = useCallback(
    async (opts?: SVGExportOptions): Promise<SVGExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportSVG(
          mergeOptions(opts),
          handleProgress
        );
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
        setProgress(null);
      }
    },
    [exportService, mergeOptions, handleProgress]
  );

  // Export JSON
  const exportJSON = useCallback(
    async (opts?: JSONExportOptions): Promise<JSONExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportJSON(
          mergeOptions(opts),
          handleProgress
        );
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
        setProgress(null);
      }
    },
    [exportService, mergeOptions, handleProgress]
  );

  // Export CSV
  const exportCSV = useCallback(
    async (opts?: CSVExportOptions): Promise<CSVExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportCSV(
          mergeOptions(opts),
          handleProgress
        );
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
        setProgress(null);
      }
    },
    [exportService, mergeOptions, handleProgress]
  );

  // Export batch
  const exportBatch = useCallback(
    async (batchOpts: BatchExportOptions): Promise<BatchExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportBatch(
          { ...batchOpts, filename: batchOpts.filename || defaultFilename },
          handleProgress
        );
        if (!result.allSuccessful) {
          setError('Some exports failed');
        }
        return result;
      } finally {
        setIsExporting(false);
        setProgress(null);
      }
    },
    [exportService, defaultFilename, handleProgress]
  );

  // Download PNG
  const downloadPNG = useCallback(
    async (opts?: PNGExportOptions): Promise<PNGExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportAndDownloadPNG(mergeOptions(opts));
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [exportService, mergeOptions]
  );

  // Download SVG
  const downloadSVG = useCallback(
    async (opts?: SVGExportOptions): Promise<SVGExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportAndDownloadSVG(mergeOptions(opts));
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [exportService, mergeOptions]
  );

  // Download JSON
  const downloadJSON = useCallback(
    async (opts?: JSONExportOptions): Promise<JSONExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportAndDownloadJSON(mergeOptions(opts));
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [exportService, mergeOptions]
  );

  // Download CSV
  const downloadCSV = useCallback(
    async (opts?: CSVExportOptions): Promise<CSVExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportAndDownloadCSV(mergeOptions(opts));
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [exportService, mergeOptions]
  );

  // Download all formats
  const downloadAll = useCallback(
    async (opts?: {
      png?: PNGExportOptions;
      svg?: SVGExportOptions;
      json?: JSONExportOptions;
      csv?: CSVExportOptions;
    }): Promise<BatchExportResult> => {
      setIsExporting(true);
      setError(null);
      try {
        const result = await exportService.exportAndDownloadAll(defaultFilename, opts);
        if (!result.allSuccessful) {
          setError('Some exports failed');
        }
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [exportService, defaultFilename]
  );

  // Get PNG preview
  const getPNGPreview = useCallback(
    (opts?: PNGExportOptions): string | null => {
      return exportService.exportPNGAsDataUrl(opts);
    },
    [exportService]
  );

  // Get SVG preview
  const getSVGPreview = useCallback(
    (opts?: SVGExportOptions): string | null => {
      return exportService.exportSVGAsDataUrl(opts);
    },
    [exportService]
  );

  // Get available formats
  const getAvailableFormats = useCallback((): ExportFormat[] => {
    return exportService.getAvailableFormats();
  }, [exportService]);

  // Get export stats
  const getExportStats = useCallback((): { nodeCount: number; edgeCount: number } | null => {
    return exportService.getExportStats();
  }, [exportService]);

  // Estimate file sizes
  const estimateFileSizes = useCallback((): Record<ExportFormat, string> | null => {
    return exportService.estimateFileSizes();
  }, [exportService]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isExporting,
    progress,
    error,

    exportPNG,
    exportSVG,
    exportJSON,
    exportCSV,
    exportBatch,

    downloadPNG,
    downloadSVG,
    downloadJSON,
    downloadCSV,
    downloadAll,

    getPNGPreview,
    getSVGPreview,

    getAvailableFormats,
    getExportStats,
    estimateFileSizes,
    clearError,
  };
}

export default useExport;
