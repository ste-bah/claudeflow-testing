/**
 * Agent Error Classes
 * TASK-001: DAI-001 Foundation Layer
 *
 * Custom error classes for agent operations with full context.
 * Per constitution.md RULE-003: All errors MUST include full context.
 *
 * NO fallbacks, NO generic messages, NO silent failures.
 */
/**
 * Base error class for all agent operations.
 * All agent errors MUST extend this class.
 */
export declare class AgentError extends Error {
    readonly originalCause?: Error;
    constructor(message: string, options?: {
        cause?: Error;
    });
    /**
     * Get the full error chain for debugging
     */
    getErrorChain(): string[];
}
/**
 * Error thrown when the agent directory (.claude/agents/) does not exist.
 * This is a fatal error - cannot proceed without agent definitions.
 */
export declare class AgentDirectoryNotFoundError extends AgentError {
    readonly path: string;
    constructor(path: string);
}
/**
 * Error thrown when an agent .md file fails to load or parse.
 * Includes file path, key, and original parsing error.
 */
export declare class AgentLoadError extends AgentError {
    readonly agentKey: string;
    readonly filePath: string;
    constructor(key: string, path: string, cause: Error);
}
/**
 * Error thrown when no suitable agent can be found for a task.
 * Includes task details, analysis results, and available agents.
 */
export declare class AgentSelectionError extends AgentError {
    readonly task: string;
    readonly availableAgents: string[];
    readonly taskType?: string;
    readonly requiredCapabilities?: string[];
    constructor(task: string, availableAgents: string[], analysis?: {
        taskType?: string;
        requiredCapabilities?: string[];
    });
}
/**
 * Error thrown when Task() execution fails.
 * Includes agent details, task, and original execution error.
 */
export declare class AgentExecutionError extends AgentError {
    readonly agentKey: string;
    readonly agentCategory: string;
    readonly task: string;
    readonly duration?: number;
    constructor(agentKey: string, agentCategory: string, task: string, cause: Error, duration?: number);
}
/**
 * Error thrown when duplicate agent keys are detected across categories.
 * This is a warning-level error - first agent is kept, duplicate is skipped.
 */
export declare class DuplicateAgentKeyError extends AgentError {
    readonly agentKey: string;
    readonly firstPath: string;
    readonly duplicatePath: string;
    constructor(key: string, firstPath: string, duplicatePath: string);
}
/**
 * Error thrown when AgentRegistry is not initialized before use.
 */
export declare class AgentRegistryNotInitializedError extends AgentError {
    constructor(operation: string);
}
/**
 * Error thrown when a required agent is not found in the registry.
 */
export declare class AgentNotFoundError extends AgentError {
    readonly agentKey: string;
    readonly availableKeys: string[];
    constructor(key: string, availableKeys: string[]);
}
/**
 * Error thrown when a category is not found or is empty.
 */
export declare class AgentCategoryError extends AgentError {
    readonly category: string;
    readonly availableCategories: string[];
    constructor(category: string, availableCategories: string[], isEmpty?: boolean);
}
//# sourceMappingURL=agent-errors.d.ts.map