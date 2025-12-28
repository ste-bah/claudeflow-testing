/**
 * God Agent Vector Validation Utilities
 *
 * Core validation functions that enforce the 1536-dimensional, L2-normalized,
 * finite-valued vector contract across the entire God Agent system.
 *
 * Implements: REQ-VEC-01, REQ-VEC-02, REQ-VEC-03, REQ-VEC-04
 * Referenced by: TASK-VEC-001
 *
 * Per constitution.md:
 * - VEC-01: ALL vectors MUST be exactly 1536 dimensions
 * - VEC-02: ALL vectors MUST be L2-normalized before storage
 * - VEC-03: NO NaN or Infinity values permitted in vectors
 * - VEC-04: Dimension validation required at ALL insertion boundaries
 */
/**
 * Calculate L2 norm (Euclidean length) of a vector
 *
 * @param vector - Float32Array to calculate norm of
 * @returns L2 norm value
 */
export declare function calculateNorm(vector: Float32Array): number;
/**
 * Check if a vector is L2-normalized (norm within tolerance of 1.0)
 *
 * @param vector - Float32Array to check
 * @param epsilon - Tolerance for deviation from 1.0 (default: 1e-6)
 * @returns true if vector is L2-normalized within tolerance
 */
export declare function isL2Normalized(vector: Float32Array, epsilon?: number): boolean;
/**
 * Check if all values in a vector are finite (no NaN or Infinity)
 *
 * @param vector - Float32Array to validate
 * @returns Object with valid flag and first invalid position/value if any
 */
export declare function validateFiniteValues(vector: Float32Array): {
    valid: boolean;
    invalidPosition?: number;
    invalidValue?: number;
};
/**
 * L2 normalize a vector in-place or return new normalized copy
 *
 * @param vector - Float32Array to normalize
 * @param inPlace - If true, modifies original vector; if false, returns new array
 * @returns Normalized vector (same array if inPlace, new array otherwise)
 * @throws ZeroVectorError if vector has zero magnitude
 */
export declare function normL2(vector: Float32Array, inPlace?: boolean): Float32Array;
/**
 * Comprehensive vector validation at insertion boundaries
 *
 * Validates that a vector:
 * 1. Has exactly the expected dimensions (default: 1536)
 * 2. Is L2-normalized (norm within tolerance of 1.0)
 * 3. Contains only finite values (no NaN or Infinity)
 *
 * Per constitution.md VEC-04: This function MUST be called at ALL insertion
 * boundaries (VectorDB, PatternMatcher, Hyperedge creation)
 *
 * @param vector - Float32Array to validate
 * @param expected - Expected dimension count (default: 1536)
 * @param context - Context string for error messages (e.g., "VectorDB.insert")
 * @throws GraphDimensionMismatchError if dimensions don't match
 * @throws NotNormalizedError if vector is not L2-normalized
 * @throws InvalidVectorValueError if vector contains NaN or Infinity
 */
export declare function assertDimensions(vector: Float32Array, expected?: number, context?: string): void;
/**
 * Validate vector dimensions only (without normalization check)
 * Useful for pre-normalization validation
 *
 * @param vector - Float32Array to validate
 * @param expected - Expected dimension count
 * @param context - Context string for error messages
 * @throws GraphDimensionMismatchError if dimensions don't match
 * @throws InvalidVectorValueError if vector contains NaN or Infinity
 */
export declare function assertDimensionsOnly(vector: Float32Array, expected?: number, context?: string): void;
/**
 * Create a validated, normalized vector from raw values
 * Convenience function that validates dimensions, normalizes, and validates again
 *
 * @param values - Raw values (number array or Float32Array)
 * @param context - Context string for error messages
 * @returns Validated, normalized Float32Array
 */
export declare function createValidatedVector(values: number[] | Float32Array, context?: string): Float32Array;
/**
 * Cosine similarity between two vectors
 * Assumes vectors are already L2-normalized
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (dot product for normalized vectors)
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Euclidean distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Euclidean distance
 */
export declare function euclideanDistance(a: Float32Array, b: Float32Array): number;
//# sourceMappingURL=vector-validation.d.ts.map