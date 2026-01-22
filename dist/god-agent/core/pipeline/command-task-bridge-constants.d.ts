/**
 * DAI-002: Command Task Bridge Constants
 *
 * Constants for the command-task-bridge module.
 * Extracted for constitution compliance (< 500 lines per file).
 *
 * @see command-task-bridge.ts
 */
import type { IAgentMapping } from './command-task-bridge-types.js';
/**
 * Default complexity threshold for triggering pipeline.
 */
export declare const DEFAULT_PIPELINE_THRESHOLD = 0.6;
/**
 * Keywords indicating multiple phases.
 */
export declare const PHASE_KEYWORDS: string[];
/**
 * Document creation keywords.
 */
export declare const DOCUMENT_KEYWORDS: string[];
/**
 * Multi-step action patterns (regex).
 */
export declare const MULTI_STEP_PATTERNS: RegExp[];
/**
 * Connector words indicating sequential work.
 */
export declare const CONNECTOR_WORDS: string[];
/**
 * Default agent mappings for common phases.
 */
export declare const DEFAULT_PHASE_MAPPINGS: IAgentMapping[];
/**
 * Document type to agent mapping.
 */
export declare const DOCUMENT_AGENT_MAPPING: Record<string, string>;
//# sourceMappingURL=command-task-bridge-constants.d.ts.map