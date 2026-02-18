/**
 * Market Data Service
 *
 * Provides methods for fetching market data including quotes, charts,
 * and historical price data from the backend API.
 */

import type {
  TickerData,
  TickerHistoryResponse,
  Timeframe,
} from '../types';
import { getApiUrl } from './config';
import { healthService } from './health';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Market Data Service errors
 */
export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly symbol?: string
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

/**
 * Check if backend is available before making requests
 */
async function ensureBackendAvailable(): Promise<void> {
  const health = healthService.getHealth();
  if (!health?.api?.reachable) {
    throw new MarketDataError(
      'Backend is not available. Please ensure the server is running.',
      'BACKEND_UNAVAILABLE'
    );
  }
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, endpoint: string, params?: Record<string, unknown>): string {
  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

/**
 * Market Data Service
 *
 * Provides methods for fetching market data from the backend API.
 * Uses the health service to verify backend availability before making requests.
 */
class MarketDataService {
  /**
   * Get current quote for a symbol
   */
  async getQuote(symbol: string): Promise<TickerData> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = buildUrl(apiUrl, `/ticker/${encodeURIComponent(symbol.toUpperCase())}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new MarketDataError(
            `Symbol "${symbol}" not found`,
            'SYMBOL_NOT_FOUND',
            404,
            symbol
          );
        }
        throw new MarketDataError(
          `Failed to fetch quote for ${symbol}`,
          'QUOTE_REQUEST_FAILED',
          response.status,
          symbol
        );
      }

      const data = await response.json();
      return data as TickerData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MarketDataError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MarketDataError(
            `Request timed out for ${symbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            symbol
          );
        }
        throw new MarketDataError(
          `Failed to fetch quote: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          symbol
        );
      }

      throw new MarketDataError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get historical price data for a symbol
   */
  async getHistory(
    symbol: string,
    timeframe: Timeframe = '3m'
  ): Promise<TickerHistoryResponse> {
    await ensureBackendAvailable();

    const apiUrl = getApiUrl();
    const url = buildUrl(apiUrl, `/ticker/${encodeURIComponent(symbol.toUpperCase())}`, {
      period: timeframe,
      include_history: true,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new MarketDataError(
            `Symbol "${symbol}" not found`,
            'SYMBOL_NOT_FOUND',
            404,
            symbol
          );
        }
        throw new MarketDataError(
          `Failed to fetch history for ${symbol}`,
          'HISTORY_REQUEST_FAILED',
          response.status,
          symbol
        );
      }

      const data = await response.json();
      return data as TickerHistoryResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MarketDataError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MarketDataError(
            `Request timed out for ${symbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            symbol
          );
        }
        throw new MarketDataError(
          `Failed to fetch history: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          symbol
        );
      }

      throw new MarketDataError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Map<string, TickerData>> {
    await ensureBackendAvailable();

    const results = new Map<string, TickerData>();
    const errors: Array<{ symbol: string; error: MarketDataError }> = [];

    // Fetch all quotes concurrently with limit
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(async (symbol) => {
        try {
          const quote = await this.getQuote(symbol);
          return { symbol, quote, error: null };
        } catch (error) {
          return {
            symbol,
            quote: null,
            error: error instanceof MarketDataError ? error : null,
          };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ symbol, quote, error }) => {
        if (quote) {
          results.set(symbol, quote);
        } else if (error) {
          errors.push({ symbol, error });
        }
      });
    }

    if (errors.length > 0 && results.size === 0) {
      // All requests failed
      throw errors[0].error;
    }

    return results;
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();

// Export convenience functions
export const getQuote = (symbol: string) => marketDataService.getQuote(symbol);
export const getHistory = (symbol: string, timeframe?: Timeframe) =>
  marketDataService.getHistory(symbol, timeframe);
export const getQuotes = (symbols: string[]) => marketDataService.getQuotes(symbols);

// Export error class for type checking
export { MarketDataError };