/**
 * Watchlist Service
 *
 * Provides methods for managing the user's stock watchlist.
 * Supports adding, removing, and retrieving watchlist entries.
 */

import type { WatchlistEntry, WatchlistResponse } from '../types';
import { SYMBOL_REGEX, MAX_WATCHLIST_SIZE } from '../types';
import { getApiUrl } from './config';
import { healthService } from './health';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 15000;

/**
 * Watchlist Service errors
 */
export class WatchlistError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly symbol?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WatchlistError';
  }
}

/**
 * Check if backend is available before making requests
 */
async function ensureBackendAvailable(): Promise<void> {
  const health = healthService.getHealth();
  if (!health?.api?.reachable) {
    throw new WatchlistError(
      'Backend is not available. Please ensure the server is running.',
      'BACKEND_UNAVAILABLE'
    );
  }
}

/**
 * Validate a symbol
 */
function validateSymbol(symbol: string): void {
  const upperSymbol = symbol.toUpperCase();
  if (!SYMBOL_REGEX.test(upperSymbol)) {
    throw new WatchlistError(
      `Invalid symbol: "${symbol}". Symbol must be 1-5 uppercase letters.`,
      'INVALID_SYMBOL',
      undefined,
      symbol
    );
  }
}

/**
 * Watchlist Service
 *
 * Provides methods for managing the user's stock watchlist.
 * Uses the health service to verify backend availability before making requests.
 */
class WatchlistService {
  private cachedWatchlist: WatchlistResponse | null = null;
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 60000; // 1 minute cache

  /**
   * Get the current watchlist
   */
  async getWatchlist(forceRefresh: boolean = false): Promise<WatchlistResponse> {
    await ensureBackendAvailable();

    // Return cached data if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && this.cachedWatchlist && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.cachedWatchlist;
    }

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/watchlist`;

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
        throw new WatchlistError(
          'Failed to fetch watchlist',
          'WATCHLIST_REQUEST_FAILED',
          response.status
        );
      }

      const data: WatchlistResponse = await response.json();

      // Update cache
      this.cachedWatchlist = data;
      this.cacheTimestamp = now;

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof WatchlistError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new WatchlistError(
            'Request timed out while fetching watchlist',
            'REQUEST_TIMEOUT'
          );
        }
        throw new WatchlistError(
          `Failed to fetch watchlist: ${error.message}`,
          'NETWORK_ERROR'
        );
      }

      throw new WatchlistError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Add a symbol to the watchlist
   */
  async addSymbol(symbol: string, group?: string): Promise<WatchlistEntry> {
    await ensureBackendAvailable();

    // Validate symbol
    const upperSymbol = symbol.toUpperCase();
    validateSymbol(upperSymbol);

    // Check current watchlist size
    const currentWatchlist = await this.getWatchlist();
    if (currentWatchlist.count >= MAX_WATCHLIST_SIZE) {
      throw new WatchlistError(
        `Watchlist is full (max ${MAX_WATCHLIST_SIZE} symbols). Please remove a symbol first.`,
        'WATCHLIST_FULL',
        undefined,
        upperSymbol
      );
    }

    // Check if symbol is already in watchlist
    if (currentWatchlist.tickers.some(t => t.symbol === upperSymbol)) {
      throw new WatchlistError(
        `Symbol "${upperSymbol}" is already in the watchlist`,
        'SYMBOL_ALREADY_EXISTS',
        undefined,
        upperSymbol
      );
    }

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/watchlist`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: upperSymbol, group }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new WatchlistError(
            `Symbol "${upperSymbol}" not found`,
            'SYMBOL_NOT_FOUND',
            404,
            upperSymbol
          );
        }
        if (response.status === 409) {
          throw new WatchlistError(
            `Symbol "${upperSymbol}" is already in the watchlist`,
            'SYMBOL_ALREADY_EXISTS',
            409,
            upperSymbol
          );
        }
        throw new WatchlistError(
          `Failed to add ${upperSymbol} to watchlist`,
          'ADD_SYMBOL_FAILED',
          response.status,
          upperSymbol
        );
      }

      const entry: WatchlistEntry = await response.json();

      // Invalidate cache
      this.invalidateCache();

      return entry;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof WatchlistError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new WatchlistError(
            `Request timed out while adding ${upperSymbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            upperSymbol
          );
        }
        throw new WatchlistError(
          `Failed to add symbol: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          upperSymbol
        );
      }

      throw new WatchlistError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Remove a symbol from the watchlist
   */
  async removeSymbol(symbol: string): Promise<void> {
    await ensureBackendAvailable();

    // Validate symbol
    const upperSymbol = symbol.toUpperCase();
    validateSymbol(upperSymbol);

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/watchlist/${encodeURIComponent(upperSymbol)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new WatchlistError(
            `Symbol "${upperSymbol}" is not in the watchlist`,
            'SYMBOL_NOT_IN_WATCHLIST',
            404,
            upperSymbol
          );
        }
        throw new WatchlistError(
          `Failed to remove ${upperSymbol} from watchlist`,
          'REMOVE_SYMBOL_FAILED',
          response.status,
          upperSymbol
        );
      }

      // Invalidate cache
      this.invalidateCache();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof WatchlistError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new WatchlistError(
            `Request timed out while removing ${upperSymbol}`,
            'REQUEST_TIMEOUT',
            undefined,
            upperSymbol
          );
        }
        throw new WatchlistError(
          `Failed to remove symbol: ${error.message}`,
          'NETWORK_ERROR',
          undefined,
          upperSymbol
        );
      }

      throw new WatchlistError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Check if a symbol is in the watchlist
   */
  async hasSymbol(symbol: string): Promise<boolean> {
    const upperSymbol = symbol.toUpperCase();
    const watchlist = await this.getWatchlist();
    return watchlist.tickers.some(t => t.symbol === upperSymbol);
  }

  /**
   * Get watchlist entries by group
   */
  async getWatchlistByGroup(group: string): Promise<WatchlistEntry[]> {
    const watchlist = await this.getWatchlist();
    return watchlist.tickers.filter(t => t.group === group);
  }

  /**
   * Get available groups
   */
  async getGroups(): Promise<string[]> {
    const watchlist = await this.getWatchlist();
    return watchlist.groups;
  }

  /**
   * Invalidate the cached watchlist
   */
  invalidateCache(): void {
    this.cachedWatchlist = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Clear all watchlist data (for logout/reset)
   */
  clearCache(): void {
    this.cachedWatchlist = null;
    this.cacheTimestamp = 0;
  }
}

// Export singleton instance
export const watchlistService = new WatchlistService();

// Export convenience functions
export const getWatchlist = (forceRefresh?: boolean) =>
  watchlistService.getWatchlist(forceRefresh);
export const addToWatchlist = (symbol: string, group?: string) =>
  watchlistService.addSymbol(symbol, group);
export const removeFromWatchlist = (symbol: string) =>
  watchlistService.removeSymbol(symbol);
export const hasInWatchlist = (symbol: string) =>
  watchlistService.hasSymbol(symbol);
export const getWatchlistByGroup = (group: string) =>
  watchlistService.getWatchlistByGroup(group);
export const getWatchlistGroups = () => watchlistService.getGroups();
export const invalidateWatchlistCache = () => watchlistService.invalidateCache();

// Export error class for type checking
export { WatchlistError };