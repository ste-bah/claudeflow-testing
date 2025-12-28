#!/usr/bin/env node
/**
 * PhD Pipeline CLI - Guided orchestration tool
 * Implements REQ-PIPE-001 through REQ-PIPE-007
 */
import type { StoredStyleProfile } from '../universal/style-profile.js';
import type { InitOptions, InitResponse, NextOptions, NextResponse, CompleteOptions, CompleteResponse, StatusOptions, StatusResponse, ListOptions, ListResponse, ResumeOptions, ResumeResponse, AbortOptions, AbortResponse } from './cli-types.js';
import type { FinalStageResult } from './final-stage/index.js';
/**
 * Execute init command
 * [REQ-PIPE-001, REQ-PIPE-011, REQ-PIPE-020, REQ-PIPE-021, REQ-PIPE-023]
 */
declare function commandInit(query: string, options: InitOptions, sessionBasePath?: string): Promise<InitResponse>;
/**
 * Determine which style profile to use
 * [REQ-PIPE-011]
 */
declare function determineStyleProfile(profileId?: string): Promise<string>;
/**
 * Load style profile by ID
 */
declare function loadStyleProfile(profileId: string): Promise<StoredStyleProfile>;
/**
 * Generate pipeline ID from query
 */
declare function generatePipelineId(query: string): string;
/**
 * Generate research folder slug from query
 */
declare function generateSlug(query: string): string;
/**
 * Execute next command
 * [REQ-PIPE-002]
 *
 * @param sessionId - Session ID to get next agent for
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandNext(sessionId: string, options: NextOptions, sessionBasePath?: string): Promise<NextResponse>;
/**
 * Execute complete command
 * [REQ-PIPE-003, REQ-PIPE-024]
 *
 * @param sessionId - Session ID to update
 * @param agentKey - Agent key being completed
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandComplete(sessionId: string, agentKey: string, options: CompleteOptions, sessionBasePath?: string): Promise<CompleteResponse>;
/**
 * Execute status command
 * [REQ-PIPE-004]
 *
 * @param sessionId - Session ID to get status for
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandStatus(sessionId: string, options: StatusOptions, sessionBasePath?: string): Promise<StatusResponse>;
/**
 * Execute list command
 * [REQ-PIPE-005]
 *
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandList(options: ListOptions, sessionBasePath?: string): Promise<ListResponse>;
/**
 * Execute resume command
 * [REQ-PIPE-006]
 *
 * @param sessionId - Session ID to resume
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandResume(sessionId: string, options: ResumeOptions, sessionBasePath?: string): Promise<ResumeResponse>;
/**
 * Execute abort command
 * [REQ-PIPE-007]
 *
 * @param sessionId - Session ID to abort
 * @param options - Command options
 * @param sessionBasePath - Optional base path for session storage (for testing)
 */
declare function commandAbort(sessionId: string, options: AbortOptions, sessionBasePath?: string): Promise<AbortResponse>;
/**
 * CLI options interface for finalize command
 */
interface FinalizeCliOptions {
    slug: string;
    force?: boolean;
    dryRun?: boolean;
    threshold?: string;
    verbose?: boolean;
    sequential?: boolean;
    skipValidation?: boolean;
}
/**
 * Execute finalize command
 * [REQ-PIPE-008] Per SPEC-FUNC-001 Section 3.1
 *
 * Exit Codes per CONSTITUTION Appendix B:
 * 0 - SUCCESS: All phases completed successfully
 * 1 - GENERAL_ERROR: Unspecified error
 * 2 - MISSING_FILES: Required input files missing
 * 3 - TOKEN_OVERFLOW: Context limit exceeded
 * 4 - MAPPING_FAILURE: Chapter with zero sources
 * 5 - VALIDATION_FAILURE: Output quality validation failed
 * 6 - SECURITY_VIOLATION: SE-xxx rule violated
 * 7 - CONSTITUTION_VIOLATION: Critical DI-xxx or FS-xxx rule violated
 *
 * @param cliOptions - Command line options
 * @returns FinalStageResult with output details
 */
declare function commandFinalize(cliOptions: FinalizeCliOptions): Promise<FinalStageResult>;
export { commandInit, commandNext, commandComplete, commandStatus, commandList, commandResume, commandAbort, commandFinalize, determineStyleProfile, loadStyleProfile, generatePipelineId, generateSlug };
//# sourceMappingURL=phd-cli.d.ts.map