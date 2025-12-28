/**
 * Transaction Manager for Atomic Rollback
 * Implements Two-Phase Commit (2PC) protocol for MemoryEngine operations
 */
/**
 * TransactionManager coordinates atomic operations across VectorDB and GraphDB
 * Ensures no orphaned data on partial failures
 */
export class TransactionManager {
    transactions = new Map();
    cleanupIntervalMs = 60000; // Clean up old transactions every minute
    maxTransactionAgeMs = 300000; // Max age: 5 minutes
    constructor() {
        // Start cleanup timer
        this.startCleanupTimer();
    }
    /**
     * Start a new transaction
     * @returns Transaction ID
     */
    startTransaction() {
        const txnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const transaction = {
            id: txnId,
            operations: [],
            status: 'pending',
            createdAt: Date.now()
        };
        this.transactions.set(txnId, transaction);
        return txnId;
    }
    /**
     * Add an operation to the transaction
     * @param txnId - Transaction ID
     * @param operation - Operation to track
     */
    addOperation(txnId, operation) {
        const transaction = this.transactions.get(txnId);
        if (!transaction) {
            throw new Error(`Transaction ${txnId} not found`);
        }
        if (transaction.status !== 'pending') {
            throw new Error(`Cannot add operation to ${transaction.status} transaction`);
        }
        transaction.operations.push(operation);
    }
    /**
     * Commit the transaction (mark as successful)
     * @param txnId - Transaction ID
     */
    async commit(txnId) {
        const transaction = this.transactions.get(txnId);
        if (!transaction) {
            throw new Error(`Transaction ${txnId} not found`);
        }
        transaction.status = 'committed';
        transaction.completedAt = Date.now();
        // Remove from active transactions
        this.transactions.delete(txnId);
    }
    /**
     * Rollback the transaction (undo all operations in reverse order)
     * @param txnId - Transaction ID
     */
    async rollback(txnId) {
        const transaction = this.transactions.get(txnId);
        if (!transaction) {
            // Transaction already cleaned up or doesn't exist
            return;
        }
        // Rollback in reverse order: edges → nodes → vectors
        const operations = [...transaction.operations].reverse();
        for (const operation of operations) {
            try {
                await operation.rollback();
            }
            catch (error) {
                // Log but continue with other rollbacks
                console.error(`Failed to rollback ${operation.type} operation ${operation.id}:`, error);
            }
        }
        transaction.status = 'rolled_back';
        transaction.completedAt = Date.now();
        // Remove from active transactions
        this.transactions.delete(txnId);
    }
    /**
     * Get transaction status
     * @param txnId - Transaction ID
     * @returns Transaction or null if not found
     */
    getTransaction(txnId) {
        return this.transactions.get(txnId) || null;
    }
    /**
     * Get count of pending transactions
     * @returns Number of pending transactions
     */
    getPendingCount() {
        return this.transactions.size;
    }
    /**
     * Create a vector insert operation
     * @param vectorDB - VectorDB instance
     * @param vectorId - Vector ID to delete on rollback
     * @returns Transaction operation
     */
    createVectorOperation(vectorDB, vectorId) {
        return {
            type: 'vector-insert',
            id: vectorId,
            rollback: async () => {
                await vectorDB.delete(vectorId);
            }
        };
    }
    /**
     * Create a graph node operation
     * @param graphDB - GraphDB instance
     * @param nodeId - Node ID to delete on rollback
     * @returns Transaction operation
     */
    createNodeOperation(graphDB, nodeId) {
        return {
            type: 'graph-node',
            id: nodeId,
            rollback: async () => {
                await graphDB.deleteNode(nodeId);
            }
        };
    }
    /**
     * Create a graph edge operation
     * @param graphDB - GraphDB instance
     * @param edgeId - Edge ID to delete on rollback
     * @returns Transaction operation
     */
    createEdgeOperation(graphDB, edgeId) {
        return {
            type: 'graph-edge',
            id: edgeId,
            rollback: async () => {
                await graphDB.deleteEdge(edgeId);
            }
        };
    }
    /**
     * Start cleanup timer for abandoned transactions
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupAbandonedTransactions();
        }, this.cleanupIntervalMs);
    }
    /**
     * Clean up transactions that are too old
     */
    cleanupAbandonedTransactions() {
        const now = Date.now();
        for (const [txnId, transaction] of this.transactions.entries()) {
            const age = now - transaction.createdAt;
            if (age > this.maxTransactionAgeMs) {
                console.warn(`Transaction ${txnId} abandoned after ${age}ms. Status: ${transaction.status}`);
                // If still pending, attempt rollback
                if (transaction.status === 'pending') {
                    this.rollback(txnId).catch(error => {
                        console.error(`Failed to rollback abandoned transaction ${txnId}:`, error);
                    });
                }
                else {
                    // Remove completed but not deleted transactions
                    this.transactions.delete(txnId);
                }
            }
        }
    }
    /**
     * Stop the cleanup timer (for testing or shutdown)
     */
    stopCleanupTimer() {
        // Timer reference not stored, but intervals can be cleared externally if needed
        // This is a placeholder for explicit cleanup
    }
}
//# sourceMappingURL=transaction-manager.js.map