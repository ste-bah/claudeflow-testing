/**
 * Configuration Service
 *
 * Provides typed configuration management for the Market Terminal frontend.
 * Uses environment variables and provides validation and defaults.
 */

import type {
  AppEnvConfig,
  ServerConfig,
  CacheConfig,
  CircuitBreakerConfig,
} from '../types';
import { DEFAULT_CONFIG, createConfigFromEnv } from '../types';
/**
 * Configuration service singleton
 */
class ConfigService {
  private config: AppEnvConfig | null = null;
  private initialized = false;

  /**
   * Initialize configuration from environment variables
   */
  initialize(): AppEnvConfig {
    if (this.initialized) {
      return this.config!;
    }

    this.config = createConfigFromEnv() as AppEnvConfig;
    this.initialized = true;
    this.validate();
    return this.config;
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppEnvConfig {
    if (!this.initialized) {
      return this.initialize();
    }
    return this.config!;
  }

  /**
   * Validate configuration values
   */
  private validate(): void {
    if (!this.config) return;

    // Validate server configuration
    const { server } = this.config;
    if (server.port < 1 || server.port > 65535) {
      console.warn(`Invalid port: ${server.port}, using default`);
      server.port = DEFAULT_CONFIG.server!.port!;
    }

    if (server.frontendPort < 1 || server.frontendPort > 65535) {
      console.warn(`Invalid frontend port: ${server.frontendPort}, using default`);
      server.frontendPort = DEFAULT_CONFIG.server!.frontendPort!;
    }

    // Validate cache TTL values
    const { cache } = this.config;
    const minTTL = 0;
    const maxTTL = 86400 * 30; // 30 days max
    const validatedCache: CacheConfig = { ...cache };

    (Object.keys(cache) as Array<keyof CacheConfig>).forEach((key) => {
      const value = cache[key];
      if (value < minTTL || value > maxTTL) {
        console.warn(`Invalid cache TTL for ${key}: ${value}, using default`);
        validatedCache[key] = DEFAULT_CONFIG.cache![key]!;
      }
    });
    this.config.cache = validatedCache;

    // Validate circuit breaker configuration
    const { circuitBreaker } = this.config;
    if (circuitBreaker.failureThreshold < 1 || circuitBreaker.failureThreshold > 20) {
      console.warn(`Invalid failure threshold, using default`);
      circuitBreaker.failureThreshold = DEFAULT_CONFIG.circuitBreaker!.failureThreshold!;
    }

    if (circuitBreaker.windowSeconds < 10 || circuitBreaker.windowSeconds > 3600) {
      console.warn(`Invalid window seconds, using default`);
      circuitBreaker.windowSeconds = DEFAULT_CONFIG.circuitBreaker!.windowSeconds!;
    }

    if (circuitBreaker.cooldownSeconds < 10 || circuitBreaker.cooldownSeconds > 7200) {
      console.warn(`Invalid cooldown seconds, using default`);
      circuitBreaker.cooldownSeconds = DEFAULT_CONFIG.circuitBreaker!.cooldownSeconds!;
    }
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this.getConfig().server;
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig {
    return this.getConfig().cache;
  }

  /**
   * Get circuit breaker configuration
   */
  getCircuitBreakerConfig(): CircuitBreakerConfig {
    return this.getConfig().circuitBreaker;
  }

  /**
   * Get API URL for backend
   */
  getApiUrl(): string {
    const { server } = this.getConfig();
    return `http://${server.host}:${server.port}`;
  }

  /**
   * Get WebSocket URL
   */
  getWebSocketUrl(): string {
    const { server } = this.getConfig();
    return `ws://${server.host}:${server.port}`;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return import.meta.env.VITE_APP_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return import.meta.env.VITE_APP_ENV === 'production';
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return import.meta.env.VITE_DEBUG === true;
  }

  /**
   * Reset configuration (primarily for testing)
   */
  reset(): void {
    this.config = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const configService = new ConfigService();

// Export convenience functions
export const getConfig = () => configService.getConfig();
export const getServerConfig = () => configService.getServerConfig();
export const getCacheConfig = () => configService.getCacheConfig();
export const getCircuitBreakerConfig = () => configService.getCircuitBreakerConfig();
export const getApiUrl = () => configService.getApiUrl();
export const getWebSocketUrl = () => configService.getWebSocketUrl();
export const initializeConfig = () => configService.initialize();