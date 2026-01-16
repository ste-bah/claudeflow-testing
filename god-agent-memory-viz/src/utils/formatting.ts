/**
 * Formatting utilities for God Agent Memory Visualization
 *
 * Provides functions for formatting dates, numbers, durations, and strings.
 *
 * @module utils/formatting
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Formats a date using date-fns format string
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param formatStr - date-fns format string (default: 'PPp')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number, formatStr = 'PPp'): string {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  return format(d, formatStr);
}

/**
 * Formats a date as relative time (e.g., "5 minutes ago")
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @returns Relative time string with suffix
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Formats a duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "5m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Formats a number using Intl.NumberFormat
 * @param num - Number to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(num);
}

/**
 * Formats a number in compact notation (e.g., 1.5K, 2.3M)
 * @param num - Number to format
 * @returns Compact formatted string
 */
export function formatCompact(num: number): string {
  if (num < 1000) return String(num);
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
}

/**
 * Formats bytes to human-readable size string
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a decimal value as a percentage
 * @param value - Decimal value (0-1)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Truncates a string to a maximum length with suffix
 * @param str - String to truncate
 * @param maxLength - Maximum length including suffix
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts a string to title case
 * @param str - String to convert
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Converts a string to a URL-safe slug
 * @param str - String to slugify
 * @returns Slugified string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
