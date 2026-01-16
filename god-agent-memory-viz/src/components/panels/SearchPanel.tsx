/**
 * SearchPanel Component
 *
 * Provides search functionality for finding nodes and edges in the graph.
 * Supports text search, regex mode, case sensitivity, and field filtering.
 *
 * @module components/panels/SearchPanel
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { useGraphStore } from '../../stores/graphStore';
import type { GraphNode } from '../../types/graph';
import type { SearchQuery } from '../../stores/filterStore';

// ============================================================================
// Types
// ============================================================================

interface SearchPanelProps {
  /** Additional CSS class name */
  className?: string;
  /** Callback when a search result is clicked */
  onResultClick?: (nodeId: string) => void;
  /** Maximum number of results to display */
  maxResults?: number;
}

interface SearchResultItemProps {
  node: GraphNode;
  searchText: string;
  searchFields: ('label' | 'id' | 'data')[];
  caseSensitive: boolean;
  useRegex: boolean;
  isSelected: boolean;
  onClick: () => void;
}

type SearchField = 'label' | 'id' | 'data';

// ============================================================================
// Constants
// ============================================================================

/** Node type colors matching the constitution specification */
const NODE_TYPE_COLORS: Record<string, string> = {
  trajectory: 'var(--node-trajectory, #f59e0b)',
  pattern: 'var(--node-pattern, #ec4899)',
  episode: 'var(--node-episode, #14b8a6)',
  feedback: 'var(--node-feedback, #22c55e)',
  reasoning_step: 'var(--node-reasoning-step, #3b82f6)',
  checkpoint: 'var(--node-checkpoint, #8b5cf6)',
  session: 'var(--node-session, #6366f1)',
  agent: 'var(--node-agent, #f97316)',
  namespace: 'var(--node-namespace, #64748b)',
};

/** Node type icons (using Unicode symbols) */
const NODE_TYPE_ICONS: Record<string, string> = {
  trajectory: '\u2192',
  pattern: '\u2727',
  episode: '\u25CF',
  feedback: '\u2714',
  reasoning_step: '\u25B6',
  checkpoint: '\u2691',
  session: '\u231B',
  agent: '\u2699',
  namespace: '\u2630',
};

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: 'label', label: 'Label' },
  { value: 'id', label: 'ID' },
  { value: 'data', label: 'Data' },
];

const MAX_RECENT_SEARCHES = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a node matches the search query
 */
function nodeMatchesQuery(
  node: GraphNode,
  query: SearchQuery
): boolean {
  const { text, fields, caseSensitive, useRegex } = query;
  if (!text.trim()) return false;

  let pattern: RegExp;
  try {
    if (useRegex) {
      pattern = new RegExp(text, caseSensitive ? '' : 'i');
    } else {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, caseSensitive ? '' : 'i');
    }
  } catch {
    // Invalid regex, return false
    return false;
  }

  for (const field of fields) {
    switch (field) {
      case 'label':
        if (pattern.test(node.label)) return true;
        break;
      case 'id':
        if (pattern.test(node.id)) return true;
        break;
      case 'data':
        // Search through all data fields
        if (node.data) {
          const dataString = JSON.stringify(node.data);
          if (pattern.test(dataString)) return true;
        }
        break;
    }
  }

  return false;
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(
  text: string,
  searchText: string,
  caseSensitive: boolean,
  useRegex: boolean
): React.ReactNode {
  if (!searchText.trim()) return text;

  try {
    let pattern: RegExp;
    if (useRegex) {
      pattern = new RegExp(`(${searchText})`, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`(${escaped})`, caseSensitive ? 'g' : 'gi');
    }

    const parts = text.split(pattern);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      if (pattern.test(part)) {
        return (
          <mark key={i} className="search-panel__highlight">
            {part}
          </mark>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Search Result Item Component
// ============================================================================

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  node,
  searchText,
  searchFields,
  caseSensitive,
  useRegex,
  isSelected,
  onClick,
}) => {
  const color = NODE_TYPE_COLORS[node.type] || '#888';
  const icon = NODE_TYPE_ICONS[node.type] || '\u25CF';

  // Find which field matches for context
  const matchContext = useMemo(() => {
    if (searchFields.includes('data') && node.data) {
      const dataString = JSON.stringify(node.data);
      let pattern: RegExp;
      try {
        if (useRegex) {
          pattern = new RegExp(searchText, caseSensitive ? '' : 'i');
        } else {
          const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          pattern = new RegExp(escaped, caseSensitive ? '' : 'i');
        }

        if (pattern.test(dataString)) {
          // Try to find a meaningful snippet
          const match = dataString.match(pattern);
          if (match && match.index !== undefined) {
            const start = Math.max(0, match.index - 20);
            const end = Math.min(dataString.length, match.index + match[0].length + 20);
            return truncateText(dataString.slice(start, end), 60);
          }
        }
      } catch {
        // Invalid regex
      }
    }
    return null;
  }, [node.data, searchText, searchFields, caseSensitive, useRegex]);

  return (
    <button
      className={`search-panel__result ${isSelected ? 'search-panel__result--selected' : ''}`}
      onClick={onClick}
      title={`Click to select ${node.label}`}
    >
      <div
        className="search-panel__result-icon"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="search-panel__result-content">
        <div className="search-panel__result-label">
          {highlightMatch(node.label, searchText, caseSensitive, useRegex)}
        </div>
        <div className="search-panel__result-meta">
          <span className="search-panel__result-type">
            {node.type.replace(/_/g, ' ')}
          </span>
          {matchContext && (
            <span className="search-panel__result-context">
              {highlightMatch(matchContext, searchText, caseSensitive, useRegex)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SearchPanel: React.FC<SearchPanelProps> = ({
  className = '',
  onResultClick,
  maxResults = 50,
}) => {
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);

  // Store state
  const nodes = useGraphStore((state) => state.nodes);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setFocusedNode = useGraphStore((state) => state.setFocusedNode);
  const selectedNodeIds = useGraphStore((state) => state.selection.selectedNodeIds);

  const searchQuery = useFilterStore((state) => state.searchQuery);
  const setSearchQuery = useFilterStore((state) => state.setSearchQuery);
  const setSearchResults = useFilterStore((state) => state.setSearchResults);
  const clearSearch = useFilterStore((state) => state.clearSearch);

  // Local state
  const [searchText, setSearchText] = useState(searchQuery?.text || '');
  const [searchFields, setSearchFields] = useState<SearchField[]>(
    searchQuery?.fields || ['label', 'id', 'data']
  );
  const [caseSensitive, setCaseSensitive] = useState(
    searchQuery?.caseSensitive || false
  );
  const [useRegex, setUseRegex] = useState(searchQuery?.useRegex || false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);

  // Compute search results
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];

    // Validate regex if enabled
    if (useRegex) {
      try {
        new RegExp(searchText);
        setRegexError(null);
      } catch (e) {
        setRegexError((e as Error).message);
        return [];
      }
    } else {
      setRegexError(null);
    }

    const query: SearchQuery = {
      text: searchText,
      fields: searchFields,
      caseSensitive,
      useRegex,
    };

    const results = nodes.filter((node) => nodeMatchesQuery(node, query));
    return results.slice(0, maxResults);
  }, [nodes, searchText, searchFields, caseSensitive, useRegex, maxResults]);

  // Update store when search changes
  useEffect(() => {
    if (searchText.trim()) {
      const query: SearchQuery = {
        text: searchText,
        fields: searchFields,
        caseSensitive,
        useRegex,
      };
      setSearchQuery(query);
      setSearchResults(searchResults.map((n) => n.id));
    } else {
      setSearchQuery(null);
      setSearchResults([]);
    }
  }, [searchText, searchFields, caseSensitive, useRegex, searchResults, setSearchQuery, setSearchResults]);

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
    },
    []
  );

  const handleClearSearch = useCallback(() => {
    setSearchText('');
    clearSearch();
    setRegexError(null);
  }, [clearSearch]);

  // Keyboard shortcut handler (Cmd/Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      // Escape to clear search
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        handleClearSearch();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClearSearch]);

  const handleResultClick = useCallback(
    (nodeId: string) => {
      // Add to recent searches
      if (searchText.trim()) {
        setRecentSearches((prev) => {
          const filtered = prev.filter((s) => s !== searchText);
          return [searchText, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        });
      }

      // Select and focus the node
      selectNode(nodeId);
      setFocusedNode(nodeId);
      onResultClick?.(nodeId);
    },
    [searchText, selectNode, setFocusedNode, onResultClick]
  );

  const handleFieldToggle = useCallback((field: SearchField) => {
    setSearchFields((prev) => {
      if (prev.includes(field)) {
        // Don't allow removing the last field
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  }, []);

  const handleRecentSearchClick = useCallback((text: string) => {
    setSearchText(text);
    inputRef.current?.focus();
  }, []);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Select first result if available
    if (searchResults.length > 0) {
      handleResultClick(searchResults[0].id);
    }
  }, [searchResults, handleResultClick]);

  return (
    <div className={`search-panel ${className}`}>
      {/* Header */}
      <div className="search-panel__header">
        <span className="search-panel__title">{'\u{1F50D}'} Search</span>
        <button
          className="btn btn--ghost btn--icon-sm"
          onClick={() => setShowOptions(!showOptions)}
          title="Search options"
          aria-expanded={showOptions}
        >
          {'\u2699'}
        </button>
      </div>

      {/* Search input */}
      <form className="search-panel__form" onSubmit={handleFormSubmit}>
        <div className="search-panel__input-wrapper">
          <span className="search-panel__input-icon">{'\u{1F50D}'}</span>
          <input
            ref={inputRef}
            type="text"
            className={`search-panel__input ${regexError ? 'search-panel__input--error' : ''}`}
            placeholder="Search nodes..."
            value={searchText}
            onChange={handleSearchChange}
            aria-label="Search nodes"
          />
          {searchText && (
            <button
              type="button"
              className="search-panel__clear-btn"
              onClick={handleClearSearch}
              title="Clear search"
            >
              {'\u2715'}
            </button>
          )}
        </div>

        {/* Regex error message */}
        {regexError && (
          <div className="search-panel__error">
            Invalid regex: {regexError}
          </div>
        )}

        {/* Keyboard hint */}
        <div className="search-panel__hint">
          <kbd>{navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}</kbd>
          <kbd>F</kbd>
          <span>to focus</span>
        </div>
      </form>

      {/* Search options */}
      {showOptions && (
        <div className="search-panel__options">
          <div className="search-panel__options-section">
            <div className="search-panel__options-label">Search in:</div>
            <div className="search-panel__field-toggles">
              {SEARCH_FIELDS.map((field) => (
                <label
                  key={field.value}
                  className={`search-panel__field-toggle ${
                    searchFields.includes(field.value)
                      ? 'search-panel__field-toggle--active'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={searchFields.includes(field.value)}
                    onChange={() => handleFieldToggle(field.value)}
                    className="search-panel__field-checkbox"
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="search-panel__options-row">
            <label className="search-panel__option-toggle">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              <span>Case sensitive</span>
            </label>

            <label className="search-panel__option-toggle">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              <span>Regex</span>
            </label>
          </div>
        </div>
      )}

      {/* Recent searches */}
      {!searchText && recentSearches.length > 0 && (
        <div className="search-panel__recent">
          <div className="search-panel__recent-header">
            <span className="search-panel__recent-title">Recent</span>
            <button
              className="search-panel__recent-clear"
              onClick={() => setRecentSearches([])}
            >
              Clear
            </button>
          </div>
          <div className="search-panel__recent-list">
            {recentSearches.map((text, i) => (
              <button
                key={i}
                className="search-panel__recent-item"
                onClick={() => handleRecentSearchClick(text)}
              >
                {'\u23F1'} {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searchText && (
        <div className="search-panel__results">
          <div className="search-panel__results-header">
            <span className="search-panel__results-count">
              {searchResults.length === 0
                ? 'No results'
                : `${searchResults.length}${
                    searchResults.length === maxResults ? '+' : ''
                  } result${searchResults.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {searchResults.length > 0 && (
            <div className="search-panel__results-list">
              {searchResults.map((node) => (
                <SearchResultItem
                  key={node.id}
                  node={node}
                  searchText={searchText}
                  searchFields={searchFields}
                  caseSensitive={caseSensitive}
                  useRegex={useRegex}
                  isSelected={selectedNodeIds.has(node.id)}
                  onClick={() => handleResultClick(node.id)}
                />
              ))}
            </div>
          )}

          {searchResults.length === 0 && !regexError && (
            <div className="search-panel__empty">
              <div className="search-panel__empty-icon">{'\u2139'}</div>
              <div className="search-panel__empty-text">
                No nodes match your search
              </div>
              <div className="search-panel__empty-hint">
                Try different keywords or adjust search options
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
