/**
 * Tests for startup types.
 *
 * Validates:
 * - Type definitions and defaults
 * - StartupProgress phase mapping
 * - Service status types
 * - Health response types
 *
 * Run with: `npm test -- src/__tests__/types/startup.test.ts`
 */

import { describe, it, expect } from 'vitest';
import type {
  ServiceStatus,
  ServiceInfo,
  SystemHealth,
  DatabaseHealth,
  ApiHealth,
  StartupConfig,
  StartupProgress,
  StopProgress,
  BackendHealthResponse,
  PidFileInfo,
  ProcessInfo,
} from '../../types/startup';
import type { ServerConfig, DatabaseConfig, CacheConfig, CircuitBreakerConfig } from '../../types/env';

describe('Startup Types', () => {
  describe('ServiceStatus', () => {
    it('should allow valid status values', () => {
      const statuses: ServiceStatus[] = ['stopped', 'starting', 'running', 'error', 'stopping'];

      // All statuses should be assignable
      statuses.forEach((status) => {
        const service: ServiceInfo = {
          name: 'backend',
          status,
          lastCheck: new Date(),
        };
        expect(service.status).toBe(status);
      });
    });
  });

  describe('ServiceInfo', () => {
    it('should create a valid ServiceInfo object', () => {
      const service: ServiceInfo = {
        name: 'backend',
        status: 'running',
        port: 8000,
        pid: 12345,
        uptime: 3600,
        lastCheck: new Date('2024-01-01T00:00:00Z'),
      };

      expect(service.name).toBe('backend');
      expect(service.status).toBe('running');
      expect(service.port).toBe(8000);
      expect(service.pid).toBe(12345);
      expect(service.uptime).toBe(3600);
    });

    it('should allow optional fields to be undefined', () => {
      const service: ServiceInfo = {
        name: 'frontend',
        status: 'stopped',
        lastCheck: new Date(),
      };

      expect(service.port).toBeUndefined();
      expect(service.pid).toBeUndefined();
      expect(service.uptime).toBeUndefined();
      expect(service.error).toBeUndefined();
    });

    it('should allow error field when status is error', () => {
      const service: ServiceInfo = {
        name: 'backend',
        status: 'error',
        error: 'Connection refused',
        lastCheck: new Date(),
      };

      expect(service.status).toBe('error');
      expect(service.error).toBe('Connection refused');
    });
  });

  describe('SystemHealth', () => {
    it('should create a valid SystemHealth object', () => {
      const health: SystemHealth = {
        backend: {
          name: 'backend',
          status: 'running',
          port: 8000,
          lastCheck: new Date(),
        },
        frontend: {
          name: 'frontend',
          status: 'running',
          port: 3000,
          lastCheck: new Date(),
        },
        database: {
          connected: true,
          path: '/data/market_terminal.db',
          size: 1024000,
        },
        api: {
          reachable: true,
          latency: 50,
          endpoints: {
            ticker: true,
            news: true,
            fundamentals: true,
            analysis: true,
          },
        },
        timestamp: new Date(),
      };

      expect(health.backend.status).toBe('running');
      expect(health.database.connected).toBe(true);
      expect(health.api.reachable).toBe(true);
    });

    it('should reflect database disconnection', () => {
      const health: SystemHealth = {
        backend: {
          name: 'backend',
          status: 'error',
          error: 'Database unavailable',
          lastCheck: new Date(),
        },
        frontend: {
          name: 'frontend',
          status: 'running',
          lastCheck: new Date(),
        },
        database: {
          connected: false,
          lastError: 'Connection refused',
        },
        api: {
          reachable: false,
          lastError: 'Backend down',
          endpoints: {
            ticker: false,
            news: false,
            fundamentals: false,
            analysis: false,
          },
        },
        timestamp: new Date(),
      };

      expect(health.database.connected).toBe(false);
      expect(health.api.reachable).toBe(false);
    });
  });

  describe('StartupProgress', () => {
    it('should have all required phases', () => {
      const phases: StartupProgress['phase'][] = [
        'initializing',
        'checking-deps',
        'starting-backend',
        'starting-frontend',
        'health-check',
        'ready',
        'error',
      ];

      phases.forEach((phase) => {
        const progress: StartupProgress = {
          phase,
          message: 'Test message',
          progress: 50,
          errors: [],
        };
        expect(progress.phase).toBe(phase);
      });
    });

    it('should track errors array', () => {
      const progress: StartupProgress = {
        phase: 'error',
        message: 'Failed to start',
        progress: 0,
        errors: ['Port 8000 in use', 'Python not found'],
      };

      expect(progress.errors).toHaveLength(2);
      expect(progress.errors).toContain('Port 8000 in use');
    });

    it('should include service info when available', () => {
      const progress: StartupProgress = {
        phase: 'starting-backend',
        message: 'Starting backend...',
        progress: 30,
        errors: [],
        backend: {
          name: 'backend',
          status: 'starting',
          lastCheck: new Date(),
        },
      };

      expect(progress.backend).toBeDefined();
      expect(progress.backend?.status).toBe('starting');
    });
  });

  describe('StopProgress', () => {
    it('should have all required phases', () => {
      const phases: StopProgress['phase'][] = ['stopping', 'cleanup', 'complete'];

      phases.forEach((phase) => {
        const progress: StopProgress = {
          phase,
          message: 'Test message',
          progress: 50,
          errors: [],
        };
        expect(progress.phase).toBe(phase);
      });
    });
  });

  describe('BackendHealthResponse', () => {
    it('should create a healthy response', () => {
      const response: BackendHealthResponse = {
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600,
        services: {
          database: true,
          cache: true,
          sentiment: true,
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(response.status).toBe('healthy');
      expect(response.services.database).toBe(true);
    });

    it('should create a degraded response', () => {
      const response: BackendHealthResponse = {
        status: 'degraded',
        version: '1.0.0',
        uptime: 3600,
        services: {
          database: true,
          cache: false,
          sentiment: true,
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(response.status).toBe('degraded');
      expect(response.services.cache).toBe(false);
    });

    it('should create an unhealthy response', () => {
      const response: BackendHealthResponse = {
        status: 'unhealthy',
        version: '1.0.0',
        uptime: 0,
        services: {
          database: false,
          cache: false,
          sentiment: false,
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(response.status).toBe('unhealthy');
      expect(response.services.database).toBe(false);
    });
  });

  describe('PidFileInfo', () => {
    it('should represent an existing PID file', () => {
      const info: PidFileInfo = {
        pid: 12345,
        file: '.run/backend.pid',
        exists: true,
      };

      expect(info.exists).toBe(true);
      expect(info.pid).toBe(12345);
    });

    it('should represent a missing PID file', () => {
      const info: PidFileInfo = {
        pid: 0,
        file: '.run/backend.pid',
        exists: false,
      };

      expect(info.exists).toBe(false);
      expect(info.pid).toBe(0);
    });
  });

  describe('ProcessInfo', () => {
    it('should represent a running process', () => {
      const info: ProcessInfo = {
        pid: 12345,
        name: 'uvicorn',
        status: 'running',
        cpu: 5.2,
        memory: 128000,
        startTime: new Date('2024-01-01T00:00:00Z'),
      };

      expect(info.status).toBe('running');
      expect(info.cpu).toBe(5.2);
    });

    it('should represent a zombie process', () => {
      const info: ProcessInfo = {
        pid: 12345,
        name: 'uvicorn',
        status: 'zombie',
      };

      expect(info.status).toBe('zombie');
    });
  });

  describe('StartupProgress phases', () => {
    it('should have all required phases', () => {
      // This is tested in the earlier test but we verify the type exists
      const phases: StartupProgress['phase'][] = [
        'initializing',
        'checking-deps',
        'starting-backend',
        'starting-frontend',
        'health-check',
        'ready',
        'error',
      ];
      expect(phases).toHaveLength(7);
    });
  });

  describe('StartupConfig', () => {
    it('should create a valid development config', () => {
      const config: StartupConfig = {
        backend: {
          host: '0.0.0.0',
          port: 8000,
          serverConfig: {
            workers: 4,
            timeout: 30,
            reload: true,
          },
          databaseConfig: {
            path: './data/market_terminal.db',
            connectionTimeout: 5000,
          },
          cacheConfig: {
            enabled: true,
            ttl: 300,
          },
          circuitBreakerConfig: {
            enabled: true,
            failureThreshold: 5,
            resetTimeout: 30,
          },
          logLevel: 'debug',
        },
        frontend: {
          port: 3000,
          proxyTarget: 'http://localhost:8000',
          apiUrl: '/api',
          wsUrl: 'ws://localhost:8000/ws',
        },
        environment: 'development',
      };

      expect(config.environment).toBe('development');
      expect(config.backend.port).toBe(8000);
      expect(config.frontend.port).toBe(3000);
    });

    it('should create a valid production config', () => {
      const config: StartupConfig = {
        backend: {
          host: '0.0.0.0',
          port: 8000,
          serverConfig: {
            workers: 8,
            timeout: 60,
            reload: false,
          },
          databaseConfig: {
            path: '/var/data/market_terminal.db',
            connectionTimeout: 10000,
          },
          cacheConfig: {
            enabled: true,
            ttl: 600,
          },
          circuitBreakerConfig: {
            enabled: true,
            failureThreshold: 10,
            resetTimeout: 60,
          },
          logLevel: 'info',
        },
        frontend: {
          port: 3000,
          proxyTarget: 'http://localhost:8000',
          apiUrl: '/api',
          wsUrl: 'ws://localhost:8000/ws',
        },
        environment: 'production',
      };

      expect(config.environment).toBe('production');
      expect(config.backend.serverConfig.workers).toBe(8);
    });
  });
});