/**
 * DAI-002: Pipeline Memory Coordinator
 * TASK-004: Handles memory operations for pipeline execution
 *
 * RULE-005: Mandatory Memory Coordination
 * - Every agent in a pipeline MUST coordinate through God Agent's memory systems
 * - Uses InteractionStore (NOT claude-flow) for storage/retrieval
 * - Outputs stored BEFORE next agent starts
 *
 * Memory Operations:
 * 1. storeStepOutput() - Store agent output after step completion
 * 2. retrievePreviousOutput() - Retrieve previous agent's output
 * 3. clearPipelineData() - Clean up after pipeline completion (optional)
 */
import { MemoryCoordinationError } from './pipeline-errors.js';
// ==================== Pipeline Memory Coordinator ====================
/**
 * Coordinates memory operations for pipeline execution.
 * Stores and retrieves agent outputs via InteractionStore.
 *
 * @example
 * ```typescript
 * const coordinator = new PipelineMemoryCoordinator(interactionStore);
 *
 * // Store output after agent completes
 * await coordinator.storeStepOutput(step, 0, 'pip_123', agentOutput, 'backend-dev');
 *
 * // Retrieve for next agent
 * const previous = coordinator.retrievePreviousOutput(nextStep, 'pip_123');
 * ```
 */
export class PipelineMemoryCoordinator {
    interactionStore;
    config;
    /**
     * Create a new memory coordinator
     * @param interactionStore - The InteractionStore instance for storage
     * @param config - Optional configuration
     */
    constructor(interactionStore, config = {}) {
        this.interactionStore = interactionStore;
        this.config = {
            defaultQuality: config.defaultQuality ?? 1.0,
            verbose: config.verbose ?? false,
        };
    }
    /**
     * Store agent output after step completion.
     *
     * CRITICAL: This MUST be called BEFORE the next agent starts (RULE-005).
     *
     * @param step - The pipeline step that completed
     * @param stepIndex - Index of the step (0-based)
     * @param pipelineId - Unique pipeline execution ID
     * @param output - Agent's output to store
     * @param agentKey - Key of the agent that executed
     * @returns Storage result with entry ID
     * @throws MemoryCoordinationError if storage fails
     */
    storeStepOutput(step, stepIndex, pipelineId, output, agentKey) {
        const timestamp = Date.now();
        const entryId = this.generateEntryId(pipelineId, stepIndex, timestamp);
        // Prepare storage data following IPipelineStepStorage structure
        const storageData = {
            stepIndex,
            agentKey,
            output,
            pipelineId,
            timestamp,
        };
        // Build tags: step's output tags + pipeline ID + step marker
        const tags = [
            ...step.outputTags,
            pipelineId,
            `step-${stepIndex}`,
        ];
        try {
            // Create knowledge entry
            const entry = {
                id: entryId,
                content: JSON.stringify(storageData),
                type: 'fact', // Pipeline outputs are factual data
                domain: step.outputDomain,
                tags,
                quality: this.config.defaultQuality,
                usageCount: 0,
                lastUsed: timestamp,
                createdAt: timestamp,
            };
            // Store in InteractionStore
            this.interactionStore.addKnowledge(entry);
            if (this.config.verbose) {
                console.log(`[Pipeline ${pipelineId}] Stored to domain '${step.outputDomain}' ` +
                    `(entry: ${entryId})`);
            }
            return {
                entryId,
                domain: step.outputDomain,
                tags,
                timestamp,
            };
        }
        catch (error) {
            throw new MemoryCoordinationError(`Failed to store step output: ${error.message}`, {
                pipelineId,
                stepIndex,
                domain: step.outputDomain,
                operation: 'store',
                cause: error instanceof Error ? error : new Error(String(error)),
            });
        }
    }
    /**
     * Retrieve previous agent's output for a step.
     *
     * @param step - The current step that needs previous output
     * @param pipelineId - Unique pipeline execution ID
     * @returns Retrieved data (may be empty if first agent or no matches)
     * @throws MemoryCoordinationError if retrieval fails unexpectedly
     */
    retrievePreviousOutput(step, pipelineId) {
        // First agent has no previous output
        if (!step.inputDomain) {
            return { entries: [] };
        }
        try {
            // Get all entries from the input domain
            const domainEntries = this.interactionStore.getKnowledgeByDomain(step.inputDomain);
            // Filter by pipeline ID to get only this pipeline's outputs
            let filtered = domainEntries.filter(entry => entry.tags?.includes(pipelineId));
            // If input tags specified, filter further
            if (step.inputTags?.length) {
                filtered = filtered.filter(entry => step.inputTags.some(tag => entry.tags?.includes(tag)));
            }
            // Sort by timestamp (most recent first)
            filtered.sort((a, b) => b.createdAt - a.createdAt);
            if (this.config.verbose && filtered.length > 0) {
                console.log(`[Pipeline ${pipelineId}] Retrieved ${filtered.length} entries from '${step.inputDomain}'`);
            }
            // Parse the most recent entry if available
            let output;
            let stepData;
            if (filtered.length > 0) {
                try {
                    stepData = JSON.parse(filtered[0].content);
                    output = stepData.output;
                }
                catch {
                    // Content isn't valid JSON - return raw content
                    output = filtered[0].content;
                }
            }
            return {
                entries: filtered,
                output,
                stepData,
            };
        }
        catch (error) {
            throw new MemoryCoordinationError(`Failed to retrieve previous output: ${error.message}`, {
                pipelineId,
                stepIndex: -1, // Unknown step index during retrieval
                domain: step.inputDomain,
                operation: 'retrieve',
                cause: error instanceof Error ? error : new Error(String(error)),
            });
        }
    }
    /**
     * Retrieve output from a specific step by index.
     *
     * @param pipelineId - Pipeline execution ID
     * @param stepIndex - Step index to retrieve
     * @param domain - Domain where output was stored
     * @returns Retrieved data
     */
    retrieveStepOutput(pipelineId, stepIndex, domain) {
        try {
            const domainEntries = this.interactionStore.getKnowledgeByDomain(domain);
            // Filter by pipeline ID and step index
            const filtered = domainEntries.filter(entry => entry.tags?.includes(pipelineId) &&
                entry.tags?.includes(`step-${stepIndex}`));
            // Sort by timestamp (most recent first)
            filtered.sort((a, b) => b.createdAt - a.createdAt);
            let output;
            let stepData;
            if (filtered.length > 0) {
                try {
                    stepData = JSON.parse(filtered[0].content);
                    output = stepData.output;
                }
                catch {
                    output = filtered[0].content;
                }
            }
            return {
                entries: filtered,
                output,
                stepData,
            };
        }
        catch (error) {
            throw new MemoryCoordinationError(`Failed to retrieve step ${stepIndex} output: ${error.message}`, {
                pipelineId,
                stepIndex,
                domain,
                operation: 'retrieve',
                cause: error instanceof Error ? error : new Error(String(error)),
            });
        }
    }
    /**
     * Get all outputs from a pipeline execution.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns All stored outputs for this pipeline
     */
    getAllPipelineOutputs(pipelineId) {
        // Get all knowledge entries and filter by pipeline ID
        // Note: stats is retrieved but not currently used for scanning
        // Could be enhanced to dynamically discover domains
        // We need to scan all domains - get unique domains from the store
        // This is a bit inefficient but necessary for retrieving all pipeline data
        const allEntries = [];
        // Access the knowledge map through getKnowledgeByDomain with wildcards
        // Since InteractionStore doesn't have a getAllKnowledge method,
        // we'll use getKnowledge with known IDs or scan known domains
        // For now, return based on common pipeline domains
        const commonDomains = [
            'project/plans',
            'project/specs',
            'project/implementations',
            'project/tests',
            'project/api',
            'project/events',
            'project/frontend',
        ];
        for (const domain of commonDomains) {
            const entries = this.interactionStore.getKnowledgeByDomain(domain);
            const pipelineEntries = entries.filter(e => e.tags?.includes(pipelineId));
            allEntries.push(...pipelineEntries);
        }
        return allEntries;
    }
    /**
     * Check if previous output exists for a step.
     *
     * @param step - The step to check
     * @param pipelineId - Pipeline execution ID
     * @returns True if previous output is available
     */
    hasPreviousOutput(step, pipelineId) {
        if (!step.inputDomain) {
            return false;
        }
        const result = this.retrievePreviousOutput(step, pipelineId);
        return result.entries.length > 0;
    }
    /**
     * Generate a unique entry ID for a pipeline step output.
     */
    generateEntryId(pipelineId, stepIndex, timestamp) {
        return `pipeline-${pipelineId}-step-${stepIndex}-${timestamp}`;
    }
}
// ==================== Factory Function ====================
/**
 * Create a PipelineMemoryCoordinator with given InteractionStore
 * @param interactionStore - Initialized InteractionStore
 * @param config - Optional configuration
 * @returns PipelineMemoryCoordinator instance
 */
export function createPipelineMemoryCoordinator(interactionStore, config) {
    return new PipelineMemoryCoordinator(interactionStore, config);
}
//# sourceMappingURL=pipeline-memory-coordinator.js.map