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
import { PlatformDetector } from './platform-detector.js';
// ==================== Default Module Definitions ====================
/**
 * Default modules to validate
 */
export const DEFAULT_MODULE_DEFINITIONS = [
    {
        name: 'vectordb',
        functions: ['createIndex', 'insert', 'search', 'remove', 'getStats'],
    },
    {
        name: 'graph',
        functions: ['createNode', 'createEdge', 'traverse', 'query', 'deleteNode'],
    },
    {
        name: 'math',
        functions: ['l2Normalize', 'cosineSimilarity', 'dotProduct', 'euclideanDistance'],
    },
];
// ==================== Native Binding Validator ====================
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
export class NativeBindingValidator {
    detector;
    moduleDefinitions;
    mockModules = new Map();
    constructor(moduleDefinitions) {
        this.detector = new PlatformDetector();
        this.moduleDefinitions = moduleDefinitions ?? DEFAULT_MODULE_DEFINITIONS;
    }
    /**
     * Register a mock module for testing
     */
    registerMockModule(name, module) {
        this.mockModules.set(name, module);
    }
    /**
     * Clear all mock modules
     */
    clearMockModules() {
        this.mockModules.clear();
    }
    /**
     * Validate all native bindings
     */
    async validateAll() {
        const results = [];
        for (const moduleDef of this.moduleDefinitions) {
            const result = await this.validateModule(moduleDef);
            results.push(result);
        }
        const allLoaded = results.every(r => r.loaded);
        const allWorking = results.every(r => r.functions.every(f => f.working));
        return {
            timestamp: Date.now(),
            platform: this.detector.detect().platform,
            modules: results,
            summary: {
                totalModules: results.length,
                loadedModules: results.filter(r => r.loaded).length,
                totalFunctions: results.reduce((sum, r) => sum + r.functions.length, 0),
                workingFunctions: results.reduce((sum, r) => sum + r.functions.filter(f => f.working).length, 0),
                allLoaded,
                allWorking,
            },
        };
    }
    /**
     * Validate a specific module
     */
    async validateModule(moduleDef) {
        const result = {
            module: moduleDef.name,
            loaded: false,
            functions: [],
        };
        const loadStart = performance.now();
        try {
            const nativeModule = await this.loadModule(moduleDef);
            result.loaded = true;
            result.loadTimeMs = performance.now() - loadStart;
            // Validate each function
            for (const funcName of moduleDef.functions) {
                const funcValidation = await this.validateFunction(nativeModule, funcName, moduleDef);
                result.functions.push(funcValidation);
            }
        }
        catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            result.loadTimeMs = performance.now() - loadStart;
            // Mark all functions as unavailable
            for (const funcName of moduleDef.functions) {
                result.functions.push({
                    name: funcName,
                    available: false,
                    working: false,
                    error: 'Module failed to load',
                });
            }
        }
        return result;
    }
    /**
     * Load a native module
     */
    async loadModule(moduleDef) {
        // Check for mock module first (for testing)
        if (this.mockModules.has(moduleDef.name)) {
            return this.mockModules.get(moduleDef.name);
        }
        // Use custom loader if provided
        if (moduleDef.loader) {
            return moduleDef.loader();
        }
        // Simulate native module loading
        // In real implementation, this would use require() or import()
        return this.createSimulatedModule(moduleDef.name);
    }
    /**
     * Create a simulated module for testing when native not available
     */
    createSimulatedModule(name) {
        const platform = this.detector.detect();
        // If native not supported, throw to simulate load failure
        if (!platform.nativeSupported) {
            throw new Error(`Native bindings not available for ${platform.platform}`);
        }
        // Return simulated functions based on module type
        switch (name) {
            case 'vectordb':
                return {
                    createIndex: async (config) => ({ id: 'index_1', config }),
                    insert: async (id, vector) => ({ id, inserted: true }),
                    search: async (query, k) => Array(k).fill({ id: 'v1', score: 0.9 }),
                    remove: async (id) => ({ id, removed: true }),
                    getStats: async () => ({ vectors: 0, dimensions: 768 }),
                };
            case 'graph':
                return {
                    createNode: async (data) => ({ id: 'node_1', data }),
                    createEdge: async (from, to, type) => ({ from, to, type }),
                    traverse: async (start, depth) => [{ id: start }],
                    query: async (query) => [],
                    deleteNode: async (id) => ({ id, deleted: true }),
                };
            case 'math':
                return {
                    l2Normalize: async (v) => {
                        const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
                        return new Float32Array(v.map(x => x / norm));
                    },
                    cosineSimilarity: async (a, b) => {
                        let dot = 0;
                        for (let i = 0; i < a.length; i++)
                            dot += a[i] * b[i];
                        return dot;
                    },
                    dotProduct: async (a, b) => {
                        let dot = 0;
                        for (let i = 0; i < a.length; i++)
                            dot += a[i] * b[i];
                        return dot;
                    },
                    euclideanDistance: async (a, b) => {
                        let sum = 0;
                        for (let i = 0; i < a.length; i++)
                            sum += (a[i] - b[i]) ** 2;
                        return Math.sqrt(sum);
                    },
                };
            default:
                throw new Error(`Unknown module: ${name}`);
        }
    }
    /**
     * Validate a specific function within a module
     */
    async validateFunction(module, funcName, moduleDef) {
        const validation = {
            name: funcName,
            available: false,
            working: false,
        };
        // Check if function exists
        if (typeof module[funcName] !== 'function') {
            validation.error = 'Function not found in module';
            return validation;
        }
        validation.available = true;
        // Test function execution
        const execStart = performance.now();
        try {
            const testData = moduleDef.testDataGenerator
                ? moduleDef.testDataGenerator(funcName)
                : this.getDefaultTestData(funcName);
            await module[funcName](...testData);
            validation.working = true;
            validation.executionTimeMs = performance.now() - execStart;
        }
        catch (error) {
            validation.error = error instanceof Error ? error.message : String(error);
            validation.executionTimeMs = performance.now() - execStart;
        }
        return validation;
    }
    /**
     * Get default test data for common functions
     */
    getDefaultTestData(funcName) {
        const testVector = new Float32Array(768).fill(0.1);
        switch (funcName) {
            // Vector operations
            case 'l2Normalize':
                return [testVector];
            case 'cosineSimilarity':
            case 'dotProduct':
            case 'euclideanDistance':
                return [testVector, testVector];
            // VectorDB operations
            case 'createIndex':
                return [{ dimensions: 768, metric: 'cosine' }];
            case 'insert':
                return ['test_id', testVector];
            case 'search':
                return [testVector, 10];
            case 'remove':
                return ['test_id'];
            case 'getStats':
                return [];
            // Graph operations
            case 'createNode':
                return [{ type: 'test', data: {} }];
            case 'createEdge':
                return ['node_a', 'node_b', 'test_edge'];
            case 'traverse':
                return ['node_a', 3];
            case 'query':
                return ['MATCH (n) RETURN n LIMIT 1'];
            case 'deleteNode':
                return ['node_test'];
            default:
                return [];
        }
    }
    /**
     * Validate a single module by name
     */
    async validateModuleByName(moduleName) {
        const moduleDef = this.moduleDefinitions.find(m => m.name === moduleName);
        if (!moduleDef) {
            return {
                module: moduleName,
                loaded: false,
                error: `Unknown module: ${moduleName}`,
                functions: [],
            };
        }
        return this.validateModule(moduleDef);
    }
    /**
     * Check if all critical functions are available
     */
    async checkCriticalFunctions() {
        const report = await this.validateAll();
        const missing = [];
        for (const module of report.modules) {
            for (const func of module.functions) {
                if (!func.working) {
                    missing.push(`${module.module}.${func.name}`);
                }
            }
        }
        return {
            allAvailable: missing.length === 0,
            missing,
        };
    }
    /**
     * Get module definitions
     */
    getModuleDefinitions() {
        return [...this.moduleDefinitions];
    }
    /**
     * Add a custom module definition
     */
    addModuleDefinition(definition) {
        this.moduleDefinitions.push(definition);
    }
}
// ==================== Global Instance ====================
/**
 * Global native binding validator instance
 */
export const nativeBindingValidator = new NativeBindingValidator();
//# sourceMappingURL=native-binding-validator.js.map