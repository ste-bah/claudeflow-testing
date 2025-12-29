/**
 * DAI-003: Task Analyzer Implementation
 *
 * TASK-004: Task Analysis Engine
 * Constitution: INT-001, INT-007
 *
 * Analyzes task descriptions to extract:
 * - Primary domain (research, testing, code, writing, design, review)
 * - Complexity assessment (simple, moderate, complex)
 * - Required capabilities
 * - Semantic embedding (VECTOR_DIM (1536), L2-normalized)
 * - Multi-step detection
 * - Expected artifacts
 *
 * Performance target: < 150ms (P95) per INT-007
 *
 * @module src/god-agent/core/routing/task-analyzer
 */
import type { ITaskAnalyzer, ITaskAnalysis, TaskDomain } from './routing-types.js';
/**
 * Configuration for TaskAnalyzer
 */
export interface ITaskAnalyzerConfig {
    /** Whether to use local embedding API (default: true) */
    useLocalEmbedding?: boolean;
    /** Whether to cache analysis results (default: true) */
    enableCache?: boolean;
    /** Maximum cache size (default: 1000) */
    maxCacheSize?: number;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
}
/**
 * Task analyzer for extracting domain, complexity, and semantic features
 * Implements ITaskAnalyzer interface from routing-types.ts
 *
 * @implements ITaskAnalyzer
 */
export declare class TaskAnalyzer implements ITaskAnalyzer {
    private readonly config;
    private readonly cache;
    private embeddingProvider;
    constructor(config?: ITaskAnalyzerConfig);
    /**
     * Initialize the embedding provider
     * Lazy initialization on first use
     */
    private initEmbeddingProvider;
    /**
     * Analyze a task description
     * Per INT-001: Returns domain, complexity, embedding
     * Per INT-007: Analysis completes in < 150ms (P95)
     *
     * @param task - Task description to analyze
     * @returns Task analysis result
     * @throws TaskAnalysisError if analysis fails
     */
    analyze(task: string): Promise<ITaskAnalysis>;
    /**
     * Extract verbs from task description
     * Looks for action words at sentence boundaries and after common prepositions
     *
     * @param task - Task description
     * @returns Array of verbs in order of appearance
     */
    private extractVerbs;
    /**
     * Detect primary domain from task description and verbs
     * Uses verb-to-domain pattern matching with frequency scoring
     * Prioritizes more specific domains (review > research for overlapping verbs)
     *
     * @param task - Task description
     * @param verbs - Extracted verbs
     * @returns Detected domain
     */
    private detectDomain;
    /**
     * Assess task complexity based on verb count
     * Per spec: simple (1 verb), moderate (2-3), complex (4+)
     *
     * @param verbs - Extracted verbs
     * @returns Complexity level
     */
    private assessComplexity;
    /**
     * Extract required capabilities from task and domain
     * Combines domain-specific patterns with verbs
     *
     * @param task - Task description
     * @param domain - Detected domain
     * @param verbs - Extracted verbs
     * @returns Array of required capabilities
     */
    private extractCapabilities;
    /**
     * Detect if task requires multiple steps
     * Looks for multi-step markers like "then", "after", "finally"
     * Uses word boundaries to avoid false positives (e.g., "authentication" contains "then")
     *
     * @param task - Task description
     * @returns true if multi-step indicators found
     */
    private detectMultiStep;
    /**
     * Extract explicit agent preference from task
     * Looks for patterns like "use researcher", "with coder"
     *
     * @param task - Task description
     * @returns Agent key if preference found, undefined otherwise
     */
    private extractPreferredAgent;
    /**
     * Infer expected output artifacts from task and domain
     *
     * @param task - Task description
     * @param domain - Detected domain
     * @returns Array of expected artifacts
     */
    private inferArtifacts;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
    /**
     * Clear the analysis cache
     */
    clearCache(): void;
    /**
     * Get configuration
     */
    getConfig(): Required<ITaskAnalyzerConfig>;
}
/**
 * Build domain pattern regex for performance
 * Pre-compiles regex patterns for domain detection
 *
 * @deprecated Not currently used, kept for potential optimization
 */
export declare function buildDomainPatterns(): Record<TaskDomain, RegExp>;
/**
 * Build verb pattern set for performance
 * Pre-compiles verb list for quick lookup
 *
 * @deprecated Not currently used, kept for potential optimization
 */
export declare function buildVerbPatterns(): Set<string>;
//# sourceMappingURL=task-analyzer.d.ts.map