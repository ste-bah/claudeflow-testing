/**
 * Object manipulation utilities for God Agent Memory Visualization
 *
 * Provides pure functions for deep cloning, comparison, and array operations.
 *
 * @module utils/objects
 */

/**
 * Creates a deep clone of an object, handling Date, Array, Map, and Set
 * @param obj - Object to clone
 * @returns Deep cloned copy
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as T;
  if (obj instanceof Map)
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as T;
  if (obj instanceof Set) return new Set(Array.from(obj).map((item) => deepClone(item))) as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Performs deep equality comparison between two values
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}

/**
 * Creates a new object with only the specified keys
 * @param obj - Source object
 * @param keys - Keys to include
 * @returns New object with only specified keys
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

/**
 * Creates a new object without the specified keys
 * @param obj - Source object
 * @param keys - Keys to exclude
 * @returns New object without specified keys
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result as Omit<T, K>;
}

/**
 * Groups array items by a key function
 * @param arr - Array to group
 * @param keyFn - Function to extract grouping key
 * @returns Object with arrays grouped by key
 */
export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Returns unique items from an array based on a key function
 * @param arr - Array to filter
 * @param keyFn - Function to extract unique key
 * @returns Array with unique items
 */
export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sorts an array by a key function
 * @param arr - Array to sort
 * @param keyFn - Function to extract sort key
 * @param order - Sort order ('asc' or 'desc')
 * @returns New sorted array
 */
export function sortBy<T>(
  arr: T[],
  keyFn: (item: T) => string | number,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...arr].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
  return order === 'desc' ? sorted.reverse() : sorted;
}
