/**
 * CodingPipelineConfigLoader - Loads pipeline configuration from agent definition files
 *
 * Implements REQ-PIPE-047 (support all 47 coding agents)
 * Pattern from: PipelineConfigLoader in pipeline-loader.ts
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-config-loader
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../observability/index.js';

import type {
  CodingPipelinePhase,
  CodingPipelineAgent,
  IAgentMapping,
  AlgorithmType,
} from './types.js';

const logger = createComponentLogger('CodingPipelineConfigLoader', {
  minLevel: LogLevel.WARN,
  handlers: [new ConsoleLogHandler({ useStderr: true })]
});

const AGENTS_DIR = '.claude/agents/coding-pipeline';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map agent `type` field to CodingPipelinePhase
 */
const TYPE_TO_PHASE: Record<string, CodingPipelinePhase> = {
  'understanding': 'understanding',
  'exploration': 'exploration',
  'architecture': 'architecture',
  'implementation': 'implementation',
  'testing': 'testing',
  'optimization': 'optimization',
  'delivery': 'delivery',
  // Special agent types (CRITICAL-001 fix)
  'approval': 'delivery',              // sign-off-approver
  'validation': 'testing',             // quality-gate
  'sherlock-reviewer': 'delivery',     // phase-N-reviewers
  'sherlock-recovery': 'delivery',     // recovery-agent
};

/**
 * Default algorithm mapping by phase
 */
const PHASE_DEFAULT_ALGORITHM: Record<CodingPipelinePhase, AlgorithmType> = {
  'understanding': 'ReAct',
  'exploration': 'LATS',
  'architecture': 'ToT',
  'implementation': 'Self-Debug',
  'testing': 'Self-Debug',
  'optimization': 'Reflexion',
  'delivery': 'Reflexion',
};

/**
 * Agent ordering - canonical 47 agents
 * Derived from actual .md files in .claude/agents/coding-pipeline/
 */
const AGENT_ORDER: Record<string, number> = {
  // Phase 1: Understanding (6 agents, positions 1-6)
  'task-analyzer': 1,           // CRITICAL: pipeline entry point
  'requirement-extractor': 2,
  'requirement-prioritizer': 3,
  'scope-definer': 4,
  'context-gatherer': 5,
  'feasibility-analyzer': 6,

  // Phase 2: Exploration (4 agents, positions 7-10)
  'pattern-explorer': 7,
  'technology-scout': 8,
  'research-planner': 9,
  'codebase-analyzer': 10,

  // Phase 3: Architecture (5 agents, positions 11-15)
  'system-designer': 11,
  'component-designer': 12,
  'interface-designer': 13,
  'data-architect': 14,
  'integration-architect': 15,

  // Phase 4: Implementation (12 agents, positions 16-27)
  'code-generator': 16,
  'type-implementer': 17,
  'unit-implementer': 18,
  'service-implementer': 19,
  'data-layer-implementer': 20,
  'api-implementer': 21,
  'frontend-implementer': 22,
  'error-handler-implementer': 23,
  'config-implementer': 24,
  'logger-implementer': 25,
  'dependency-manager': 26,
  'implementation-coordinator': 27,

  // Phase 5: Testing (7 agents, positions 28-34)
  'test-generator': 28,
  'test-runner': 29,
  'integration-tester': 30,
  'regression-tester': 31,
  'security-tester': 32,
  'coverage-analyzer': 33,
  'quality-gate': 34,

  // Phase 6: Optimization (5 agents, positions 35-39)
  'performance-optimizer': 35,
  'performance-architect': 36,
  'code-quality-improver': 37,
  'security-architect': 38,
  'final-refactorer': 39,

  // Phase 7: Delivery / Sherlock Reviewers (8 agents, positions 40-47)
  'sign-off-approver': 40,      // CRITICAL: final approval
  'phase-1-reviewer': 41,       // Sherlock: Understanding review
  'phase-2-reviewer': 42,       // Sherlock: Exploration review
  'phase-3-reviewer': 43,       // Sherlock: Architecture review
  'phase-4-reviewer': 44,       // Sherlock: Implementation review
  'phase-5-reviewer': 45,       // Sherlock: Testing review
  'phase-6-reviewer': 46,       // Sherlock: Optimization review
  'recovery-agent': 47,         // Sherlock: Recovery orchestration
};

/**
 * Critical agents that halt pipeline on failure
 * CRITICAL-003 fix: Aligned with types.ts CRITICAL_AGENTS and frontmatter priority:critical
 */
const CRITICAL_AGENT_KEYS = new Set([
  // From types.ts CRITICAL_AGENTS
  'task-analyzer',              // #1 - Pipeline entry point
  'interface-designer',         // #13 - API contract validation
  'quality-gate',               // #34 - L-Score validation gateway
  'sign-off-approver',          // #40 - Final approval
  // Sherlock forensic reviewers (all critical)
  'phase-1-reviewer',
  'phase-2-reviewer',
  'phase-3-reviewer',
  'phase-4-reviewer',
  'phase-5-reviewer',
  'phase-6-reviewer',
  'recovery-agent',
  // From frontmatter priority:critical (additional)
  'system-designer',            // Architecture critical
  'code-generator',             // Implementation critical
  'implementation-coordinator', // Implementation critical
  'test-runner',                // Testing critical
  'security-tester',            // Testing critical
  'security-architect',         // Optimization critical
  'feasibility-analyzer',       // Understanding critical
]);

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Coding agent configuration from definition file
 */
export interface CodingAgentConfig {
  /** Unique agent key (filename without .md) */
  key: string;
  /** Human-readable name */
  name: string;
  /** Pipeline phase */
  phase: CodingPipelinePhase;
  /** Execution order within pipeline */
  order: number;
  /** Agent description */
  description: string;
  /** Agent type from frontmatter */
  type: string;
  /** Agent category */
  category: string;
  /** Version string */
  version: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Agent capabilities */
  capabilities: string[];
  /** Available tools */
  tools: string[];
  /** Quality gates */
  qualityGates: string[];
  /** Pre/post hooks */
  hooks: {
    pre?: string;
    post?: string;
  };
  /** Algorithm for this agent */
  algorithm: AlgorithmType;
  /** Fallback algorithm */
  fallbackAlgorithm?: AlgorithmType;
  /** If true, pipeline halts on failure */
  critical: boolean;
  /** Full markdown content */
  fullContent: string;
}

/**
 * Coding pipeline configuration
 */
export interface CodingPipelineConfig {
  id: string;
  name: string;
  agents: CodingAgentConfig[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CODING PIPELINE CONFIG LOADER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CodingPipelineConfigLoader class
 *
 * Dynamically loads agent configurations from .claude/agents/coding-pipeline/*.md files.
 * This replaces the hardcoded CODING_PIPELINE_MAPPINGS with file-driven configuration.
 */
export class CodingPipelineConfigLoader {
  private configCache: CodingPipelineConfig | null = null;
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Load pipeline configuration from agent definition files
   * Returns config with all 47 agents
   * [REQ-PIPE-047]
   */
  async loadPipelineConfig(): Promise<CodingPipelineConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const agentsDir = path.join(this.basePath, AGENTS_DIR);

    let files: string[];
    try {
      files = await fs.readdir(agentsDir);
    } catch {
      // INTENTIONAL: Directory access failure - throw descriptive error for caller handling
      throw new Error(`Coding agents directory not found: ${agentsDir}`);
    }

    const agentFiles = files.filter(f => f.endsWith('.md'));
    const agents: CodingAgentConfig[] = [];

    for (const file of agentFiles) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const agent = this.parseAgentDefinition(content, file);
        agents.push(agent);
      } catch (error) {
        logger.warn('Failed to parse coding agent definition', { file, error: String(error) });
      }
    }

    // Sort agents by order
    agents.sort((a, b) => a.order - b.order);

    this.configCache = {
      id: 'coding-pipeline',
      name: 'God Agent Coding Pipeline',
      agents
    };

    return this.configCache;
  }

  /**
   * Parse agent definition markdown file
   * Extract frontmatter and content
   */
  private parseAgentDefinition(content: string, filename: string): CodingAgentConfig {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      throw new Error(`No frontmatter found in ${filename}`);
    }

    const frontmatter = this.parseYAML(frontmatterMatch[1]);

    // Extract description (content after frontmatter)
    const fullContent = content.substring(frontmatterMatch[0].length).trim();

    // Build agent key from filename
    const key = filename.replace('.md', '');

    // Get order from AGENT_ORDER map
    const order = AGENT_ORDER[key] || 99;

    // Determine phase from AGENT_ORDER position, NOT frontmatter type
    // This is more reliable since frontmatter types may not match intended phase
    const phase = this.derivePhaseFromOrder(order);

    // Store original type from frontmatter for reference
    const agentType = (frontmatter.type as string) || 'implementation';

    // Determine if critical
    const isCritical = CRITICAL_AGENT_KEYS.has(key) ||
      frontmatter.priority === 'critical';

    // Get algorithm
    const algorithm = PHASE_DEFAULT_ALGORITHM[phase];

    return {
      key,
      name: (frontmatter.name as string) || key,
      phase,
      order,
      description: (frontmatter.description as string) || '',
      type: agentType,
      category: (frontmatter.category as string) || 'coding-pipeline',
      version: (frontmatter.version as string) || '1.0.0',
      priority: this.parsePriority(frontmatter.priority as string),
      capabilities: this.parseStringArray(frontmatter.capabilities),
      tools: this.parseStringArray(frontmatter.tools),
      qualityGates: this.parseStringArray(frontmatter.qualityGates),
      hooks: this.parseHooks(frontmatter.hooks),
      algorithm,
      fallbackAlgorithm: this.getFallbackAlgorithm(algorithm),
      critical: isCritical,
      fullContent,
    };
  }

  /**
   * Parse priority string to typed value
   */
  private parsePriority(priority: string | undefined): 'critical' | 'high' | 'medium' | 'low' {
    if (priority === 'critical') return 'critical';
    if (priority === 'high') return 'high';
    if (priority === 'low') return 'low';
    return 'medium';
  }

  /**
   * Parse string array from frontmatter
   */
  private parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v));
    }
    return [];
  }

  /**
   * Parse hooks from frontmatter
   */
  private parseHooks(hooks: unknown): { pre?: string; post?: string } {
    if (typeof hooks === 'object' && hooks !== null) {
      const h = hooks as Record<string, unknown>;
      return {
        pre: typeof h.pre === 'string' ? h.pre : undefined,
        post: typeof h.post === 'string' ? h.post : undefined,
      };
    }
    return {};
  }

  /**
   * Derive pipeline phase from AGENT_ORDER position
   * This is the source of truth for phase assignment
   */
  private derivePhaseFromOrder(order: number): CodingPipelinePhase {
    // Phase boundaries based on AGENT_ORDER positions
    // Phase 1: Understanding (1-6)
    // Phase 2: Exploration (7-10)
    // Phase 3: Architecture (11-15)
    // Phase 4: Implementation (16-27)
    // Phase 5: Testing (28-34)
    // Phase 6: Optimization (35-39)
    // Phase 7: Delivery/Sherlock (40-47)
    if (order <= 6) return 'understanding';
    if (order <= 10) return 'exploration';
    if (order <= 15) return 'architecture';
    if (order <= 27) return 'implementation';
    if (order <= 34) return 'testing';
    if (order <= 39) return 'optimization';
    return 'delivery';
  }

  /**
   * Get fallback algorithm for primary algorithm
   */
  private getFallbackAlgorithm(primary: AlgorithmType): AlgorithmType {
    const fallbacks: Record<AlgorithmType, AlgorithmType> = {
      'LATS': 'ToT',
      'ReAct': 'Reflexion',
      'Self-Debug': 'ReAct',
      'Reflexion': 'ReAct',
      'PoT': 'ReAct',
      'ToT': 'ReAct',
    };
    return fallbacks[primary] || 'ReAct';
  }

  /**
   * Simple YAML parser for frontmatter
   * Handles arrays, booleans, numbers, strings, and nested objects
   */
  private parseYAML(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] | null = null;
    let currentObject: Record<string, unknown> | null = null;
    let objectKey: string | null = null;

    for (const line of lines) {
      // Check for array item
      if (currentArray !== null && line.match(/^\s+-\s+(.+)$/)) {
        const match = line.match(/^\s+-\s+(.+)$/);
        if (match) {
          currentArray.push(match[1].replace(/^["']|["']$/g, ''));
        }
        continue;
      }

      // Check for nested object value (with pipe for multiline)
      if (currentObject !== null && objectKey !== null && line.match(/^\s+\w+:\s*\|$/)) {
        const match = line.match(/^\s+(\w+):\s*\|$/);
        if (match) {
          const nestedKey = match[1];
          // Collect multiline value
          const multilineValue = this.collectMultilineValue(lines, lines.indexOf(line) + 1);
          currentObject[nestedKey] = multilineValue;
        }
        continue;
      }

      // Check for nested object value
      if (currentObject !== null && objectKey !== null && line.match(/^\s+\w+:\s*.+$/)) {
        const match = line.match(/^\s+(\w+):\s*(.+)$/);
        if (match) {
          currentObject[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
        continue;
      }

      // End of array or object
      if (currentArray !== null && !line.match(/^\s+-/)) {
        result[currentKey!] = currentArray;
        currentArray = null;
        currentKey = null;
      }

      if (currentObject !== null && objectKey !== null && !line.match(/^\s+\w+:/)) {
        result[objectKey] = currentObject;
        currentObject = null;
        objectKey = null;
      }

      // Check for key: value
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        currentKey = key;

        // Check for array start
        if (value === '' || value === undefined) {
          // Peek next line to see if it's an array
          const nextLineIdx = lines.indexOf(line) + 1;
          if (nextLineIdx < lines.length && lines[nextLineIdx].match(/^\s+-/)) {
            currentArray = [];
            continue;
          }
          // Check for nested object
          if (nextLineIdx < lines.length && lines[nextLineIdx].match(/^\s+\w+:/)) {
            currentObject = {};
            objectKey = key;
            continue;
          }
        }

        // Parse value
        if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          try {
            result[key] = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            result[key] = [];
          }
        } else if (value === 'true' || value === 'false') {
          result[key] = value === 'true';
        } else if (!isNaN(Number(value)) && value !== '') {
          result[key] = Number(value);
        } else if (value !== '') {
          result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }

    // Finalize any pending array or object
    if (currentArray !== null && currentKey !== null) {
      result[currentKey] = currentArray;
    }
    if (currentObject !== null && objectKey !== null) {
      result[objectKey] = currentObject;
    }

    return result;
  }

  /**
   * Collect multiline value (for YAML pipe syntax)
   */
  private collectMultilineValue(lines: string[], startIdx: number): string {
    const valueLines: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      // Multiline content is indented
      if (line.match(/^\s{4,}/)) {
        valueLines.push(line.trim());
      } else if (line.trim() === '') {
        // Empty line within multiline
        valueLines.push('');
      } else {
        // End of multiline
        break;
      }
    }
    return valueLines.join('\n');
  }

  /**
   * Get agent by index
   */
  async getAgentByIndex(index: number): Promise<CodingAgentConfig> {
    const config = await this.loadPipelineConfig();

    if (index < 0 || index >= config.agents.length) {
      throw new Error(`Invalid agent index: ${index}. Valid range: 0-${config.agents.length - 1}`);
    }

    return config.agents[index];
  }

  /**
   * Get agent by key
   */
  async getAgentByKey(key: string): Promise<CodingAgentConfig | undefined> {
    const config = await this.loadPipelineConfig();
    return config.agents.find(a => a.key === key);
  }

  /**
   * Get agents for a specific phase
   */
  async getAgentsForPhase(phase: CodingPipelinePhase): Promise<CodingAgentConfig[]> {
    const config = await this.loadPipelineConfig();
    return config.agents.filter(a => a.phase === phase);
  }

  /**
   * Get Sherlock reviewer agents
   */
  async getSherlockAgents(): Promise<CodingAgentConfig[]> {
    const config = await this.loadPipelineConfig();
    return config.agents.filter(a => a.type === 'sherlock-reviewer');
  }

  /**
   * Get critical agents
   */
  async getCriticalAgents(): Promise<CodingAgentConfig[]> {
    const config = await this.loadPipelineConfig();
    return config.agents.filter(a => a.critical);
  }

  /**
   * Convert CodingAgentConfig to IAgentMapping for orchestrator compatibility
   */
  async getAgentMappings(): Promise<IAgentMapping[]> {
    const config = await this.loadPipelineConfig();

    return config.agents.map(agent => ({
      phase: agent.phase,
      agentKey: agent.key as CodingPipelineAgent,
      priority: agent.order,
      category: agent.category,
      algorithm: agent.algorithm,
      fallbackAlgorithm: agent.fallbackAlgorithm,
      dependsOn: this.inferDependencies(agent, config.agents),
      memoryReads: this.inferMemoryReads(agent),
      memoryWrites: this.inferMemoryWrites(agent),
      xpReward: this.calculateXPReward(agent),
      parallelizable: !agent.critical && agent.priority !== 'critical',
      critical: agent.critical,
      description: agent.description,
    }));
  }

  /**
   * Infer dependencies from agent position and phase
   */
  private inferDependencies(
    agent: CodingAgentConfig,
    allAgents: CodingAgentConfig[]
  ): CodingPipelineAgent[] | undefined {
    // First agent in phase depends on last agent of previous phase
    const phaseAgents = allAgents.filter(a => a.phase === agent.phase);
    const firstInPhase = phaseAgents.length > 0 && phaseAgents[0].key === agent.key;

    if (firstInPhase && agent.order > 1) {
      // Find last agent of previous phase
      const prevAgent = allAgents.find(a => a.order === agent.order - 1);
      if (prevAgent) {
        return [prevAgent.key as CodingPipelineAgent];
      }
    }

    // Non-first agents depend on previous agent
    if (!firstInPhase) {
      const prevInPhase = phaseAgents.find(a => a.order === agent.order - 1);
      if (prevInPhase) {
        return [prevInPhase.key as CodingPipelineAgent];
      }
    }

    return undefined;
  }

  /**
   * Infer memory read keys from agent phase
   */
  private inferMemoryReads(agent: CodingAgentConfig): string[] {
    const phasePrefix = `coding/${agent.phase}`;
    const reads: string[] = [];

    // Read from previous phases
    const phaseOrder = ['understanding', 'exploration', 'architecture', 'implementation', 'testing', 'optimization', 'delivery'];
    const currentIdx = phaseOrder.indexOf(agent.phase);

    if (currentIdx > 0) {
      reads.push(`coding/${phaseOrder[currentIdx - 1]}`);
    }

    // Read from input/context
    if (agent.order === 1) {
      reads.push('coding/input/task');
      reads.push('coding/context/project');
    }

    return reads;
  }

  /**
   * Infer memory write keys from agent
   */
  private inferMemoryWrites(agent: CodingAgentConfig): string[] {
    return [`coding/${agent.phase}/${agent.key}`];
  }

  /**
   * Calculate XP reward based on agent criticality and phase
   */
  private calculateXPReward(agent: CodingAgentConfig): number {
    let baseXP = 50;

    // Critical agents get more XP
    if (agent.critical) {
      baseXP += 50;
    }

    // Sherlock reviewers get bonus XP
    if (agent.type === 'sherlock-reviewer') {
      baseXP += 50;
    }

    // Later phases get slightly more XP
    const phaseMultipliers: Record<CodingPipelinePhase, number> = {
      'understanding': 1.0,
      'exploration': 1.0,
      'architecture': 1.1,
      'implementation': 1.2,
      'testing': 1.1,
      'optimization': 1.1,
      'delivery': 1.3,
    };

    return Math.round(baseXP * (phaseMultipliers[agent.phase] || 1.0));
  }

  /**
   * Clear cache to force reload
   */
  clearCache(): void {
    this.configCache = null;
  }

  /**
   * Validate all agent files exist and are parseable
   */
  async validateAgentFiles(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const config = await this.loadPipelineConfig();

      // Check for expected agent count
      const expectedKeys = Object.keys(AGENT_ORDER);
      const foundKeys = new Set(config.agents.map(a => a.key));

      for (const expected of expectedKeys) {
        if (!foundKeys.has(expected)) {
          errors.push(`Missing agent file: ${expected}.md`);
        }
      }

      // Check for unexpected agents
      for (const agent of config.agents) {
        if (!AGENT_ORDER[agent.key]) {
          errors.push(`Unknown agent (not in AGENT_ORDER): ${agent.key}.md`);
        }
      }

      // Validate each agent has required fields
      for (const agent of config.agents) {
        if (!agent.name) errors.push(`Agent ${agent.key} missing 'name'`);
        if (!agent.description) errors.push(`Agent ${agent.key} missing 'description'`);
        if (!agent.type) errors.push(`Agent ${agent.key} missing 'type'`);
      }

    } catch (error) {
      errors.push(`Failed to load pipeline config: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new CodingPipelineConfigLoader instance
 */
export function createCodingPipelineConfigLoader(basePath?: string): CodingPipelineConfigLoader {
  return new CodingPipelineConfigLoader(basePath);
}

/**
 * Get agent mappings for the coding pipeline
 * Convenience function that loads config and returns IAgentMapping array
 */
export async function loadCodingPipelineMappings(basePath?: string): Promise<IAgentMapping[]> {
  const loader = createCodingPipelineConfigLoader(basePath);
  return loader.getAgentMappings();
}
