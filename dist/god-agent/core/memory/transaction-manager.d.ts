/**
 * Transaction Manager for Atomic Rollback
 * Implements Two-Phase Commit (2PC) protocol for MemoryEngine operations
 */
import type { VectorDB, VectorID } from '../vector-db/index.js';
import type { GraphDB, NodeID, EdgeID } from '../graph-db/index.js';
/**
 * Single operation within a transaction
 */
export interface ITransactionOperation {
    type: 'vector-insert' | 'graph-node' | 'graph-edge';
    id: string;
    rollback: () => Promise<void>;
}
/**
 * Transaction record with operations tracking
 */
export interface ITransaction {
    id: string;
    operations: ITransactionOperation[];
    status: 'pending' | 'committed' | 'rolled_back';
    createdAt: number;
    completedAt?: number;
}
/**
 * TransactionManager coordinates atomic operations across VectorDB and GraphDB
 * Ensures no orphaned data on partial failures
 */
export declare class TransactionManager {
    private transactions;
    private cleanupIntervalMs;
    private maxTransactionAgeMs;
    constructor();
    /**
     * Start a new transaction
     * @returns Transaction ID
     */
    startTransaction(): string;
    /**
     * Add an operation to the transaction
     * @param txnId - Transaction ID
     * @param operation - Operation to track
     */
    addOperation(txnId: string, operation: ITransactionOperation): void;
    /**
     * Commit the transaction (mark as successful)
     * @param txnId - Transaction ID
     */
    commit(txnId: string): Promise<void>;
    /**
     * Rollback the transaction (undo all operations in reverse order)
     * @param txnId - Transaction ID
     */
    rollback(txnId: string): Promise<void>;
    /**
     * Get transaction status
     * @param txnId - Transaction ID
     * @returns Transaction or null if not found
     */
    getTransaction(txnId: string): ITransaction | null;
    /**
     * Get count of pending transactions
     * @returns Number of pending transactions
     */
    getPendingCount(): number;
    /**
     * Create a vector insert operation
     * @param vectorDB - VectorDB instance
     * @param vectorId - Vector ID to delete on rollback
     * @returns Transaction operation
     */
    createVectorOperation(vectorDB: VectorDB, vectorId: VectorID): ITransactionOperation;
    /**
     * Create a graph node operation
     * @param graphDB - GraphDB instance
     * @param nodeId - Node ID to delete on rollback
     * @returns Transaction operation
     */
    createNodeOperation(graphDB: GraphDB, nodeId: NodeID): ITransactionOperation;
    /**
     * Create a graph edge operation
     * @param graphDB - GraphDB instance
     * @param edgeId - Edge ID to delete on rollback
     * @returns Transaction operation
     */
    createEdgeOperation(graphDB: GraphDB, edgeId: EdgeID): ITransactionOperation;
    /**
     * Start cleanup timer for abandoned transactions
     */
    private startCleanupTimer;
    /**
     * Clean up transactions that are too old
     */
    private cleanupAbandonedTransactions;
    /**
     * Stop the cleanup timer (for testing or shutdown)
     */
    stopCleanupTimer(): void;
}
//# sourceMappingURL=transaction-manager.d.ts.map