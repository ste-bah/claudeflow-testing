/**
 * Analysis Service
 *
 * Provides methods for triggering and retrieving stock analysis results
 * from the backend API.
 */

import type {
  AnalysisApiResponse,
  AnalysisData,
  CompositeSignal,
} from '../types';
import { normalizeAnalysis } from '../types';
import { getApiUrl } from './config';
import { healthService } from './health';

/**
 * Request timeout in milliseconds for analysis requests
 */
const ANALYSIS_TIMEOUT = 120000; // 2 minutes for analysis

/**
 * Analysis Service errors
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly symbol?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

/**
 * Check if backend is available before making requests
 */
async function ensureBackendAvailable(): Promise<void> {
  const health = healthService.getHealth();
  if (!health?.api?.reachable) {
    throw new AnalysisError(
      'Backend is not available. Please ensure the server is running.',
      'BACKEND_UNAVAILABLE'
    );
  }
}

/**
 * Analysis Service
 *
 * Provides methods for triggering and retrieving stock analysis results.
 * Uses the health service to verify backend availability before making requests.
 */
class AnalysisService {
  /**
   * Get cached analysis results for a symbol
   */
  async getAnalysis(symbol: string, signal?: AbortSignal): Promise<AnalysisData> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/analyze/${encodeURIComponent(symbol.toUpperCase())}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

    // If a signal is provided, handle its abort
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new AnalysisError(
            `No analysis available for "${symbol}"`,
            'ANALYSIS_NOT_FOUND',
            404,
            symbol
          );
        }
        if (response.status === 503) {
          throw new AnalysisError(
            'Analysis service is temporarily unavailable',
            'SERVICE_UNAVAILABLE',
            503,
            symbol
          );
        }
        throw new AnalysisError(
          `Failed to fetch analysis for ${symbol}`,
          'ANALYSIS_REQUEST_FAILED',
          response.status,
          symbol
        );
      }

      const data: AnalysisApiResponse = await response.json();
      return normalizeAnalysis(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AnalysisError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (signal?.aborted) {
            throw new AnalysisError(
              'Analysis request was cancelled',
              'REQUEST_CANCELLED',
              undefined,
              symbol
            );
          }
          throw new AnalysisError(
            `Analysis request timed out for ${symbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            symbol
          );
        }
        throw new AnalysisError(
          `Failed to fetch analysis: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          symbol
        );
      }

      throw new AnalysisError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Trigger a new analysis for a symbol
   */
  async triggerAnalysis(symbol: string): Promise<CompositeSignal> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/analyze/${encodeURIComponent(symbol.toUpperCase())}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new AnalysisError(
            `Symbol "${symbol}" not found`,
            'SYMBOL_NOT_FOUND',
            404,
            symbol
          );
        }
        if (response.status === 503) {
          throw new AnalysisError(
            'Analysis service is temporarily unavailable',
            'SERVICE_UNAVAILABLE',
            503,
            symbol
          );
        }
        throw new AnalysisError(
          `Failed to trigger analysis for ${symbol}`,
          'ANALYSIS_TRIGGER_FAILED',
          response.status,
          symbol
        );
      }

      const data = await response.json();
      return data as CompositeSignal;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AnalysisError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AnalysisError(
            `Analysis request timed out for ${symbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            symbol
          );
        }
        throw new AnalysisError(
          `Failed to trigger analysis: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          symbol
        );
      }

      throw new AnalysisError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get analysis status (check if analysis is in progress)
   */
  async getAnalysisStatus(symbol: string): Promise<{
    isAnalyzing: boolean;
    lastAnalysis?: string;
    cached: boolean;
  }> {
    // This would typically call a status endpoint
    // For now, we check if we can get cached analysis
    try {
      const analysis = await this.getAnalysis(symbol);
      return {
        isAnalyzing: false,
        lastAnalysis: analysis.composite.timestamp,
        cached: analysis.metadata.cached,
      };
    } catch (error) {
      if (error instanceof AnalysisError && error.code === 'ANALYSIS_NOT_FOUND') {
        return { isAnalyzing: false, cached: false };
      }
      // Re-throw other errors
      throw error;
    }
  }
}

// Export singleton instance
export const analysisService = new AnalysisService();

// Export convenience functions
export const getAnalysis = (symbol: string, signal?: AbortSignal) =>
  analysisService.getAnalysis(symbol, signal);
export const triggerAnalysis = (symbol: string) =>
  analysisService.triggerAnalysis(symbol);
export const getAnalysisStatus = (symbol: string) =>
  analysisService.getAnalysisStatus(symbol);
