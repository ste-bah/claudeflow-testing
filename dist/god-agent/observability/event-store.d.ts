/**
 * EventStore - Dual Storage with Circular Buffer + SQLite Persistence
 *
 * Implements high-performance event storage with:
 * - In-memory circular buffer (10,000 events max, FIFO eviction)
 * - SQLite persistence for 24-hour retention
 * - Non-blocking inserts (< 0.1ms)
 * - Batch SQLite writes (100 events per transaction)
 *
 * @module observability/event-store
 * @see TASK-OBS-006-EVENT-STORE.md
 * @see SPEC-OBS-001-CORE.md#event_store
 */
import { IActivityEvent, ActivityEventComponent, ActivityEventStatus } from './types.js';
/**
 * Event query criteria
 */
export interface IEventQuery {
    /** Maximum number of events to return (default: 100) */
    limit?: number;
    /** Offset for pagination (default: 0) */
    offset?: number;
    /** Filter by component */
    component?: ActivityEventComponent;
    /** Filter by status */
    status?: ActivityEventStatus;
    /** Filter events after this timestamp */
    since?: number;
    /** Filter events before this timestamp */
    until?: number;
    /** Filter by trace ID */
    traceId?: string;
}
/**
 * EventStore statistics
 */
export interface IEventStoreStats {
    /** Current buffer size */
    bufferSize: number;
    /** Buffer capacity */
    bufferCapacity: number;
    /** Total events in SQLite database */
    dbEventCount: number;
    /** Oldest event timestamp in storage */
    oldestEventTime: number | null;
    /** Newest event timestamp in storage */
    newestEventTime: number | null;
}
/**
 * EventStore interface
 * Implements [REQ-OBS-06]: Dual storage (buffer + SQLite)
 */
export interface IEventStore {
    /**
     * Insert an event (non-blocking)
     * Implements [RULE-OBS-005]: Insert MUST complete in < 0.1ms
     * @param event The event to insert
     */
    insert(event: IActivityEvent): void;
    /**
     * Query events from storage
     * Strategy: Check buffer first, fall back to SQLite for historical
     * @param criteria Query criteria
     * @returns Promise resolving to events array
     */
    query(criteria: IEventQuery): Promise<IActivityEvent[]>;
    /**
     * Get storage statistics
     * @returns Current stats
     */
    getStats(): IEventStoreStats;
    /**
     * Close the event store and flush pending writes
     * @returns Promise resolving when closed
     */
    close(): Promise<void>;
}
/**
 * EventStore implementation with circular buffer + SQLite
 *
 * Implements:
 * - [REQ-OBS-06]: Dual storage system
 * - [RULE-OBS-004]: 10,000 event buffer with FIFO eviction
 * - [RULE-OBS-005]: Non-blocking insert (< 0.1ms)
 * - 24-hour SQLite retention with auto-cleanup
 * - Batch writes (100 events per transaction)
 */
export declare class EventStore implements IEventStore {
    private buffer;
    private head;
    private tail;
    private count;
    private readonly maxSize;
    private db;
    private insertStmt;
    private dbPath;
    private writeQueue;
    private writeTimer;
    private readonly batchSize;
    private isClosing;
    private readonly retentionMs;
    /**
     * Create a new EventStore
     * @param dbPath Path to SQLite database file
     * @param maxSize Maximum buffer size (default: 10000 per RULE-OBS-004)
     */
    constructor(dbPath?: string, maxSize?: number);
    /**
     * Ensure the directory for the database file exists
     * @param dbPath Database file path
     */
    private ensureDirectoryExists;
    /**
     * Initialize SQLite database with schema and triggers
     * @param dbPath Database file path
     * @returns Database instance
     */
    private initDatabase;
    /**
     * Insert an event (non-blocking)
     * Implements [RULE-OBS-005]: < 0.1ms operation
     *
     * Strategy:
     * 1. Add to circular buffer synchronously (O(1))
     * 2. Queue for SQLite batch write (async via setImmediate)
     *
     * @param event The event to insert
     */
    insert(event: IActivityEvent): void;
    /**
     * Queue an event for batch SQLite write
     * Non-blocking - uses setImmediate
     *
     * @param event Event to queue
     */
    private queueWrite;
    /**
     * Flush pending writes to SQLite in a batch transaction
     * Implements batch writes (100 events per transaction)
     */
    private flushWrites;
    /**
     * Query events from storage
     * Strategy:
     * 1. Check circular buffer for recent events
     * 2. Fall back to SQLite for historical events
     * 3. Merge and deduplicate results
     *
     * @param criteria Query criteria
     * @returns Promise resolving to events array
     */
    query(criteria?: IEventQuery): Promise<IActivityEvent[]>;
    /**
     * Query events from circular buffer
     * @param criteria Query criteria
     * @returns Filtered events from buffer
     */
    private queryBuffer;
    /**
     * Query events from SQLite database
     * @param criteria Query criteria
     * @param limit Maximum results
     * @returns Promise resolving to events array
     */
    private queryDatabase;
    /**
     * Check if an event matches query criteria
     * @param event Event to check
     * @param criteria Query criteria
     * @returns True if event matches
     */
    private matchesCriteria;
    /**
     * Get storage statistics
     * @returns Current storage stats
     */
    getStats(): IEventStoreStats;
    /**
     * Close the event store and flush pending writes
     * @returns Promise resolving when closed
     */
    close(): Promise<void>;
    /**
     * Clear all events from buffer and database
     * WARNING: This is destructive and used primarily for testing
     */
    clear(): void;
}
export default EventStore;
//# sourceMappingURL=event-store.d.ts.map