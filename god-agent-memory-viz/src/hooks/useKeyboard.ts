/**
 * Keyboard Hook Module
 *
 * Re-exports keyboard shortcuts functionality from useKeyboardShortcuts.
 * This module serves as the public API for keyboard-related hooks.
 *
 * @module hooks/useKeyboard
 */

export {
  useKeyboardShortcuts,
  createDefaultShortcuts,
  announceToScreenReader,
  getFocusableElements,
  trapFocus,
  focusFirstElement,
  createSkipLink,
  type ModifierKey,
  type ShortcutScope,
  type ShortcutCategory,
  type ShortcutDefinition,
  type UseKeyboardShortcutsOptions,
  type UseKeyboardShortcutsReturn,
  type DefaultShortcutsParams,
} from './useKeyboardShortcuts';
