/**
 * Data Transformers Service
 *
 * Provides data transformation utilities that complement the type normalizers.
 * Handles API response transformation, data formatting, and type conversions
 * for frontend consumption.
 */

import type { Timeframe, OHLCVBar, TickerHistoryResponse, TickerPrice } from '../types/ticker';
import type { WatchlistEntry } from '../types/watchlist';
import type { NewsArticleRaw, NewsApiResponse, NewsArticle } from '../types/news';
import type { AnalysisApiResponse, AnalysisData } from '../types/analysis';
import type { FundamentalsApiResponse, FundamentalsData } from '../types/fundamentals';
import type { OwnershipApiResponse, InsiderApiResponse, OwnershipData, InsiderData } from '../types/ownership';
import type { MacroCalendarApiResponse, MacroReactionApiResponse, MacroCalendarData, MacroReactionData } from '../types/macro';
import type { ScanApiResponse } from '../types/command';

import { normalizeAnalysis } from '../types/analysis';
import { normalizeArticle, sortArticlesByDate, NEWS_PAGE_SIZE } from '../types/news';
import { normalizeFundamentals } from '../types/fundamentals';
import { normalizeOwnership, normalizeInsider } from '../types/ownership';
import { normalizeCalendar, normalizeReaction } from '../types/macro';

import { cacheService, CACHE_CONFIGS, cacheKeys } from './cache';
import { getLocalWatchlist, setLocalWatchlist } from './storage';

/**
 * Transform ticker history response to chart-friendly format
 */
export function transformTickerForChart(response: TickerHistoryResponse): {
  ohlcv: OHLCVBar[];
  price: TickerPrice;
  metadata: {
    symbol: string;
    name: string | null;
    isMarketOpen: boolean;
    dataAgeSeconds: number;
    cacheHit: boolean;
  };
} {
  return {
    ohlcv: response.ohlcv,
    price: response.price,
    metadata: {
      symbol: response.symbol,
      name: response.name,
      isMarketOpen: response.is_market_open,
      dataAgeSeconds: response.data_age_seconds,
      cacheHit: response.cache_hit,
    },
  };
}

/**
 * Get cached or fresh ticker data
 */
export async function getTickerWithCache<T>(
  symbol: string,
  fetchFn: () => Promise<T>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean }
): Promise<T> {
  const key = cacheKeys.ticker(symbol);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const data = await fetchFn();
  cacheService.set(key, data, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.TICKER.ttlSeconds });
  return data;
}

/**
 * Get cached or fresh analysis data
 */
export async function getAnalysisWithCache(
  symbol: string,
  fetchFn: () => Promise<AnalysisApiResponse>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean }
): Promise<AnalysisData> {
  const key = cacheKeys.analysis(symbol);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<AnalysisData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeAnalysis(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.ANALYSIS.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh news data
 */
export async function getNewsWithCache(
  symbol: string,
  fetchFn: () => Promise<NewsApiResponse>,
  options?: { page?: number; ttlSeconds?: number; forceRefresh?: boolean }
): Promise<{ articles: NewsArticle[]; totalCount: number }> {
  const key = cacheKeys.news(symbol, options?.page);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<{ articles: NewsArticle[]; totalCount: number }>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const articles = raw.articles
    .map(normalizeArticle)
    .filter((a): a is NewsArticle => a !== null);

  const result = {
    articles: sortArticlesByDate(articles),
    totalCount: raw.total_count,
  };

  cacheService.set(key, result, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.NEWS.ttlSeconds });
  return result;
}

/**
 * Get cached or fresh fundamentals data
 */
export async function getFundamentalsWithCache(
  symbol: string,
  fetchFn: () => Promise<FundamentalsApiResponse>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean }
): Promise<FundamentalsData | null> {
  const key = cacheKeys.fundamentals(symbol);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<FundamentalsData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeFundamentals(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.FUNDAMENTALS.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh ownership data
 */
export async function getOwnershipWithCache(
  symbol: string,
  fetchFn: () => Promise<OwnershipApiResponse>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean }
): Promise<OwnershipData | null> {
  const key = cacheKeys.ownership(symbol);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<OwnershipData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeOwnership(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.OWNERSHIP.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh insider data
 */
export async function getInsiderWithCache(
  symbol: string,
  fetchFn: () => Promise<InsiderApiResponse>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean }
): Promise<InsiderData | null> {
  const key = cacheKeys.insider(symbol);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<InsiderData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeInsider(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.INSIDER.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh macro calendar data
 */
export async function getMacroCalendarWithCache(
  fetchFn: () => Promise<MacroCalendarApiResponse>,
  options?: { fromDate?: string; toDate?: string; ttlSeconds?: number; forceRefresh?: boolean }
): Promise<MacroCalendarData> {
  const key = cacheKeys.macroCalendar(options?.fromDate, options?.toDate);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<MacroCalendarData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeCalendar(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.MACRO_CALENDAR.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh macro reaction data
 */
export async function getMacroReactionWithCache(
  symbol: string,
  eventType: string,
  fetchFn: () => Promise<MacroReactionApiResponse>,
  options?: { ttlSeconds?: number; forceRefresh?: boolean; periods?: number }
): Promise<MacroReactionData | null> {
  const key = cacheKeys.macroReaction(symbol, eventType);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<MacroReactionData>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const raw = await fetchFn();
  const normalized = normalizeReaction(raw);
  cacheService.set(key, normalized, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.MACRO_CALENDAR.ttlSeconds });
  return normalized;
}

/**
 * Get cached or fresh scan results
 */
export async function getScanWithCache(
  fetchFn: () => Promise<ScanApiResponse>,
  options?: { preset?: string; ttlSeconds?: number; forceRefresh?: boolean }
): Promise<ScanApiResponse> {
  const key = cacheKeys.scan(options?.preset);

  if (!options?.forceRefresh) {
    const cached = cacheService.get<ScanApiResponse>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const data = await fetchFn();
  cacheService.set(key, data, { ttlSeconds: options?.ttlSeconds ?? CACHE_CONFIGS.SCAN_RESULTS.ttlSeconds });
  return data;
}

/**
 * Get watchlist with local fallback
 */
export async function getWatchlistWithLocalFallback(
  fetchFn: () => Promise<{ tickers: WatchlistEntry[]; count: number; max_allowed: number; groups: string[] }>
): Promise<{ tickers: WatchlistEntry[]; count: number; max_allowed: number; groups: string[]; isOffline: boolean }> {
  try {
    const data = await fetchFn();
    // Sync to local storage for offline access
    setLocalWatchlist(data.tickers);
    return { ...data, isOffline: false };
  } catch {
    // Fallback to local storage
    const localWatchlist = getLocalWatchlist();
    if (localWatchlist.length > 0) {
      return {
        tickers: localWatchlist,
        count: localWatchlist.length,
        max_allowed: 50,
        groups: [...new Set(localWatchlist.map(t => t.group).filter(Boolean))],
        isOffline: true,
      };
    }
    throw new Error('Watchlist unavailable and no local data');
  }
}

/**
 * Format price with proper decimal places
 */
export function formatPrice(price: number | null, currency: string = 'USD'): string {
  if (price === null || price === undefined) {
    return '-';
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(price);
}

/**
 * Format change percentage with sign and color class
 */
export function formatChangePercent(change: number | null): { text: string; isPositive: boolean } {
  if (change === null || change === undefined) {
    return { text: '-', isPositive: false };
  }

  const isPositive = change >= 0;
  const sign = isPositive ? '+' : '';
  return {
    text: `${sign}${change.toFixed(2)}%`,
    isPositive,
  };
}

/**
 * Format volume with appropriate suffixes
 */
export function formatVolume(volume: number | null): string {
  if (volume === null || volume === undefined) {
    return '-';
  }

  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`;
  }
  return volume.toString();
}

/**
 * Format market cap with appropriate suffixes
 */
export function formatMarketCap(marketCap: number | null): string {
  if (marketCap === null || marketCap === undefined) {
    return '-';
  }

  if (marketCap >= 1_000_000_000_000) {
    return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}M`;
  }
  return `$${marketCap.toLocaleString()}`;
}

/**
 * Transform OHLCV data to format expected by charting library
 */
export function transformOHLCVForChart(ohlcv: OHLCVBar[]): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  return ohlcv.map(bar => ({
    time: new Date(bar.date).getTime() / 1000, // Unix timestamp
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

/**
 * Calculate price change from OHLCV data
 */
export function calculatePriceChange(ohlcv: OHLCVBar[]): { amount: number; percent: number } | null {
  if (ohlcv.length < 2) return null;

  const first = ohlcv[0];
  const last = ohlcv[ohlcv.length - 1];

  const amount = last.close - first.open;
  const percent = (amount / first.open) * 100;

  return { amount, percent };
}

/**
 * Detect timeframe from URL or default
 */
export function getTimeframeFromUrl(searchParams: URLSearchParams): Timeframe {
  const timeframe = searchParams.get('timeframe');
  if (timeframe && ['1d', '1w', '1m', '3m', '6m', '1y', '5y'].includes(timeframe)) {
    return timeframe as Timeframe;
  }
  return '3m';
}

/**
 * Batch transform multiple symbols' data
 */
export async function batchTransform<T>(
  symbols: string[],
  fetchFn: (symbol: string) => Promise<T>,
  transformFn: (data: T) => unknown
): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const data = await fetchFn(symbol);
        results.set(symbol, transformFn(data));
      } catch (error) {
        console.warn(`Failed to fetch/transform data for ${symbol}:`, error);
        results.set(symbol, null);
      }
    })
  );

  return results;
}

/**
 * Invalidate all caches related to a symbol
 */
export function invalidateSymbolCache(symbol: string): void {
  const upperSymbol = symbol.toUpperCase();

  // Delete individual caches
  cacheService.delete(cacheKeys.ticker(upperSymbol));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '1d'));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '1w'));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '1m'));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '3m'));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '6m'));
  cacheService.delete(cacheKeys.tickerHistory(upperSymbol, '1y'));
  cacheService.delete(cacheKeys.fundamentals(upperSymbol));
  cacheService.delete(cacheKeys.news(upperSymbol));
  cacheService.delete(cacheKeys.news(upperSymbol, 1));
  cacheService.delete(cacheKeys.ownership(upperSymbol));
  cacheService.delete(cacheKeys.insider(upperSymbol));
  cacheService.delete(cacheKeys.analysis(upperSymbol));
  cacheService.delete(cacheKeys.watchlistItem(upperSymbol));
}

/**
 * Invalidate all caches
 */
export function invalidateAllCaches(): void {
  cacheService.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStatistics() {
  return cacheService.getStats();
}
