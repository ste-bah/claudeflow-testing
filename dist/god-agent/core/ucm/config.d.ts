/**
 * UCM Configuration
 * Universal Context Management System Configuration Schema and Loader
 *
 * CONSTITUTION: Configuration values per RULE-001 to RULE-075
 */
import type { IUniversalContextConfig, IChunkingConfig, ITokenDefaults, ISummarizationConfig, IProgressiveConfig, BreakPattern } from './types.js';
export declare const DEFAULT_BREAK_PATTERNS: BreakPattern[];
export declare const PROTECTED_PATTERNS: RegExp[];
export declare const DEFAULT_CHUNKING_CONFIG: IChunkingConfig;
export declare const DEFAULT_TOKEN_DEFAULTS: ITokenDefaults;
/**
 * Summarization budget allocation per RULE-043
 */
export declare const DEFAULT_SUMMARIZATION_CONFIG: ISummarizationConfig;
/**
 * Progressive writing config per RULE-008
 */
export declare const DEFAULT_PROGRESSIVE_CONFIG: IProgressiveConfig;
/**
 * Default Universal Context Configuration
 */
export declare const DEFAULT_UCM_CONFIG: IUniversalContextConfig;
/**
 * Load UCM configuration with defaults
 */
export declare function loadConfig(overrides?: Partial<IUniversalContextConfig>): IUniversalContextConfig;
/**
 * Validate configuration
 */
export declare function validateConfig(config: IUniversalContextConfig): void;
/**
 * Load and validate configuration
 */
export declare function loadAndValidateConfig(overrides?: Partial<IUniversalContextConfig>): IUniversalContextConfig;
/**
 * Get environment-based configuration overrides
 */
export declare function getEnvOverrides(): Partial<IUniversalContextConfig>;
/**
 * Load configuration with environment overrides
 */
export declare function loadConfigWithEnv(overrides?: Partial<IUniversalContextConfig>): IUniversalContextConfig;
//# sourceMappingURL=config.d.ts.map