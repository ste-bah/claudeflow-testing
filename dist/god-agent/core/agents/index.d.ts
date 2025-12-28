/**
 * Agent Loading System
 * Universal Subagent Integration - Agent Module Index
 *
 * DAI-001: Dynamic Agent Integration
 *
 * Exports all agent-related types and classes for:
 * - Loading agent definitions from .claude/agents/ markdown files
 * - Selecting appropriate agents for tasks
 * - Executing tasks with selected agents
 * - Handling agent-related errors
 */
export type { IAgentHooks, IAgentFrontmatter, ILoadedAgentDefinition, ICategoryInfo, IAgentLoaderOptions, IRegistryValidationResult, IRegistryStats, } from './agent-types.js';
export type { ITaskAnalysis, IScoredAgent, IAgentSelectionResult, } from './agent-selector.js';
export type { ITaskExecutionOptions, ITaskExecutionResult, TaskExecutionFunction, } from './task-executor.js';
export { hasHooks, hasPreHook, hasPostHook, DEFAULT_LOADER_OPTIONS, createDefaultFrontmatter, } from './agent-types.js';
export { AgentError, AgentDirectoryNotFoundError, AgentLoadError, AgentSelectionError, AgentExecutionError, DuplicateAgentKeyError, AgentRegistryNotInitializedError, AgentNotFoundError, AgentCategoryError, } from './agent-errors.js';
export { AgentCategoryScanner } from './agent-category-scanner.js';
export { AgentDefinitionLoader, parseFrontmatter, parseYaml } from './agent-definition-loader.js';
export { AgentRegistry, createAgentRegistry } from './agent-registry.js';
export { AgentSelector } from './agent-selector.js';
export { TaskExecutor } from './task-executor.js';
//# sourceMappingURL=index.d.ts.map