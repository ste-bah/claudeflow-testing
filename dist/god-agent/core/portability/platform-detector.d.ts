/**
 * Platform Detector
 * TASK-NFR-003 - Portability Validation Suite (NFR-5)
 *
 * Detects platform capabilities:
 * - OS and architecture detection
 * - Node.js version checking
 * - WASM and SIMD support
 * - Native binding availability
 */
/**
 * Supported operating systems
 */
export type SupportedOS = 'linux' | 'darwin' | 'win32';
/**
 * Supported architectures
 */
export type SupportedArch = 'x64' | 'arm64';
/**
 * Platform information structure
 */
export interface PlatformInfo {
    /** Operating system */
    os: SupportedOS | 'unknown';
    /** CPU architecture */
    arch: SupportedArch | 'ia32' | 'unknown';
    /** Full Node.js version string */
    nodeVersion: string;
    /** Node.js major version number */
    nodeMajor: number;
    /** Whether native bindings are supported for this platform */
    nativeSupported: boolean;
    /** Whether WebAssembly is available */
    wasmSupported: boolean;
    /** Whether WASM SIMD is available */
    simdSupported: boolean;
    /** Platform identifier (e.g., "linux-x64") */
    platform: string;
}
/**
 * Compatibility report structure
 */
export interface CompatibilityReport {
    /** Platform identifier */
    platform: string;
    /** Node.js version */
    nodeVersion: string;
    /** Whether platform is fully supported */
    isSupported: boolean;
    /** Available capabilities */
    capabilities: {
        native: boolean;
        wasm: boolean;
        simd: boolean;
    };
    /** Compatibility warnings */
    warnings: string[];
    /** Performance recommendations */
    recommendations: string[];
}
/**
 * Supported platform matrix (platform identifier → true)
 */
export declare const SUPPORTED_PLATFORMS: Set<string>;
/**
 * Supported Node.js major versions
 */
export declare const SUPPORTED_NODE_VERSIONS: number[];
/**
 * Platform detector for NFR-5 portability validation
 *
 * Detects the current platform, capabilities, and generates
 * compatibility reports for runtime selection.
 *
 * @example
 * ```typescript
 * const detector = new PlatformDetector();
 * const info = detector.detect();
 *
 * console.log(`Platform: ${info.platform}`);
 * console.log(`Native supported: ${info.nativeSupported}`);
 * ```
 */
export declare class PlatformDetector {
    /**
     * Detect current platform information
     */
    detect(): PlatformInfo;
    /**
     * Get operating system
     */
    private getOS;
    /**
     * Get CPU architecture
     */
    private getArch;
    /**
     * Parse Node.js major version number
     */
    private parseNodeMajor;
    /**
     * Check WebAssembly support
     */
    private checkWasmSupport;
    /**
     * Check WASM SIMD support (for optimized vector operations)
     */
    private checkSimdSupport;
    /**
     * Check if Node.js version is supported
     */
    isNodeVersionSupported(major?: number): boolean;
    /**
     * Check if platform is fully supported
     */
    isPlatformSupported(platform?: string): boolean;
    /**
     * Get comprehensive compatibility report
     */
    getCompatibilityReport(): CompatibilityReport;
    /**
     * Generate warnings for current platform
     */
    private getWarnings;
    /**
     * Generate performance recommendations
     */
    private getRecommendations;
    /**
     * Get platform string for binary selection
     */
    getBinaryPlatform(): string;
    /**
     * Get detailed environment info for debugging
     */
    getEnvironmentInfo(): Record<string, unknown>;
    /**
     * Get system endianness
     */
    private getEndianness;
}
/**
 * Global platform detector instance
 */
export declare const platformDetector: PlatformDetector;
//# sourceMappingURL=platform-detector.d.ts.map