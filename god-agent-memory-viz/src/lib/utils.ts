/**
 * Utility functions for the God Agent Memory Visualization
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Combines class names using clsx
 * This is a simplified version - if tailwind-merge is needed later,
 * it can be added: twMerge(clsx(inputs))
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
