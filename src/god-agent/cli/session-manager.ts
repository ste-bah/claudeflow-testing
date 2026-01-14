/**
 * SessionManager - Handles pipeline session persistence
 * Implements REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-022, REQ-PIPE-023
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { validate as isValidUUID } from 'uuid';
import type {
  PipelineSession,
  SessionStatus,
  DataSourceMode,
  ToolPermissions,
  QueryIntent,
  ToolUsageEntry,
  PromotedKU,
  LLMCallEntry,
  LLMCallPurpose,
  LLMUsageStats
} from './cli-types.js';

const SESSION_DIR = '.phd-sessions';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_WRITE_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * SessionManager class for pipeline session persistence
 */
export class SessionManager {
  private sessionDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.sessionDir = path.join(baseDir, SESSION_DIR);
  }

  /**
   * Create new session object with initial state
   * [REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-023]
   */
createSession(
  sessionId: string,
  query: string,
  styleProfileId: string,
  pipelineId: string,
  dataSourceMode: DataSourceMode = "external"
): PipelineSession {

    // Validate UUID v4 format
    if (!isValidUUID(sessionId)) {
      throw new Error(`Invalid session ID format: ${sessionId}`);
    }

    const now = Date.now();

    return {
      sessionId,
      pipelineId,
      query,
      styleProfileId,
      dataSourceMode,
      status: 'running',
      currentPhase: 1,
      currentAgentIndex: 0,
      completedAgents: [],
      agentOutputs: {},
      startTime: now,
      lastActivityTime: now,
      errors: []
    };
  }

  /**
   * Save session to disk with atomic write pattern
   * Uses temp file + rename to prevent corruption
   * [REQ-PIPE-020]
   */
  async saveSession(session: PipelineSession): Promise<void> {
    // Ensure directory exists
    await this.ensureSessionDirectory();

    const sessionPath = this.getSessionPath(session.sessionId);
    const tempPath = `${sessionPath}.tmp`;

    // Serialize session
    const json = JSON.stringify(session, null, 2);

    // Retry logic for disk failures
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_WRITE_RETRIES; attempt++) {
      try {
        // Write to temp file
        await fs.writeFile(tempPath, json, 'utf-8');

        // Atomic rename
        await fs.rename(tempPath, sessionPath);

        return; // Success
      } catch (error) {
        lastError = error as Error;

        if (attempt < MAX_WRITE_RETRIES) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }

    // All retries failed
    throw new SessionPersistError(
      `Failed to save session after ${MAX_WRITE_RETRIES} attempts: ${lastError?.message}`,
      session
    );
  }

  /**
   * Load session from disk with validation
   * [REQ-PIPE-020]
   */
  async loadSession(sessionId: string): Promise<PipelineSession> {
    // Validate UUID format
    if (!isValidUUID(sessionId)) {
      throw new SessionNotFoundError(sessionId);
    }

    const sessionPath = this.getSessionPath(sessionId);

    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(content) as PipelineSession;

      // Validate required fields
      this.validateSession(session);

      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new SessionNotFoundError(sessionId);
      }

      if (error instanceof SyntaxError) {
        throw new SessionCorruptedError(sessionId);
      }

      throw error;
    }
  }

  /**
   * Check if session exists on disk
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    if (!isValidUUID(sessionId)) {
      return false;
    }

    try {
      await fs.access(this.getSessionPath(sessionId));
      return true;
    } catch {
      // INTENTIONAL: File access failure means session doesn't exist - false is correct response
      return false;
    }
  }

  /**
   * Check if session has expired (inactive > 24 hours)
   * [REQ-PIPE-022]
   */
  isSessionExpired(session: PipelineSession): boolean {
    const now = Date.now();
    const elapsed = now - session.lastActivityTime;
    return elapsed > SESSION_EXPIRY_MS;
  }

  /**
   * Update session's lastActivityTime
   * Used by next command to keep session alive
   * [REQ-PIPE-002]
   */
  async updateActivity(session: PipelineSession): Promise<void> {
    session.lastActivityTime = Date.now();
    await this.saveSession(session);
  }

  /**
   * Get sessions active within last N days
   * Default: 7 days for list command
   */
  async listSessions(options: { includeAll?: boolean; maxAgeDays?: number } = {}): Promise<PipelineSession[]> {
    const { includeAll = false, maxAgeDays = 7 } = options;

    await this.ensureSessionDirectory();

    const files = await fs.readdir(this.sessionDir);
    const sessionFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));

    const sessions: PipelineSession[] = [];
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const file of sessionFiles) {
      try {
        const sessionId = file.replace('.json', '');
        const session = await this.loadSession(sessionId);

        // Filter by age unless includeAll
        if (includeAll) {
          sessions.push(session);
        } else {
          const age = now - session.lastActivityTime;
          if (age <= maxAgeMs) {
            sessions.push(session);
          }
        }
      } catch (error) {
        // Skip corrupted sessions silently
        if (error instanceof SessionCorruptedError || error instanceof SessionNotFoundError) {
          continue;
        }
        throw error;
      }
    }

    // Sort by lastActivityTime descending (most recent first)
    sessions.sort((a, b) => b.lastActivityTime - a.lastActivityTime);

    return sessions;
  }


  /**
   * Update session status
   */
  async updateStatus(session: PipelineSession, status: SessionStatus): Promise<void> {
    session.status = status;
    session.lastActivityTime = Date.now();
    await this.saveSession(session);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!isValidUUID(sessionId)) {
      throw new SessionNotFoundError(sessionId);
    }

    const sessionPath = this.getSessionPath(sessionId);

    try {
      await fs.unlink(sessionPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new SessionNotFoundError(sessionId);
      }
      throw error;
    }
  }

  /**
   * Get most recently active session
   */
  async getMostRecentSession(): Promise<PipelineSession | null> {
    const sessions = await this.listSessions({ maxAgeDays: 1 });
    return sessions.length > 0 ? sessions[0] : null;
  }

  /**
   * Get session directory path
   */
  getSessionDirectory(): string {
    return this.sessionDir;
  }

  /**
   * Helper: Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDir, `${sessionId}.json`);
  }

  /**
   * Helper: Ensure session directory exists
   */
  private async ensureSessionDirectory(): Promise<void> {
    try {
      await fs.access(this.sessionDir);
    } catch {
      // INTENTIONAL: Directory doesn't exist - create it (this is expected on first run)
      await fs.mkdir(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Helper: Validate session structure
   */
  private validateSession(session: unknown): asserts session is PipelineSession {
    if (typeof session !== 'object' || session === null) {
      throw new Error('Invalid session: not an object');
    }

    const required = [
      'sessionId', 'pipelineId', 'query', 'styleProfileId', 'status',
      'currentPhase', 'currentAgentIndex', 'completedAgents',
      'startTime', 'lastActivityTime'
    ];

    for (const field of required) {
      if (!(field in session)) {
        throw new Error(`Invalid session: missing field ${field}`);
      }
    }
  }

  /**
   * Helper: Sleep utility for retry delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends Error {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

/**
 * Session corrupted error (invalid JSON)
 */
export class SessionCorruptedError extends Error {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session corrupted: ${sessionId}`);
    this.name = 'SessionCorruptedError';
    this.sessionId = sessionId;
  }
}

/**
 * Session persist error (disk write failure)
 */
export class SessionPersistError extends Error {
  public readonly session: PipelineSession;

  constructor(message: string, session: PipelineSession) {
    super(message);
    this.name = 'SessionPersistError';
    this.session = session;
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends Error {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session expired (inactive >24h): ${sessionId}`);
    this.name = 'SessionExpiredError';
    this.sessionId = sessionId;
  }
}

// ============================================================================
// GAP-H01: Programmatic Tool Gate
// ============================================================================

/**
 * Resolve tool permissions based on data source mode, coverage grade, and query intent.
 * Implements the programmatic tool gate for local/hybrid/external modes.
 *
 * GAP-H01: Programmatic tool gate implementation
 *
 * @param dataSourceMode - The research mode policy (local, hybrid, external)
 * @param coverageGrade - Coverage grade from Phase 9 REPORT (NONE, LOW, MED, HIGH)
 * @param queryIntent - Analyzed query intent for hybrid decisions
 * @returns ToolPermissions object indicating which tools are allowed
 */
export function resolveToolPermissions(
  dataSourceMode: DataSourceMode,
  coverageGrade: 'NONE' | 'LOW' | 'MED' | 'HIGH' = 'NONE',
  queryIntent?: QueryIntent
): ToolPermissions {
  // Local mode: No external tools permitted
  if (dataSourceMode === 'local') {
    return {
      webSearch: false,
      webFetch: false,
      perplexity: false
    };
  }

  // External mode: All external tools permitted
  if (dataSourceMode === 'external') {
    return {
      webSearch: true,
      webFetch: true,
      perplexity: true
    };
  }

  // Hybrid mode: Decision based on coverage and query intent
  // Rule 1: Low or no coverage -> allow external tools
  if (coverageGrade === 'NONE' || coverageGrade === 'LOW') {
    return {
      webSearch: true,
      webFetch: true,
      perplexity: true
    };
  }

  // Rule 2: Query requires recent information -> allow external tools
  if (queryIntent?.recencyRequired) {
    return {
      webSearch: true,
      webFetch: true,
      perplexity: true
    };
  }

  // Rule 3: Query references domains outside corpus -> allow external tools
  if (queryIntent?.outsideCorpusDomains && queryIntent.outsideCorpusDomains.length > 0) {
    return {
      webSearch: true,
      webFetch: true,
      perplexity: true
    };
  }

  // Rule 4: External supplementation explicitly justified -> allow external tools
  if (queryIntent?.externalSupplementationJustified) {
    return {
      webSearch: true,
      webFetch: true,
      perplexity: true
    };
  }

  // Default for hybrid with HIGH/MED coverage and no recency/outside-corpus intent:
  // Deny external tools (use local corpus)
  return {
    webSearch: false,
    webFetch: false,
    perplexity: false
  };
}

// ============================================================================
// GAP-H03: Query Intent Analyzer
// ============================================================================

/** Temporal markers that indicate recency requirements */
const RECENCY_MARKERS = [
  'latest', 'recent', 'current', 'new', 'modern', 'contemporary',
  '2024', '2025', '2026', 'today', 'now', 'emerging', 'cutting-edge',
  'state-of-the-art', 'up-to-date', 'breakthrough', 'novel'
];

/** Domains that are unlikely to be in most scholarly corpora */
const OUTSIDE_CORPUS_INDICATORS = [
  'cryptocurrency', 'blockchain', 'NFT', 'metaverse', 'web3',
  'GPT-4', 'GPT-5', 'Claude 3', 'Gemini', 'LLaMA', 'Mistral',
  'SORA', 'Devin', 'o1', 'o3', 'DeepSeek',
  'quantum computing', 'fusion energy',
  'SpaceX', 'Starship', 'Neuralink',
  'CRISPR', 'AlphaFold', 'mRNA vaccine'
];

/**
 * Analyze query intent to determine if external tools are needed.
 * Used in hybrid mode to make intelligent decisions about tool usage.
 *
 * GAP-H03: Query intent analyzer implementation
 *
 * @param query - The research query to analyze
 * @returns QueryIntent object with analysis results
 */
export function analyzeQueryIntent(query: string): QueryIntent {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  // Detect temporal markers indicating recency requirements
  const temporalMarkers: string[] = [];
  for (const marker of RECENCY_MARKERS) {
    if (queryLower.includes(marker.toLowerCase())) {
      temporalMarkers.push(marker);
    }
  }

  // Detect domains that are likely outside typical scholarly corpus
  const outsideCorpusDomains: string[] = [];
  for (const domain of OUTSIDE_CORPUS_INDICATORS) {
    if (queryLower.includes(domain.toLowerCase())) {
      outsideCorpusDomains.push(domain);
    }
  }

  // Check for explicit recency indicators
  const recencyRequired = temporalMarkers.length > 0 ||
    /\b(20[2-9][0-9])\b/.test(query) || // Years 2020-2099
    queryWords.some(w => ['latest', 'recent', 'current', 'emerging'].includes(w));

  // Determine if external supplementation is justified
  const externalSupplementationJustified =
    recencyRequired ||
    outsideCorpusDomains.length > 0 ||
    queryWords.includes('comparison') && queryWords.includes('current');

  return {
    recencyRequired,
    outsideCorpusDomains,
    externalSupplementationJustified,
    temporalMarkers
  };
}

// ============================================================================
// GAP-H04: Tool Usage Logging
// ============================================================================

/**
 * Create a tool usage entry for the audit log.
 *
 * GAP-H04: Tool usage logging implementation
 *
 * @param agentKey - The agent that used the tool
 * @param tool - The tool that was used (webSearch, webFetch, perplexity)
 * @param justification - Why the tool was used
 * @param coverageGrade - Coverage grade at the time of usage
 * @returns ToolUsageEntry for the audit log
 */
export function createToolUsageEntry(
  agentKey: string,
  tool: string,
  justification: string,
  coverageGrade: string
): ToolUsageEntry {
  return {
    timestamp: new Date().toISOString(),
    agentKey,
    tool,
    justification,
    coverageGradeAtTime: coverageGrade
  };
}

/**
 * Add a tool usage entry to a session's audit log.
 * Mutates the session in place and returns it.
 *
 * @param session - The pipeline session to update
 * @param entry - The tool usage entry to add
 * @returns The updated session
 */
export function logToolUsage(
  session: PipelineSession,
  entry: ToolUsageEntry
): PipelineSession {
  if (!session.toolUsageLog) {
    session.toolUsageLog = [];
  }
  session.toolUsageLog.push(entry);
  return session;
}

/**
 * Check if a specific tool is allowed for the current session.
 *
 * @param session - The pipeline session
 * @param tool - The tool to check (webSearch, webFetch, perplexity)
 * @returns true if tool is allowed, false otherwise
 */
export function isToolAllowed(
  session: PipelineSession,
  tool: 'webSearch' | 'webFetch' | 'perplexity'
): boolean {
  // If no permissions set, derive from dataSourceMode
  if (!session.toolPermissions) {
    const permissions = resolveToolPermissions(
      session.dataSourceMode || 'external',
      session.coverageGrade,
      session.queryIntent
    );
    return permissions[tool];
  }

  return session.toolPermissions[tool];
}

/**
 * Initialize tool permissions for a session based on its data source mode.
 * Called during session creation or when dataSourceMode changes.
 *
 * @param session - The pipeline session to initialize
 * @returns The session with toolPermissions set
 */
export function initializeToolPermissions(session: PipelineSession): PipelineSession {
  // Analyze query intent if not already done
  if (!session.queryIntent) {
    session.queryIntent = analyzeQueryIntent(session.query);
  }

  // Resolve permissions based on mode, coverage, and intent
  session.toolPermissions = resolveToolPermissions(
    session.dataSourceMode || 'external',
    session.coverageGrade || 'NONE',
    session.queryIntent
  );

  // Initialize empty audit log
  if (!session.toolUsageLog) {
    session.toolUsageLog = [];
  }

  return session;
}

/**
 * Update session coverage grade (called after Phase 9 REPORT).
 * Re-resolves tool permissions based on new coverage information.
 *
 * @param session - The pipeline session to update
 * @param coverageGrade - The new coverage grade from Phase 9 REPORT
 * @returns The session with updated coverage and permissions
 */
export function updateCoverageGrade(
  session: PipelineSession,
  coverageGrade: 'NONE' | 'LOW' | 'MED' | 'HIGH'
): PipelineSession {
  session.coverageGrade = coverageGrade;

  // Re-resolve permissions with new coverage info (only affects hybrid mode)
  if (session.dataSourceMode === 'hybrid') {
    session.toolPermissions = resolveToolPermissions(
      'hybrid',
      coverageGrade,
      session.queryIntent
    );
  }

  return session;
}

// ============================================================================
// GAP-L02: Local KU Promotion
// ============================================================================

/** Default confidence threshold for KU promotion */
const DEFAULT_KU_PROMOTION_THRESHOLD = 0.7;

/** Maximum number of KUs to promote */
const MAX_PROMOTED_KUS = 50;

/**
 * Extract Knowledge Unit data from Phase 9 REPORT JSON.
 *
 * GAP-L02: Local KU promotion implementation
 *
 * @param phase9Report - The Phase 9 REPORT JSON object
 * @returns Array of raw KU data objects
 */
function extractKUsFromReport(phase9Report: Record<string, unknown>): Array<{
  id: string;
  content: string;
  source: string;
  confidence: number;
  category?: string;
  relatedConcepts?: string[];
}> {
  const kus: Array<{
    id: string;
    content: string;
    source: string;
    confidence: number;
    category?: string;
    relatedConcepts?: string[];
  }> = [];

  // Try different JSON structures for KU data
  const kuSection = phase9Report.knowledge_units as Record<string, unknown> | undefined;

  if (!kuSection) {
    return kus;
  }

  // Get hits array (common structure)
  const hits = kuSection.hits as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(hits)) {
    for (const hit of hits) {
      const ku = {
        id: String(hit.id || hit.ku_id || `ku_${kus.length}`),
        content: String(hit.content || hit.text || hit.fact || ''),
        source: String(hit.source || hit.doc || hit.document || 'unknown'),
        confidence: Number(hit.confidence || hit.score || 0.5),
        category: hit.category ? String(hit.category) : undefined,
        relatedConcepts: Array.isArray(hit.related) ? hit.related.map(String) : undefined
      };

      if (ku.content) {
        kus.push(ku);
      }
    }
  }

  return kus;
}

/**
 * Promote high-confidence Knowledge Units from Phase 9 REPORT to session context.
 *
 * GAP-L02: Local KU promotion implementation
 *
 * @param session - The pipeline session to update
 * @param phase9Report - The Phase 9 REPORT JSON object
 * @param threshold - Minimum confidence threshold (default: 0.7)
 * @returns The session with promotedKUs populated
 */
export function promoteKnowledgeUnits(
  session: PipelineSession,
  phase9Report: Record<string, unknown>,
  threshold: number = DEFAULT_KU_PROMOTION_THRESHOLD
): PipelineSession {
  // Only promote in local or hybrid modes
  if (session.dataSourceMode === 'external') {
    return session;
  }

  // Check if promotion is enabled
  if (!session.promoteLocalKUs) {
    return session;
  }

  // Extract KUs from report
  const allKUs = extractKUsFromReport(phase9Report);

  // Filter by threshold and limit
  const promotedKUs: PromotedKU[] = allKUs
    .filter(ku => ku.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_PROMOTED_KUS)
    .map(ku => ({
      id: ku.id,
      content: ku.content,
      source: ku.source,
      confidence: ku.confidence,
      category: ku.category,
      relatedConcepts: ku.relatedConcepts
    }));

  session.promotedKUs = promotedKUs;
  session.kuPromotionThreshold = threshold;

  return session;
}

/**
 * Format promoted KUs for agent prompt injection.
 *
 * @param promotedKUs - Array of promoted Knowledge Units
 * @returns Formatted markdown string for prompt injection
 */
export function formatPromotedKUsForPrompt(promotedKUs: PromotedKU[]): string {
  if (!promotedKUs || promotedKUs.length === 0) {
    return '';
  }

  const lines = [
    '',
    '---',
    '## PROMOTED KNOWLEDGE UNITS (Local Corpus)',
    '',
    'The following high-confidence facts from the local corpus are available for grounding:',
    ''
  ];

  for (const ku of promotedKUs) {
    lines.push(`### ${ku.id} (confidence: ${(ku.confidence * 100).toFixed(0)}%)`);
    lines.push(`> ${ku.content}`);
    lines.push(`- Source: ${ku.source}`);
    if (ku.category) {
      lines.push(`- Category: ${ku.category}`);
    }
    if (ku.relatedConcepts && ku.relatedConcepts.length > 0) {
      lines.push(`- Related: ${ku.relatedConcepts.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Initialize KU promotion settings for a session.
 *
 * @param session - The pipeline session
 * @param enabled - Whether to enable KU promotion
 * @param threshold - Confidence threshold (optional)
 * @returns The session with KU promotion settings
 */
export function initializeKUPromotion(
  session: PipelineSession,
  enabled: boolean,
  threshold?: number
): PipelineSession {
  session.promoteLocalKUs = enabled;
  session.kuPromotionThreshold = threshold ?? DEFAULT_KU_PROMOTION_THRESHOLD;
  session.promotedKUs = [];
  return session;
}

// ============================================================================
// GAP-LLM02: LLM Call Logging
// ============================================================================

/** Counter for generating unique call IDs */
let llmCallCounter = 0;

/**
 * Generate a unique LLM call ID.
 */
function generateLLMCallId(): string {
  llmCallCounter++;
  return `llm_${Date.now()}_${llmCallCounter}`;
}

/**
 * Create an LLM call entry for the audit log.
 *
 * GAP-LLM02: LLM call logging implementation
 *
 * @param agentKey - The agent making the call
 * @param model - The model being used
 * @param purpose - The purpose of the LLM call
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param durationMs - Duration of the call in milliseconds
 * @param success - Whether the call succeeded
 * @param error - Error message if failed
 * @returns LLMCallEntry for the audit log
 */
export function createLLMCallEntry(
  agentKey: string,
  model: string,
  purpose: LLMCallPurpose,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  success: boolean,
  error?: string
): LLMCallEntry {
  return {
    callId: generateLLMCallId(),
    timestamp: new Date().toISOString(),
    agentKey,
    model,
    purpose,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    durationMs,
    success,
    error
  };
}

/**
 * Initialize empty LLM usage stats.
 */
function initializeLLMUsageStats(): LLMUsageStats {
  return {
    totalCalls: 0,
    totalTokens: 0,
    callsByPurpose: {
      rhetorical_style: 0,
      reasoning: 0,
      synthesis: 0,
      summarization: 0,
      structure: 0,
      validation: 0,
      translation: 0,
      knowledge_retrieval: 0
    },
    knowledgeRetrievalCalls: 0,
    totalDurationMs: 0
  };
}

/**
 * Log an LLM call to the session audit trail.
 *
 * GAP-LLM02: LLM call logging implementation
 *
 * @param session - The pipeline session to update
 * @param entry - The LLM call entry to add
 * @returns The updated session with warning if knowledge_retrieval purpose used
 */
export function logLLMCall(
  session: PipelineSession,
  entry: LLMCallEntry
): { session: PipelineSession; warning?: string } {
  // Initialize log if needed
  if (!session.llmCallLog) {
    session.llmCallLog = [];
  }
  if (!session.llmUsageStats) {
    session.llmUsageStats = initializeLLMUsageStats();
  }

  // Add entry to log
  session.llmCallLog.push(entry);

  // Update stats
  session.llmUsageStats.totalCalls++;
  session.llmUsageStats.totalTokens += entry.totalTokens;
  session.llmUsageStats.totalDurationMs += entry.durationMs;
  session.llmUsageStats.callsByPurpose[entry.purpose]++;

  // Track knowledge_retrieval calls (LLM boundary violation)
  let warning: string | undefined;
  if (entry.purpose === 'knowledge_retrieval') {
    session.llmUsageStats.knowledgeRetrievalCalls++;
    warning = `LLM BOUNDARY WARNING: Agent ${entry.agentKey} used LLM for knowledge_retrieval. ` +
      `Consider using local corpus instead. Total violations: ${session.llmUsageStats.knowledgeRetrievalCalls}`;
  }

  return { session, warning };
}

/**
 * Get LLM usage summary for reporting.
 *
 * @param session - The pipeline session
 * @returns Formatted usage summary
 */
export function getLLMUsageSummary(session: PipelineSession): string {
  const stats = session.llmUsageStats;
  if (!stats) {
    return 'No LLM calls recorded.';
  }

  const lines = [
    '## LLM Usage Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Calls | ${stats.totalCalls} |`,
    `| Total Tokens | ${stats.totalTokens.toLocaleString()} |`,
    `| Total Duration | ${(stats.totalDurationMs / 1000).toFixed(2)}s |`,
    `| Knowledge Retrieval Violations | ${stats.knowledgeRetrievalCalls} |`,
    '',
    '### Calls by Purpose',
    ''
  ];

  for (const [purpose, count] of Object.entries(stats.callsByPurpose)) {
    if (count > 0) {
      const flag = purpose === 'knowledge_retrieval' ? ' ⚠️' : '';
      lines.push(`- ${purpose}: ${count}${flag}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if LLM usage is within acceptable boundaries.
 *
 * @param session - The pipeline session
 * @returns Object with isValid flag and violations list
 */
export function validateLLMBoundaries(session: PipelineSession): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const stats = session.llmUsageStats;

  if (!stats) {
    return { isValid: true, violations: [] };
  }

  // Check for knowledge_retrieval violations
  if (stats.knowledgeRetrievalCalls > 0) {
    violations.push(
      `${stats.knowledgeRetrievalCalls} LLM calls used for knowledge_retrieval (should use local corpus)`
    );
  }

  // Check for excessive token usage (arbitrary threshold: 100k per session)
  if (stats.totalTokens > 100000) {
    violations.push(
      `High token usage: ${stats.totalTokens.toLocaleString()} tokens (threshold: 100,000)`
    );
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}
