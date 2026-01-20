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

import { type IPipelineDefinition, type IPipelineStep } from './dai-002-types.js';
import { PipelineDefinitionError } from './pipeline-errors.js';

// ==================== Coding Pipeline Types ====================
// Import types from types.ts with aliasing to avoid collision with local IAgentMapping

import type {
  IAgentMapping as ICodingAgentMapping,
  CodingPipelinePhase,
  CodingPipelineAgent,
  AlgorithmType,
  IPipelineDAG,
  IPipelineDAGNode,
} from './types.js';

import {
  PHASE_ORDER,
  CHECKPOINT_PHASES,
  CRITICAL_AGENTS,
  TOTAL_AGENTS,
  PHASE_AGENT_COUNTS,
  CODING_MEMORY_NAMESPACE,
  MEMORY_PREFIXES,
} from './types.js';

// ==================== Types ====================

/**
 * Result of task complexity analysis.
 */
export interface IComplexityAnalysis {
  /** Complexity score from 0 to 1 */
  score: number;
  /** Whether task requires multiple agents */
  isMultiStep: boolean;
  /** Detected phases in the task */
  detectedPhases: string[];
  /** Detected document types to create */
  detectedDocuments: string[];
  /** Detected action verbs indicating steps */
  detectedActions: string[];
  /** Reasoning for the complexity score */
  reasoning: string;
}

/**
 * Result of pipeline detection.
 */
export interface IPipelineDecision {
  /** Whether to use a pipeline */
  usePipeline: boolean;
  /** Reason for the decision */
  reason: string;
  /** Suggested pipeline steps if applicable */
  suggestedSteps?: string[];
  /** Complexity analysis details */
  complexity: IComplexityAnalysis;
}

/**
 * Task type mapping for agent selection.
 */
export type TaskType = 'code' | 'ask' | 'research' | 'write' | 'unknown';

/**
 * Agent mapping for different task types and phases.
 */
export interface IAgentMapping {
  /** Phase name (e.g., 'plan', 'implement', 'test') */
  phase: string;
  /** Recommended agent key */
  agentKey: string;
  /** Domain for output storage */
  outputDomain: string;
  /** Tags for output storage */
  outputTags: string[];
  /** Task template for this phase */
  taskTemplate: string;
}

/**
 * Configuration for CommandTaskBridge.
 */
export interface ICommandTaskBridgeConfig {
  /** Complexity threshold for triggering pipeline (default: 0.6) */
  pipelineThreshold?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom phase mappings */
  phaseMappings?: Map<string, IAgentMapping>;
}

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
  /(\w+)\s+and\s+(\w+)(?:\s+and\s+(\w+))?/gi,  // "plan and implement and test"
  /first\s+(\w+).*then\s+(\w+)/gi,              // "first analyze, then implement"
  /step\s*\d+|phase\s*\d+/gi,                    // "step 1", "phase 2"
  /create\s+(\w+),?\s+(\w+)(?:,?\s+and\s+(\w+))?/gi  // "create PRD, spec, and docs"
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
export const DEFAULT_PHASE_MAPPINGS: IAgentMapping[] = [
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
export const DOCUMENT_AGENT_MAPPING: Record<string, string> = {
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
// CODING PIPELINE AGENT MAPPINGS (47 Agents, 7 Phases)
// REQ-PIPE-047: Matches actual .claude/agents/coding-pipeline/*.md files
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete mapping of all 47 agents in the coding pipeline.
 *
 * Phase Distribution (40 Core + 7 Sherlock Forensic = 47 Total):
 * - Phase 1 (Understanding): 6 agents + Sherlock #41
 * - Phase 2 (Exploration): 4 agents   + Sherlock #42
 * - Phase 3 (Architecture): 5 agents  + Sherlock #43
 * - Phase 4 (Implementation): 12 agents + Sherlock #44
 * - Phase 5 (Testing): 7 agents       + Sherlock #45
 * - Phase 6 (Optimization): 5 agents  + Sherlock #46
 * - Phase 7 (Delivery): 1 agent       + Sherlock #47 (Recovery)
 *
 * Total: 47 agents (40 core + 7 Sherlock)
 *
 * @see SPEC-001-architecture.md
 * @see constitution.xml
 */
export const CODING_PIPELINE_MAPPINGS: ICodingAgentMapping[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: UNDERSTANDING (6 agents)
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
    description: 'Parses and structures coding requests into actionable components. CRITICAL agent - pipeline entry point.',
  },
  {
    phase: 'understanding',
    agentKey: 'requirement-extractor',
    priority: 2,
    category: 'analysis',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['task-analyzer'],
    memoryReads: ['coding/understanding/task-analysis'],
    memoryWrites: ['coding/understanding/requirements', 'coding/understanding/functional-requirements'],
    xpReward: 45,
    parallelizable: true,
    critical: false,
    description: 'Extracts functional and non-functional requirements from parsed task analysis.',
  },
  {
    phase: 'understanding',
    agentKey: 'requirement-prioritizer',
    priority: 3,
    category: 'analysis',
    algorithm: 'PoT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['requirement-extractor'],
    memoryReads: ['coding/understanding/requirements'],
    memoryWrites: ['coding/understanding/prioritized-requirements'],
    xpReward: 40,
    parallelizable: false,
    critical: false,
    description: 'Applies MoSCoW prioritization to requirements, enabling focused delivery.',
  },
  {
    phase: 'understanding',
    agentKey: 'scope-definer',
    priority: 4,
    category: 'analysis',
    algorithm: 'ToT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['requirement-prioritizer'],
    memoryReads: ['coding/understanding/prioritized-requirements'],
    memoryWrites: ['coding/understanding/scope', 'coding/understanding/boundaries'],
    xpReward: 45,
    parallelizable: false,
    critical: false,
    description: 'Defines clear boundaries, deliverables, and milestones for the coding task.',
  },
  {
    phase: 'understanding',
    agentKey: 'context-gatherer',
    priority: 5,
    category: 'analysis',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['task-analyzer'],
    memoryReads: ['coding/understanding/task-analysis', 'coding/context/project'],
    memoryWrites: ['coding/understanding/context', 'coding/understanding/existing-code'],
    xpReward: 45,
    parallelizable: true,
    critical: false,
    description: 'Gathers codebase context via LEANN semantic search using ReAct reasoning.',
  },
  {
    phase: 'understanding',
    agentKey: 'feasibility-analyzer',
    priority: 6,
    category: 'analysis',
    algorithm: 'PoT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['scope-definer', 'context-gatherer'],
    memoryReads: ['coding/understanding/scope', 'coding/understanding/context'],
    memoryWrites: ['coding/understanding/feasibility', 'coding/understanding/constraints'],
    xpReward: 50,
    parallelizable: false,
    critical: false,
    description: 'Assesses technical, resource, and timeline feasibility of proposed implementation.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: EXPLORATION (4 agents)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'exploration',
    agentKey: 'pattern-explorer',
    priority: 1,
    category: 'exploration',
    algorithm: 'LATS',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['feasibility-analyzer'],
    memoryReads: ['coding/understanding/requirements', 'coding/understanding/constraints'],
    memoryWrites: ['coding/exploration/patterns', 'coding/exploration/best-practices'],
    xpReward: 45,
    parallelizable: false,
    critical: false,
    description: 'Explores and documents existing code patterns that can guide implementation decisions.',
  },
  {
    phase: 'exploration',
    agentKey: 'technology-scout',
    priority: 2,
    category: 'exploration',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['pattern-explorer'],
    memoryReads: ['coding/exploration/patterns', 'coding/understanding/requirements'],
    memoryWrites: ['coding/exploration/technologies', 'coding/exploration/recommendations'],
    xpReward: 40,
    parallelizable: true,
    critical: false,
    description: 'Evaluates technology options and external solutions that could address implementation needs.',
  },
  {
    phase: 'exploration',
    agentKey: 'research-planner',
    priority: 3,
    category: 'exploration',
    algorithm: 'ToT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['pattern-explorer'],
    memoryReads: ['coding/exploration/patterns', 'coding/understanding/scope'],
    memoryWrites: ['coding/exploration/research-plan', 'coding/exploration/unknowns'],
    xpReward: 35,
    parallelizable: true,
    critical: false,
    description: 'Creates structured research plans to investigate implementation approaches and unknowns.',
  },
  {
    phase: 'exploration',
    agentKey: 'codebase-analyzer',
    priority: 4,
    category: 'exploration',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['technology-scout', 'research-planner'],
    memoryReads: ['coding/exploration/technologies', 'coding/understanding/context'],
    memoryWrites: ['coding/exploration/codebase-analysis', 'coding/exploration/integration-points'],
    xpReward: 50,
    parallelizable: false,
    critical: false,
    description: 'Performs deep analysis of relevant code sections to understand implementation context.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: ARCHITECTURE (5 agents)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'architecture',
    agentKey: 'system-designer',
    priority: 1,
    category: 'design',
    algorithm: 'ToT',
    fallbackAlgorithm: 'LATS',
    dependsOn: ['codebase-analyzer'],
    memoryReads: ['coding/exploration/codebase-analysis', 'coding/understanding/requirements'],
    memoryWrites: ['coding/architecture/design', 'coding/architecture/structure'],
    xpReward: 60,
    parallelizable: false,
    critical: false,
    description: 'Designs high-level system architecture, module boundaries, and component relationships.',
  },
  {
    phase: 'architecture',
    agentKey: 'component-designer',
    priority: 2,
    category: 'design',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['system-designer'],
    memoryReads: ['coding/architecture/design'],
    memoryWrites: ['coding/architecture/components', 'coding/architecture/modules'],
    xpReward: 45,
    parallelizable: true,
    critical: false,
    description: 'Designs internal component structure, class hierarchies, and implementation details.',
  },
  {
    phase: 'architecture',
    agentKey: 'interface-designer',
    priority: 3,
    category: 'design',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['component-designer'],
    memoryReads: ['coding/architecture/components'],
    memoryWrites: ['coding/architecture/interfaces', 'coding/architecture/contracts'],
    xpReward: 50,
    parallelizable: true,
    critical: true,
    description: 'Designs API contracts, type definitions, and interface specifications.',
  },
  {
    phase: 'architecture',
    agentKey: 'data-architect',
    priority: 4,
    category: 'design',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'PoT',
    dependsOn: ['component-designer'],
    memoryReads: ['coding/architecture/components', 'coding/architecture/interfaces'],
    memoryWrites: ['coding/architecture/data-models', 'coding/architecture/schemas'],
    xpReward: 45,
    parallelizable: true,
    critical: false,
    description: 'Designs data models, database schemas, and data persistence strategies.',
  },
  {
    phase: 'architecture',
    agentKey: 'integration-architect',
    priority: 5,
    category: 'design',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['interface-designer', 'data-architect'],
    memoryReads: ['coding/architecture/interfaces', 'coding/architecture/data-models'],
    memoryWrites: ['coding/architecture/integrations', 'coding/architecture/dependencies'],
    xpReward: 55,
    parallelizable: false,
    critical: false,
    description: 'Designs integration patterns, external API connections, and system interoperability.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: IMPLEMENTATION (12 agents)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'implementation',
    agentKey: 'code-generator',
    priority: 1,
    category: 'implementation',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['integration-architect'],
    memoryReads: ['coding/architecture/design', 'coding/architecture/interfaces'],
    memoryWrites: ['coding/implementation/generated-code', 'coding/implementation/core-files'],
    xpReward: 70,
    parallelizable: false,
    critical: false,
    description: 'Generates clean, production-ready code following architecture specifications.',
  },
  {
    phase: 'implementation',
    agentKey: 'type-implementer',
    priority: 2,
    category: 'implementation',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['code-generator'],
    memoryReads: ['coding/architecture/interfaces', 'coding/implementation/generated-code'],
    memoryWrites: ['coding/implementation/types', 'coding/implementation/type-files'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Implements TypeScript type definitions, interfaces, generics, and type utilities.',
  },
  {
    phase: 'implementation',
    agentKey: 'unit-implementer',
    priority: 3,
    category: 'implementation',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['type-implementer'],
    memoryReads: ['coding/implementation/types', 'coding/architecture/components'],
    memoryWrites: ['coding/implementation/units', 'coding/implementation/entities'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Implements domain entities, value objects, and core business logic units.',
  },
  {
    phase: 'implementation',
    agentKey: 'service-implementer',
    priority: 4,
    category: 'implementation',
    algorithm: 'LATS',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['unit-implementer'],
    memoryReads: ['coding/implementation/units', 'coding/architecture/design'],
    memoryWrites: ['coding/implementation/services', 'coding/implementation/business-logic'],
    xpReward: 60,
    parallelizable: false,
    critical: false,
    description: 'Implements domain services, business logic, and application use cases.',
  },
  {
    phase: 'implementation',
    agentKey: 'data-layer-implementer',
    priority: 5,
    category: 'implementation',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['unit-implementer'],
    memoryReads: ['coding/implementation/units', 'coding/architecture/data-models'],
    memoryWrites: ['coding/implementation/data-layer', 'coding/implementation/repositories'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Implements repositories, database access, and data persistence layer.',
  },
  {
    phase: 'implementation',
    agentKey: 'api-implementer',
    priority: 6,
    category: 'implementation',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['service-implementer', 'data-layer-implementer'],
    memoryReads: ['coding/implementation/services', 'coding/architecture/interfaces'],
    memoryWrites: ['coding/implementation/api', 'coding/implementation/endpoints'],
    xpReward: 60,
    parallelizable: false,
    critical: false,
    description: 'Implements REST/GraphQL API endpoints, controllers, and request validation.',
  },
  {
    phase: 'implementation',
    agentKey: 'frontend-implementer',
    priority: 7,
    category: 'implementation',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['api-implementer'],
    memoryReads: ['coding/implementation/api', 'coding/architecture/components'],
    memoryWrites: ['coding/implementation/frontend', 'coding/implementation/ui-components'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Implements UI components, pages, state management, and client-side logic.',
  },
  {
    phase: 'implementation',
    agentKey: 'error-handler-implementer',
    priority: 8,
    category: 'implementation',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['api-implementer'],
    memoryReads: ['coding/implementation/api', 'coding/implementation/services'],
    memoryWrites: ['coding/implementation/error-handling', 'coding/implementation/exceptions'],
    xpReward: 50,
    parallelizable: true,
    critical: false,
    description: 'Implements error handling strategies, recovery mechanisms, and error reporting.',
  },
  {
    phase: 'implementation',
    agentKey: 'config-implementer',
    priority: 9,
    category: 'implementation',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['frontend-implementer'],
    memoryReads: ['coding/implementation/api', 'coding/architecture/dependencies'],
    memoryWrites: ['coding/implementation/config', 'coding/implementation/settings'],
    xpReward: 40,
    parallelizable: true,
    critical: false,
    description: 'Implements configuration management, environment handling, and feature flags.',
  },
  {
    phase: 'implementation',
    agentKey: 'logger-implementer',
    priority: 10,
    category: 'implementation',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['error-handler-implementer'],
    memoryReads: ['coding/implementation/error-handling', 'coding/implementation/services'],
    memoryWrites: ['coding/implementation/logging', 'coding/implementation/observability'],
    xpReward: 45,
    parallelizable: true,
    critical: false,
    description: 'Implements logging infrastructure, log formatting, and observability patterns.',
  },
  {
    phase: 'implementation',
    agentKey: 'dependency-manager',
    priority: 11,
    category: 'implementation',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['config-implementer', 'logger-implementer'],
    memoryReads: ['coding/implementation/config', 'coding/architecture/dependencies'],
    memoryWrites: ['coding/implementation/dependencies', 'coding/implementation/package-json'],
    xpReward: 40,
    parallelizable: false,
    critical: false,
    description: 'Manages package dependencies, version resolution, and module organization.',
  },
  {
    phase: 'implementation',
    agentKey: 'implementation-coordinator',
    priority: 12,
    category: 'implementation',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['dependency-manager'],
    memoryReads: ['coding/implementation/generated-code', 'coding/implementation/services', 'coding/implementation/api'],
    memoryWrites: ['coding/implementation/coordination-report', 'coding/implementation/integration-status'],
    xpReward: 55,
    parallelizable: false,
    critical: false,
    description: 'Coordinates implementation across all agents, manages dependencies, and ensures consistency.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: TESTING (7 agents)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'testing',
    agentKey: 'test-generator',
    priority: 1,
    category: 'testing',
    algorithm: 'ToT',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['implementation-coordinator'],
    memoryReads: ['coding/implementation/services', 'coding/understanding/requirements'],
    memoryWrites: ['coding/testing/generated-tests', 'coding/testing/test-files'],
    xpReward: 55,
    parallelizable: false,
    critical: false,
    description: 'Generates comprehensive test suites including unit, integration, and e2e tests.',
  },
  {
    phase: 'testing',
    agentKey: 'test-runner',
    priority: 2,
    category: 'testing',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['test-generator'],
    memoryReads: ['coding/testing/generated-tests', 'coding/implementation/services'],
    memoryWrites: ['coding/testing/results', 'coding/testing/failures'],
    xpReward: 50,
    parallelizable: false,
    critical: false,
    description: 'Orchestrates and executes all test suites, managing test lifecycle and reporting results.',
  },
  {
    phase: 'testing',
    agentKey: 'integration-tester',
    priority: 3,
    category: 'testing',
    algorithm: 'Self-Debug',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['test-runner'],
    memoryReads: ['coding/testing/results', 'coding/implementation/api'],
    memoryWrites: ['coding/testing/integration-tests', 'coding/testing/integration-results'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Creates and executes integration tests verifying component interactions and system behavior.',
  },
  {
    phase: 'testing',
    agentKey: 'regression-tester',
    priority: 4,
    category: 'testing',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['test-runner'],
    memoryReads: ['coding/testing/results', 'coding/understanding/context'],
    memoryWrites: ['coding/testing/regression-tests', 'coding/testing/breaking-changes'],
    xpReward: 50,
    parallelizable: true,
    critical: false,
    description: 'Performs regression testing to detect unintended changes and compares against baselines.',
  },
  {
    phase: 'testing',
    agentKey: 'security-tester',
    priority: 5,
    category: 'testing',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['integration-tester'],
    memoryReads: ['coding/testing/integration-results', 'coding/implementation/api'],
    memoryWrites: ['coding/testing/security-tests', 'coding/testing/vulnerabilities'],
    xpReward: 60,
    parallelizable: true,
    critical: false,
    description: 'Performs security testing including vulnerability scanning and compliance verification.',
  },
  {
    phase: 'testing',
    agentKey: 'coverage-analyzer',
    priority: 6,
    category: 'testing',
    algorithm: 'PoT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['regression-tester', 'security-tester'],
    memoryReads: ['coding/testing/results', 'coding/testing/integration-results'],
    memoryWrites: ['coding/testing/coverage-report', 'coding/testing/coverage-gaps'],
    xpReward: 50,
    parallelizable: false,
    critical: false,
    description: 'Analyzes test coverage metrics, identifies gaps, and generates coverage reports.',
  },
  {
    phase: 'testing',
    agentKey: 'quality-gate',
    priority: 7,
    category: 'testing',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'PoT',
    dependsOn: ['coverage-analyzer'],
    memoryReads: ['coding/testing/coverage-report', 'coding/testing/results'],
    memoryWrites: ['coding/testing/quality-verdict', 'coding/testing/l-score'],
    xpReward: 65,
    parallelizable: false,
    critical: true,
    description: 'Validates code against quality gates, computes L-Scores, and determines phase completion.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: OPTIMIZATION (5 agents)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'optimization',
    agentKey: 'performance-optimizer',
    priority: 1,
    category: 'optimization',
    algorithm: 'PoT',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['quality-gate'],
    memoryReads: ['coding/implementation/services', 'coding/testing/results'],
    memoryWrites: ['coding/optimization/performance', 'coding/optimization/benchmarks'],
    xpReward: 60,
    parallelizable: false,
    critical: false,
    description: 'Identifies and optimizes performance bottlenecks, memory usage, and runtime efficiency.',
  },
  {
    phase: 'optimization',
    agentKey: 'performance-architect',
    priority: 2,
    category: 'optimization',
    algorithm: 'ToT',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['performance-optimizer'],
    memoryReads: ['coding/optimization/performance', 'coding/architecture/design'],
    memoryWrites: ['coding/optimization/architecture-improvements', 'coding/optimization/scalability'],
    xpReward: 55,
    parallelizable: true,
    critical: false,
    description: 'Designs performance architecture, optimization strategies, and scalability patterns.',
  },
  {
    phase: 'optimization',
    agentKey: 'code-quality-improver',
    priority: 3,
    category: 'optimization',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['performance-optimizer'],
    memoryReads: ['coding/implementation/services', 'coding/testing/quality-verdict'],
    memoryWrites: ['coding/optimization/quality-improvements', 'coding/optimization/refactoring'],
    xpReward: 50,
    parallelizable: true,
    critical: false,
    description: 'Improves code quality through refactoring, pattern application, and maintainability enhancements.',
  },
  {
    phase: 'optimization',
    agentKey: 'security-architect',
    priority: 4,
    category: 'security',
    algorithm: 'ReAct',
    fallbackAlgorithm: 'Reflexion',
    dependsOn: ['performance-architect', 'code-quality-improver'],
    memoryReads: ['coding/testing/vulnerabilities', 'coding/implementation/api'],
    memoryWrites: ['coding/optimization/security-improvements', 'coding/optimization/security-audit'],
    xpReward: 60,
    parallelizable: false,
    critical: false,
    description: 'Designs security architecture, authentication flows, and threat mitigation strategies.',
  },
  {
    phase: 'optimization',
    agentKey: 'final-refactorer',
    priority: 5,
    category: 'optimization',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'Self-Debug',
    dependsOn: ['security-architect'],
    memoryReads: ['coding/optimization/quality-improvements', 'coding/optimization/security-audit'],
    memoryWrites: ['coding/optimization/final-code', 'coding/optimization/polish-report'],
    xpReward: 55,
    parallelizable: false,
    critical: false,
    description: 'Performs final code polish, consistency checks, and prepares code for delivery.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7: DELIVERY (1 core agent)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    phase: 'delivery',
    agentKey: 'sign-off-approver',
    priority: 1,
    category: 'approval',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'ReAct',
    dependsOn: ['final-refactorer'],
    memoryReads: ['coding/optimization/final-code', 'coding/testing/coverage-report', 'coding/testing/quality-verdict'],
    memoryWrites: ['coding/delivery/sign-off', 'coding/delivery/approval-status'],
    xpReward: 75,
    parallelizable: false,
    critical: true,
    description: 'Final sign-off authority for code delivery, verifying all requirements met. CRITICAL: Must pass for pipeline completion.',
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
    priority: 99,
    category: 'forensic-review',
    algorithm: 'Reflexion',
    fallbackAlgorithm: 'ToT',
    dependsOn: ['feasibility-analyzer'],
    memoryReads: [
      'coding/understanding/task-analysis',
      'coding/understanding/requirements',
      'coding/understanding/scope',
      'coding/understanding/context',
      'coding/understanding/feasibility',
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
    dependsOn: ['codebase-analyzer'],
    memoryReads: [
      'coding/exploration/patterns',
      'coding/exploration/technologies',
      'coding/exploration/research-plan',
      'coding/exploration/codebase-analysis',
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
    dependsOn: ['integration-architect'],
    memoryReads: [
      'coding/architecture/design',
      'coding/architecture/components',
      'coding/architecture/interfaces',
      'coding/architecture/data-models',
      'coding/architecture/integrations',
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
    dependsOn: ['implementation-coordinator'],
    memoryReads: [
      'coding/implementation/generated-code',
      'coding/implementation/types',
      'coding/implementation/services',
      'coding/implementation/api',
      'coding/implementation/coordination-report',
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
    dependsOn: ['quality-gate'],
    memoryReads: [
      'coding/testing/generated-tests',
      'coding/testing/results',
      'coding/testing/coverage-report',
      'coding/testing/quality-verdict',
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
    dependsOn: ['final-refactorer'],
    memoryReads: [
      'coding/optimization/performance',
      'coding/optimization/quality-improvements',
      'coding/optimization/security-audit',
      'coding/optimization/final-code',
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
    dependsOn: ['sign-off-approver'],
    memoryReads: [
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
    description: 'Sherlock #47: Phase 7 Delivery forensic review and recovery orchestration. CRITICAL: Final pipeline gate.',
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
export function getAgentsForPhase(phase: CodingPipelinePhase): ICodingAgentMapping[] {
  return CODING_PIPELINE_MAPPINGS
    .filter(agent => agent.phase === phase)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Build the complete pipeline DAG from agent mappings.
 *
 * @returns Complete DAG structure for pipeline execution
 */
export function buildPipelineDAG(): IPipelineDAG {
  const nodes = new Map<CodingPipelineAgent, IPipelineDAGNode>();
  const phases = new Map<CodingPipelinePhase, CodingPipelineAgent[]>();

  // Initialize phases map
  for (const phase of PHASE_ORDER) {
    phases.set(phase, []);
  }

  // Create nodes for each agent
  for (const mapping of CODING_PIPELINE_MAPPINGS) {
    const node: IPipelineDAGNode = {
      agentKey: mapping.agentKey,
      phase: mapping.phase,
      dependsOn: mapping.dependsOn ?? [],
      dependents: [],
    };
    nodes.set(mapping.agentKey, node);
    phases.get(mapping.phase)!.push(mapping.agentKey);
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
  const topologicalOrder: CodingPipelineAgent[] = [];
  const inDegree = new Map<CodingPipelineAgent, number>();

  // Initialize in-degrees
  for (const [agentKey, node] of nodes) {
    inDegree.set(agentKey, node.dependsOn.length);
  }

  // Find all nodes with no dependencies
  const queue: CodingPipelineAgent[] = [];
  for (const [agentKey, degree] of inDegree) {
    if (degree === 0) {
      queue.push(agentKey);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const agentKey = queue.shift()!;
    topologicalOrder.push(agentKey);

    const node = nodes.get(agentKey)!;
    for (const dependent of node.dependents) {
      const newDegree = inDegree.get(dependent)! - 1;
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
export function getCriticalAgents(): ICodingAgentMapping[] {
  return CODING_PIPELINE_MAPPINGS.filter(agent => agent.critical === true);
}

/**
 * Get a specific agent mapping by key.
 *
 * @param key - The agent key to find
 * @returns The agent mapping or undefined if not found
 */
export function getAgentByKey(key: CodingPipelineAgent): ICodingAgentMapping | undefined {
  return CODING_PIPELINE_MAPPINGS.find(agent => agent.agentKey === key);
}

/**
 * Get the total XP available in the pipeline.
 *
 * @returns Total XP reward sum across all agents
 */
export function getTotalPipelineXP(): number {
  return CODING_PIPELINE_MAPPINGS.reduce((sum, agent) => sum + agent.xpReward, 0);
}

/**
 * Get XP totals grouped by phase.
 *
 * @returns Map of phase to total XP for that phase
 */
export function getPhaseXPTotals(): Map<CodingPipelinePhase, number> {
  const totals = new Map<CodingPipelinePhase, number>();

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
export function validatePipelineDependencies(): string[] {
  const errors: string[] = [];
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
  private readonly config: Required<ICommandTaskBridgeConfig>;
  private readonly phaseMappings: Map<string, IAgentMapping>;

  constructor(config: ICommandTaskBridgeConfig = {}) {
    this.config = {
      pipelineThreshold: config.pipelineThreshold ?? DEFAULT_PIPELINE_THRESHOLD,
      verbose: config.verbose ?? false,
      phaseMappings: config.phaseMappings ?? new Map()
    };

    // Initialize phase mappings with defaults + custom
    this.phaseMappings = new Map(
      DEFAULT_PHASE_MAPPINGS.map(m => [m.phase, m])
    );

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
  analyzeTaskComplexity(task: string): IComplexityAnalysis {
    const normalizedTask = task.toLowerCase();
    let score = 0;
    const detectedPhases: string[] = [];
    const detectedDocuments: string[] = [];
    const detectedActions: string[] = [];
    const reasons: string[] = [];

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
          const words = match.split(/\s+/).filter(w =>
            !['and', 'then', 'create', 'first', 'step', 'phase'].includes(w.toLowerCase())
          );
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
    const isMultiStep =
      detectedPhases.length >= 2 ||
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
  shouldUsePipeline(task: string): IPipelineDecision {
    const complexity = this.analyzeTaskComplexity(task);

    // Decision factors
    const exceedsThreshold = complexity.score >= this.config.pipelineThreshold;
    const isMultiStep = complexity.isMultiStep;
    const hasMultipleDocuments = complexity.detectedDocuments.length >= 2;
    const hasMultiplePhases = complexity.detectedPhases.length >= 2;

    // Determine if pipeline should be used
    const usePipeline = exceedsThreshold && (isMultiStep || hasMultipleDocuments || hasMultiplePhases);

    let reason: string;
    let suggestedSteps: string[] | undefined;

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
    } else {
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
  buildPipelineDefinition(
    task: string,
    taskType: TaskType = 'code',
    baseName?: string
  ): IPipelineDefinition {
    const decision = this.shouldUsePipeline(task);

    if (!decision.usePipeline || !decision.suggestedSteps) {
      throw new PipelineDefinitionError(
        'Task does not require a pipeline. Use single agent execution.',
        {
          pipelineName: baseName ?? 'unknown',
          invalidField: 'task',
          details: {
            complexityScore: decision.complexity.score,
            threshold: this.config.pipelineThreshold
          }
        }
      );
    }

    const steps: IPipelineStep[] = [];
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
      const pipelineStep: IPipelineStep = {
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
      throw new PipelineDefinitionError(
        'Could not build any pipeline steps from task',
        {
          pipelineName,
          invalidField: 'agents',
          details: { task, suggestedSteps: decision.suggestedSteps }
        }
      );
    }

    const pipeline: IPipelineDefinition = {
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
  getSingleAgent(task: string, taskType: TaskType): string {
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
  private generatePipelineName(task: string, taskType: TaskType): string {
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
  private extractPhaseKey(step: string): string {
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
  private getDefaultMapping(phaseKey: string, taskType: TaskType): IAgentMapping {
    // Try to get from existing mappings
    const existing = this.phaseMappings.get(phaseKey);
    if (existing) return existing;

    // Create a default based on task type
    const defaultAgents: Record<TaskType, string> = {
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
  getPhaseMappings(): Map<string, IAgentMapping> {
    return new Map(this.phaseMappings);
  }

  /**
   * Get the configured pipeline threshold.
   */
  getThreshold(): number {
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
export function createCommandTaskBridge(
  config: ICommandTaskBridgeConfig = {}
): CommandTaskBridge {
  return new CommandTaskBridge(config);
}
