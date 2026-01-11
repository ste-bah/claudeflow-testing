/**
 * DAI-002: Command Task Bridge
 *
 * Bridges between Claude Code slash commands and Task() subagent spawning.
 * Implements RULE-008: Commands must spawn Task() subagents, never execute directly.
 *
 * US-014: /god-code Task() Spawning
 * US-015: /god-ask Task() Spawning
 * US-016: /god-research Task() Spawning
 * US-017: /god-write Task() Spawning
 * US-018: Complex Task Pipeline Triggering
 * FR-017: Task() Spawning Required
 * FR-018: Pipeline Detection
 * FR-019: Multi-Step Task Detection
 */
import { PipelineDefinitionError } from './pipeline-errors.js';
import { PHASE_ORDER, CHECKPOINT_PHASES, TOTAL_AGENTS, } from './types.js';
// ==================== Constants ====================
/**
 * Default complexity threshold for triggering pipeline.
 */
export const DEFAULT_PIPELINE_THRESHOLD = 0.6;
/**
 * Keywords indicating multiple phases.
 */
export const PHASE_KEYWORDS = [
    'plan', 'design', 'analyze', 'implement', 'test', 'validate',
    'review', 'document', 'deploy', 'refactor', 'optimize'
];
/**
 * Document creation keywords.
 */
export const DOCUMENT_KEYWORDS = [
    'prd', 'spec', 'specification', 'tech doc', 'technical document',
    'readme', 'documentation', 'architecture', 'design doc', 'api doc'
];
/**
 * Multi-step action patterns (regex).
 */
export const MULTI_STEP_PATTERNS = [
    /(\w+)\s+and\s+(\w+)(?:\s+and\s+(\w+))?/gi, // "plan and implement and test"
    /first\s+(\w+).*then\s+(\w+)/gi, // "first analyze, then implement"
    /step\s*\d+|phase\s*\d+/gi, // "step 1", "phase 2"
    /create\s+(\w+),?\s+(\w+)(?:,?\s+and\s+(\w+))?/gi // "create PRD, spec, and docs"
];
/**
 * Connector words indicating sequential work.
 */
export const CONNECTOR_WORDS = [
    'then', 'after', 'before', 'once', 'following', 'next', 'finally',
    'first', 'second', 'third', 'lastly', 'subsequently'
];
/**
 * Default agent mappings for common phases.
 */
export const DEFAULT_PHASE_MAPPINGS = [
    {
        phase: 'plan',
        agentKey: 'planner',
        outputDomain: 'project/plans',
        outputTags: ['plan', 'strategy'],
        taskTemplate: 'Create a detailed plan for: {task}'
    },
    {
        phase: 'analyze',
        agentKey: 'code-analyzer',
        outputDomain: 'project/analysis',
        outputTags: ['analysis', 'review'],
        taskTemplate: 'Analyze and assess: {task}'
    },
    {
        phase: 'design',
        agentKey: 'system-architect',
        outputDomain: 'project/designs',
        outputTags: ['design', 'architecture'],
        taskTemplate: 'Design the architecture for: {task}'
    },
    {
        phase: 'implement',
        agentKey: 'backend-dev',
        outputDomain: 'project/implementations',
        outputTags: ['implementation', 'code'],
        taskTemplate: 'Implement: {task}'
    },
    {
        phase: 'test',
        agentKey: 'tester',
        outputDomain: 'project/tests',
        outputTags: ['test', 'validation'],
        taskTemplate: 'Write tests for: {task}'
    },
    {
        phase: 'document',
        agentKey: 'documentation-specialist',
        outputDomain: 'project/docs',
        outputTags: ['documentation', 'docs'],
        taskTemplate: 'Create documentation for: {task}'
    },
    {
        phase: 'review',
        agentKey: 'reviewer',
        outputDomain: 'project/reviews',
        outputTags: ['review', 'feedback'],
        taskTemplate: 'Review and validate: {task}'
    },
    {
        phase: 'research',
        agentKey: 'researcher',
        outputDomain: 'project/research',
        outputTags: ['research', 'findings'],
        taskTemplate: 'Research and investigate: {task}'
    }
];
/**
 * Document type to agent mapping.
 */
export const DOCUMENT_AGENT_MAPPING = {
    'prd': 'planner',
    'spec': 'system-architect',
    'specification': 'system-architect',
    'tech doc': 'documentation-specialist',
    'technical document': 'documentation-specialist',
    'readme': 'documentation-specialist',
    'documentation': 'documentation-specialist',
    'architecture': 'system-architect',
    'design doc': 'system-architect',
    'api doc': 'backend-dev'
};
// ═══════════════════════════════════════════════════════════════════════════
// CODING PIPELINE AGENT MAPPINGS (40 Agents, 7 Phases)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Complete mapping of all 40 agents in the coding pipeline.
 *
 * Phase Distribution (40 Core + 7 Sherlock Forensic = 47 Total):
 * - Phase 1 (Understanding): 5 agents  - XP: 215 + Sherlock #41
 * - Phase 2 (Exploration): 5 agents    - XP: 210 + Sherlock #42
 * - Phase 3 (Architecture): 6 agents   - XP: 305 + Sherlock #43
 * - Phase 4 (Implementation): 8 agents - XP: 430 + Sherlock #44
 * - Phase 5 (Testing): 8 agents        - XP: 420 + Sherlock #45
 * - Phase 6 (Optimization): 4 agents   - XP: 225 + Sherlock #46
 * - Phase 7 (Delivery): 4 agents       - XP: 230 + Sherlock #47 (Recovery)
 *
 * Total: 47 agents (40 core + 7 Sherlock), ~2685 XP
 *
 * @see SPEC-001-architecture.md
 * @see TASK-WIRING-002-agent-mappings.md
 */
export const CODING_PIPELINE_MAPPINGS = [
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: UNDERSTANDING (5 agents, XP: 215)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'understanding',
        agentKey: 'task-analyzer',
        priority: 1,
        category: 'analysis',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'ToT',
        dependsOn: undefined,
        memoryReads: ['coding/input/task', 'coding/context/project'],
        memoryWrites: ['coding/understanding/task-analysis', 'coding/understanding/parsed-intent'],
        xpReward: 50,
        parallelizable: false,
        critical: true,
        description: 'Parses and validates the coding task. CRITICAL: Pipeline halts if task cannot be parsed.',
    },
    {
        phase: 'understanding',
        agentKey: 'requirement-extractor',
        priority: 2,
        category: 'analysis',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['task-analyzer'],
        memoryReads: ['coding/understanding/task-analysis'],
        memoryWrites: ['coding/understanding/requirements', 'coding/understanding/acceptance-criteria'],
        xpReward: 40,
        parallelizable: true,
        critical: false,
        description: 'Extracts functional and non-functional requirements from the parsed task.',
    },
    {
        phase: 'understanding',
        agentKey: 'scope-definer',
        priority: 3,
        category: 'analysis',
        algorithm: 'ToT',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['task-analyzer'],
        memoryReads: ['coding/understanding/task-analysis', 'coding/understanding/requirements'],
        memoryWrites: ['coding/understanding/scope', 'coding/understanding/boundaries'],
        xpReward: 40,
        parallelizable: true,
        critical: false,
        description: 'Defines scope boundaries and identifies what is in/out of scope.',
    },
    {
        phase: 'understanding',
        agentKey: 'context-gatherer',
        priority: 4,
        category: 'analysis',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['task-analyzer'],
        memoryReads: ['coding/understanding/task-analysis', 'coding/context/project'],
        memoryWrites: ['coding/understanding/context', 'coding/understanding/existing-code'],
        xpReward: 45,
        parallelizable: true,
        critical: false,
        description: 'Gathers relevant context from existing codebase and project documentation.',
    },
    {
        phase: 'understanding',
        agentKey: 'constraint-analyzer',
        priority: 5,
        category: 'analysis',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'PoT',
        dependsOn: ['requirement-extractor', 'scope-definer'],
        memoryReads: ['coding/understanding/requirements', 'coding/understanding/scope'],
        memoryWrites: ['coding/understanding/constraints', 'coding/understanding/limitations'],
        xpReward: 40,
        parallelizable: false,
        critical: false,
        description: 'Identifies technical constraints, limitations, and dependencies.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: EXPLORATION (5 agents, XP: 210)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'exploration',
        agentKey: 'solution-explorer',
        priority: 1,
        category: 'exploration',
        algorithm: 'LATS',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['constraint-analyzer'],
        memoryReads: ['coding/understanding/requirements', 'coding/understanding/constraints'],
        memoryWrites: ['coding/exploration/solutions', 'coding/exploration/options'],
        xpReward: 45,
        parallelizable: false,
        critical: false,
        description: 'Explores multiple solution approaches using tree search.',
    },
    {
        phase: 'exploration',
        agentKey: 'pattern-matcher',
        priority: 2,
        category: 'exploration',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['solution-explorer'],
        memoryReads: ['coding/exploration/solutions', 'coding/context/patterns'],
        memoryWrites: ['coding/exploration/patterns', 'coding/exploration/best-practices'],
        xpReward: 40,
        parallelizable: true,
        critical: false,
        description: 'Matches requirements against known design patterns and best practices.',
    },
    {
        phase: 'exploration',
        agentKey: 'analogy-finder',
        priority: 3,
        category: 'exploration',
        algorithm: 'ToT',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['solution-explorer'],
        memoryReads: ['coding/exploration/solutions', 'coding/context/project'],
        memoryWrites: ['coding/exploration/analogies', 'coding/exploration/similar-implementations'],
        xpReward: 35,
        parallelizable: true,
        critical: false,
        description: 'Finds similar implementations in codebase for reference.',
    },
    {
        phase: 'exploration',
        agentKey: 'prior-art-searcher',
        priority: 4,
        category: 'exploration',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['solution-explorer'],
        memoryReads: ['coding/exploration/solutions', 'coding/understanding/requirements'],
        memoryWrites: ['coding/exploration/prior-art', 'coding/exploration/references'],
        xpReward: 40,
        parallelizable: true,
        critical: false,
        description: 'Searches for prior art and existing solutions to similar problems.',
    },
    {
        phase: 'exploration',
        agentKey: 'feasibility-assessor',
        priority: 5,
        category: 'exploration',
        algorithm: 'PoT',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['pattern-matcher', 'analogy-finder', 'prior-art-searcher'],
        memoryReads: ['coding/exploration/solutions', 'coding/exploration/patterns', 'coding/understanding/constraints'],
        memoryWrites: ['coding/exploration/feasibility', 'coding/exploration/recommendation'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Assesses feasibility of solutions and recommends best approach.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: ARCHITECTURE (6 agents, XP: 305)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'architecture',
        agentKey: 'architecture-designer',
        priority: 1,
        category: 'design',
        algorithm: 'ToT',
        fallbackAlgorithm: 'LATS',
        dependsOn: ['feasibility-assessor'],
        memoryReads: ['coding/exploration/recommendation', 'coding/understanding/requirements'],
        memoryWrites: ['coding/architecture/design', 'coding/architecture/structure'],
        xpReward: 60,
        parallelizable: false,
        critical: false,
        description: 'Designs high-level architecture and system structure.',
    },
    {
        phase: 'architecture',
        agentKey: 'component-specifier',
        priority: 2,
        category: 'design',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['architecture-designer'],
        memoryReads: ['coding/architecture/design'],
        memoryWrites: ['coding/architecture/components', 'coding/architecture/modules'],
        xpReward: 45,
        parallelizable: true,
        critical: false,
        description: 'Specifies individual components and their responsibilities.',
    },
    {
        phase: 'architecture',
        agentKey: 'interface-designer',
        priority: 3,
        category: 'design',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['component-specifier'],
        memoryReads: ['coding/architecture/components'],
        memoryWrites: ['coding/architecture/interfaces', 'coding/architecture/contracts'],
        xpReward: 50,
        parallelizable: true,
        critical: false,
        description: 'Designs interfaces and contracts between components.',
    },
    {
        phase: 'architecture',
        agentKey: 'dependency-mapper',
        priority: 4,
        category: 'design',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'PoT',
        dependsOn: ['component-specifier'],
        memoryReads: ['coding/architecture/components', 'coding/architecture/interfaces'],
        memoryWrites: ['coding/architecture/dependencies', 'coding/architecture/dependency-graph'],
        xpReward: 45,
        parallelizable: true,
        critical: false,
        description: 'Maps dependencies between components and external libraries.',
    },
    {
        phase: 'architecture',
        agentKey: 'consistency-checker',
        priority: 5,
        category: 'validation',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['interface-designer', 'dependency-mapper'],
        memoryReads: ['coding/architecture/design', 'coding/architecture/interfaces', 'coding/architecture/dependencies'],
        memoryWrites: ['coding/architecture/consistency-report', 'coding/architecture/conflicts'],
        xpReward: 55,
        parallelizable: false,
        critical: true,
        description: 'Validates architecture consistency. CRITICAL: Halts if unresolved conflicts exist.',
    },
    {
        phase: 'architecture',
        agentKey: 'type-system-designer',
        priority: 6,
        category: 'design',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['consistency-checker'],
        memoryReads: ['coding/architecture/interfaces', 'coding/architecture/consistency-report'],
        memoryWrites: ['coding/architecture/types', 'coding/architecture/type-definitions'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Designs type system and type definitions for the implementation.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 4: IMPLEMENTATION (8 agents, XP: 430)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'implementation',
        agentKey: 'type-generator',
        priority: 1,
        category: 'implementation',
        algorithm: 'Self-Debug',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['type-system-designer'],
        memoryReads: ['coding/architecture/types', 'coding/architecture/interfaces'],
        memoryWrites: ['coding/implementation/types', 'coding/implementation/type-files'],
        xpReward: 55,
        parallelizable: false,
        critical: false,
        description: 'Generates TypeScript type definitions and interfaces.',
    },
    {
        phase: 'implementation',
        agentKey: 'algorithm-implementer',
        priority: 2,
        category: 'implementation',
        algorithm: 'LATS',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['type-generator'],
        memoryReads: ['coding/implementation/types', 'coding/architecture/design'],
        memoryWrites: ['coding/implementation/algorithms', 'coding/implementation/core-logic'],
        xpReward: 70,
        parallelizable: false,
        critical: false,
        description: 'Implements core algorithms and business logic.',
    },
    {
        phase: 'implementation',
        agentKey: 'data-structure-builder',
        priority: 3,
        category: 'implementation',
        algorithm: 'Self-Debug',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['type-generator'],
        memoryReads: ['coding/implementation/types', 'coding/architecture/components'],
        memoryWrites: ['coding/implementation/data-structures', 'coding/implementation/models'],
        xpReward: 55,
        parallelizable: true,
        critical: false,
        description: 'Builds data structures, models, and storage classes.',
    },
    {
        phase: 'implementation',
        agentKey: 'api-implementer',
        priority: 4,
        category: 'implementation',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['algorithm-implementer', 'data-structure-builder'],
        memoryReads: ['coding/implementation/core-logic', 'coding/architecture/interfaces'],
        memoryWrites: ['coding/implementation/api', 'coding/implementation/endpoints'],
        xpReward: 60,
        parallelizable: false,
        critical: false,
        description: 'Implements API endpoints and external interfaces.',
    },
    {
        phase: 'implementation',
        agentKey: 'integration-coder',
        priority: 5,
        category: 'implementation',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['api-implementer'],
        memoryReads: ['coding/implementation/api', 'coding/architecture/dependencies'],
        memoryWrites: ['coding/implementation/integrations', 'coding/implementation/adapters'],
        xpReward: 55,
        parallelizable: true,
        critical: false,
        description: 'Implements integrations with external systems and services.',
    },
    {
        phase: 'implementation',
        agentKey: 'error-handler',
        priority: 6,
        category: 'implementation',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['api-implementer'],
        memoryReads: ['coding/implementation/api', 'coding/implementation/core-logic'],
        memoryWrites: ['coding/implementation/error-handling', 'coding/implementation/exceptions'],
        xpReward: 50,
        parallelizable: true,
        critical: false,
        description: 'Implements error handling, exceptions, and recovery logic.',
    },
    {
        phase: 'implementation',
        agentKey: 'config-generator',
        priority: 7,
        category: 'implementation',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['integration-coder'],
        memoryReads: ['coding/implementation/integrations', 'coding/architecture/dependencies'],
        memoryWrites: ['coding/implementation/config', 'coding/implementation/settings'],
        xpReward: 40,
        parallelizable: true,
        critical: false,
        description: 'Generates configuration files and environment settings.',
    },
    {
        phase: 'implementation',
        agentKey: 'utility-generator',
        priority: 8,
        category: 'implementation',
        algorithm: 'Self-Debug',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['error-handler', 'config-generator'],
        memoryReads: ['coding/implementation/core-logic', 'coding/implementation/error-handling'],
        memoryWrites: ['coding/implementation/utilities', 'coding/implementation/helpers'],
        xpReward: 45,
        parallelizable: false,
        critical: false,
        description: 'Generates utility functions and helper classes.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 5: TESTING (8 agents, XP: 420)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'testing',
        agentKey: 'test-planner',
        priority: 1,
        category: 'testing',
        algorithm: 'ToT',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['utility-generator'],
        memoryReads: ['coding/implementation/api', 'coding/understanding/requirements'],
        memoryWrites: ['coding/testing/test-plan', 'coding/testing/test-strategy'],
        xpReward: 45,
        parallelizable: false,
        critical: false,
        description: 'Creates comprehensive test plan and testing strategy.',
    },
    {
        phase: 'testing',
        agentKey: 'unit-test-writer',
        priority: 2,
        category: 'testing',
        algorithm: 'Self-Debug',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['test-planner'],
        memoryReads: ['coding/testing/test-plan', 'coding/implementation/core-logic'],
        memoryWrites: ['coding/testing/unit-tests', 'coding/testing/unit-coverage'],
        xpReward: 60,
        parallelizable: true,
        critical: false,
        description: 'Writes unit tests for individual functions and classes.',
    },
    {
        phase: 'testing',
        agentKey: 'integration-test-writer',
        priority: 3,
        category: 'testing',
        algorithm: 'Self-Debug',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['test-planner'],
        memoryReads: ['coding/testing/test-plan', 'coding/implementation/api'],
        memoryWrites: ['coding/testing/integration-tests', 'coding/testing/integration-coverage'],
        xpReward: 55,
        parallelizable: true,
        critical: false,
        description: 'Writes integration tests for component interactions.',
    },
    {
        phase: 'testing',
        agentKey: 'edge-case-tester',
        priority: 4,
        category: 'testing',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['unit-test-writer'],
        memoryReads: ['coding/testing/unit-tests', 'coding/understanding/constraints'],
        memoryWrites: ['coding/testing/edge-cases', 'coding/testing/boundary-tests'],
        xpReward: 50,
        parallelizable: true,
        critical: false,
        description: 'Identifies and tests edge cases and boundary conditions.',
    },
    {
        phase: 'testing',
        agentKey: 'mock-generator',
        priority: 5,
        category: 'testing',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['test-planner'],
        memoryReads: ['coding/testing/test-plan', 'coding/architecture/dependencies'],
        memoryWrites: ['coding/testing/mocks', 'coding/testing/fixtures'],
        xpReward: 45,
        parallelizable: true,
        critical: false,
        description: 'Generates mocks, stubs, and test fixtures.',
    },
    {
        phase: 'testing',
        agentKey: 'test-runner',
        priority: 6,
        category: 'testing',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['unit-test-writer', 'integration-test-writer', 'mock-generator'],
        memoryReads: ['coding/testing/unit-tests', 'coding/testing/integration-tests', 'coding/testing/mocks'],
        memoryWrites: ['coding/testing/results', 'coding/testing/failures'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Executes test suites and collects results.',
    },
    {
        phase: 'testing',
        agentKey: 'bug-fixer',
        priority: 7,
        category: 'testing',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['test-runner'],
        memoryReads: ['coding/testing/failures', 'coding/implementation/core-logic'],
        memoryWrites: ['coding/testing/fixes', 'coding/testing/fix-verification'],
        xpReward: 65,
        parallelizable: false,
        critical: false,
        description: 'Fixes bugs identified during testing.',
    },
    {
        phase: 'testing',
        agentKey: 'coverage-analyzer',
        priority: 8,
        category: 'testing',
        algorithm: 'PoT',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['test-runner', 'bug-fixer'],
        memoryReads: ['coding/testing/results', 'coding/testing/unit-coverage'],
        memoryWrites: ['coding/testing/coverage-report', 'coding/testing/coverage-gaps'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Analyzes test coverage and identifies gaps.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 6: OPTIMIZATION (4 agents, XP: 225)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'optimization',
        agentKey: 'performance-optimizer',
        priority: 1,
        category: 'optimization',
        algorithm: 'PoT',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['coverage-analyzer'],
        memoryReads: ['coding/implementation/core-logic', 'coding/testing/results'],
        memoryWrites: ['coding/optimization/performance', 'coding/optimization/benchmarks'],
        xpReward: 60,
        parallelizable: false,
        critical: false,
        description: 'Optimizes performance and identifies bottlenecks.',
    },
    {
        phase: 'optimization',
        agentKey: 'refactoring-agent',
        priority: 2,
        category: 'optimization',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['performance-optimizer'],
        memoryReads: ['coding/optimization/performance', 'coding/implementation/core-logic'],
        memoryWrites: ['coding/optimization/refactoring', 'coding/optimization/improvements'],
        xpReward: 55,
        parallelizable: true,
        critical: false,
        description: 'Refactors code for maintainability and readability.',
    },
    {
        phase: 'optimization',
        agentKey: 'security-auditor',
        priority: 3,
        category: 'security',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['performance-optimizer'],
        memoryReads: ['coding/implementation/api', 'coding/implementation/error-handling'],
        memoryWrites: ['coding/optimization/security-audit', 'coding/optimization/vulnerabilities'],
        xpReward: 60,
        parallelizable: true,
        critical: false,
        description: 'Audits code for security vulnerabilities.',
    },
    {
        phase: 'optimization',
        agentKey: 'code-quality-checker',
        priority: 4,
        category: 'quality',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Reflexion',
        dependsOn: ['refactoring-agent', 'security-auditor'],
        memoryReads: ['coding/optimization/refactoring', 'coding/optimization/security-audit'],
        memoryWrites: ['coding/optimization/quality-report', 'coding/optimization/linting-issues'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Checks code quality, linting, and coding standards.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 7: DELIVERY (4 agents, XP: 230)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        phase: 'delivery',
        agentKey: 'documentation-writer',
        priority: 1,
        category: 'documentation',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['code-quality-checker'],
        memoryReads: ['coding/implementation/api', 'coding/architecture/design'],
        memoryWrites: ['coding/delivery/documentation', 'coding/delivery/api-docs'],
        xpReward: 50,
        parallelizable: false,
        critical: false,
        description: 'Writes documentation and API references.',
    },
    {
        phase: 'delivery',
        agentKey: 'code-reviewer',
        priority: 2,
        category: 'review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['documentation-writer'],
        memoryReads: ['coding/implementation/core-logic', 'coding/optimization/quality-report'],
        memoryWrites: ['coding/delivery/review-report', 'coding/delivery/review-comments'],
        xpReward: 60,
        parallelizable: true,
        critical: false,
        description: 'Performs final code review and provides feedback.',
    },
    {
        phase: 'delivery',
        agentKey: 'release-preparer',
        priority: 3,
        category: 'release',
        algorithm: 'ReAct',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['code-reviewer'],
        memoryReads: ['coding/delivery/review-report', 'coding/testing/coverage-report'],
        memoryWrites: ['coding/delivery/release-notes', 'coding/delivery/changelog'],
        xpReward: 45,
        parallelizable: true,
        critical: false,
        description: 'Prepares release notes and changelog.',
    },
    {
        phase: 'delivery',
        agentKey: 'sign-off-approver',
        priority: 4,
        category: 'approval',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ReAct',
        dependsOn: ['release-preparer'],
        memoryReads: ['coding/delivery/review-report', 'coding/delivery/release-notes', 'coding/testing/coverage-report'],
        memoryWrites: ['coding/delivery/sign-off', 'coding/delivery/approval-status'],
        xpReward: 75,
        parallelizable: false,
        critical: true,
        description: 'Final approval gate. CRITICAL: Must pass for pipeline completion.',
    },
    // ═══════════════════════════════════════════════════════════════════════════
    // SHERLOCK FORENSIC REVIEW AGENTS (#41-47)
    // All forensic reviewers are CRITICAL - they gate pipeline phase progression
    // Verdicts: INNOCENT (pass), GUILTY (fail), INSUFFICIENT_EVIDENCE (retry)
    // ═══════════════════════════════════════════════════════════════════════════
    // #41 - Phase 1 Understanding Forensic Review
    {
        phase: 'understanding',
        agentKey: 'phase-1-reviewer',
        priority: 99, // Runs last in phase
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['constraint-analyzer'], // Last agent in Phase 1
        memoryReads: [
            'coding/understanding/task-analysis',
            'coding/understanding/parsed-intent',
            'coding/understanding/requirements',
            'coding/understanding/scope',
            'coding/understanding/context',
            'coding/understanding/constraints',
        ],
        memoryWrites: ['coding/forensic/phase-1-verdict', 'coding/forensic/phase-1-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #41: Phase 1 Understanding forensic review. CRITICAL: Gates progression to Phase 2.',
    },
    // #42 - Phase 2 Exploration Forensic Review
    {
        phase: 'exploration',
        agentKey: 'phase-2-reviewer',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['feasibility-assessor'], // Last agent in Phase 2
        memoryReads: [
            'coding/exploration/solutions',
            'coding/exploration/patterns',
            'coding/exploration/analogies',
            'coding/exploration/prior-art',
            'coding/exploration/feasibility',
        ],
        memoryWrites: ['coding/forensic/phase-2-verdict', 'coding/forensic/phase-2-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #42: Phase 2 Exploration forensic review. CRITICAL: Gates progression to Phase 3.',
    },
    // #43 - Phase 3 Architecture Forensic Review
    {
        phase: 'architecture',
        agentKey: 'phase-3-reviewer',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['type-system-designer'], // Last agent in Phase 3
        memoryReads: [
            'coding/architecture/design',
            'coding/architecture/components',
            'coding/architecture/interfaces',
            'coding/architecture/dependencies',
            'coding/architecture/consistency',
            'coding/architecture/type-system',
        ],
        memoryWrites: ['coding/forensic/phase-3-verdict', 'coding/forensic/phase-3-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #43: Phase 3 Architecture forensic review. CRITICAL: Gates progression to Phase 4.',
    },
    // #44 - Phase 4 Implementation Forensic Review
    {
        phase: 'implementation',
        agentKey: 'phase-4-reviewer',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['utility-generator'], // Last agent in Phase 4
        memoryReads: [
            'coding/implementation/types',
            'coding/implementation/algorithms',
            'coding/implementation/data-structures',
            'coding/implementation/api',
            'coding/implementation/integration',
            'coding/implementation/error-handling',
            'coding/implementation/config',
            'coding/implementation/utilities',
        ],
        memoryWrites: ['coding/forensic/phase-4-verdict', 'coding/forensic/phase-4-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #44: Phase 4 Implementation forensic review. CRITICAL: Gates progression to Phase 5.',
    },
    // #45 - Phase 5 Testing Forensic Review
    {
        phase: 'testing',
        agentKey: 'phase-5-reviewer',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'Self-Debug',
        dependsOn: ['coverage-analyzer'], // Last agent in Phase 5
        memoryReads: [
            'coding/testing/plan',
            'coding/testing/unit-tests',
            'coding/testing/integration-tests',
            'coding/testing/edge-cases',
            'coding/testing/mocks',
            'coding/testing/results',
            'coding/testing/bug-fixes',
            'coding/testing/coverage-report',
        ],
        memoryWrites: ['coding/forensic/phase-5-verdict', 'coding/forensic/phase-5-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #45: Phase 5 Testing forensic review. CRITICAL: Gates progression to Phase 6.',
    },
    // #46 - Phase 6 Optimization Forensic Review
    {
        phase: 'optimization',
        agentKey: 'phase-6-reviewer',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'ToT',
        dependsOn: ['code-quality-checker'], // Last agent in Phase 6
        memoryReads: [
            'coding/optimization/performance',
            'coding/optimization/refactoring',
            'coding/optimization/security',
            'coding/optimization/quality',
        ],
        memoryWrites: ['coding/forensic/phase-6-verdict', 'coding/forensic/phase-6-evidence'],
        xpReward: 100,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #46: Phase 6 Optimization forensic review. CRITICAL: Gates progression to Phase 7.',
    },
    // #47 - Phase 7 Delivery Forensic Review / Recovery Agent
    {
        phase: 'delivery',
        agentKey: 'recovery-agent',
        priority: 99,
        category: 'forensic-review',
        algorithm: 'Reflexion',
        fallbackAlgorithm: 'LATS',
        dependsOn: ['sign-off-approver'], // Last agent in Phase 7
        memoryReads: [
            'coding/delivery/documentation',
            'coding/delivery/review-report',
            'coding/delivery/release-notes',
            'coding/delivery/sign-off',
            'coding/forensic/phase-1-verdict',
            'coding/forensic/phase-2-verdict',
            'coding/forensic/phase-3-verdict',
            'coding/forensic/phase-4-verdict',
            'coding/forensic/phase-5-verdict',
            'coding/forensic/phase-6-verdict',
        ],
        memoryWrites: ['coding/forensic/phase-7-verdict', 'coding/forensic/final-report', 'coding/forensic/recovery-plan'],
        xpReward: 150,
        parallelizable: false,
        critical: true,
        description: 'Sherlock #47: Phase 7 Delivery forensic review and recovery orchestration. CRITICAL: Final pipeline gate and recovery coordinator.',
    },
];
// ═══════════════════════════════════════════════════════════════════════════
// CODING PIPELINE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Get all agents for a specific phase.
 *
 * @param phase - The pipeline phase to get agents for
 * @returns Array of agent mappings for the phase, sorted by priority
 */
export function getAgentsForPhase(phase) {
    return CODING_PIPELINE_MAPPINGS
        .filter(agent => agent.phase === phase)
        .sort((a, b) => a.priority - b.priority);
}
/**
 * Build the complete pipeline DAG from agent mappings.
 *
 * @returns Complete DAG structure for pipeline execution
 */
export function buildPipelineDAG() {
    const nodes = new Map();
    const phases = new Map();
    // Initialize phases map
    for (const phase of PHASE_ORDER) {
        phases.set(phase, []);
    }
    // Create nodes for each agent
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        const node = {
            agentKey: mapping.agentKey,
            phase: mapping.phase,
            dependsOn: mapping.dependsOn ?? [],
            dependents: [],
        };
        nodes.set(mapping.agentKey, node);
        phases.get(mapping.phase).push(mapping.agentKey);
    }
    // Build dependents (reverse dependencies)
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        if (mapping.dependsOn) {
            for (const dep of mapping.dependsOn) {
                const depNode = nodes.get(dep);
                if (depNode) {
                    depNode.dependents.push(mapping.agentKey);
                }
            }
        }
    }
    // Build topological order using Kahn's algorithm
    const topologicalOrder = [];
    const inDegree = new Map();
    // Initialize in-degrees
    for (const [agentKey, node] of nodes) {
        inDegree.set(agentKey, node.dependsOn.length);
    }
    // Find all nodes with no dependencies
    const queue = [];
    for (const [agentKey, degree] of inDegree) {
        if (degree === 0) {
            queue.push(agentKey);
        }
    }
    // Process queue
    while (queue.length > 0) {
        const agentKey = queue.shift();
        topologicalOrder.push(agentKey);
        const node = nodes.get(agentKey);
        for (const dependent of node.dependents) {
            const newDegree = inDegree.get(dependent) - 1;
            inDegree.set(dependent, newDegree);
            if (newDegree === 0) {
                queue.push(dependent);
            }
        }
    }
    return {
        nodes,
        phases,
        topologicalOrder,
        checkpointPhases: CHECKPOINT_PHASES,
    };
}
/**
 * Get all critical agents that halt the pipeline on failure.
 *
 * @returns Array of critical agent mappings
 */
export function getCriticalAgents() {
    return CODING_PIPELINE_MAPPINGS.filter(agent => agent.critical === true);
}
/**
 * Get a specific agent mapping by key.
 *
 * @param key - The agent key to find
 * @returns The agent mapping or undefined if not found
 */
export function getAgentByKey(key) {
    return CODING_PIPELINE_MAPPINGS.find(agent => agent.agentKey === key);
}
/**
 * Get the total XP available in the pipeline.
 *
 * @returns Total XP reward sum across all agents
 */
export function getTotalPipelineXP() {
    return CODING_PIPELINE_MAPPINGS.reduce((sum, agent) => sum + agent.xpReward, 0);
}
/**
 * Get XP totals grouped by phase.
 *
 * @returns Map of phase to total XP for that phase
 */
export function getPhaseXPTotals() {
    const totals = new Map();
    for (const phase of PHASE_ORDER) {
        const phaseAgents = CODING_PIPELINE_MAPPINGS.filter(a => a.phase === phase);
        const phaseXP = phaseAgents.reduce((sum, agent) => sum + agent.xpReward, 0);
        totals.set(phase, phaseXP);
    }
    return totals;
}
/**
 * Validate that all dependencies are valid.
 *
 * @returns Array of validation errors (empty if valid)
 */
export function validatePipelineDependencies() {
    const errors = [];
    const agentKeys = new Set(CODING_PIPELINE_MAPPINGS.map(a => a.agentKey));
    for (const mapping of CODING_PIPELINE_MAPPINGS) {
        if (mapping.dependsOn) {
            for (const dep of mapping.dependsOn) {
                if (!agentKeys.has(dep)) {
                    errors.push(`Agent "${mapping.agentKey}" depends on unknown agent "${dep}"`);
                }
            }
        }
    }
    // Check for cycles
    const dag = buildPipelineDAG();
    if (dag.topologicalOrder.length !== TOTAL_AGENTS) {
        errors.push(`Cycle detected: topological order has ${dag.topologicalOrder.length} agents but expected ${TOTAL_AGENTS}`);
    }
    return errors;
}
// ==================== CommandTaskBridge Class ====================
/**
 * Bridges Claude Code commands to Task() subagent spawning.
 *
 * RULE-008: Commands must spawn Task() subagents, never execute directly.
 *
 * @example
 * ```typescript
 * const bridge = new CommandTaskBridge({ verbose: true });
 *
 * // Analyze complexity
 * const analysis = bridge.analyzeTaskComplexity("implement auth and test it");
 * console.log(analysis.score); // 0.7 (multi-step detected)
 *
 * // Check if pipeline needed
 * const decision = bridge.shouldUsePipeline("implement auth and test it");
 * if (decision.usePipeline) {
 *   const pipeline = bridge.buildPipelineDefinition("implement auth and test it");
 *   await agent.runPipeline(pipeline);
 * }
 * ```
 */
export class CommandTaskBridge {
    config;
    phaseMappings;
    constructor(config = {}) {
        this.config = {
            pipelineThreshold: config.pipelineThreshold ?? DEFAULT_PIPELINE_THRESHOLD,
            verbose: config.verbose ?? false,
            phaseMappings: config.phaseMappings ?? new Map()
        };
        // Initialize phase mappings with defaults + custom
        this.phaseMappings = new Map(DEFAULT_PHASE_MAPPINGS.map(m => [m.phase, m]));
        // Override with custom mappings
        if (config.phaseMappings) {
            for (const [phase, mapping] of config.phaseMappings) {
                this.phaseMappings.set(phase, mapping);
            }
        }
    }
    /**
     * Analyze task complexity to determine if pipeline is needed.
     *
     * Implements FR-019: Multi-Step Task Detection
     *
     * @param task - The task description to analyze
     * @returns Complexity analysis with score and detected patterns
     */
    analyzeTaskComplexity(task) {
        const normalizedTask = task.toLowerCase();
        let score = 0;
        const detectedPhases = [];
        const detectedDocuments = [];
        const detectedActions = [];
        const reasons = [];
        // 1. Check for phase keywords
        for (const phase of PHASE_KEYWORDS) {
            if (normalizedTask.includes(phase)) {
                detectedPhases.push(phase);
                score += 0.15;
                reasons.push(`Phase keyword "${phase}" detected`);
            }
        }
        // 2. Check for document creation keywords
        for (const doc of DOCUMENT_KEYWORDS) {
            if (normalizedTask.includes(doc)) {
                detectedDocuments.push(doc);
                score += 0.2;
                reasons.push(`Document type "${doc}" detected`);
            }
        }
        // 3. Check for multi-step patterns
        for (const pattern of MULTI_STEP_PATTERNS) {
            const matches = normalizedTask.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const words = match.split(/\s+/).filter(w => !['and', 'then', 'create', 'first', 'step', 'phase'].includes(w.toLowerCase()));
                    for (const word of words) {
                        if (!detectedActions.includes(word)) {
                            detectedActions.push(word);
                        }
                    }
                }
                score += 0.25;
                reasons.push(`Multi-step pattern detected: ${matches[0]}`);
            }
            // Reset lastIndex for global patterns
            pattern.lastIndex = 0;
        }
        // 4. Check for connector words (indicates sequential work)
        const connectorCount = CONNECTOR_WORDS.filter(c => normalizedTask.includes(c)).length;
        if (connectorCount > 0) {
            score += connectorCount * 0.1;
            reasons.push(`${connectorCount} connector word(s) indicating sequence`);
        }
        // 5. Count unique action verbs
        const actionVerbs = ['create', 'build', 'implement', 'write', 'design', 'test', 'review', 'deploy'];
        const verbCount = actionVerbs.filter(v => normalizedTask.includes(v)).length;
        if (verbCount >= 2) {
            score += (verbCount - 1) * 0.1;
            reasons.push(`${verbCount} distinct action verbs detected`);
        }
        // 6. Task length heuristic (longer = likely more complex)
        const wordCount = task.split(/\s+/).length;
        if (wordCount > 15) {
            score += 0.1;
            reasons.push(`Task length (${wordCount} words) suggests complexity`);
        }
        // Normalize score to 0-1 range
        score = Math.min(1, Math.max(0, score));
        // Determine if multi-step based on analysis
        const isMultiStep = detectedPhases.length >= 2 ||
            detectedDocuments.length >= 2 ||
            detectedActions.length >= 2 ||
            connectorCount >= 2;
        if (this.config.verbose) {
            console.log(`[CommandTaskBridge] Complexity analysis for: "${task.substring(0, 50)}..."`);
            console.log(`[CommandTaskBridge] Score: ${score.toFixed(2)}, Multi-step: ${isMultiStep}`);
        }
        return {
            score,
            isMultiStep,
            detectedPhases,
            detectedDocuments,
            detectedActions,
            reasoning: reasons.length > 0 ? reasons.join('; ') : 'Simple single-step task'
        };
    }
    /**
     * Determine if a pipeline should be used for the given task.
     *
     * Implements US-018: Complex Task Pipeline Triggering
     *
     * @param task - The task description
     * @returns Decision with reasoning and suggested steps
     */
    shouldUsePipeline(task) {
        const complexity = this.analyzeTaskComplexity(task);
        // Decision factors
        const exceedsThreshold = complexity.score >= this.config.pipelineThreshold;
        const isMultiStep = complexity.isMultiStep;
        const hasMultipleDocuments = complexity.detectedDocuments.length >= 2;
        const hasMultiplePhases = complexity.detectedPhases.length >= 2;
        // Determine if pipeline should be used
        const usePipeline = exceedsThreshold && (isMultiStep || hasMultipleDocuments || hasMultiplePhases);
        let reason;
        let suggestedSteps;
        if (usePipeline) {
            reason = `Complexity score ${complexity.score.toFixed(2)} >= ${this.config.pipelineThreshold} threshold`;
            // Build suggested steps from detected phases/documents
            suggestedSteps = [];
            // Add phases first
            for (const phase of complexity.detectedPhases) {
                if (!suggestedSteps.includes(phase)) {
                    suggestedSteps.push(phase);
                }
            }
            // Add document creation steps
            for (const doc of complexity.detectedDocuments) {
                const step = `create ${doc}`;
                if (!suggestedSteps.includes(step)) {
                    suggestedSteps.push(step);
                }
            }
            // Default to a basic pipeline if nothing detected but score is high
            if (suggestedSteps.length === 0) {
                suggestedSteps = ['analyze', 'implement', 'validate'];
                reason += '; Using default analyze-implement-validate pipeline';
            }
            if (this.config.verbose) {
                console.log(`[CommandTaskBridge] Pipeline recommended: ${suggestedSteps.join(' -> ')}`);
            }
        }
        else {
            reason = complexity.score < this.config.pipelineThreshold
                ? `Complexity score ${complexity.score.toFixed(2)} below ${this.config.pipelineThreshold} threshold`
                : 'Single-step task detected';
            if (this.config.verbose) {
                console.log(`[CommandTaskBridge] Single agent execution recommended`);
            }
        }
        return {
            usePipeline,
            reason,
            suggestedSteps,
            complexity
        };
    }
    /**
     * Build a pipeline definition from a complex task.
     *
     * Implements FR-017, FR-018, FR-019
     *
     * @param task - The task description
     * @param taskType - Type of task (code, ask, research, write)
     * @param baseName - Optional base name for the pipeline
     * @returns Pipeline definition ready for execution
     * @throws PipelineDefinitionError if pipeline cannot be built
     */
    buildPipelineDefinition(task, taskType = 'code', baseName) {
        const decision = this.shouldUsePipeline(task);
        if (!decision.usePipeline || !decision.suggestedSteps) {
            throw new PipelineDefinitionError('Task does not require a pipeline. Use single agent execution.', {
                pipelineName: baseName ?? 'unknown',
                invalidField: 'task',
                details: {
                    complexityScore: decision.complexity.score,
                    threshold: this.config.pipelineThreshold
                }
            });
        }
        const steps = [];
        const pipelineName = baseName ?? this.generatePipelineName(task, taskType);
        // Build steps from suggested phases
        for (let i = 0; i < decision.suggestedSteps.length; i++) {
            const step = decision.suggestedSteps[i];
            const phaseKey = this.extractPhaseKey(step);
            const mapping = this.phaseMappings.get(phaseKey) ?? this.getDefaultMapping(phaseKey, taskType);
            // Determine input domain (from previous step)
            const inputDomain = i > 0
                ? steps[i - 1].outputDomain
                : undefined;
            const inputTags = i > 0
                ? steps[i - 1].outputTags
                : undefined;
            // Build the step
            const pipelineStep = {
                agentKey: mapping.agentKey,
                task: mapping.taskTemplate.replace('{task}', task),
                inputDomain,
                inputTags,
                outputDomain: mapping.outputDomain,
                outputTags: [...mapping.outputTags, pipelineName.replace(/\s+/g, '-').toLowerCase()]
            };
            steps.push(pipelineStep);
        }
        if (steps.length === 0) {
            throw new PipelineDefinitionError('Could not build any pipeline steps from task', {
                pipelineName,
                invalidField: 'agents',
                details: { task, suggestedSteps: decision.suggestedSteps }
            });
        }
        const pipeline = {
            name: pipelineName,
            description: `Auto-generated pipeline for: ${task.substring(0, 100)}`,
            agents: steps,
            sequential: true,
            metadata: {
                taskType,
                originalTask: task,
                complexityScore: decision.complexity.score,
                generatedAt: new Date().toISOString()
            }
        };
        if (this.config.verbose) {
            console.log(`[CommandTaskBridge] Built pipeline "${pipelineName}" with ${steps.length} steps`);
            console.log(`[CommandTaskBridge] Agents: ${steps.map(s => s.agentKey).join(' -> ')}`);
        }
        return pipeline;
    }
    /**
     * Get the appropriate single agent for a simple task.
     *
     * Used when shouldUsePipeline() returns false.
     *
     * @param task - The task description
     * @param taskType - Type of task
     * @returns Agent key to use
     */
    getSingleAgent(task, taskType) {
        const normalizedTask = task.toLowerCase();
        // Check for specific document types first
        for (const [docType, agentKey] of Object.entries(DOCUMENT_AGENT_MAPPING)) {
            if (normalizedTask.includes(docType)) {
                return agentKey;
            }
        }
        // Check for phase keywords
        for (const phase of PHASE_KEYWORDS) {
            if (normalizedTask.includes(phase)) {
                const mapping = this.phaseMappings.get(phase);
                if (mapping) {
                    return mapping.agentKey;
                }
            }
        }
        // Default based on task type
        switch (taskType) {
            case 'code':
                return 'backend-dev';
            case 'ask':
                return 'ambiguity-clarifier';
            case 'research':
                return 'researcher';
            case 'write':
                return 'documentation-specialist';
            default:
                return 'backend-dev';
        }
    }
    /**
     * Generate a descriptive pipeline name from task.
     */
    generatePipelineName(task, taskType) {
        // Extract first few meaningful words
        const words = task
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !['that', 'this', 'with', 'from', 'into'].includes(w))
            .slice(0, 3);
        const base = words.length > 0 ? words.join('-') : taskType;
        return `${taskType}-${base}-pipeline`;
    }
    /**
     * Extract the phase key from a step description.
     */
    extractPhaseKey(step) {
        const normalizedStep = step.toLowerCase();
        // Direct match with phase keywords
        for (const phase of PHASE_KEYWORDS) {
            if (normalizedStep.includes(phase)) {
                return phase;
            }
        }
        // Check document types and map to phases
        for (const [docType, _] of Object.entries(DOCUMENT_AGENT_MAPPING)) {
            if (normalizedStep.includes(docType)) {
                return 'document';
            }
        }
        // Default to implement for unrecognized steps
        return 'implement';
    }
    /**
     * Get a default mapping for an unknown phase.
     */
    getDefaultMapping(phaseKey, taskType) {
        // Try to get from existing mappings
        const existing = this.phaseMappings.get(phaseKey);
        if (existing)
            return existing;
        // Create a default based on task type
        const defaultAgents = {
            code: 'backend-dev',
            ask: 'ambiguity-clarifier',
            research: 'researcher',
            write: 'documentation-specialist',
            unknown: 'backend-dev'
        };
        return {
            phase: phaseKey,
            agentKey: defaultAgents[taskType],
            outputDomain: `project/${phaseKey}`,
            outputTags: [phaseKey, taskType],
            taskTemplate: `Execute ${phaseKey} phase: {task}`
        };
    }
    /**
     * Get all available phase mappings.
     */
    getPhaseMappings() {
        return new Map(this.phaseMappings);
    }
    /**
     * Get the configured pipeline threshold.
     */
    getThreshold() {
        return this.config.pipelineThreshold;
    }
}
// ==================== Factory Function ====================
/**
 * Create a CommandTaskBridge instance.
 *
 * @param config - Configuration options
 * @returns Configured CommandTaskBridge instance
 */
export function createCommandTaskBridge(config = {}) {
    return new CommandTaskBridge(config);
}
//# sourceMappingURL=command-task-bridge.js.map