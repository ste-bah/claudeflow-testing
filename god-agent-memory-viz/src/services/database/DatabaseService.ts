/**
 * DatabaseService - Singleton service for sql.js database operations
 *
 * Provides a centralized interface for loading, querying, and managing
 * SQLite databases in the browser using sql.js WASM.
 *
 * @module services/database/DatabaseService
 */

import { Database, QueryExecResult, SqlValue } from 'sql.js';
import { initializeSQL, createDatabase } from './sqljs-config';
import type {
  ConnectionInfo,
  DatabaseStats,
  SchemaValidation,
  ConnectionStateListener,
  QueryResult,
} from './types';

/** Required tables for a valid God Agent database */
const REQUIRED_TABLES = ['events', 'memory_entries', 'sessions'] as const;

/**
 * DatabaseService class - Singleton pattern for database operations
 *
 * @example
 * ```typescript
 * const db = DatabaseService.getInstance();
 * await db.initialize();
 * await db.loadFromFile(file);
 * const events = await db.query<EventRow>('SELECT * FROM events LIMIT 10');
 * ```
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null;

  private db: Database | null = null;
  private connectionInfo: ConnectionInfo = {
    state: 'uninitialized',
    fileName: null,
    fileSize: 0,
    loadedAt: null,
    error: null,
  };
  private listeners: Set<ConnectionStateListener> = new Set();
  private initialized = false;

  /**
   * Private constructor - use getInstance() to get the singleton
   */
  private constructor() {}

  /**
   * Get the singleton instance of DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    if (DatabaseService.instance) {
      DatabaseService.instance.close();
      DatabaseService.instance = null;
    }
  }

  /**
   * Initialize the sql.js WASM module
   * Must be called before any database operations
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.updateConnectionInfo({ state: 'initializing', error: null });

    try {
      await initializeSQL();
      this.initialized = true;
      this.updateConnectionInfo({ state: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize sql.js';
      this.updateConnectionInfo({ state: 'error', error: message });
      throw new Error(`sql.js initialization failed: ${message}`);
    }
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if a database is currently connected
   */
  public isConnected(): boolean {
    return this.db !== null && this.connectionInfo.state === 'connected';
  }

  /**
   * Get current connection information
   */
  public getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo };
  }

  /**
   * Subscribe to connection state changes
   */
  public subscribe(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getConnectionInfo());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Unsubscribe from connection state changes
   */
  public unsubscribe(listener: ConnectionStateListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Load a database from binary data
   */
  public async loadDatabase(data: ArrayLike<number>, fileName: string): Promise<SchemaValidation> {
    await this.ensureInitialized();

    // Close existing connection if any
    if (this.db) {
      this.close();
    }

    try {
      this.db = createDatabase(data);
      const fileSize = data.length;

      // Validate schema
      const validation = this.validateSchema();

      if (validation.isValid) {
        this.updateConnectionInfo({
          state: 'connected',
          fileName,
          fileSize,
          loadedAt: new Date(),
          error: null,
        });
      } else {
        this.db.close();
        this.db = null;
        this.updateConnectionInfo({
          state: 'error',
          error: validation.error || 'Schema validation failed',
        });
      }

      return validation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load database';
      this.updateConnectionInfo({ state: 'error', error: message });
      throw new Error(`Database load failed: ${message}`);
    }
  }

  /**
   * Load a database from a File object
   */
  public async loadFromFile(file: File): Promise<SchemaValidation> {
    await this.ensureInitialized();

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      return this.loadDatabase(data, file.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read file';
      this.updateConnectionInfo({ state: 'error', error: message });
      throw new Error(`File read failed: ${message}`);
    }
  }

  /**
   * Load a database from a URL
   */
  public async loadFromURL(url: string): Promise<SchemaValidation> {
    await this.ensureInitialized();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Extract filename from URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1] || 'remote.db';

      return this.loadDatabase(data, fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch database';
      this.updateConnectionInfo({ state: 'error', error: message });
      throw new Error(`URL fetch failed: ${message}`);
    }
  }

  /**
   * Validate that the database has the required schema
   */
  public validateSchema(): SchemaValidation {
    if (!this.db) {
      return {
        isValid: false,
        missingTables: [...REQUIRED_TABLES],
        foundTables: [],
        error: 'No database loaded',
      };
    }

    try {
      // Query for existing tables
      const result = this.db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      const foundTables: string[] = [];
      if (result.length > 0 && result[0].values) {
        for (const row of result[0].values) {
          if (typeof row[0] === 'string') {
            foundTables.push(row[0]);
          }
        }
      }

      // Check for required tables
      const missingTables = REQUIRED_TABLES.filter(
        (table) => !foundTables.includes(table)
      );

      const isValid = missingTables.length === 0;
      const error = isValid
        ? null
        : `Missing required tables: ${missingTables.join(', ')}`;

      return {
        isValid,
        missingTables,
        foundTables,
        error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema validation error';
      return {
        isValid: false,
        missingTables: [...REQUIRED_TABLES],
        foundTables: [],
        error: message,
      };
    }
  }

  /**
   * Execute a SQL statement (for DDL or DML without results)
   */
  public exec(sql: string, params?: unknown[]): QueryExecResult[] {
    if (!this.db) {
      throw new Error('No database connected. Call loadDatabase() first.');
    }

    try {
      const bindParams = params ? this.convertParams(params) : undefined;
      return this.db.exec(sql, bindParams);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      throw new Error(`SQL exec failed: ${message}`);
    }
  }

  /**
   * Execute a query and return typed results
   */
  public query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): QueryResult<T> {
    if (!this.db) {
      throw new Error('No database connected. Call loadDatabase() first.');
    }

    const startTime = performance.now();

    try {
      const bindParams = params ? this.convertParams(params) : undefined;
      const results = this.db.exec(sql, bindParams);
      const executionTime = performance.now() - startTime;

      if (results.length === 0) {
        return { rows: [], rowCount: 0, executionTime };
      }

      const { columns, values } = results[0];
      const rows = values.map((row: SqlValue[]) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col: string, idx: number) => {
          obj[col] = row[idx];
        });
        return obj as T;
      });

      return { rows, rowCount: rows.length, executionTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query failed';
      throw new Error(`SQL query failed: ${message}`);
    }
  }

  /**
   * Execute a query and return a single result or null
   */
  public queryOne<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T | null {
    const result = this.query<T>(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get database statistics
   */
  public getStats(): DatabaseStats {
    if (!this.db) {
      throw new Error('No database connected. Call loadDatabase() first.');
    }

    try {
      // Count events
      const eventCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM events'
      );

      // Count memory entries
      const memoryCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM memory_entries'
      );

      // Count sessions
      const sessionCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions'
      );

      // Count unique agents
      const agentCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT agent_id) as count FROM events WHERE agent_id IS NOT NULL'
      );

      // Count unique namespaces
      const namespaceCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT namespace) as count FROM memory_entries'
      );

      // Get date range
      const dateRangeResult = this.queryOne<{ earliest: string | null; latest: string | null }>(
        'SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest FROM events'
      );

      return {
        eventCount: eventCountResult?.count ?? 0,
        memoryEntryCount: memoryCountResult?.count ?? 0,
        sessionCount: sessionCountResult?.count ?? 0,
        uniqueAgents: agentCountResult?.count ?? 0,
        uniqueNamespaces: namespaceCountResult?.count ?? 0,
        dateRange: {
          earliest: dateRangeResult?.earliest ? new Date(dateRangeResult.earliest) : null,
          latest: dateRangeResult?.latest ? new Date(dateRangeResult.latest) : null,
        },
        fileSize: this.connectionInfo.fileSize,
      };
    } catch {
      // Return empty stats on error
      return {
        eventCount: 0,
        memoryEntryCount: 0,
        sessionCount: 0,
        uniqueAgents: 0,
        uniqueNamespaces: 0,
        dateRange: { earliest: null, latest: null },
        fileSize: this.connectionInfo.fileSize,
      };
    }
  }

  /**
   * Export the database as a Uint8Array
   */
  public export(): Uint8Array {
    if (!this.db) {
      throw new Error('No database connected. Call loadDatabase() first.');
    }
    return this.db.export();
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore close errors
      }
      this.db = null;
    }

    this.updateConnectionInfo({
      state: this.initialized ? 'ready' : 'uninitialized',
      fileName: null,
      fileSize: 0,
      loadedAt: null,
      error: null,
    });
  }

  /**
   * Get the underlying sql.js Database instance (for advanced use)
   */
  public getDatabase(): Database | null {
    return this.db;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Convert parameters to sql.js bind format
   */
  private convertParams(params: unknown[]): (string | number | Uint8Array | null)[] {
    return params.map((param) => {
      if (param === null || param === undefined) {
        return null;
      }
      if (typeof param === 'string' || typeof param === 'number') {
        return param;
      }
      if (param instanceof Uint8Array) {
        return param;
      }
      if (typeof param === 'boolean') {
        return param ? 1 : 0;
      }
      if (param instanceof Date) {
        return param.toISOString();
      }
      // Convert objects to JSON
      return JSON.stringify(param);
    });
  }

  /**
   * Update connection info and notify listeners
   */
  private updateConnectionInfo(update: Partial<ConnectionInfo>): void {
    this.connectionInfo = { ...this.connectionInfo, ...update };

    // Notify all listeners
    const info = this.getConnectionInfo();
    for (const listener of this.listeners) {
      try {
        listener(info);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// Export singleton getter for convenience
export const getDatabaseService = (): DatabaseService => DatabaseService.getInstance();
