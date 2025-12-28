/**
 * Recovery Service (SVC-003)
 * JSON-RPC 2.0 service for compaction recovery operations
 *
 * METHODS:
 * - recovery.check: Check for compaction events
 * - recovery.reconstruct: Reconstruct context after compaction
 * - recovery.status: Get recovery system status
 *
 * CONSTITUTION RULES: RULE-055 to RULE-062
 */
import { CompactionDetector } from '../recovery/compaction-detector.js';
import { MemoryReconstructor } from '../recovery/memory-reconstructor.js';
interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: unknown;
    id: string | number | null;
}
interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: JsonRpcError;
    id: string | number | null;
}
interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}
export declare class RecoveryService {
    private compactionDetector;
    private memoryReconstructor;
    private recoveryHistory;
    private compactionCount;
    private enabled;
    constructor(compactionDetector?: CompactionDetector, memoryReconstructor?: MemoryReconstructor);
    /**
     * Handle JSON-RPC 2.0 request
     */
    handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
    /**
     * Handle recovery.check method
     * Check for compaction events in conversation context
     * RULE-055: Detect Claude Code compaction markers
     */
    private handleCheck;
    /**
     * Handle recovery.reconstruct method
     * Reconstruct context after compaction using memory tiers
     * RULE-056: Reconstruct from AgentDB + DESC fallback
     */
    private handleReconstruct;
    /**
     * Handle recovery.status method
     * Get recovery system status and statistics
     */
    private handleStatus;
    /**
     * Enable/disable recovery system
     */
    setEnabled(enabled: boolean): void;
    private isCheckParams;
    private isReconstructParams;
    private successResponse;
    private errorResponse;
    private handleError;
}
export {};
//# sourceMappingURL=recovery-service.d.ts.map