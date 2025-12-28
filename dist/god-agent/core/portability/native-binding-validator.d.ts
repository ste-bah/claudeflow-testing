/**
 * Native Binding Validator
 * TASK-NFR-003 - Portability Validation Suite (NFR-5.1)
 *
 * Validates native Rust bindings:
 * - Module loading verification
 * - Function availability checks
 * - Basic operation testing
 * - Graceful error reporting
 */
/**
 * Function validation result
 */
export interface FunctionValidation {
    /** Function name */
    name: string;
    /** Whether function exists */
    available: boolean;
    /** Whether function works */
    working: boolean;
    /** Error message if failed */
    error?: string;
    /** Execution time in ms */
    executionTimeMs?: number;
}
/**
 * Module validation result
 */
export interface ModuleValidation {
    /** Module name */
    module: string;
    /** Whether module loaded */
    loaded: boolean;
    /** Load error if failed */
    error?: string;
    /** Load time in ms */
    loadTimeMs?: number;
    /** Validated functions */
    functions: FunctionValidation[];
}
/**
 * Native validation report
 */
export interface NativeValidationReport {
    /** Timestamp */
    timestamp: number;
    /** Platform identifier */
    platform: string;
    /** Validated modules */
    modules: ModuleValidation[];
    /** Summary statistics */
    summary: {
        totalModules: number;
        loadedModules: number;
        totalFunctions: number;
        workingFunctions: number;
        allLoaded: boolean;
        allWorking: boolean;
    };
}
/**
 * Module definition for validation
 */
export interface ModuleDefinition {
    /** Module name */
    name: string;
    /** Required functions */
    functions: string[];
    /** Optional module loader override */
    loader?: () => Promise<Record<string, unknown>>;
    /** Test data generator for functions */
    testDataGenerator?: (funcName: string) => unknown[];
}
/**
 * Default modules to validate
 */
export declare const DEFAULT_MODULE_DEFINITIONS: ModuleDefinition[];
/**
 * Native binding validator for NFR-5.1 validation
 *
 * Tests that native Rust modules load correctly and all required
 * functions are available and working.
 *
 * @example
 * ```typescript
 * const validator = new NativeBindingValidator();
 * const report = await validator.validateAll();
 *
 * if (report.summary.allWorking) {
 *   console.log('All native bindings working!');
 * }
 * ```
 */
export declare class NativeBindingValidator {
    private detector;
    private moduleDefinitions;
    private mockModules;
    constructor(moduleDefinitions?: ModuleDefinition[]);
    /**
     * Register a mock module for testing
     */
    registerMockModule(name: string, module: Record<string, unknown>): void;
    /**
     * Clear all mock modules
     */
    clearMockModules(): void;
    /**
     * Validate all native bindings
     */
    validateAll(): Promise<NativeValidationReport>;
    /**
     * Validate a specific module
     */
    validateModule(moduleDef: ModuleDefinition): Promise<ModuleValidation>;
    /**
     * Load a native module
     */
    private loadModule;
    /**
     * Create a simulated module for testing when native not available
     */
    private createSimulatedModule;
    /**
     * Validate a specific function within a module
     */
    private validateFunction;
    /**
     * Get default test data for common functions
     */
    private getDefaultTestData;
    /**
     * Validate a single module by name
     */
    validateModuleByName(moduleName: string): Promise<ModuleValidation>;
    /**
     * Check if all critical functions are available
     */
    checkCriticalFunctions(): Promise<{
        allAvailable: boolean;
        missing: string[];
    }>;
    /**
     * Get module definitions
     */
    getModuleDefinitions(): ModuleDefinition[];
    /**
     * Add a custom module definition
     */
    addModuleDefinition(definition: ModuleDefinition): void;
}
/**
 * Global native binding validator instance
 */
export declare const nativeBindingValidator: NativeBindingValidator;
//# sourceMappingURL=native-binding-validator.d.ts.map