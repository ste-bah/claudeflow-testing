/**
 * Storage Service
 *
 * Provides localStorage persistence for watchlist, user preferences,
 * and offline data management.
 */

import type { WatchlistEntry } from '../types';

/**
 * Storage keys for localStorage
 */
export const STORAGE_KEYS = {
  WATCHLIST: 'market_terminal_watchlist',
  WATCHLIST_SYNCED_AT: 'market_terminal_watchlist_synced_at',
  USER_PREFERENCES: 'market_terminal_preferences',
  LAST_SYMBOL: 'market_terminal_last_symbol',
  COMMAND_HISTORY: 'market_terminal_command_history',
  THEME: 'market_terminal_theme',
  LAYOUT_CONFIG: 'market_terminal_layout',
  ANALYSES_CACHE: 'market_terminal_analyses',
} as const;

/**
 * User preferences stored in localStorage
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultTimeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
  defaultChartType: 'candlestick' | 'line' | 'area';
  showNewsOnChart: boolean;
  autoRefreshInterval: number; // seconds, 0 = disabled
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  layoutConfig?: Record<string, unknown>;
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  defaultTimeframe: '1M',
  defaultChartType: 'candlestick',
  showNewsOnChart: true,
  autoRefreshInterval: 0,
  soundEnabled: false,
  notificationsEnabled: true,
};

/**
 * Storage service errors
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generic storage operations with error handling
 */
function safeGetItem<T>(key: string, defaultValue: T): T {
  if (!isStorageAvailable()) {
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Storage: Failed to read "${key}"`, error);
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Storage: Failed to write "${key}"`, error);
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Storage: Failed to remove "${key}"`, error);
    return false;
  }
}

/**
 * Watchlist local storage operations
 */
export function getLocalWatchlist(): WatchlistEntry[] {
  return safeGetItem<WatchlistEntry[]>(STORAGE_KEYS.WATCHLIST, []);
}

export function setLocalWatchlist(watchlist: WatchlistEntry[]): boolean {
  const success = safeSetItem(STORAGE_KEYS.WATCHLIST, watchlist);
  if (success) {
    safeSetItem(STORAGE_KEYS.WATCHLIST_SYNCED_AT, Date.now());
  }
  return success;
}

export function getLocalWatchlistSyncedAt(): number | null {
  return safeGetItem<number | null>(STORAGE_KEYS.WATCHLIST_SYNCED_AT, null);
}

export function clearLocalWatchlist(): boolean {
  return safeRemoveItem(STORAGE_KEYS.WATCHLIST) &&
    safeRemoveItem(STORAGE_KEYS.WATCHLIST_SYNCED_AT);
}

/**
 * User preferences operations
 */
export function getUserPreferences(): UserPreferences {
  return safeGetItem<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES, DEFAULT_PREFERENCES);
}

export function setUserPreferences(prefs: Partial<UserPreferences>): boolean {
  const current = getUserPreferences();
  const updated = { ...current, ...prefs };
  return safeSetItem(STORAGE_KEYS.USER_PREFERENCES, updated);
}

export function resetUserPreferences(): boolean {
  return safeSetItem(STORAGE_KEYS.USER_PREFERENCES, DEFAULT_PREFERENCES);
}

export function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): boolean {
  return setUserPreferences({ [key]: value });
}

/**
 * Last viewed symbol persistence
 */
export function getLastSymbol(): string | null {
  return safeGetItem<string | null>(STORAGE_KEYS.LAST_SYMBOL, null);
}

export function setLastSymbol(symbol: string): boolean {
  return safeSetItem(STORAGE_KEYS.LAST_SYMBOL, symbol);
}

/**
 * Command history operations
 */
export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  type: 'symbol' | 'scan' | 'macro' | 'query';
}

export function getCommandHistory(): CommandHistoryEntry[] {
  return safeGetItem<CommandHistoryEntry[]>(STORAGE_KEYS.COMMAND_HISTORY, []);
}

export function addCommandToHistory(
  command: string,
  type: CommandHistoryEntry['type']
): boolean {
  const history = getCommandHistory();
  const entry: CommandHistoryEntry = {
    command,
    timestamp: Date.now(),
    type,
  };

  // Add to front, keep max 100 entries
  const updated = [entry, ...history].slice(0, 100);
  return safeSetItem(STORAGE_KEYS.COMMAND_HISTORY, updated);
}

export function clearCommandHistory(): boolean {
  return safeRemoveItem(STORAGE_KEYS.COMMAND_HISTORY);
}

/**
 * Theme operations
 */
export function getTheme(): UserPreferences['theme'] {
  return safeGetItem<UserPreferences['theme']>(STORAGE_KEYS.THEME, 'system');
}

export function setTheme(theme: UserPreferences['theme']): boolean {
  return safeSetItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Layout configuration operations
 */
export function getLayoutConfig(): Record<string, unknown> | null {
  return safeGetItem<Record<string, unknown> | null>(STORAGE_KEYS.LAYOUT_CONFIG, null);
}

export function setLayoutConfig(config: Record<string, unknown>): boolean {
  return safeSetItem(STORAGE_KEYS.LAYOUT_CONFIG, config);
}

/**
 * Analysis cache operations (for offline viewing)
 */
export interface CachedAnalysis {
  symbol: string;
  data: unknown;
  cachedAt: number;
  expiresAt: number;
}

export function getCachedAnalysis(symbol: string): CachedAnalysis | null {
  const cache = safeGetItem<Record<string, CachedAnalysis>>(
    STORAGE_KEYS.ANALYSES_CACHE,
    {}
  );
  const entry = cache[symbol.toUpperCase()];

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    // Clean up expired entry
    delete cache[symbol.toUpperCase()];
    safeSetItem(STORAGE_KEYS.ANALYSES_CACHE, cache);
    return null;
  }

  return entry;
}

export function setCachedAnalysis(
  symbol: string,
  data: unknown,
  ttlMinutes: number = 30
): boolean {
  const cache = safeGetItem<Record<string, CachedAnalysis>>(
    STORAGE_KEYS.ANALYSES_CACHE,
    {}
  );

  const now = Date.now();
  cache[symbol.toUpperCase()] = {
    symbol: symbol.toUpperCase(),
    data,
    cachedAt: now,
    expiresAt: now + ttlMinutes * 60 * 1000,
  };

  return safeSetItem(STORAGE_KEYS.ANALYSES_CACHE, cache);
}

export function clearAnalysisCache(): boolean {
  return safeRemoveItem(STORAGE_KEYS.ANALYSES_CACHE);
}

export function getAllCachedSymbols(): string[] {
  const cache = safeGetItem<Record<string, CachedAnalysis>>(
    STORAGE_KEYS.ANALYSES_CACHE,
    {}
  );
  return Object.keys(cache);
}

/**
 * Clear all market terminal storage
 */
export function clearAllStorage(): boolean {
  const keys = Object.values(STORAGE_KEYS);
  let success = true;

  for (const key of keys) {
    if (!safeRemoveItem(key)) {
      success = false;
    }
  }

  return success;
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { used: number; keys: number } {
  if (!isStorageAvailable()) {
    return { used: 0, keys: 0 };
  }

  let totalSize = 0;
  let keyCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('market_terminal_')) {
      keyCount++;
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    }
  }

  return { used: totalSize, keys: keyCount };
}