/**
 * PDF Generator Configuration Manager
 *
 * Centralized configuration management with environment variable support
 * and runtime overrides for the APA 7th Edition PDF generator.
 *
 * Environment Variables:
 * - APA_PDF_GENERATOR: Preferred generator type (pandoc-latex|pandoc-html|pdfkit|auto)
 * - APA_PDF_PANDOC_PATH: Path to pandoc binary
 * - APA_PDF_LATEX_PATH: Path to latex binary
 * - APA_PDF_OUTPUT_DIR: Default output directory
 * - APA_PDF_TEMP_DIR: Temp directory for processing
 * - APA_PDF_DEBUG: Enable debug mode (true|false)
 * - APA_PDF_LOG_LEVEL: Logging level (silent|error|warn|info|debug)
 * - APA_PDF_STRICT: Strict validation mode (true|false)
 *
 * @module pdf-generator/config
 */
/** Supported generator types */
export type PreferredGenerator = 'pandoc-latex' | 'pandoc-html' | 'pdfkit' | 'auto';
/** Supported log levels */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
/**
 * Margin configuration in inches.
 */
export interface MarginConfig {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
/**
 * Font configuration.
 */
export interface FontConfig {
    family: string;
    size: number;
}
/**
 * Complete PDF generator configuration.
 */
export interface PdfGeneratorConfig {
    preferredGenerator: PreferredGenerator;
    pandocPath?: string;
    latexPath?: string;
    defaultOutputDir: string;
    tempDir: string;
    cleanupTempFiles: boolean;
    margins: MarginConfig;
    font: FontConfig;
    lineSpacing: number;
    runningHeadMaxLength: number;
    strictValidation: boolean;
    debug: boolean;
    logLevel: LogLevel;
}
/**
 * Validation result for configuration.
 */
export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
}
/** Default configuration values */
declare const DEFAULT_CONFIG: PdfGeneratorConfig;
/**
 * Singleton configuration manager for PDF generator settings.
 *
 * Configuration is loaded in priority order:
 * 1. Runtime updates (highest priority)
 * 2. Environment variables
 * 3. Default values (lowest priority)
 *
 * @example
 * ```typescript
 * const config = ConfigManager.getInstance();
 * console.log(config.preferredGenerator);
 *
 * // Update at runtime
 * config.updateConfig({ debug: true });
 * ```
 */
export declare class ConfigManager {
    private static instance;
    private config;
    /**
     * Private constructor - use getInstance() instead.
     * Loads configuration from defaults and environment variables.
     */
    private constructor();
    /**
     * Get the singleton ConfigManager instance.
     * Creates the instance on first call.
     */
    static getInstance(): ConfigManager;
    /**
     * Reset the singleton instance.
     * Primarily useful for testing to ensure clean state.
     */
    static resetInstance(): void;
    /**
     * Get the current configuration as a read-only object.
     * Returns a frozen copy to prevent accidental modifications.
     */
    getConfig(): Readonly<PdfGeneratorConfig>;
    /**
     * Update configuration with partial values.
     * Performs deep merge with existing configuration.
     *
     * @param partial - Partial configuration to merge
     *
     * @example
     * ```typescript
     * config.updateConfig({
     *   debug: true,
     *   margins: { top: 1.5 }
     * });
     * ```
     */
    updateConfig(partial: Partial<PdfGeneratorConfig>): void;
    /**
     * Get the preferred generator type.
     */
    get preferredGenerator(): PreferredGenerator;
    /**
     * Check if debug mode is enabled.
     */
    get isDebug(): boolean;
    /**
     * Get the temporary directory path.
     */
    get tempDir(): string;
    /**
     * Get the default output directory.
     */
    get outputDir(): string;
    /**
     * Get the current log level.
     */
    get logLevel(): LogLevel;
    /**
     * Check if strict validation is enabled.
     */
    get strictValidation(): boolean;
    /**
     * Validate the current configuration.
     * Checks for valid values and accessible paths.
     *
     * @returns Validation result with any errors found
     */
    validateConfig(): ConfigValidationResult;
}
/**
 * Load and return the current configuration.
 * Creates a new ConfigManager instance if needed.
 *
 * @returns Complete PDF generator configuration
 */
export declare function loadConfig(): PdfGeneratorConfig;
/**
 * Get the current configuration (shorthand for ConfigManager.getInstance().getConfig()).
 *
 * @returns Read-only configuration object
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * console.log(config.preferredGenerator);
 * ```
 */
export declare function getConfig(): Readonly<PdfGeneratorConfig>;
/**
 * Update the global configuration with partial values.
 * Shorthand for ConfigManager.getInstance().updateConfig().
 *
 * @param options - Partial configuration to merge
 *
 * @example
 * ```typescript
 * configure({
 *   debug: true,
 *   logLevel: 'debug',
 *   preferredGenerator: 'pdfkit'
 * });
 * ```
 */
export declare function configure(options: Partial<PdfGeneratorConfig>): void;
/**
 * Validate the current configuration.
 * Shorthand for ConfigManager.getInstance().validateConfig().
 *
 * @returns Validation result with any errors
 */
export declare function validateConfig(): ConfigValidationResult;
/**
 * Reset configuration to defaults and reload from environment.
 * Primarily useful for testing.
 */
export declare function resetConfig(): void;
export { DEFAULT_CONFIG };
//# sourceMappingURL=config.d.ts.map