/**
 * Test Vector Generation Utilities for Benchmarks
 *
 * Implements: TASK-VDB-002
 * Referenced by: vector-db.bench.ts
 *
 * Generates random L2-normalized vectors for benchmarking purposes.
 */

import { normL2, VECTOR_DIM } from '../../../src/god-agent/core/validation/index.js';

/**
 * Generate a single random L2-normalized vector
 *
 * @param dimension - Vector dimension (default: 768)
 * @returns L2-normalized Float32Array
 */
export function generateRandomVector(dimension: number = VECTOR_DIM): Float32Array {
  const vector = new Float32Array(dimension);

  // Generate random values in range [-1, 1]
  for (let i = 0; i < dimension; i++) {
    vector[i] = (Math.random() - 0.5) * 2;
  }

  // L2 normalize
  return normL2(vector, true);
}

/**
 * Generate multiple random L2-normalized vectors
 *
 * @param count - Number of vectors to generate
 * @param dimension - Vector dimension (default: 768)
 * @returns Array of L2-normalized Float32Arrays
 */
export function generateTestVectors(
  count: number,
  dimension: number = VECTOR_DIM
): Float32Array[] {
  const vectors: Float32Array[] = [];

  for (let i = 0; i < count; i++) {
    vectors.push(generateRandomVector(dimension));
  }

  return vectors;
}

/**
 * Generate test vectors with a fixed seed for reproducibility
 * Uses a simple LCG (Linear Congruential Generator) for deterministic randomness
 *
 * @param count - Number of vectors to generate
 * @param dimension - Vector dimension (default: 768)
 * @param seed - Random seed (default: 42)
 * @returns Array of L2-normalized Float32Arrays
 */
export function generateSeededTestVectors(
  count: number,
  dimension: number = VECTOR_DIM,
  seed: number = 42
): Float32Array[] {
  const vectors: Float32Array[] = [];

  // Simple LCG random number generator
  let state = seed;
  const lcgRandom = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      vector[j] = (lcgRandom() - 0.5) * 2;
    }
    vectors.push(normL2(vector, true));
  }

  return vectors;
}
