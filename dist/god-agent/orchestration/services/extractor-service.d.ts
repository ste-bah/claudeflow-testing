/**
 * ExtractorService - Pattern Matching for Task Output
 *
 * Implements: TASK-ORC-004 (TECH-ORC-001 lines 602-677)
 *
 * Extracts structured findings from task output using regex patterns.
 * Handles code blocks, schemas, API contracts, decisions, errors, and file paths.
 *
 * @module orchestration/services/extractor-service
 */
import type { IExtractedFindings } from '../types.js';
/**
 * ExtractorService - Extracts structured information from task output
 */
export declare class ExtractorService {
    /**
     * Extract findings from task output
     *
     * @param output - Task output string
     * @returns Extracted findings with categorized content
     */
    extractFindings(output: string): IExtractedFindings;
    /**
     * Match code blocks with regex patterns
     *
     * Pattern: ```language\n...\n```
     *
     * @param output - Task output
     * @returns Array of code blocks with language tags
     */
    private matchCodeBlocks;
    /**
     * Extract schema definitions
     *
     * Patterns:
     * - TypeScript interfaces: interface Name { ... }
     * - Type definitions: type Name = ...
     *
     * @param output - Task output
     * @returns Array of schema definitions
     */
    private extractSchemas;
    /**
     * Extract API contracts
     *
     * Patterns:
     * - @Get('/path'), @Post('/path')
     * - GET /path, POST /path
     *
     * @param output - Task output
     * @returns Array of API contracts
     */
    private extractAPIContracts;
    /**
     * Extract architectural decisions
     *
     * Patterns:
     * - ## Decision
     * - ADR-XXX
     *
     * @param output - Task output
     * @returns Array of decisions
     */
    private extractDecisions;
    /**
     * Extract implementation summaries
     *
     * Looks for summary sections in output
     *
     * @param output - Task output
     * @returns Array of summaries
     */
    private extractSummaries;
    /**
     * Extract test results
     *
     * Looks for test output patterns
     *
     * @param output - Task output
     * @returns Array of test results
     */
    private extractTestResults;
    /**
     * Extract file paths
     *
     * Patterns:
     * - ./src/path/to/file.ts
     * - /absolute/path/to/file.ts
     * - src/path/to/file.ts
     *
     * @param output - Task output
     * @returns Array of file paths
     */
    private extractFilePaths;
    /**
     * Extract error messages
     *
     * Patterns:
     * - Error:
     * - Exception:
     * - Failed:
     *
     * @param output - Task output
     * @returns Array of error messages
     */
    private extractErrors;
    /**
     * Return empty findings structure
     */
    private emptyFindings;
}
//# sourceMappingURL=extractor-service.d.ts.map