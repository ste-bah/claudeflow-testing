/**
 * Compatibility Matrix
 * TASK-NFR-003 - Portability Validation Suite (NFR-5.3, NFR-5.4)
 *
 * Generates compatibility matrices for CI/CD:
 * - GitHub Actions matrix configuration
 * - Platform × Node.js version grid
 * - Expected test results documentation
 */
/**
 * Platform test entry
 */
export interface PlatformTestEntry {
    /** Platform name */
    name: string;
    /** Operating system */
    os: string;
    /** Architecture */
    arch: string;
    /** Runtime tests to run */
    tests: ('native' | 'wasm' | 'javascript')[];
    /** Expected results per runtime */
    expectedResults: {
        native: 'pass' | 'skip' | 'fail';
        wasm: 'pass' | 'skip' | 'fail';
        javascript: 'pass' | 'skip' | 'fail';
    };
}
/**
 * Node.js version entry
 */
export interface NodeVersionEntry {
    /** Version string */
    version: string;
    /** LTS status */
    status: 'lts' | 'current' | 'maintenance' | 'eol';
    /** Testing priority */
    priority: 'high' | 'medium' | 'low';
    /** Special notes */
    notes?: string;
}
/**
 * GitHub Actions matrix configuration
 */
export interface GitHubActionsMatrix {
    /** OS runners */
    os: string[];
    /** Node.js versions */
    node: string[];
    /** Excluded combinations */
    exclude: {
        os: string;
        node: string;
    }[];
    /** Additional test configurations */
    include: {
        os: string;
        node: string;
        flags?: string;
    }[];
}
/**
 * Compatibility test suite
 */
export interface CompatibilityTestSuite {
    /** Platform configurations */
    platforms: PlatformTestEntry[];
    /** Node.js versions */
    nodeVersions: NodeVersionEntry[];
}
/**
 * Matrix entry result
 */
export interface MatrixEntryResult {
    /** OS runner */
    os: string;
    /** Node.js version */
    node: string;
    /** Architecture */
    arch: string;
    /** Native support */
    nativeSupported: boolean;
    /** WASM support */
    wasmSupported: boolean;
    /** Test command */
    testCommand: string;
}
/**
 * Compatibility matrix generator for NFR-5.3/5.4 validation
 *
 * Generates CI/CD matrix configurations for cross-platform testing.
 *
 * @example
 * ```typescript
 * const matrix = new CompatibilityMatrix();
 * const ghMatrix = matrix.generateGitHubActionsMatrix();
 *
 * console.log('OS:', ghMatrix.os);
 * console.log('Node:', ghMatrix.node);
 * ```
 */
export declare class CompatibilityMatrix {
    /**
     * Generate GitHub Actions matrix configuration
     */
    generateGitHubActionsMatrix(): GitHubActionsMatrix;
    /**
     * Generate complete compatibility test suite
     */
    generateTestSuite(): CompatibilityTestSuite;
    /**
     * Generate platform test entries
     */
    private generatePlatformEntries;
    /**
     * Generate Node.js version entries
     */
    private generateNodeVersionEntries;
    /**
     * Generate full matrix entries (platform × node version)
     */
    generateFullMatrix(): MatrixEntryResult[];
    /**
     * Map OS to GitHub Actions runner
     */
    private mapOsToRunner;
    /**
     * Generate test command for a matrix entry
     */
    private generateTestCommand;
    /**
     * Generate YAML for GitHub Actions workflow
     */
    generateGitHubActionsYAML(): string;
    /**
     * Generate markdown compatibility table
     */
    generateMarkdownTable(): string;
    /**
     * Check if a specific combination is supported
     */
    isSupported(os: string, arch: string, nodeVersion: number): boolean;
    /**
     * Get recommendations for unsupported configurations
     */
    getRecommendations(os: string, arch: string, nodeVersion: number): string[];
}
/**
 * Global compatibility matrix instance
 */
export declare const compatibilityMatrix: CompatibilityMatrix;
//# sourceMappingURL=compatibility-matrix.d.ts.map