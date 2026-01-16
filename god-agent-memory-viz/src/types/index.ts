/**
 * Type definitions for God Agent Memory Visualization
 *
 * This module re-exports all types and provides utility type definitions.
 * Import from '@/types' for convenient access to all types.
 *
 * @example
 * ```typescript
 * import { GraphNode, FilterState, EventType } from '@/types';
 * ```
 *
 * @module types
 */

// ============================================================================
// Re-export all type modules
// ============================================================================

export * from './database';
export * from './graph';
export * from './filters';
export * from './ui';
export * from './events';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make a type nullable (T | null)
 */
export type Nullable<T> = T | null;

/**
 * Make a type optional (T | undefined)
 */
export type Optional<T> = T | undefined;

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties of T required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Make all properties of T readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract keys of T whose values are of type V
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Extract keys of T whose values are NOT of type V
 */
export type KeysNotOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? never : K;
}[keyof T];

/**
 * Make specific keys of T optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys of T required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Make specific keys of T nullable
 */
export type NullableBy<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

/**
 * Ensure type T is not null or undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Extract the element type from an array type
 */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

/**
 * Create a type that requires at least one of the specified keys
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Create a type that allows only one of the specified keys
 */
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

/**
 * Create a union type from object values
 */
export type ValueOf<T> = T[keyof T];

/**
 * Create a type with all properties as string keys
 */
export type StringKeyOf<T> = Extract<keyof T, string>;

/**
 * Assert that a type extends another type
 */
export type Extends<T, U extends T> = U;

/**
 * Get function parameter types as tuple
 */
export type Parameters<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

/**
 * Get function return type
 */
export type ReturnType<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => infer R
  ? R
  : never;

/**
 * Async function type
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Async function with arguments
 */
export type AsyncFunctionWithArgs<A extends unknown[], T = void> = (
  ...args: A
) => Promise<T>;

// ============================================================================
// Brand Types (for nominal typing)
// ============================================================================

/**
 * Brand a type for nominal typing
 * @example
 * type UserId = Brand<string, 'UserId'>;
 * type SessionId = Brand<string, 'SessionId'>;
 */
export type Brand<T, B> = T & { readonly __brand: B };

/**
 * Commonly used branded types
 */
export type NodeId = Brand<string, 'NodeId'>;
export type EdgeId = Brand<string, 'EdgeId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type AgentId = Brand<string, 'AgentId'>;

// ============================================================================
// Result Types (for error handling)
// ============================================================================

/**
 * Success result
 */
export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * Failure result
 */
export interface Failure<E = Error> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Create a success result
 */
export const success = <T>(data: T): Success<T> => ({ success: true, data });

/**
 * Create a failure result
 */
export const failure = <E = Error>(error: E): Failure<E> => ({
  success: false,
  error,
});

/**
 * Check if result is success
 */
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> =>
  result.success;

/**
 * Check if result is failure
 */
export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> =>
  !result.success;
