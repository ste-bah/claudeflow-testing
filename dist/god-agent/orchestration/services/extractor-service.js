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
/**
 * ExtractorService - Extracts structured information from task output
 */
export class ExtractorService {
    /**
     * Extract findings from task output
     *
     * @param output - Task output string
     * @returns Extracted findings with categorized content
     */
    extractFindings(output) {
        if (!output || output.trim().length === 0) {
            return this.emptyFindings();
        }
        try {
            return {
                codeBlocks: this.matchCodeBlocks(output),
                schemas: this.extractSchemas(output),
                apiContracts: this.extractAPIContracts(output),
                decisions: this.extractDecisions(output),
                summaries: this.extractSummaries(output),
                testResults: this.extractTestResults(output),
                filePaths: this.extractFilePaths(output),
                errors: this.extractErrors(output)
            };
        }
        catch (error) {
            console.warn('[ExtractorService] Extraction error (non-fatal):', error);
            return this.emptyFindings();
        }
    }
    /**
     * Match code blocks with regex patterns
     *
     * Pattern: ```language\n...\n```
     *
     * @param output - Task output
     * @returns Array of code blocks with language tags
     */
    matchCodeBlocks(output) {
        const codeBlocks = [];
        // Pattern: ```language\n...\n```
        const pattern = /```(\w+)\n([\s\S]*?)\n```/g;
        let match;
        while ((match = pattern.exec(output)) !== null) {
            codeBlocks.push({
                language: match[1],
                code: match[2],
                description: undefined
            });
        }
        return codeBlocks;
    }
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
    extractSchemas(output) {
        const schemas = [];
        // TypeScript interfaces
        const interfacePattern = /interface\s+(\w+)\s*(\{[^}]+\})/g;
        let match;
        while ((match = interfacePattern.exec(output)) !== null) {
            schemas.push({
                type: 'interface',
                name: match[1],
                definition: match[2]
            });
        }
        // Type definitions
        const typePattern = /type\s+(\w+)\s*=\s*([^;]+);/g;
        while ((match = typePattern.exec(output)) !== null) {
            schemas.push({
                type: 'type',
                name: match[1],
                definition: match[2]
            });
        }
        return schemas;
    }
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
    extractAPIContracts(output) {
        const contracts = [];
        // Decorator pattern: @Get('/path')
        const decoratorPattern = /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
        let match;
        while ((match = decoratorPattern.exec(output)) !== null) {
            contracts.push({
                method: match[1].toUpperCase(),
                path: match[2],
                description: '',
                contract: match[0]
            });
        }
        // HTTP method pattern: POST /path
        const httpPattern = /(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w\/-]+)/gi;
        match = null; // Reset match variable
        while ((match = httpPattern.exec(output)) !== null) {
            // Avoid duplicates
            const exists = contracts.some(c => c.method === match[1] && c.path === match[2]);
            if (!exists) {
                contracts.push({
                    method: match[1].toUpperCase(),
                    path: match[2],
                    description: '',
                    contract: match[0]
                });
            }
        }
        return contracts;
    }
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
    extractDecisions(output) {
        const decisions = [];
        // ## Decision pattern
        const decisionPattern = /##\s*Decision[:\s]+([^\n]+)\n([\s\S]*?)(?=\n##|\n\n|$)/gi;
        let match;
        while ((match = decisionPattern.exec(output)) !== null) {
            decisions.push({
                topic: match[1].trim(),
                decision: match[1].trim(),
                reasoning: match[2].trim()
            });
        }
        // ADR pattern
        const adrPattern = /ADR-(\d+)[:\s]+([^\n]+)\n([\s\S]*?)(?=\nADR-|\n\n|$)/gi;
        while ((match = adrPattern.exec(output)) !== null) {
            decisions.push({
                topic: `ADR-${match[1]}`,
                decision: match[2].trim(),
                reasoning: match[3].trim()
            });
        }
        return decisions;
    }
    /**
     * Extract implementation summaries
     *
     * Looks for summary sections in output
     *
     * @param output - Task output
     * @returns Array of summaries
     */
    extractSummaries(output) {
        const summaries = [];
        // ## Summary pattern
        const summaryPattern = /##\s*Summary[:\s]*\n([\s\S]*?)(?=\n##|\n\n\n|$)/gi;
        let match;
        while ((match = summaryPattern.exec(output)) !== null) {
            const summary = match[1].trim();
            if (summary.length > 0) {
                summaries.push(summary);
            }
        }
        return summaries;
    }
    /**
     * Extract test results
     *
     * Looks for test output patterns
     *
     * @param output - Task output
     * @returns Array of test results
     */
    extractTestResults(output) {
        const results = [];
        // Pattern: X passing, Y failing
        const testPattern = /(\d+)\s+passing[,\s]+(\d+)\s+failing/gi;
        const match = testPattern.exec(output);
        if (match) {
            results.push({
                testSuite: 'Test Suite',
                passed: parseInt(match[1], 10),
                failed: parseInt(match[2], 10),
                details: match[0]
            });
        }
        return results;
    }
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
    extractFilePaths(output) {
        const filePaths = [];
        // Match file paths with extensions
        const pathPattern = /(?:\.?\/)?[\w\-\/]+\/[\w\-\.]+\.\w+/g;
        let match;
        while ((match = pathPattern.exec(output)) !== null) {
            filePaths.push(match[0]);
        }
        // Deduplicate
        return [...new Set(filePaths)];
    }
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
    extractErrors(output) {
        const errors = [];
        // Error pattern
        const errorPattern = /(Error|Exception|Failed):[^\n]+/gi;
        let match;
        while ((match = errorPattern.exec(output)) !== null) {
            errors.push(match[0]);
        }
        return errors;
    }
    /**
     * Return empty findings structure
     */
    emptyFindings() {
        return {
            codeBlocks: [],
            schemas: [],
            apiContracts: [],
            decisions: [],
            summaries: [],
            testResults: [],
            filePaths: [],
            errors: []
        };
    }
}
//# sourceMappingURL=extractor-service.js.map