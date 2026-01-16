/**
 * Debounce and throttle utilities for God Agent Memory Visualization
 *
 * Provides rate-limiting functions for event handlers and callbacks.
 *
 * @module utils/debounce
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after `delay` milliseconds have elapsed since the last call.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce(search, 300);
 * input.addEventListener('input', () => debouncedSearch(input.value));
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Creates a throttled version of a function that only executes
 * at most once per `limit` milliseconds. Trailing calls are preserved.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Creates a throttled version of a function using requestAnimationFrame.
 * Ideal for visual updates that should sync with the display refresh rate.
 *
 * @param fn - Function to throttle
 * @returns RAF-throttled function
 *
 * @example
 * const rafResize = rafThrottle(handleResize);
 * window.addEventListener('resize', rafResize);
 */
export function rafThrottle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}
