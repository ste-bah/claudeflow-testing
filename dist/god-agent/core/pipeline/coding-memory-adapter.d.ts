/**
 * Coding Pipeline Memory Adapter
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/coding-memory-adapter
 */
import { z } from 'zod';
import type { PipelineMemoryCoordinator } from './pipeline-memory-coordinator.js';
export type MemoryAdapterErrorCode = 'STORE_FAILED' | 'RETRIEVE_FAILED' | 'VALIDATION_FAILED';
export declare class MemoryAdapterError extends Error {
    readonly code: MemoryAdapterErrorCode;
    constructor(code: MemoryAdapterErrorCode, message: string);
}
export declare const MemoryAdapterConfigSchema: z.ZodObject<{
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    maxContextSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    maxContextSize: number;
}, {
    verbose?: boolean | undefined;
    maxContextSize?: number | undefined;
}>;
export type IMemoryAdapterConfig = z.infer<typeof MemoryAdapterConfigSchema>;
export interface IMemoryContext {
    patterns: string[];
    decisions: string[];
    constraints: string[];
}
export interface IMemoryService {
    store(key: string, value: unknown): Promise<void>;
    retrieve(key: string): Promise<unknown>;
}
export declare function storeMemory(memoryCoordinator: PipelineMemoryCoordinator, namespace: string, key: string, value: unknown, log: (message: string) => void): void;
export declare function retrieveMemoryContext(memoryCoordinator: PipelineMemoryCoordinator, namespace: string, keys: string[]): Record<string, unknown>;
export declare function createNamespacedKey(namespace: string, key: string): string;
//# sourceMappingURL=coding-memory-adapter.d.ts.map