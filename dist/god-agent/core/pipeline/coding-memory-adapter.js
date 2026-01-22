/**
 * Coding Pipeline Memory Adapter
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/coding-memory-adapter
 */
import { z } from 'zod';
export class MemoryAdapterError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'MemoryAdapterError';
        Object.setPrototypeOf(this, MemoryAdapterError.prototype);
    }
}
// =============================================================================
// TS-004: ZOD VALIDATION FOR CONFIGS
// =============================================================================
export const MemoryAdapterConfigSchema = z.object({
    verbose: z.boolean().optional().default(false),
    maxContextSize: z.number().min(1).optional().default(10000),
});
// =============================================================================
// MEMORY STORAGE
// =============================================================================
export function storeMemory(memoryCoordinator, namespace, key, value, log) {
    const fullKey = createNamespacedKey(namespace, key);
    try {
        const step = {
            agentKey: 'orchestrator',
            task: 'pipeline-state-update',
            inputDomain: '',
            inputTags: [],
            outputDomain: namespace,
            outputTags: [fullKey],
        };
        memoryCoordinator.storeStepOutput(step, 0, `pipeline-${Date.now()}`, value, 'orchestrator');
    }
    catch (error) {
        throw new MemoryAdapterError('STORE_FAILED', `Failed to store ${fullKey}: ${error.message}`);
    }
}
// =============================================================================
// MEMORY RETRIEVAL
// =============================================================================
export function retrieveMemoryContext(memoryCoordinator, namespace, keys) {
    const context = {};
    for (const key of keys) {
        const fullKey = createNamespacedKey(namespace, key);
        try {
            const step = {
                agentKey: 'orchestrator',
                task: 'retrieve-context',
                inputDomain: fullKey,
                inputTags: [],
                outputDomain: '',
                outputTags: [],
            };
            const result = memoryCoordinator.retrievePreviousOutput(step, 'coding-pipeline');
            if (result.output !== undefined) {
                context[key] = result.output;
            }
        }
        catch {
            // Ignore retrieval errors - key may not exist yet
        }
    }
    return context;
}
// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
export function createNamespacedKey(namespace, key) {
    return key.startsWith(namespace) ? key : `${namespace}/${key}`;
}
//# sourceMappingURL=coding-memory-adapter.js.map