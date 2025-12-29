/**
 * DatabaseConnection - Unified SQLite connection for god-agent learning system
 *
 * Implements: REQ-DESC-007, GAP-DESC-007
 * Constitution: RULE-008, RULE-046, RULE-085
 *
 * Key features:
 * - WAL mode for concurrent access (RULE-046)
 * - Automatic schema initialization
 * - Singleton pattern with environment variable support (RULE-085)
 * - Health check and graceful shutdown
 */
import Database from 'better-sqlite3';
/**
 * Interface for database connection (RULE-067)
 */
export interface IDatabaseConnection {
    readonly db: Database.Database;
    prepare<BindParams extends unknown[] | {} = unknown[], Result = unknown>(sql: string): Database.Statement<BindParams, Result>;
    transaction<T>(fn: () => T): T;
    close(): void;
    isHealthy(): boolean;
    checkpoint(): void;
}
/**
 * Database configuration options
 */
export interface DatabaseConfig {
    /** Path to SQLite database file */
    dbPath: string;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Memory limit for cache in bytes */
    cacheSize?: number;
}
/**
 * DatabaseConnection - Core database service
 *
 * Provides:
 * - Automatic schema initialization on first connection
 * - WAL mode for better concurrency
 * - Prepared statement caching via better-sqlite3
 * - Transaction support with automatic rollback on error
 */
export declare class DatabaseConnection implements IDatabaseConnection {
    readonly db: Database.Database;
    private readonly schemaDir;
    private initialized;
    constructor(config: DatabaseConfig);
    /**
     * Initialize all database schemas
     * Implements: RULE-011, RULE-013, RULE-014 (SQLite storage)
     */
    private initializeSchemas;
    /**
     * Prepare a SQL statement for execution
     */
    prepare<BindParams extends unknown[] | {} = unknown[], Result = unknown>(sql: string): Database.Statement<BindParams, Result>;
    /**
     * Execute a function within a transaction
     * Implements: RULE-046 (atomic operations)
     */
    transaction<T>(fn: () => T): T;
    /**
     * Check if database connection is healthy
     */
    isHealthy(): boolean;
    /**
     * Force WAL checkpoint (for flush operations)
     */
    checkpoint(): void;
    /**
     * Close database connection gracefully
     */
    close(): void;
    /**
     * Get database statistics
     */
    getStats(): {
        episodeCount: number;
        patternCount: number;
        outcomeCount: number;
        feedbackCount: number;
    };
}
/**
 * Get or create the singleton database connection
 * Implements: RULE-085 (environment variable support)
 *
 * @param dbPath - Optional path override (uses env or default if not provided)
 * @returns DatabaseConnection instance
 */
export declare function getDatabaseConnection(dbPath?: string): DatabaseConnection;
/**
 * Close and clear the singleton connection
 */
export declare function closeDatabaseConnection(): void;
/**
 * Check if a connection exists
 */
export declare function hasConnection(): boolean;
/**
 * Create a new connection (for testing, bypasses singleton)
 */
export declare function createConnection(config: DatabaseConfig): DatabaseConnection;
//# sourceMappingURL=connection.d.ts.map