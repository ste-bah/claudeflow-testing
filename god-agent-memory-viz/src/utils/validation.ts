/**
 * Validation utilities for God Agent Memory Visualization
 *
 * Provides type guards and validation functions for graph data.
 *
 * @module utils/validation
 */

import type { NodeType, EdgeType } from '@/types/graph';
import { NODE_TYPE_ORDER } from '@/constants/nodeTypes';

/**
 * Valid edge types in the graph
 */
const EDGE_TYPES: EdgeType[] = [
  'uses_pattern',
  'creates_pattern',
  'linked_to',
  'informed_by_feedback',
  'belongs_to_route',
  'has_step',
  'has_checkpoint',
];

/**
 * Type guard for valid node types
 * @param type - Value to check
 * @returns True if value is a valid NodeType
 */
export function isValidNodeType(type: unknown): type is NodeType {
  return typeof type === 'string' && NODE_TYPE_ORDER.includes(type as NodeType);
}

/**
 * Type guard for valid edge types
 * @param type - Value to check
 * @returns True if value is a valid EdgeType
 */
export function isValidEdgeType(type: unknown): type is EdgeType {
  return typeof type === 'string' && EDGE_TYPES.includes(type as EdgeType);
}

/**
 * Validates if a string is a valid UUID v1-5
 * @param str - Value to check
 * @returns True if value is a valid UUID
 */
export function isValidUUID(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validates if a value is a valid timestamp
 * @param value - Value to check (number, string, or Date)
 * @returns True if value represents a valid timestamp
 */
export function isValidTimestamp(value: unknown): boolean {
  if (typeof value === 'number') {
    // Must be positive and within reasonable range (not more than 1 year in future)
    return value > 0 && value < Date.now() + 86400000 * 365;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard for non-empty strings
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for positive numbers
 * @param value - Value to check
 * @returns True if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Checks if a number is within a range (inclusive)
 * @param value - Number to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validates a filter state object and returns validation errors
 * @param state - Filter state object to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateFilterState(state: unknown): string[] {
  const errors: string[] = [];

  if (!state || typeof state !== 'object') {
    errors.push('Filter state must be an object');
    return errors;
  }

  const s = state as Record<string, unknown>;

  if (s.nodeTypes !== undefined && !Array.isArray(s.nodeTypes)) {
    errors.push('nodeTypes must be an array');
  }

  if (
    s.minConfidence !== undefined &&
    (typeof s.minConfidence !== 'number' || !isInRange(s.minConfidence, 0, 1))
  ) {
    errors.push('minConfidence must be a number between 0 and 1');
  }

  if (s.maxNodes !== undefined && (!isPositiveNumber(s.maxNodes) || s.maxNodes > 10000)) {
    errors.push('maxNodes must be a positive number <= 10000');
  }

  return errors;
}

/**
 * Safely parse a JSON string with a fallback value
 * @param str - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed value or fallback
 */
export function safeParseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
