/**
 * Startup and process management types for the Market Terminal.
 * These types support the startup scripts (start.sh, start.bat, stop.sh)
 * and any frontend status display related to service health.
 */

import type { ServerConfig, DatabaseConfig, CacheConfig, CircuitBreakerConfig } from './env';

/**
 * Service status for individual backend/frontend services
 */
export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'error' | 'stopping';

/**
 * Service information returned from health checks
 */
export interface ServiceInfo {
  name: 'backend' | 'frontend';
  status: ServiceStatus;
  port?: number;
  pid?: number;
  uptime?: number;
  error?: string;
  lastCheck: Date;
}

/**
 * Overall system health status
 */
export interface SystemHealth {
  backend: ServiceInfo;
  frontend: ServiceInfo;
  database: DatabaseHealth;
  api: ApiHealth;
  timestamp: Date;
}

/**
 * Database connection health
 */
export interface DatabaseHealth {
  connected: boolean;
  path?: string;
  size?: number;
  lastError?: string;
}

/**
 * API endpoint health
 */
export interface ApiHealth {
  reachable: boolean;
  latency?: number;
  endpoints: {
    ticker: boolean;
    news: boolean;
    fundamentals: boolean;
    analysis: boolean;
  };
  lastError?: string;
}

/**
 * Startup configuration passed to services
 */
export interface StartupConfig {
  backend: BackendStartupConfig;
  frontend: FrontendStartupConfig;
  environment: 'development' | 'production' | 'test';
}

/**
 * Backend startup configuration
 */
export interface BackendStartupConfig {
  host: string;
  port: number;
  serverConfig: ServerConfig;
  databaseConfig: DatabaseConfig;
  cacheConfig: CacheConfig;
  circuitBreakerConfig: CircuitBreakerConfig;
  logLevel: string;
}

/**
 * Frontend startup configuration
 */
export interface FrontendStartupConfig {
  port: number;
  proxyTarget: string;
  apiUrl: string;
  wsUrl: string;
}

/**
 * Startup progress for UI display
 */
export interface StartupProgress {
  phase: 'initializing' | 'checking-deps' | 'starting-backend' | 'starting-frontend' | 'health-check' | 'ready' | 'error';
  message: string;
  progress: number; // 0-100
  errors: string[];
  backend?: ServiceInfo;
  frontend?: ServiceInfo;
}

/**
 * Stop progress for UI display
 */
export interface StopProgress {
  phase: 'stopping' | 'cleanup' | 'complete';
  message: string;
  progress: number;
  errors: string[];
}

/**
 * Health check response from backend
 */
export interface BackendHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    database: boolean;
    cache: boolean;
    sentiment: boolean;
  };
  timestamp: string;
}

/**
 * PID file info
 */
export interface PidFileInfo {
  pid: number;
  file: string;
  exists: boolean;
}

/**
 * Process info for display
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  status: 'running' | 'stopped' | 'zombie';
  cpu?: number;
  memory?: number;
  startTime?: Date;
}

/**
 * Default startup progress
 */
export const DEFAULT_STARTUP_PROGRESS: StartupProgress = {
  phase: 'initializing',
  message: 'Initializing...',
  progress: 0,
  errors: [],
};

/**
 * Phase progress mapping for startup
 */
export const STARTUP_PHASE_PROGRESS: Record<StartupProgress['phase'], number> = {
  initializing: 5,
  'checking-deps': 15,
  'starting-backend': 30,
  'starting-frontend': 55,
  'health-check': 80,
  ready: 100,
  error: 0,
};
