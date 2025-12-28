/**
 * GNN Service - IPC wrapper for GNNEnhancer
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes GNN enhancement operations via JSON-RPC 2.0
 */
import type { GNNEnhancer } from '../../reasoning/gnn-enhancer.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * GNN service parameters
 */
export interface IGNNEnhanceParams {
    embedding: number[];
    trajectoryGraph?: {
        nodes: Array<{
            id: string;
            embedding: number[];
            metadata?: Record<string, unknown>;
        }>;
        edges?: Array<{
            source: string;
            target: string;
            weight: number;
        }>;
    };
}
/**
 * Create GNN service handler
 *
 * @param gnnEnhancer - GNNEnhancer instance
 * @returns Service handler with method map
 */
export declare function createGNNService(gnnEnhancer: GNNEnhancer): ServiceHandler;
//# sourceMappingURL=gnn-service.d.ts.map