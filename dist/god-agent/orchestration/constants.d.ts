/**
 * Orchestration Memory System - Constants
 *
 * Implements: TASK-ORC-003 (TECH-ORC-001 lines 1190-1250)
 *
 * @module orchestration/constants
 */
import { type IWorkflowRule, type IPhaseAgentMapping } from './types.js';
/**
 * Default workflow rules enforcing sequential phase dependencies
 *
 * From TECH-ORC-001 lines 1190-1229
 */
export declare const DEFAULT_WORKFLOW_RULES: readonly IWorkflowRule[];
/**
 * Phase to agent mapping for routing
 *
 * From TECH-ORC-001 lines 1143-1153
 */
export declare const PHASE_AGENT_MAPPING: readonly IPhaseAgentMapping[];
/**
 * Token limits for context injection
 */
export declare const TOKEN_LIMITS: {
    /** Maximum context tokens (default) */
    readonly MAX_CONTEXT_TOKENS: 8000;
    /** Minimum tokens before truncation warning */
    readonly MIN_TOKENS_WARNING: 6800;
    /** Maximum tokens before hard limit */
    readonly MAX_TOKENS_HARD: 9200;
    /** Token estimation multiplier (chars * 0.75) */
    readonly TOKEN_ESTIMATION_MULTIPLIER: 0.75;
    /** Non-ASCII character weight */
    readonly NON_ASCII_WEIGHT: 1.5;
    /** Code block weight */
    readonly CODE_BLOCK_WEIGHT: 0.9;
};
/**
 * Delegation detection keywords
 *
 * From TECH-ORC-001 lines 1244-1250
 */
export declare const DELEGATION_KEYWORDS: readonly string[];
/**
 * Operation type mappings for delegation detection
 *
 * From TECH-ORC-001 lines 1231-1242
 */
export declare const OPERATION_AGENT_MAPPING: {
    readonly backend: {
        readonly keywords: readonly ["read", "modify", "write", "test"];
        readonly filePatterns: readonly ["*.ts", "*.js", "backend/", "server/"];
        readonly suggestedAgent: "backend-dev";
        readonly confidence: 0.8;
    };
    readonly frontend: {
        readonly keywords: readonly ["read", "modify", "write"];
        readonly filePatterns: readonly ["*.tsx", "*.jsx", "components/", "frontend/"];
        readonly suggestedAgent: "coder";
        readonly confidence: 0.8;
    };
    readonly schema: {
        readonly keywords: readonly ["create", "define", "schema", "database", "api-contract"];
        readonly filePatterns: readonly ["*.sql", "schema/", "migrations/"];
        readonly suggestedAgent: "system-architect";
        readonly confidence: 0.7;
    };
    readonly testing: {
        readonly keywords: readonly ["test", "verify", "validate", "assert", "expect"];
        readonly filePatterns: readonly ["*.test.ts", "*.spec.ts", "__tests__/"];
        readonly suggestedAgent: "tester";
        readonly confidence: 0.8;
    };
    readonly analysis: {
        readonly keywords: readonly ["analyze", "review", "search", "grep", "pattern"];
        readonly filePatterns: readonly ["*"];
        readonly suggestedAgent: "code-analyzer";
        readonly confidence: 0.7;
    };
    readonly refactoring: {
        readonly keywords: readonly ["refactor", "optimize", "clean", "restructure"];
        readonly filePatterns: readonly ["*"];
        readonly suggestedAgent: "coder";
        readonly confidence: 0.7;
    };
};
/**
 * Phase detection keywords
 *
 * From TECH-ORC-001 lines 1155-1160
 */
export declare const PHASE_KEYWORDS: {
    readonly planning: readonly ["plan", "design", "architecture", "scope"];
    readonly specification: readonly ["spec", "define", "contract", "schema"];
    readonly implementation: readonly ["implement", "build", "code", "develop"];
    readonly testing: readonly ["test", "verify", "validate", "check"];
    readonly review: readonly ["review", "audit", "examine", "inspect"];
    readonly audit: readonly ["security", "performance", "compliance", "vulnerability"];
    readonly "general-purpose": readonly [];
};
/**
 * Minimum operation count for delegation detection
 */
export declare const MIN_OPERATION_COUNT = 3;
/**
 * Phase detection confidence threshold
 */
export declare const PHASE_CONFIDENCE_THRESHOLD = 0.6;
//# sourceMappingURL=constants.d.ts.map