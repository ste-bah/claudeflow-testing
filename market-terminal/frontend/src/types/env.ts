/**
 * Environment variable types for the Market Terminal application.
 * These types correspond to the configuration in .env.example
 */

export interface ServerConfig {
  host: string;
  port: number;
  frontendPort: number;
}

export interface DatabaseConfig {
  path: string;
}

export interface CacheConfig {
  price: number;
  fundamentals: number;
  news: number;
  macro: number;
  cot: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
}

export interface FinBertConfig {
  useLightweight: boolean;
}

export interface LogConfig {
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
}

/**
 * All environment variables expected by the Market Terminal
 */
export interface AppEnvConfig {
  /** API Keys */
  finnhubApiKey: string;
  fredApiKey: string;
  alphaVantageApiKey: string;

  /** SEC EDGAR Configuration */
  secEdgarUserAgent: string;

  /** Server Configuration */
  server: ServerConfig;

  /** Database Configuration */
  database: DatabaseConfig;

  /** Cache TTL in seconds */
  cache: CacheConfig;

  /** Circuit Breaker Configuration */
  circuitBreaker: CircuitBreakerConfig;

  /** FinBERT Configuration */
  finbert: FinBertConfig;

  /** Logging Configuration */
  logging: LogConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<AppEnvConfig> = {
  server: {
    host: '0.0.0.0',
    port: 8000,
    frontendPort: 3000,
  },
  database: {
    path: 'data/market_terminal.db',
  },
  cache: {
    price: 900,
    fundamentals: 86400,
    news: 3600,
    macro: 43200,
    cot: 604800,
  },
  circuitBreaker: {
    failureThreshold: 3,
    windowSeconds: 300,
    cooldownSeconds: 900,
  },
  finbert: {
    useLightweight: false,
  },
  logging: {
    level: 'INFO',
  },
};

/**
 * Parse integer environment variable
 */
export function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean environment variable
 */
export function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Create configuration object from environment variables
 * This is typically called at application startup
 */
export function createConfigFromEnv(): AppEnvConfig {
  return {
    finnhubApiKey: import.meta.env.VITE_FINNHUB_API_KEY ?? '',
    fredApiKey: import.meta.env.VITE_FRED_API_KEY ?? '',
    alphaVantageApiKey: import.meta.env.VITE_ALPHA_VANTAGE_API_KEY ?? '',
    secEdgarUserAgent: import.meta.env.VITE_SEC_EDGAR_USER_AGENT ?? 'MarketTerminal user@example.com',
    server: {
      host: import.meta.env.VITE_BACKEND_HOST ?? DEFAULT_CONFIG.server!.host!,
      port: parseIntEnv(import.meta.env.VITE_BACKEND_PORT, DEFAULT_CONFIG.server!.port!),
      frontendPort: parseIntEnv(import.meta.env.VITE_FRONTEND_PORT, DEFAULT_CONFIG.server!.frontendPort!),
    },
    database: {
      path: import.meta.env.VITE_DATABASE_PATH ?? DEFAULT_CONFIG.database!.path!,
    },
    cache: {
      price: parseIntEnv(import.meta.env.VITE_CACHE_TTL_PRICE, DEFAULT_CONFIG.cache!.price!),
      fundamentals: parseIntEnv(import.meta.env.VITE_CACHE_TTL_FUNDAMENTALS, DEFAULT_CONFIG.cache!.fundamentals!),
      news: parseIntEnv(import.meta.env.VITE_CACHE_TTL_NEWS, DEFAULT_CONFIG.cache!.news!),
      macro: parseIntEnv(import.meta.env.VITE_CACHE_TTL_MACRO, DEFAULT_CONFIG.cache!.macro!),
      cot: parseIntEnv(import.meta.env.VITE_CACHE_TTL_COT, DEFAULT_CONFIG.cache!.cot!),
    },
    circuitBreaker: {
      failureThreshold: parseIntEnv(import.meta.env.VITE_CIRCUIT_BREAKER_FAILURE_THRESHOLD, DEFAULT_CONFIG.circuitBreaker!.failureThreshold!),
      windowSeconds: parseIntEnv(import.meta.env.VITE_CIRCUIT_BREAKER_WINDOW_SECONDS, DEFAULT_CONFIG.circuitBreaker!.windowSeconds!),
      cooldownSeconds: parseIntEnv(import.meta.env.VITE_CIRCUIT_BREAKER_COOLDOWN_SECONDS, DEFAULT_CONFIG.circuitBreaker!.cooldownSeconds!),
    },
    finbert: {
      useLightweight: parseBoolEnv(import.meta.env.VITE_SENTIMENT_USE_LIGHTWEIGHT, DEFAULT_CONFIG.finbert!.useLightweight!),
    },
    logging: {
      level: (import.meta.env.VITE_LOG_LEVEL as LogConfig['level']) ?? DEFAULT_CONFIG.logging!.level!,
    },
  };
}
