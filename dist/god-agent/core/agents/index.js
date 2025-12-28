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
// ==================== Type Guards & Utilities ====================
export { hasHooks, hasPreHook, hasPostHook, DEFAULT_LOADER_OPTIONS, createDefaultFrontmatter, } from './agent-types.js';
// ==================== Error Classes ====================
export { AgentError, AgentDirectoryNotFoundError, AgentLoadError, AgentSelectionError, AgentExecutionError, DuplicateAgentKeyError, AgentRegistryNotInitializedError, AgentNotFoundError, AgentCategoryError, } from './agent-errors.js';
// ==================== Core Classes ====================
// Agent loading
export { AgentCategoryScanner } from './agent-category-scanner.js';
export { AgentDefinitionLoader, parseFrontmatter, parseYaml } from './agent-definition-loader.js';
export { AgentRegistry, createAgentRegistry } from './agent-registry.js';
// DAI-001: Dynamic agent selection and execution
export { AgentSelector } from './agent-selector.js';
export { TaskExecutor } from './task-executor.js';
//# sourceMappingURL=index.js.map