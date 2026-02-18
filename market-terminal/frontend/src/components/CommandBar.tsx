/**
 * Command Bar component -- self-contained (zero props).
 *
 * ADR-001: Uses useTickerContext() and useCommand() directly.
 * ADR-003: Static suggestion list (9 items).
 * ADR-004: Command history via useRef inside useCommand.
 *
 * ARIA: Full combobox pattern with listbox suggestions.
 *
 * @module components/CommandBar
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useTickerContext } from '../contexts/TickerContext';
import { useCommand } from '../hooks/useCommand';
import {
  filterSuggestions,
  commandTypeColor,
} from '../types/command';
import type {
  CommandSuggestion,
  CommandResult,
} from '../types/command';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LISTBOX_ID = 'command-suggestions-listbox';

// ---------------------------------------------------------------------------
// File-private sub-components (NOT exported)
// ---------------------------------------------------------------------------

interface SuggestionListProps {
  readonly listboxId: string;
  readonly suggestions: readonly CommandSuggestion[];
  readonly selectedIndex: number;
  readonly onSelect: (suggestion: CommandSuggestion) => void;
}

function SuggestionList({
  listboxId,
  suggestions,
  selectedIndex,
  onSelect,
}: SuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <ul
      id={listboxId}
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1 z-50 bg-terminal-panel border border-terminal-border rounded shadow-lg max-h-60 overflow-y-auto"
    >
      {suggestions.map((s, i) => (
        <li
          key={`${s.type}-${s.value}`}
          id={`${listboxId}-option-${i}`}
          role="option"
          aria-selected={i === selectedIndex}
          className={`
            px-3 py-1.5 cursor-pointer flex items-center gap-2 font-mono text-sm
            ${i === selectedIndex ? 'bg-terminal-border' : 'hover:bg-terminal-border/50'}
          `}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent input blur
            onSelect(s);
          }}
        >
          <span className={`shrink-0 ${commandTypeColor(s.type)}`}>
            {s.label}
          </span>
          <span className="text-text-muted text-xs truncate">
            {s.description}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface ResponsePanelProps {
  readonly result: CommandResult;
  readonly onDismiss: () => void;
}

function ResponsePanel({ result, onDismiss }: ResponsePanelProps) {
  const hasError = result.error !== null;

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="mt-1 bg-terminal-panel border border-terminal-border rounded p-3 text-sm font-mono animate-slide-down">
      <div className="flex items-center justify-between mb-1">
        <span className={hasError ? 'text-accent-red' : 'text-accent-green'}>
          {hasError ? 'Error' : 'Result'}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-muted hover:text-text-primary text-xs"
          aria-label="Dismiss result"
        >
          [ESC]
        </button>
      </div>
      <div className="text-text-secondary whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
        {hasError
          ? result.error
          : JSON.stringify(result.data, null, 2)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component (zero props, self-contained via context + hooks)
// ---------------------------------------------------------------------------

export default function CommandBar() {
  const { activeTicker } = useTickerContext();
  const {
    result,
    loading,
    execute,
    historyBack,
    historyForward,
    clearResult,
  } = useCommand();

  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute filtered suggestions
  const suggestions = showSuggestions
    ? filterSuggestions(inputValue, activeTicker)
    : [];

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [inputValue]);

  const handleSelect = useCallback(
    (suggestion: CommandSuggestion) => {
      const value = suggestion.value.trim();
      setInputValue('');
      setShowSuggestions(false);
      setSelectedIndex(-1);
      if (value.length > 0) {
        execute(value);
      }
      inputRef.current?.focus();
    },
    [execute],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;
    setInputValue('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
    execute(trimmed);
  }, [inputValue, execute]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter': {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelect(suggestions[selectedIndex]);
          } else {
            handleSubmit();
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (showSuggestions && suggestions.length > 0) {
            setSelectedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0,
            );
          } else {
            // History forward (newer)
            const next = historyForward();
            if (next !== null) {
              setInputValue(next);
            } else {
              setInputValue('');
            }
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (showSuggestions && suggestions.length > 0) {
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1,
            );
          } else {
            // History back (older)
            const prev = historyBack();
            if (prev !== null) {
              setInputValue(prev);
            }
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (showSuggestions) {
            setShowSuggestions(false);
            setSelectedIndex(-1);
          } else if (result) {
            clearResult();
          }
          break;
        }

        case 'Tab': {
          if (showSuggestions && selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            const s = suggestions[selectedIndex];
            setInputValue(s.value);
            setShowSuggestions(false);
            setSelectedIndex(-1);
          }
          break;
        }

        default:
          break;
      }
    },
    [
      showSuggestions,
      suggestions,
      selectedIndex,
      handleSelect,
      handleSubmit,
      historyBack,
      historyForward,
      result,
      clearResult,
    ],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      setShowSuggestions(val.trim().length > 0);
    },
    [],
  );

  const handleFocus = useCallback(() => {
    if (inputValue.trim().length > 0) {
      setShowSuggestions(true);
    }
  }, [inputValue]);

  // Determine active-descendant for ARIA
  const activeDescendant =
    selectedIndex >= 0 ? `${LISTBOX_ID}-option-${selectedIndex}` : undefined;

  // Loading status text
  const statusText = loading ? 'Processing...' : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Input row */}
      <div
        className={`
          bg-terminal-panel border rounded p-2 flex items-center gap-2
          transition-colors duration-150
          ${loading ? 'border-accent-amber' : 'border-terminal-border focus-within:border-accent-amber'}
        `}
      >
        {/* Prompt character */}
        <span
          className={`
            font-mono text-sm shrink-0
            ${loading ? 'text-accent-amber animate-pulse' : 'text-accent-green'}
          `}
          aria-hidden="true"
        >
          &gt;
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={activeDescendant}
          placeholder="Enter command or ticker..."
          className="flex-1 bg-transparent text-text-primary font-mono text-sm outline-none placeholder-text-muted min-w-0"
          value={inputValue}
          readOnly={loading}
          maxLength={500}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />

        {/* Status indicator */}
        {statusText && (
          <span className="text-accent-amber font-mono text-xs shrink-0 animate-pulse">
            {statusText}
          </span>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <SuggestionList
          listboxId={LISTBOX_ID}
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
        />
      )}

      {/* Response panel */}
      {result && !loading && (
        <ResponsePanel result={result} onDismiss={clearResult} />
      )}
    </div>
  );
}
