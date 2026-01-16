/**
 * Keyboard Shortcuts Help Modal Component
 *
 * Displays all available keyboard shortcuts grouped by category
 * with platform-aware key display (Cmd vs Ctrl) and search functionality.
 *
 * @module components/common/KeyboardShortcutsHelp
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, Keyboard, X } from 'lucide-react';
import { cn } from '@/utils';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import type {
  ShortcutDefinition,
  ShortcutCategory,
  UseKeyboardShortcutsReturn,
} from '@/hooks/useKeyboardShortcuts';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for KeyboardShortcutsHelp component
 */
export interface KeyboardShortcutsHelpProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Keyboard shortcuts data from useKeyboardShortcuts hook */
  keyboardShortcuts: UseKeyboardShortcutsReturn;
  /** Additional class name */
  className?: string;
}

/**
 * Category metadata for display
 */
interface CategoryMeta {
  label: string;
  icon: React.ReactNode;
  order: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Category display metadata
 */
const categoryMeta: Record<ShortcutCategory, CategoryMeta> = {
  navigation: {
    label: 'Navigation',
    icon: <span aria-hidden="true">&#x2194;</span>,
    order: 1,
  },
  selection: {
    label: 'Selection',
    icon: <span aria-hidden="true">&#x25A1;</span>,
    order: 2,
  },
  view: {
    label: 'View',
    icon: <span aria-hidden="true">&#x1F50D;</span>,
    order: 3,
  },
  editing: {
    label: 'Editing',
    icon: <span aria-hidden="true">&#x270E;</span>,
    order: 4,
  },
  general: {
    label: 'General',
    icon: <span aria-hidden="true">&#x2699;</span>,
    order: 5,
  },
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Individual shortcut row
 */
interface ShortcutRowProps {
  shortcut: ShortcutDefinition;
  displayKey: string;
  isEnabled: boolean;
}

function ShortcutRow({ shortcut, displayKey, isEnabled }: ShortcutRowProps) {
  return (
    <div
      className={cn(
        'keyboard-shortcuts__row',
        !isEnabled && 'keyboard-shortcuts__row--disabled'
      )}
      role="row"
    >
      <div className="keyboard-shortcuts__description" role="cell">
        <span className="keyboard-shortcuts__name">{shortcut.name}</span>
        <span className="keyboard-shortcuts__detail">{shortcut.description}</span>
      </div>
      <div className="keyboard-shortcuts__keys" role="cell">
        <kbd className="keyboard-shortcuts__kbd" aria-label={displayKey}>
          {displayKey}
        </kbd>
      </div>
    </div>
  );
}

/**
 * Category section
 */
interface CategorySectionProps {
  category: ShortcutCategory;
  shortcuts: ShortcutDefinition[];
  getShortcutDisplay: (shortcut: ShortcutDefinition) => string;
  isShortcutEnabled: (id: string) => boolean;
}

function CategorySection({
  category,
  shortcuts,
  getShortcutDisplay,
  isShortcutEnabled,
}: CategorySectionProps) {
  const meta = categoryMeta[category];

  // Filter out duplicate shortcuts (by name) - keep only the first one
  const uniqueShortcuts = useMemo(() => {
    const seen = new Set<string>();
    return shortcuts.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }, [shortcuts]);

  if (uniqueShortcuts.length === 0) return null;

  return (
    <section
      className="keyboard-shortcuts__category"
      aria-labelledby={`category-${category}`}
    >
      <h3 id={`category-${category}`} className="keyboard-shortcuts__category-title">
        {meta.icon}
        <span>{meta.label}</span>
      </h3>
      <div
        className="keyboard-shortcuts__list"
        role="table"
        aria-label={`${meta.label} shortcuts`}
      >
        {uniqueShortcuts.map((shortcut) => (
          <ShortcutRow
            key={shortcut.id}
            shortcut={shortcut}
            displayKey={getShortcutDisplay(shortcut)}
            isEnabled={isShortcutEnabled(shortcut.id)}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Keyboard shortcuts help modal component
 *
 * @example
 * ```tsx
 * const keyboardShortcuts = useKeyboardShortcuts({ shortcuts });
 *
 * <KeyboardShortcutsHelp
 *   isOpen={isHelpOpen}
 *   onClose={() => setIsHelpOpen(false)}
 *   keyboardShortcuts={keyboardShortcuts}
 * />
 * ```
 */
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  keyboardShortcuts,
  className,
}: KeyboardShortcutsHelpProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { shortcuts, getShortcutDisplay, isShortcutEnabled, isMac } = keyboardShortcuts;

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  /**
   * Filter shortcuts by search query
   */
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;

    const query = searchQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query)
    );
  }, [shortcuts, searchQuery]);

  /**
   * Group shortcuts by category
   */
  const groupedShortcuts = useMemo(() => {
    const groups: Record<ShortcutCategory, ShortcutDefinition[]> = {
      navigation: [],
      selection: [],
      view: [],
      editing: [],
      general: [],
    };

    filteredShortcuts.forEach((shortcut) => {
      groups[shortcut.category].push(shortcut);
    });

    // Sort groups by order
    const sortedCategories = (Object.keys(groups) as ShortcutCategory[]).sort(
      (a, b) => categoryMeta[a].order - categoryMeta[b].order
    );

    return sortedCategories
      .filter((cat) => groups[cat].length > 0)
      .map((cat) => ({ category: cat, shortcuts: groups[cat] }));
  }, [filteredShortcuts]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    []
  );

  /**
   * Clear search
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  /**
   * Get platform indicator text
   */
  const platformText = isMac ? 'macOS' : 'Windows/Linux';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="lg"
      className={cn('keyboard-shortcuts-modal', className)}
    >
      <div className="keyboard-shortcuts" role="document" aria-label="Keyboard shortcuts">
        {/* Header with platform info */}
        <div className="keyboard-shortcuts__header">
          <div className="keyboard-shortcuts__platform">
            <Keyboard size={16} aria-hidden="true" />
            <span>Showing shortcuts for {platformText}</span>
          </div>
        </div>

        {/* Search input */}
        <div className="keyboard-shortcuts__search">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={handleSearchChange}
            leftIcon={<Search size={16} />}
            rightIcon={
              searchQuery ? (
                <Button
                  variant="ghost"
                  iconOnly
                  size="sm"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </Button>
              ) : undefined
            }
            aria-label="Search keyboard shortcuts"
          />
        </div>

        {/* Shortcuts list */}
        <div className="keyboard-shortcuts__content">
          {groupedShortcuts.length > 0 ? (
            groupedShortcuts.map(({ category, shortcuts: categoryShortcuts }) => (
              <CategorySection
                key={category}
                category={category}
                shortcuts={categoryShortcuts}
                getShortcutDisplay={getShortcutDisplay}
                isShortcutEnabled={isShortcutEnabled}
              />
            ))
          ) : (
            <div className="keyboard-shortcuts__empty">
              <p>No shortcuts found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </div>

        {/* Footer with tips */}
        <div className="keyboard-shortcuts__footer">
          <div className="keyboard-shortcuts__tip">
            <strong>Tip:</strong> Press{' '}
            <kbd className="keyboard-shortcuts__kbd keyboard-shortcuts__kbd--inline">
              {isMac ? '?' : 'H'}
            </kbd>{' '}
            anytime to show this help.
          </div>
        </div>
      </div>
    </Modal>
  );
}

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;
