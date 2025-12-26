/**
 * Daemon Server - Unix socket IPC server
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001
 *
 * @module src/god-agent/core/daemon/daemon-server
 */

import { createServer, Server, Socket } from 'net';
import { existsSync, unlinkSync } from 'fs';
import { EventEmitter } from 'events';
import type {
  DaemonConfig,
  ClientConnection,
  DaemonStats,
  RegisteredService,
  ServiceHandler,
  DaemonState,
  DaemonEvent,
} from './daemon-types.js';
import {
  DEFAULT_DAEMON_CONFIG,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  ClientRejectionReason,
  DaemonErrorCode,
  createDaemonError,
  generateClientId,
} from './daemon-types.js';

/**
 * Daemon Server manages Unix socket connections for IPC
 */
export class DaemonServer extends EventEmitter {
  private readonly config: DaemonConfig;
  private server: Server | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private services: Map<string, RegisteredService> = new Map();
  private state: DaemonState = 'stopped';
  private startedAt: number = 0;
  private totalRequests: number = 0;
  private keepAliveTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new daemon server
   *
   * @param socketPath - Path to Unix socket file (default: /tmp/godagent-db.sock)
   * @param options - Optional configuration overrides
   */
  constructor(
    socketPath: string = DEFAULT_DAEMON_CONFIG.socketPath,
    options?: Partial<Omit<DaemonConfig, 'socketPath'>>
  ) {
    super();
    this.config = {
      ...DEFAULT_DAEMON_CONFIG,
      ...options,
      socketPath,
    };
  }

  /**
   * Start the daemon server
   *
   * @throws DaemonError if server cannot start
   */
  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw createDaemonError(
        DaemonErrorCode.UNKNOWN,
        `Cannot start server in ${this.state} state`
      );
    }

    this.state = 'starting';

    // Clean up existing socket file if present
    if (existsSync(this.config.socketPath)) {
      try {
        unlinkSync(this.config.socketPath);
      } catch (error) {
        this.state = 'stopped';
        throw createDaemonError(
          DaemonErrorCode.PERMISSION_DENIED,
          `Cannot remove existing socket file: ${this.config.socketPath}`,
          { originalError: error }
        );
      }
    }

    return new Promise<void>((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        this.state = 'stopped';
        if (error.code === 'EADDRINUSE') {
          reject(
            createDaemonError(
              DaemonErrorCode.SOCKET_EXISTS,
              `Socket already in use: ${this.config.socketPath}`
            )
          );
        } else if (error.code === 'EACCES') {
          reject(
            createDaemonError(
              DaemonErrorCode.PERMISSION_DENIED,
              `Permission denied for socket: ${this.config.socketPath}`
            )
          );
        } else {
          reject(
            createDaemonError(
              DaemonErrorCode.UNKNOWN,
              `Server error: ${error.message}`,
              { originalError: error }
            )
          );
        }
      });

      this.server.listen(this.config.socketPath, () => {
        this.state = 'running';
        this.startedAt = Date.now();
        this.emitEvent('start', { socketPath: this.config.socketPath });
        resolve();
      });
    });
  }

  /**
   * Stop the daemon server gracefully
   *
   * Notifies all clients, waits for in-flight requests, then closes
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'stopping';

    // Notify all clients of shutdown
    for (const client of this.clients.values()) {
      this.notifyClientShutdown(client);
    }

    // Wait for graceful shutdown or timeout
    await this.waitForShutdown();

    // Close all remaining connections
    for (const [clientId] of this.clients) {
      this.removeConnection(clientId);
    }

    // Close server
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // Remove socket file
          if (existsSync(this.config.socketPath)) {
            try {
              unlinkSync(this.config.socketPath);
            } catch {
              // Ignore cleanup errors on shutdown
            }
          }

          this.server = null;
          this.state = 'stopped';
          this.emitEvent('stop', {
            uptime: Date.now() - this.startedAt,
            totalRequests: this.totalRequests,
          });
          resolve();
        });
      } else {
        this.state = 'stopped';
        resolve();
      }
    });
  }

  /**
   * Register a service handler
   *
   * @param name - Service name
   * @param handler - Handler function for service calls
   * @param methods - List of supported methods
   */
  registerService(
    name: string,
    handler: ServiceHandler,
    methods: string[] = []
  ): void {
    this.services.set(name, { name, handler, methods });
  }

  /**
   * Unregister a service
   *
   * @param name - Service name to remove
   */
  unregisterService(name: string): boolean {
    return this.services.delete(name);
  }

  /**
   * Get registered service by name
   */
  getService(name: string): RegisteredService | undefined {
    return this.services.get(name);
  }

  /**
   * Get all registered services
   */
  getServices(): RegisteredService[] {
    return Array.from(this.services.values());
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    // Check max clients limit
    if (this.clients.size >= this.config.maxClients) {
      this.rejectConnection(socket, ClientRejectionReason.MAX_CLIENTS_EXCEEDED);
      return;
    }

    // Check if server is shutting down
    if (this.state === 'stopping') {
      this.rejectConnection(socket, ClientRejectionReason.SERVER_SHUTTING_DOWN);
      return;
    }

    const clientId = generateClientId();
    const connection: ClientConnection = {
      id: clientId,
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.clients.set(clientId, connection);

    // Set up keepalive timeout
    this.resetKeepAliveTimer(clientId);

    // Handle socket events
    socket.on('data', (data) => this.handleData(clientId, data));
    socket.on('close', () => this.handleClose(clientId));
    socket.on('error', (error) => this.handleError(clientId, error));

    this.emitEvent('client_connect', { clientId });
  }

  /**
   * Reject a connection with reason
   */
  private rejectConnection(socket: Socket, reason: ClientRejectionReason): void {
    const message = JSON.stringify({
      error: {
        code: -32000,
        message: `Connection rejected: ${reason}`,
      },
    });
    socket.write(message);
    socket.end();
    this.emitEvent('client_rejected', { reason });
  }

  /**
   * Handle incoming data from client
   */
  private handleData(clientId: string, _data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update last activity
    client.lastActivity = Date.now();
    this.totalRequests++;

    // Reset keepalive timer
    this.resetKeepAliveTimer(clientId);

    // Data handling will be implemented in TASK-DAEMON-002
  }

  /**
   * Handle client disconnect
   */
  private handleClose(clientId: string): void {
    this.removeConnection(clientId);
  }

  /**
   * Handle socket error
   */
  private handleError(clientId: string, error: Error): void {
    // Use safeEmitError to avoid uncaught errors when no listener is registered
    this.safeEmitError({ clientId, error: error.message });
    this.removeConnection(clientId);
  }

  /**
   * Safely emit error event (won't throw if no listener)
   */
  private safeEmitError(data: Record<string, unknown>): void {
    const event: DaemonEvent = {
      type: 'error',
      timestamp: Date.now(),
      data,
    };
    // Only emit 'error' if there are listeners to prevent unhandled error exceptions
    if (this.listenerCount('error') > 0) {
      this.emit('error', event);
    }
    // Always emit through 'event' channel for monitoring
    this.emit('event', event);
  }

  /**
   * Remove a client connection
   */
  removeConnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clear keepalive timer
    const timer = this.keepAliveTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.keepAliveTimers.delete(clientId);
    }

    // Close socket if still open
    if (!client.socket.destroyed) {
      client.socket.destroy();
    }

    this.clients.delete(clientId);
    this.emitEvent('client_disconnect', { clientId });
  }

  /**
   * Reset keepalive timer for client
   */
  private resetKeepAliveTimer(clientId: string): void {
    // Clear existing timer
    const existingTimer = this.keepAliveTimers.get(clientId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.removeConnection(clientId);
    }, this.config.keepAliveTimeout);

    this.keepAliveTimers.set(clientId, timer);
  }

  /**
   * Notify client of server shutdown
   */
  private notifyClientShutdown(client: ClientConnection): void {
    try {
      const message = JSON.stringify({
        notification: 'shutdown',
        message: 'Server is shutting down',
      });
      client.socket.write(message);
    } catch {
      // Ignore write errors during shutdown
    }
  }

  /**
   * Wait for graceful shutdown
   */
  private async waitForShutdown(): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();

      const checkClients = () => {
        // Check if all clients disconnected or timeout
        if (
          this.clients.size === 0 ||
          Date.now() - startTime >= GRACEFUL_SHUTDOWN_TIMEOUT_MS
        ) {
          resolve();
        } else {
          setTimeout(checkClients, 100);
        }
      };

      checkClients();
    });
  }

  /**
   * Emit a daemon event
   */
  private emitEvent(
    type: DaemonEvent['type'],
    data?: Record<string, unknown>
  ): void {
    const event: DaemonEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);
  }

  /**
   * Get daemon statistics
   */
  getStats(): DaemonStats {
    return {
      activeConnections: this.clients.size,
      totalRequests: this.totalRequests,
      uptime: this.state === 'running' ? Date.now() - this.startedAt : 0,
      startedAt: this.startedAt,
    };
  }

  /**
   * Get current daemon state
   */
  getState(): DaemonState {
    return this.state;
  }

  /**
   * Get client connection info
   */
  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all connected clients
   */
  getClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get configuration
   */
  getConfig(): DaemonConfig {
    return { ...this.config };
  }
}
