/**
 * Cache Service
 *
 * Provides in-memory caching with TTL, offline fallback,
 * and cache invalidation strategies.
 */

import type { WatchlistEntry } from '../types';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  etag?: string;
  lastModified?: string;
}

/**
 * Cache configuration
 */
export interface CacheOptions {
  ttlSeconds: number;
  staleWhileRevalidate?: boolean;
  staleTTLSeconds?: number;
}

/**
 * Default cache options by data type
 */
export const CACHE_CONFIGS = {
  // Never expire (until explicitly invalidated)
  WATCHLIST: { ttlSeconds: 60 },
  TICKER: { ttlSeconds: 30 },
  FUNDAMENTALS: { ttlSeconds: 3600 },
  NEWS: { ttlSeconds: 300 },
  OWNERSHIP: { ttlSeconds: 3600 },
  INSIDER: { ttlSeconds: 1800 },
  ANALYSIS: { ttlSeconds: 1800 },
  MACRO_CALENDAR: { ttlSeconds: 3600 },
  SCAN_RESULTS: { ttlSeconds: 120 },
} as const;

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Generic cache service with TTL support
 */
class CacheService {
  private caches = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };

  /**
   * Get a value from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.caches.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();

    // Check if expired
    if (now > entry.expiresAt) {
      this.caches.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.data as T;
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, data: T, options?: Partial<CacheOptions>): void {
    const ttl = options?.ttlSeconds ?? 300; // Default 5 minutes
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttl * 1000,
    };

    this.caches.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.caches.get(key);
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.caches.delete(key);
  }

  /**
   * Clear all cache entries matching a prefix
   */
  clearPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.caches.keys()) {
      if (key.startsWith(prefix)) {
        this.caches.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.caches.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats, size: this.caches.size };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };
  }

  /**
   * Get all keys matching a prefix
   */
  keys(prefix?: string): string[] {
    if (!prefix) {
      return Array.from(this.caches.keys());
    }
    return Array.from(this.caches.keys()).filter((k) => k.startsWith(prefix));
  }

  /**
   * Get cache entry metadata
   */
  getMetadata(key: string): { cachedAt: number; expiresAt: number } | null {
    const entry = this.caches.get(key);
    if (!entry) return null;
    return {
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
    };
  }

  /**
   * Perform cleanup of expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.caches.entries()) {
      if (now > entry.expiresAt) {
        this.caches.delete(key);
        cleaned++;
        this.stats.evictions++;
      }
    }

    return cleaned;
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Export singleton instance
 */
export const cacheService = new CacheService();

/**
 * Convenience functions for common cache operations
 */
export const cacheGet = <T>(key: string) => cacheService.get<T>(key);
export const cacheSet = <T>(key: string, data: T, ttlSeconds?: number) =>
  cacheService.set(key, data, { ttlSeconds });
export const cacheHas = (key: string) => cacheService.has(key);
export const cacheDelete = (key: string) => cacheService.delete(key);
export const cacheClear = () => cacheService.clear();
export const cacheClearPrefix = (prefix: string) => cacheService.clearPrefix(prefix);
export const cacheStats = () => cacheService.getStats();

/**
 * Build cache key for different data types
 */
export const cacheKeys = {
  ticker: (symbol: string) => `ticker:${symbol.toUpperCase()}`,
  tickerHistory: (symbol: string, period: string) =>
    `ticker:${symbol.toUpperCase()}:history:${period}`,
  fundamentals: (symbol: string) => `fundamentals:${symbol.toUpperCase()}`,
  news: (symbol: string, page?: number) =>
    `news:${symbol.toUpperCase()}${page ? `:${page}` : ''}`,
  ownership: (symbol: string) => `ownership:${symbol.toUpperCase()}`,
  insider: (symbol: string) => `insider:${symbol.toUpperCase()}`,
  analysis: (symbol: string) => `analysis:${symbol.toUpperCase()}`,
  macroCalendar: (from?: string, to?: string) =>
    `macro:calendar:${from ?? 'default'}:${to ?? 'default'}`,
  macroReaction: (symbol: string, eventType: string) =>
    `macro:reaction:${symbol.toUpperCase()}:${eventType}`,
  watchlist: () => 'watchlist:all',
  scan: (preset?: string) => `scan:${preset ?? 'default'}`,
  watchlistItem: (symbol: string) => `watchlist:item:${symbol.toUpperCase()}`,
} as const;

/**
 * Cache with offline fallback support
 */
export async function getWithOfflineFallback<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    ttlSeconds?: number;
    offlineFallback?: () => T | null;
    offlineTTLSeconds?: number;
  }
): Promise<T> {
  // Try cache first
  const cached = cacheService.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  try {
    // Fetch fresh data
    const data = await fetchFn();
    cacheService.set(key, data, { ttlSeconds: options?.ttlSeconds ?? 300 });
    return data;
  } catch (error) {
    // Try offline fallback if available
    const fallback = options?.offlineFallback?.();
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Invalidate related cache entries when data changes
 */
export function invalidateRelatedCache(symbol: string): void {
  const upperSymbol = symbol.toUpperCase();

  // Clear all cache entries for this symbol
  const patterns = [
    `ticker:${upperSymbol}`,
    `fundamentals:${upperSymbol}`,
    `news:${upperSymbol}`,
    `ownership:${upperSymbol}`,
    `insider:${upperSymbol}`,
    `analysis:${upperSymbol}`,
    `watchlist:item:${upperSymbol}`,
  ];

  for (const pattern of patterns) {
    cacheService.delete(pattern);
  }

  // Clear watchlist if symbol was in it
  cacheService.delete('watchlist:all');
}

/**
 * Preload data into cache
 */
export function preloadCache<T>(entries: Array<{ key: string; data: T; ttlSeconds?: number }>): void {
  for (const entry of entries) {
    cacheService.set(entry.key, entry.data, { ttlSeconds: entry.ttlSeconds });
  }
}

/**
 * Create a cached function that auto-invalidates on write
 */
export function createCachedFunction<TArgs extends unknown[], TResult>(
  fetchFn: (...args: TArgs) => Promise<TResult>,
  getKey: (...args: TArgs) => string,
  options?: { ttlSeconds?: number }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = getKey(...args);
    const cached = cacheService.get<TResult>(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fetchFn(...args);
    cacheService.set(key, result, { ttlSeconds: options?.ttlSeconds });
    return result;
  };
}