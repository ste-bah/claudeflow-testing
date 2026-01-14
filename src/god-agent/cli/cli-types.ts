/**
 * CLI Type Definitions for PhD Pipeline Orchestration
 * Implements REQ-PIPE-021, REQ-PIPE-023
 */

import type { ChapterStructure } from './chapter-structure-loader.js';
import type { DynamicAgentDetails } from './dynamic-agent-generator.js';
import type { Phase8PrepareResult } from './final-stage/types.js';

export type DataSourceMode = "external" | "local" | "hybrid";

// ============================================================================
// GAP-H01: TOOL PERMISSIONS (Programmatic Tool Gate)
// ============================================================================

/**
 * Tool permission settings for a session.
 * Enforces local/hybrid mode tool restrictions programmatically.
 *
 * GAP-H01: Implement programmatic external tool gate
 */
export interface ToolPermissions {
  /** Allow WebSearch tool usage */
  readonly webSearch: boolean;
  /** Allow WebFetch tool usage */
  readonly webFetch: boolean;
  /** Allow Perplexity MCP tools */
  readonly perplexity: boolean;
}

/**
 * Query intent analysis result for hybrid mode decisions.
 *
 * GAP-H03: Query intent analyzer
 */
export interface QueryIntent {
  /** Query requires recent/current information */
  readonly recencyRequired: boolean;
  /** Domains mentioned that may not be in corpus */
  readonly outsideCorpusDomains: string[];
  /** Whether external supplementation is justified */
  readonly externalSupplementationJustified: boolean;
  /** Detected temporal markers (e.g., "2025", "recent", "latest") */
  readonly temporalMarkers: string[];
}

// ============================================================================
// GAP-H04: TOOL USAGE LOGGING
// ============================================================================

/**
 * Entry recording external tool usage in a session.
 *
 * GAP-H04: Add tool usage logging to session
 */
export interface ToolUsageEntry {
  /** ISO timestamp of tool usage */
  readonly timestamp: string;
  /** Agent key that used the tool */
  readonly agentKey: string;
  /** Tool that was used (webSearch, webFetch, perplexity) */
  readonly tool: string;
  /** Justification for using external tool */
  readonly justification: string;
  /** Coverage grade at the time of tool usage */
  readonly coverageGradeAtTime: string;
}

/**
 * Options for the init command
 */
export interface InitOptions {
  styleProfile?: string;
  config?: string;

  /** Research mode policy: defaults to "external" in CLI if omitted */
  dataSourceMode?: DataSourceMode;

  // ============================================================================
  // GAP-L02: Local KU Promotion
  // ============================================================================

  /**
   * Enable local Knowledge Unit (KU) promotion during local/hybrid modes.
   * When enabled, high-confidence KUs from Phase 9 REPORT are promoted
   * to the session context for enhanced agent grounding.
   */
  promoteLocalKUs?: boolean;

  /**
   * Minimum confidence threshold for KU promotion (0.0 - 1.0).
   * Only KUs with confidence >= this threshold are promoted.
   * Default: 0.7
   */
  kuPromotionThreshold?: number;

  verbose?: boolean;
  json?: boolean;
}


/**
 * Options for the next command
 */
export interface NextOptions {
  sessionId?: string;
  json?: boolean;
}

/**
 * Options for the complete command
 */
export interface CompleteOptions {
  output?: string;
  json?: boolean;
}

/**
 * Options for the status command
 */
export interface StatusOptions {
  sessionId?: string;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Options for the list command
 */
export interface ListOptions {
  all?: boolean;
  status?: 'running' | 'paused' | 'completed' | 'failed';
  json?: boolean;
}

/**
 * Options for the resume command
 */
export interface ResumeOptions {
  json?: boolean;
}

/**
 * Options for the abort command
 */
export interface AbortOptions {
  force?: boolean;
  json?: boolean;
}

/**
 * Style profile summary in responses
 */
export interface StyleProfileSummary {
  id: string;
  name: string;
  languageVariant: string;
}

/**
 * Agent details returned by CLI commands
 * [REQ-PIPE-002, REQ-PIPE-004]
 */
export interface AgentDetails {
  index: number;
  key: string;
  name: string;
  phase: number;
  phaseName: string;
  prompt: string;
  dependencies: string[];
  timeout: number;
  critical: boolean;
  expectedOutputs: string[];
}

/**
 * Response from init command
 * [REQ-PIPE-001]
 */
export interface InitResponse {
  sessionId: string;
  pipelineId: string;
  query: string;

  /** Echo chosen mode (external/local/hybrid) */
  dataSourceMode: DataSourceMode;

  styleProfile: StyleProfileSummary;
  totalAgents: number;
  agent: AgentDetails;
}


// Note: NextResponse and CompleteResponse are defined later in TASK-PIPE-004/005 sections

/**
 * Response from status command
 * [REQ-PIPE-004]
 */
export interface StatusResponse {
  sessionId: string;
  pipelineId: string;
  query: string;
  status: SessionStatus;
  currentPhase: number;
  phaseName: string;
  currentAgent: AgentDetails;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  startTime: number;
  lastActivityTime: number;
  elapsedTime: number;
  errors: SessionError[];
}

/**
 * Response from list command
 * [REQ-PIPE-005]
 */
export interface ListResponse {
  sessions: SessionListItem[];
  total: number;
}

/**
 * Session list item for list command
 */
export interface SessionListItem {
  sessionId: string;
  pipelineId: string;
  query: string;
  status: SessionStatus;
  progress: number;
  startTime: number;
  lastActivityTime: number;
}

/**
 * Response from resume command
 * [REQ-PIPE-006]
 */
export interface ResumeResponse {
  sessionId: string;
  resumed: boolean;
  agent: AgentDetails;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Response from abort command
 * [REQ-PIPE-007]
 */
export interface AbortResponse {
  sessionId: string;
  aborted: boolean;
  finalStatus: SessionStatus;
  completedAgents: number;
}

/**
 * Session status enum
 * [REQ-PIPE-021]
 */
export type SessionStatus = 'running' | 'paused' | 'completed' | 'failed';

/**
 * Session error structure
 */
export interface SessionError {
  agentKey: string;
  error: string;
  timestamp: number;
}

/**
 * Pipeline session state
 * [REQ-PIPE-020, REQ-PIPE-021]
 */
export interface PipelineSession {
  sessionId: string;
  pipelineId: string;
  query: string;
  styleProfileId: string;
    /** Research mode policy persisted across pipeline steps */
  dataSourceMode?: DataSourceMode;
  status: SessionStatus;
  currentPhase: number;
  currentAgentIndex: number;
  completedAgents: string[];
  agentOutputs: Record<string, unknown>;
  startTime: number;
  lastActivityTime: number;
  errors: SessionError[];

  /** Research folder slug derived from query */
  slug?: string;

  /** Full path to research directory (docs/research/{slug}) */
  researchDir?: string;

  /** Locked chapter structure from dissertation-architect (Agent #6) */
  chapterStructure?: ChapterStructure;

  /** Dynamically generated Phase 6 agents based on chapter structure */
  dynamicPhase6Agents?: DynamicAgentDetails[];

  /** Recalculated total agents: 30 + N + 1 + 9 where N = chapters */
  dynamicTotalAgents?: number;

  // ============================================================================
  // GAP-H01: Tool Permissions (Programmatic Tool Gate)
  // ============================================================================

  /** Current tool permissions for the session (resolved from dataSourceMode) */
  toolPermissions?: ToolPermissions;

  /** Analyzed query intent for hybrid mode decisions */
  queryIntent?: QueryIntent;

  /** Coverage grade from Phase 9 REPORT (used in hybrid decisions) */
  coverageGrade?: 'NONE' | 'LOW' | 'MED' | 'HIGH';

  // ============================================================================
  // GAP-H04: Tool Usage Logging
  // ============================================================================

  /** Audit log of external tool usage in this session */
  toolUsageLog?: ToolUsageEntry[];

  // ============================================================================
  // GAP-A03: Phase 9 Report Injection
  // ============================================================================

  /** Phase 9 REPORT JSON (stored for agent prompt injection) */
  phase9Report?: Record<string, unknown>;

  // ============================================================================
  // GAP-L02: Local KU Promotion
  // ============================================================================

  /** Whether local KU promotion is enabled for this session */
  promoteLocalKUs?: boolean;

  /** Minimum confidence threshold for KU promotion */
  kuPromotionThreshold?: number;

  /** Promoted Knowledge Units from Phase 9 REPORT */
  promotedKUs?: PromotedKU[];

  // ============================================================================
  // GAP-LLM02: LLM Call Logging
  // ============================================================================

  /** Audit log of LLM API calls in this session */
  llmCallLog?: LLMCallEntry[];

  /** LLM usage statistics (updated after each call) */
  llmUsageStats?: LLMUsageStats;
}

// ============================================================================
// GAP-L02: Knowledge Unit Promotion Types
// ============================================================================

/**
 * A promoted Knowledge Unit from local corpus.
 * High-confidence KUs are promoted to session context for agent grounding.
 *
 * GAP-L02: Local KU promotion implementation
 */
export interface PromotedKU {
  /** Knowledge Unit ID (e.g., ku_001) */
  readonly id: string;
  /** The extracted knowledge/fact */
  readonly content: string;
  /** Source document reference */
  readonly source: string;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
  /** Category/type of knowledge */
  readonly category?: string;
  /** Related concepts */
  readonly relatedConcepts?: string[];
}

// ============================================================================
// GAP-LLM02: LLM Call Logging
// ============================================================================

/**
 * Entry recording an LLM API call for audit purposes.
 *
 * GAP-LLM02: LLM call logging implementation
 */
export interface LLMCallEntry {
  /** Unique call ID */
  readonly callId: string;
  /** ISO timestamp of call */
  readonly timestamp: string;
  /** Agent that made the call */
  readonly agentKey: string;
  /** Model used (e.g., claude-3-opus, gpt-4) */
  readonly model: string;
  /** Purpose of the call */
  readonly purpose: LLMCallPurpose;
  /** Input token count */
  readonly inputTokens: number;
  /** Output token count */
  readonly outputTokens: number;
  /** Total token count */
  readonly totalTokens: number;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Whether the call succeeded */
  readonly success: boolean;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Purpose categories for LLM calls (enforces LLM boundaries)
 *
 * GAP-LLM02: LLM call purpose classification
 */
export type LLMCallPurpose =
  | 'rhetorical_style'      // Style, tone, voice refinement
  | 'reasoning'             // Logical reasoning, argumentation
  | 'synthesis'             // Combining information
  | 'summarization'         // Condensing content
  | 'structure'             // Organizing, outlining
  | 'validation'            // Checking quality, consistency
  | 'translation'           // Language translation
  | 'knowledge_retrieval';  // FLAGGED: Should use local corpus instead

/**
 * LLM usage statistics for a session
 */
export interface LLMUsageStats {
  /** Total LLM calls */
  totalCalls: number;
  /** Total tokens used */
  totalTokens: number;
  /** Calls by purpose */
  callsByPurpose: Record<LLMCallPurpose, number>;
  /** Calls flagged as knowledge_retrieval (should be minimized) */
  knowledgeRetrievalCalls: number;
  /** Total duration of all calls */
  totalDurationMs: number;
}

/**
 * CLI error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Phase names constant
 * 7 phases as defined in constitution.md
 */
export const PHASE_NAMES: readonly string[] = [
  'Foundation',
  'Discovery',
  'Architecture',
  'Synthesis',
  'Design',
  'Writing',
  'Validation'
] as const;

/**
 * Get phase name by number (1-indexed)
 */
export function getPhaseName(phase: number): string {
  if (phase < 1 || phase > PHASE_NAMES.length) {
    return 'Unknown';
  }
  return PHASE_NAMES[phase - 1];
}

/** Phase 1-5 agent count (indices 0-29) */
export const PHASE_1_5_AGENT_COUNT = 30;

/** Phase 6 starts at this index */
export const PHASE_6_START_INDEX = 30;

/** Static Phase 7 agent count */
export const PHASE_7_AGENT_COUNT = 9;

/** Index where static Phase 7 agents start in PipelineConfigLoader */
export const STATIC_PHASE_7_START_INDEX = 36;

// ============================================================================
// TASK-PIPE-004: Next Command Types
// ============================================================================

/**
 * Options for the next command
 * [REQ-PIPE-002]
 */
export interface NextOptions {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Progress information for pipeline execution
 */
export interface ProgressInfo {
  completed: number;
  total: number;
  percentage: number;
  currentPhase: number;
  phaseName: string;
}

/**
 * Summary when pipeline is complete
 */
export interface CompletionSummary {
  duration: number;
  agentsCompleted: number;
  errors: number;
}

/**
 * Response from the next command
 * [REQ-PIPE-002]
 */
export interface NextResponse {
  sessionId: string;
  status: 'next' | 'complete';
  progress: ProgressInfo;
  agent?: AgentDetails;
  summary?: CompletionSummary;
  /** DESC episodic memory injection info */
  desc?: {
    episodesInjected: number;
    episodeIds: string[];
    /** Phase-aware window size used for retrieval (RULE-010 to RULE-014) */
    windowSize: number;
  };
  /** SonaEngine learned patterns injection info */
  patterns?: {
    patternsInjected: number;
    patternIds: string[];
    /** Combined weight of injected patterns */
    totalWeight: number;
  };
}

// ============================================================================
// TASK-PIPE-005: Complete Command Types
// ============================================================================

/**
 * Options for the complete command
 * [REQ-PIPE-003]
 */
export interface CompleteOptions {
  result?: string;
  file?: string;
  json?: boolean;
}

/**
 * Response from the complete command
 * [REQ-PIPE-003]
 * [PHASE-8-AUTO] Extended to include pipeline completion status
 */
export interface CompleteResponse {
  success: boolean;
  nextAgent?: string;
  /** True when all Phase 1-7 agents are complete */
  pipelineComplete?: boolean;
  /** True when Phase 8 finalize was automatically triggered */
  phase8Triggered?: boolean;
  /** True when Phase 8 prompts are ready for Claude Code Task tool */
  phase8Ready?: boolean;
  /** Phase 8 prompts with DYNAMIC agents per chapter for Claude Code execution */
  phase8Prompts?: Phase8PrepareResult;
  /** [PHASE-8-AUTO-FIX] True when Phase 8 completed automatically with final paper */
  phase8Completed?: boolean;
  /** [PHASE-8-AUTO-FIX] Phase 8 execution result with final paper path */
  phase8Result?: {
    outputPath: string | null;
    chaptersGenerated: number;
    totalWords: number;
    totalCitations: number;
  };
}

/**
 * Error when agent key doesn't match current agent
 * [REQ-PIPE-003]
 */
export class AgentMismatchError extends Error {
  public readonly expected: string;
  public readonly got: string;

  constructor(expected: string, got: string) {
    super(`Expected agent ${expected}, got ${got}`);
    this.name = 'AgentMismatchError';
    this.expected = expected;
    this.got = got;
  }
}
