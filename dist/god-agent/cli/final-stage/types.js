/**
 * Complete TypeScript type definitions for Phase 8 Final Stage
 *
 * Implements SPEC-TECH-001 Section 3 - Data Structures
 * Addresses gaps: GAP-H012 (CLI), GAP-C007 (Output Structure)
 */
/**
 * Custom error class for Final Stage operations
 * Exit codes per CONSTITUTION Appendix B
 */
export class FinalStageError extends Error {
    code;
    recoverable;
    exitCode;
    constructor(message, code, recoverable, exitCode) {
        super(message);
        this.code = code;
        this.recoverable = recoverable;
        this.exitCode = exitCode;
        this.name = 'FinalStageError';
    }
    /**
     * Map error code to exit code per CONSTITUTION Appendix B
     */
    static getExitCode(code) {
        const exitCodeMap = {
            NO_RESEARCH_DIR: 2,
            OUTPUT_EXISTS: 1,
            SCAN_FAILED: 2,
            MAPPING_FAILED: 4,
            NO_SOURCES: 4,
            STYLE_ERROR: 5,
            WRITE_ERROR: 1,
            TOKEN_OVERFLOW: 3,
            VALIDATION_FAILED: 5,
            SECURITY_VIOLATION: 6,
            CONSTITUTION_VIOLATION: 7
        };
        return exitCodeMap[code];
    }
}
//# sourceMappingURL=types.js.map