/**
 * Health Check Service
 *
 * Monitors backend health by polling the /api/health endpoint.
 * Provides system health status and service information.
 */

import type {
  BackendHealthResponse,
  SystemHealth,
  ServiceInfo,
  ServiceStatus,
  DatabaseHealth,
  ApiHealth,
} from '../types';
import { getApiUrl } from './config';

/**
 * Default health check interval in milliseconds
 */
const DEFAULT_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Health check timeout in milliseconds
 */
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

/**
 * Maximum consecutive failures before marking as unhealthy
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Health service state
 */
interface HealthServiceState {
  lastHealth: SystemHealth | null;
  consecutiveFailures: number;
  isPolling: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  listeners: Set<(health: SystemHealth) => void>;
}

/**
 * Health Check Service
 */
class HealthService {
  private state: HealthServiceState = {
    lastHealth: null,
    consecutiveFailures: 0,
    isPolling: false,
    intervalId: null,
    listeners: new Set(),
  };

  /**
   * Get current health status
   */
  getHealth(): SystemHealth | null {
    return this.state.lastHealth;
  }

  /**
   * Check if currently polling
   */
  isPolling(): boolean {
    return this.state.isPolling;
  }

  /**
   * Perform a single health check
   */
  async checkHealth(): Promise<SystemHealth> {
    const apiUrl = getApiUrl();
    const healthUrl = `${apiUrl}/health`;

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed: HTTP ${response.status}`);
      }

      const data: BackendHealthResponse = await response.json();
      const latency = Date.now() - startTime;

      // Reset failure count on success
      this.state.consecutiveFailures = 0;

      // Build system health from backend response
      const health = this.mapBackendHealth(data, latency);
      this.state.lastHealth = health;

      // Notify listeners
      this.notifyListeners(health);

      return health;
    } catch (error) {
      this.state.consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Build degraded health status
      const health = this.buildErrorHealth(errorMessage);
      this.state.lastHealth = health;

      // Notify listeners
      this.notifyListeners(health);

      throw error;
    }
  }

  /**
   * Map backend health response to system health
   */
  private mapBackendHealth(
    backend: BackendHealthResponse,
    latency: number
  ): SystemHealth {
    const now = new Date();

    // Determine overall status
    let overallStatus: ServiceStatus = 'running';
    if (backend.status === 'unhealthy') {
      overallStatus = 'error';
    } else if (backend.status === 'degraded') {
      overallStatus = 'starting';
    }

    // Map database health
    const database: DatabaseHealth = {
      connected: backend.services.database,
      path: undefined, // Not exposed in health endpoint
      size: undefined,
      lastError: undefined,
    };

    // Map API health
    const api: ApiHealth = {
      reachable: true,
      latency,
      endpoints: {
        ticker: true,
        news: true,
        fundamentals: true,
        analysis: true,
      },
      lastError: undefined,
    };

    return {
      backend: {
        name: 'backend',
        status: overallStatus,
        port: undefined, // Will be set from config
        pid: undefined,
        uptime: backend.uptime,
        lastCheck: now,
      },
      frontend: {
        name: 'frontend',
        status: 'running',
        lastCheck: now,
      },
      database,
      api,
      timestamp: now,
    };
  }

  /**
   * Build error health status
   */
  private buildErrorHealth(errorMessage: string): SystemHealth {
    const now = new Date();
    const isUnhealthy = this.state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

    return {
      backend: {
        name: 'backend',
        status: isUnhealthy ? 'error' : 'starting',
        error: errorMessage,
        lastCheck: now,
      },
      frontend: {
        name: 'frontend',
        status: 'running',
        lastCheck: now,
      },
      database: {
        connected: false,
        lastError: 'Unable to reach backend',
      },
      api: {
        reachable: false,
        endpoints: {
          ticker: false,
          news: false,
          fundamentals: false,
          analysis: false,
        },
        lastError: errorMessage,
      },
      timestamp: now,
    };
  }

  /**
   * Start periodic health checks
   */
  startPolling(intervalMs: number = DEFAULT_HEALTH_CHECK_INTERVAL): void {
    if (this.state.isPolling) {
      return;
    }

    this.state.isPolling = true;

    // Perform immediate check
    this.checkHealth().catch(() => {
      // Error already handled in checkHealth
    });

    // Schedule periodic checks
    this.state.intervalId = setInterval(() => {
      this.checkHealth().catch(() => {
        // Error already handled in checkHealth
      });
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopPolling(): void {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }
    this.state.isPolling = false;
  }

  /**
   * Subscribe to health updates
   */
  subscribe(callback: (health: SystemHealth) => void): () => void {
    this.state.listeners.add(callback);

    // Immediately call with current state if available
    if (this.state.lastHealth) {
      callback(this.state.lastHealth);
    }

    // Return unsubscribe function
    return () => {
      this.state.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of health update
   */
  private notifyListeners(health: SystemHealth): void {
    this.state.listeners.forEach((callback) => {
      try {
        callback(health);
      } catch (error) {
        console.error('Health listener error:', error);
      }
    });
  }

  /**
   * Get simplified status for UI
   */
  getStatusSummary(): { backend: ServiceStatus; database: boolean; api: boolean } {
    const health = this.state.lastHealth;
    if (!health) {
      return { backend: 'stopped', database: false, api: false };
    }

    return {
      backend: health.backend.status,
      database: health.database.connected,
      api: health.api.reachable,
    };
  }

  /**
   * Reset service state (for testing)
   */
  reset(): void {
    this.stopPolling();
    this.state.lastHealth = null;
    this.state.consecutiveFailures = 0;
    this.state.listeners.clear();
  }
}

// Export singleton instance
export const healthService = new HealthService();

// Export convenience functions
export const checkHealth = () => healthService.checkHealth();
export const startHealthPolling = (interval?: number) => healthService.startPolling(interval);
export const stopHealthPolling = () => healthService.stopPolling();
export const subscribeToHealth = (callback: (health: SystemHealth) => void) =>
  healthService.subscribe(callback);
export const getHealthStatus = () => healthService.getStatusSummary();