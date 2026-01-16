/**
 * Class name utility for conditional CSS classes
 *
 * Uses clsx for merging conditional class names.
 *
 * @module utils/cn
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Merges class names with conditional support
 * @param inputs - Class values to merge
 * @returns Merged class string
 * @example
 * cn('px-2 py-1', 'px-4') // => 'px-2 py-1 px-4'
 * cn('text-red-500', condition && 'text-blue-500') // conditional classes
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
