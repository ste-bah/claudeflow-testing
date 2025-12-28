/**
 * Agent Selector
 * TASK-002: DAI-001 Core Layer
 *
 * Selects appropriate agent(s) for a given task based on
 * keywords, capabilities, and priority ranking.
 *
 * Per constitution.md:
 * - RULE-004: MUST query AgentRegistry, NOT hardcode agents
 * - RULE-003: MUST throw AgentSelectionError with full context on no match
 */
import type { ILoadedAgentDefinition } from './agent-types.js';
import type { AgentRegistry } from './agent-registry.js';
/**
 * Task analysis result
 */
export interface ITaskAnalysis {
    /** Extracted keywords from task */
    keywords: string[];
    /** Detected task type */
    taskType: 'design' | 'code' | 'research' | 'write' | 'ask' | 'general';
    /** Required capabilities for task */
    requiredCapabilities: string[];
    /** Preferred agent categories */
    preferredCategories: string[];
}
/**
 * Scored agent for ranking
 */
export interface IScoredAgent {
    /** The agent definition */
    agent: ILoadedAgentDefinition;
    /** Relevance score (0-1) */
    score: number;
    /** Reasons for the score */
    matchReasons: string[];
}
/**
 * Selection result
 */
export interface IAgentSelectionResult {
    /** Selected agent */
    selected: ILoadedAgentDefinition;
    /** All candidates with scores */
    candidates: IScoredAgent[];
    /** Analysis that led to selection */
    analysis: ITaskAnalysis;
}
/**
 * AgentSelector
 *
 * Analyzes tasks and selects appropriate agents from AgentRegistry.
 * NO hardcoded agent lists - all selection based on registry queries.
 */
export declare class AgentSelector {
    private registry;
    private verbose;
    constructor(registry: AgentRegistry, options?: {
        verbose?: boolean;
    });
    /**
     * Analyze task to extract selection criteria
     */
    analyzeTask(task: string): ITaskAnalysis;
    /**
     * Select best agent for task
     * @throws AgentSelectionError if no suitable agent found
     */
    selectAgent(task: string): IAgentSelectionResult;
    /**
     * Select multiple agents for complex task (e.g., research pipeline)
     */
    selectAgents(task: string, count: number): IAgentSelectionResult[];
    /**
     * Score all agents against task analysis
     */
    private scoreAgents;
    /**
     * Calculate relevance score for agent given task analysis
     */
    private calculateRelevance;
    /**
     * Calculate keyword match score
     */
    private calculateKeywordScore;
    /**
     * Calculate capability match score
     */
    private calculateCapabilityScore;
    /**
     * Calculate trigger phrase match score
     */
    private calculateTriggerScore;
    /**
     * Extract keywords from task string
     */
    private extractKeywords;
    /**
     * Detect task type from task string
     */
    private detectTaskType;
}
//# sourceMappingURL=agent-selector.d.ts.map