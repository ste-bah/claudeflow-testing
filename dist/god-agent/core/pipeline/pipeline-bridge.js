/**
 * Pipeline Bridge
 * TASK-BRG-001 - Base class for bridging pipeline config to orchestrator format
 *
 * Converts IPipelineConfig to IPipelineDefinition with:
 * - Topological sort for dependency ordering
 * - Memory key chain building
 * - Agent config to definition mapping
 */
// ==================== Pipeline Bridge ====================
/**
 * Base Pipeline Bridge
 *
 * Converts pipeline configuration to orchestrator-compatible format.
 * Override buildTaskDescription() and buildQualityGate() for custom behavior.
 */
export class PipelineBridge {
    config;
    registry;
    bridgeConfig;
    phaseMap;
    constructor(config, registry = null, bridgeConfig = {}) {
        this.config = config;
        this.registry = registry;
        this.bridgeConfig = {
            category: bridgeConfig.category ?? 'pipeline',
            includeAgentPrompts: bridgeConfig.includeAgentPrompts ?? true,
            memoryPrefix: bridgeConfig.memoryPrefix ?? '',
            strictOrdering: bridgeConfig.strictOrdering ?? true,
        };
        // Build phase lookup map
        this.phaseMap = new Map();
        for (const phase of config.phases) {
            this.phaseMap.set(phase.id, phase);
        }
    }
    // ==================== Main Build Method ====================
    /**
     * Build pipeline definition from config
     * @param executionId - Unique execution identifier for memory key namespacing
     */
    buildPipelineDefinition(executionId) {
        // Step 1: Topological sort
        const sortResult = this.topologicalSort(this.config.agents);
        if (!sortResult.success) {
            const cycleStr = sortResult.cycles
                .map(c => c.join(' -> '))
                .join('; ');
            throw new Error(`Circular dependencies detected: ${cycleStr}`);
        }
        // Step 2: Build agent definitions
        const agentDefs = [];
        let previousKey = null;
        const totalAgents = sortResult.sorted.length;
        for (let i = 0; i < totalAgents; i++) {
            const agentConfig = sortResult.sorted[i];
            const outputKey = this.buildMemoryKey(executionId, agentConfig.key, 'output');
            // Try to load agent definition from registry
            const loadedDef = this.registry?.getByKey(agentConfig.key) ?? null;
            // Build the agent definition
            const agentDef = {
                agentName: agentConfig.name,
                position: `Agent #${i + 1}/${totalAgents}`,
                phase: this.getPhaseName(agentConfig.phase),
                previousKey: previousKey,
                outputKey: outputKey,
                task: this.buildTaskDescription(agentConfig, loadedDef),
                qualityGate: this.buildQualityGate(agentConfig, loadedDef),
                parallel: false, // Sequential by default
                dependencies: agentConfig.dependencies.map(id => `agent-${id}`),
                agentType: agentConfig.key,
                metadata: {
                    id: agentConfig.id,
                    phase: agentConfig.phase,
                    critical: agentConfig.critical ?? false,
                    timeout: agentConfig.timeout,
                    inputs: agentConfig.inputs,
                    outputs: agentConfig.outputs,
                },
            };
            agentDefs.push(agentDef);
            previousKey = outputKey;
        }
        // Step 3: Build pipeline definition
        return {
            name: this.config.pipeline.name,
            description: this.config.pipeline.description,
            agents: agentDefs,
            sequential: true,
            metadata: {
                version: this.config.pipeline.version,
                totalAgents: this.config.pipeline.totalAgents,
                phases: this.config.pipeline.phases,
                executionId,
                category: this.bridgeConfig.category,
            },
        };
    }
    // ==================== Topological Sort ====================
    /**
     * Topological sort using Kahn's algorithm
     * Returns agents in dependency-respecting order
     */
    topologicalSort(agents) {
        // Build adjacency list and in-degree map
        const adjacency = new Map();
        const inDegree = new Map();
        const agentMap = new Map();
        // Initialize
        for (const agent of agents) {
            agentMap.set(agent.id, agent);
            adjacency.set(agent.id, []);
            inDegree.set(agent.id, 0);
        }
        // Build edges
        for (const agent of agents) {
            for (const depId of agent.dependencies) {
                // depId -> agent.id (depId must complete before agent)
                const edges = adjacency.get(depId);
                if (edges) {
                    edges.push(agent.id);
                }
                inDegree.set(agent.id, (inDegree.get(agent.id) ?? 0) + 1);
            }
        }
        // Initialize queue with nodes having in-degree 0
        const queue = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) {
                queue.push(id);
            }
        }
        // Process queue
        const sorted = [];
        while (queue.length > 0) {
            // Sort queue by ID for deterministic ordering
            queue.sort((a, b) => a - b);
            const current = queue.shift();
            const agent = agentMap.get(current);
            sorted.push(agent);
            // Decrease in-degree of neighbors
            for (const neighbor of adjacency.get(current) ?? []) {
                const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }
        // Check for cycles
        const unsortable = [];
        const cycles = [];
        if (sorted.length !== agents.length) {
            // Find agents that weren't sorted (involved in cycles)
            const sortedIds = new Set(sorted.map(a => a.id));
            for (const agent of agents) {
                if (!sortedIds.has(agent.id)) {
                    unsortable.push(agent);
                }
            }
            // Detect cycles
            const detected = this.detectCycles(agents, unsortable);
            cycles.push(...detected);
        }
        return {
            sorted,
            unsortable,
            cycles,
            success: unsortable.length === 0,
        };
    }
    /**
     * Detect cycles in dependency graph
     */
    detectCycles(agents, unsortable) {
        const cycles = [];
        const unsortableIds = new Set(unsortable.map(a => a.id));
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const agentMap = new Map();
        for (const agent of agents) {
            agentMap.set(agent.id, agent);
        }
        const dfs = (id) => {
            if (recursionStack.has(id)) {
                // Found cycle - extract it from path
                const cycleStart = path.indexOf(id);
                if (cycleStart !== -1) {
                    cycles.push([...path.slice(cycleStart), id]);
                }
                return true;
            }
            if (visited.has(id)) {
                return false;
            }
            visited.add(id);
            recursionStack.add(id);
            path.push(id);
            const agent = agentMap.get(id);
            if (agent) {
                for (const depId of agent.dependencies) {
                    if (unsortableIds.has(depId)) {
                        dfs(depId);
                    }
                }
            }
            recursionStack.delete(id);
            path.pop();
            return false;
        };
        for (const agent of unsortable) {
            if (!visited.has(agent.id)) {
                dfs(agent.id);
            }
        }
        return cycles;
    }
    // ==================== Helper Methods ====================
    /**
     * Build memory key with proper namespacing
     */
    buildMemoryKey(executionId, agentKey, suffix) {
        const prefix = this.bridgeConfig.memoryPrefix
            ? `${this.bridgeConfig.memoryPrefix}/`
            : '';
        return `${prefix}${this.bridgeConfig.category}/${executionId}/${agentKey}/${suffix}`;
    }
    /**
     * Get phase name from phase ID
     */
    getPhaseName(phaseId) {
        const phase = this.phaseMap.get(phaseId);
        return phase?.name ?? `Phase ${phaseId}`;
    }
    /**
     * Build task description for agent
     * Override in subclasses for custom behavior
     */
    buildTaskDescription(agentConfig, loadedDef) {
        const parts = [];
        // Add agent description
        parts.push(agentConfig.description);
        // Add expected inputs
        if (agentConfig.inputs.length > 0) {
            parts.push(`Inputs: ${agentConfig.inputs.join(', ')}`);
        }
        // Add expected outputs
        if (agentConfig.outputs.length > 0) {
            parts.push(`Must produce: ${agentConfig.outputs.join(', ')}`);
        }
        // Add loaded prompt if available and configured
        if (loadedDef && this.bridgeConfig.includeAgentPrompts) {
            const prompt = loadedDef.prompt || loadedDef.promptContent;
            if (prompt) {
                parts.push('\n--- Agent Instructions ---');
                parts.push(prompt);
            }
        }
        return parts.join('\n');
    }
    /**
     * Build quality gate for agent
     * Override in subclasses for custom behavior
     */
    buildQualityGate(agentConfig, _loadedDef) {
        const gates = [];
        // Gate based on required outputs
        for (const output of agentConfig.outputs) {
            gates.push(`Must produce ${output}`);
        }
        // Add timeout gate
        gates.push(`Must complete within ${agentConfig.timeout}s`);
        return gates.join('; ');
    }
    // ==================== Validation ====================
    /**
     * Validate that all pipeline agents have definitions in registry
     */
    validateAgentDefinitions() {
        if (!this.registry) {
            return {
                valid: false,
                missing: this.config.agents.map(a => a.key),
                found: [],
            };
        }
        const missing = [];
        const found = [];
        for (const agent of this.config.agents) {
            const def = this.registry.getByKey(agent.key);
            if (def) {
                found.push(agent.key);
            }
            else {
                missing.push(agent.key);
            }
        }
        return {
            valid: missing.length === 0,
            missing,
            found,
        };
    }
    /**
     * Get pipeline statistics
     */
    getStatistics() {
        const agents = this.config.agents;
        const totalDeps = agents.reduce((sum, a) => sum + a.dependencies.length, 0);
        return {
            totalAgents: agents.length,
            phases: this.config.phases.length,
            criticalAgents: agents.filter(a => a.critical).length,
            avgDependencies: agents.length > 0 ? totalDeps / agents.length : 0,
        };
    }
}
//# sourceMappingURL=pipeline-bridge.js.map