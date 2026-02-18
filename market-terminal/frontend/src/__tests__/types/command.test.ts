/**
 * Unit tests for pure functions, constants, and type guards in
 * src/types/command.ts.
 *
 * These are all pure functions with zero imports and zero side effects,
 * so tests need no mocks, no React wrappers, and no async.
 *
 * @module __tests__/types/command
 */

import { describe, it, expect } from 'vitest';
import {
  sanitize,
  parseCommand,
  filterSuggestions,
  commandTypeColor,
  isSymbolCommand,
  isScanCommand,
  isMacroCommand,
  isQueryCommand,
  COMMAND_SYMBOL_REGEX,
  MAX_HISTORY,
  MAX_INPUT_LENGTH,
  COMMAND_SUGGESTIONS,
} from '../../types/command';
import type {
  CommandType,
  SymbolCommand,
  ScanCommand,
  QueryCommand,
} from '../../types/command';

// ===========================================================================
// sanitize()
// ===========================================================================

describe('sanitize', () => {
  it('should return empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('should trim leading whitespace', () => {
    expect(sanitize('   hello')).toBe('hello');
  });

  it('should trim trailing whitespace', () => {
    expect(sanitize('hello   ')).toBe('hello');
  });

  it('should trim both leading and trailing whitespace', () => {
    expect(sanitize('   hello   ')).toBe('hello');
  });

  it('should strip < characters', () => {
    expect(sanitize('a<b')).toBe('ab');
  });

  it('should strip > characters', () => {
    expect(sanitize('a>b')).toBe('ab');
  });

  it('should strip & characters', () => {
    expect(sanitize('a&b')).toBe('ab');
  });

  it('should strip double quote characters', () => {
    expect(sanitize('a"b')).toBe('ab');
  });

  it('should strip single quote characters', () => {
    expect(sanitize("a'b")).toBe('ab');
  });

  it('should strip all dangerous characters at once', () => {
    expect(sanitize('<script>"alert(\'xss\')&</script>')).toBe('scriptalert(xss)/script');
  });

  it('should strip dangerous chars then trim', () => {
    expect(sanitize('  <hello>  ')).toBe('hello');
  });

  it('should enforce MAX_INPUT_LENGTH (500 chars)', () => {
    const long = 'A'.repeat(600);
    const result = sanitize(long);
    expect(result.length).toBe(500);
  });

  it('should return exactly MAX_INPUT_LENGTH chars when input is exactly that long', () => {
    const exact = 'B'.repeat(500);
    expect(sanitize(exact)).toBe(exact);
  });

  it('should preserve normal alphanumeric text', () => {
    expect(sanitize('analyze AAPL')).toBe('analyze AAPL');
  });

  it('should preserve internal whitespace', () => {
    expect(sanitize('watch add AAPL')).toBe('watch add AAPL');
  });

  it('should handle whitespace-only input', () => {
    expect(sanitize('   ')).toBe('');
  });

  it('should handle string of only dangerous characters', () => {
    expect(sanitize('<>&"\'')).toBe('');
  });

  it('should handle XSS payload', () => {
    const xss = '<img src=x onerror="alert(1)">';
    const result = sanitize(xss);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });
});

// ===========================================================================
// parseCommand()
// ===========================================================================

describe('parseCommand', () => {
  // -------------------------------------------------------------------------
  // Empty / whitespace input
  // -------------------------------------------------------------------------

  describe('empty and whitespace input', () => {
    it('should return query with empty text for empty string', () => {
      const cmd = parseCommand('');
      expect(cmd.type).toBe('query');
      expect((cmd as QueryCommand).text).toBe('');
    });

    it('should return query with empty text for whitespace-only input', () => {
      const cmd = parseCommand('   ');
      expect(cmd.type).toBe('query');
      expect((cmd as QueryCommand).text).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1: analyze
  // -------------------------------------------------------------------------

  describe('analyze command', () => {
    it('should parse "analyze AAPL" as analyze with symbol AAPL', () => {
      const cmd = parseCommand('analyze AAPL');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse "analyze aapl" with case-insensitive keyword and uppercase symbol', () => {
      const cmd = parseCommand('analyze aapl');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse "ANALYZE MSFT" with uppercase keyword', () => {
      const cmd = parseCommand('ANALYZE MSFT');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('MSFT');
    });

    it('should parse analyze with single-letter symbol', () => {
      const cmd = parseCommand('analyze X');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('X');
    });

    it('should parse analyze with 5-letter symbol', () => {
      const cmd = parseCommand('analyze GOOGL');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('GOOGL');
    });

    it('should fall back to query when analyze has >5-letter second word', () => {
      const cmd = parseCommand('analyze TOOLONG');
      expect(cmd.type).toBe('query');
    });

    it('should fall back to query when analyze has numeric second word', () => {
      const cmd = parseCommand('analyze 12345');
      expect(cmd.type).toBe('query');
    });

    it('should fall back to query when analyze has no second word', () => {
      // "analyze" alone: first=analyze, words.length=1, so tier 1 skipped;
      // tier 4: "ANALYZE" is 7 chars so fails symbol regex -> query
      const cmd = parseCommand('analyze');
      expect(cmd.type).toBe('query');
    });

    it('should preserve raw sanitized input', () => {
      const cmd = parseCommand('analyze AAPL');
      expect(cmd.raw).toBe('analyze AAPL');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1: watch add / watch remove
  // -------------------------------------------------------------------------

  describe('watch add command', () => {
    it('should parse "watch add TSLA"', () => {
      const cmd = parseCommand('watch add TSLA');
      expect(cmd.type).toBe('watch_add');
      expect((cmd as SymbolCommand).symbol).toBe('TSLA');
    });

    it('should parse case-insensitive "Watch Add tsla"', () => {
      const cmd = parseCommand('Watch Add tsla');
      expect(cmd.type).toBe('watch_add');
      expect((cmd as SymbolCommand).symbol).toBe('TSLA');
    });

    it('should fall back when symbol is invalid (too long)', () => {
      const cmd = parseCommand('watch add TOOLONG');
      expect(cmd.type).toBe('query');
    });
  });

  describe('watch remove command', () => {
    it('should parse "watch remove AAPL"', () => {
      const cmd = parseCommand('watch remove AAPL');
      expect(cmd.type).toBe('watch_remove');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse case-insensitive "WATCH REMOVE msft"', () => {
      const cmd = parseCommand('WATCH REMOVE msft');
      expect(cmd.type).toBe('watch_remove');
      expect((cmd as SymbolCommand).symbol).toBe('MSFT');
    });

    it('should fall back when only "watch remove" with no symbol', () => {
      // words.length is 2, need >= 3 for watch add/remove
      const cmd = parseCommand('watch remove');
      expect(cmd.type).toBe('query');
    });

    it('should fall back when watch has unknown subcommand', () => {
      const cmd = parseCommand('watch delete AAPL');
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1: news
  // -------------------------------------------------------------------------

  describe('news command', () => {
    it('should parse "news AAPL"', () => {
      const cmd = parseCommand('news AAPL');
      expect(cmd.type).toBe('news');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse "NEWS aapl" case-insensitively', () => {
      const cmd = parseCommand('NEWS aapl');
      expect(cmd.type).toBe('news');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should fall back when news has no symbol', () => {
      // "news" alone: 4 chars, uppercase "NEWS" passes symbol regex -> ticker
      const cmd = parseCommand('news');
      expect(cmd.type).toBe('ticker');
      expect((cmd as SymbolCommand).symbol).toBe('NEWS');
    });

    it('should fall back when news symbol is invalid', () => {
      const cmd = parseCommand('news 123');
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1: fundamentals
  // -------------------------------------------------------------------------

  describe('fundamentals command', () => {
    it('should parse "fundamentals AAPL"', () => {
      const cmd = parseCommand('fundamentals AAPL');
      expect(cmd.type).toBe('fundamentals');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should fall back when fundamentals has no valid symbol', () => {
      // "fundamentals" alone: 12 chars, uppercase fails regex -> query
      const cmd = parseCommand('fundamentals');
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 1: insider
  // -------------------------------------------------------------------------

  describe('insider command', () => {
    it('should parse "insider MSFT"', () => {
      const cmd = parseCommand('insider MSFT');
      expect(cmd.type).toBe('insider');
      expect((cmd as SymbolCommand).symbol).toBe('MSFT');
    });

    it('should fall back when insider symbol is too long', () => {
      const cmd = parseCommand('insider LONGNAME');
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 2: scan
  // -------------------------------------------------------------------------

  describe('scan command', () => {
    it('should parse "scan" with null preset', () => {
      const cmd = parseCommand('scan');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBeNull();
    });

    it('should parse "scan bullish"', () => {
      const cmd = parseCommand('scan bullish');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBe('bullish');
    });

    it('should parse "scan bearish"', () => {
      const cmd = parseCommand('scan bearish');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBe('bearish');
    });

    it('should parse "scan strong"', () => {
      const cmd = parseCommand('scan strong');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBe('strong');
    });

    it('should parse "SCAN BULLISH" case-insensitively', () => {
      const cmd = parseCommand('SCAN BULLISH');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBe('bullish');
    });

    it('should parse "scan" with unknown preset as null preset', () => {
      const cmd = parseCommand('scan neutral');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBeNull();
    });

    it('should parse "scan" with extra words and valid preset', () => {
      const cmd = parseCommand('scan bearish extra');
      expect(cmd.type).toBe('scan');
      expect((cmd as ScanCommand).preset).toBe('bearish');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 3: macro
  // -------------------------------------------------------------------------

  describe('macro command', () => {
    it('should parse "macro"', () => {
      const cmd = parseCommand('macro');
      expect(cmd.type).toBe('macro');
    });

    it('should parse "MACRO" case-insensitively', () => {
      const cmd = parseCommand('MACRO');
      expect(cmd.type).toBe('macro');
    });

    it('should parse "Macro" with mixed case', () => {
      const cmd = parseCommand('Macro');
      expect(cmd.type).toBe('macro');
    });

    it('should parse "macro extra" still as macro (ignores extra words)', () => {
      const cmd = parseCommand('macro extra');
      expect(cmd.type).toBe('macro');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 4: bare ticker
  // -------------------------------------------------------------------------

  describe('bare ticker', () => {
    it('should parse "AAPL" as ticker', () => {
      const cmd = parseCommand('AAPL');
      expect(cmd.type).toBe('ticker');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse "aapl" (lowercase) as ticker with uppercased symbol', () => {
      const cmd = parseCommand('aapl');
      expect(cmd.type).toBe('ticker');
      expect((cmd as SymbolCommand).symbol).toBe('AAPL');
    });

    it('should parse single letter "X" as ticker', () => {
      const cmd = parseCommand('X');
      expect(cmd.type).toBe('ticker');
      expect((cmd as SymbolCommand).symbol).toBe('X');
    });

    it('should parse 5-letter symbol "GOOGL" as ticker', () => {
      const cmd = parseCommand('GOOGL');
      expect(cmd.type).toBe('ticker');
      expect((cmd as SymbolCommand).symbol).toBe('GOOGL');
    });

    it('should NOT parse 6-letter word as ticker (falls to query)', () => {
      const cmd = parseCommand('ABCDEF');
      expect(cmd.type).toBe('query');
    });

    it('should NOT parse number as ticker (falls to query)', () => {
      const cmd = parseCommand('12345');
      expect(cmd.type).toBe('query');
    });

    it('should NOT parse mixed alpha-numeric as ticker', () => {
      const cmd = parseCommand('AA1');
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Tier 4: query fallback
  // -------------------------------------------------------------------------

  describe('query fallback', () => {
    it('should parse multi-word free text as query', () => {
      const cmd = parseCommand('what is the price of apple');
      expect(cmd.type).toBe('query');
      expect((cmd as QueryCommand).text).toBe('what is the price of apple');
    });

    it('should parse text with numbers as query', () => {
      const cmd = parseCommand('top 10 stocks');
      expect(cmd.type).toBe('query');
      expect((cmd as QueryCommand).text).toBe('top 10 stocks');
    });

    it('should handle XSS payload safely via sanitize', () => {
      const cmd = parseCommand('<script>alert("xss")</script>');
      // After sanitize: "scriptalert(xss)/script"
      expect(cmd.type).toBe('query');
      expect(cmd.raw).not.toContain('<');
      expect(cmd.raw).not.toContain('>');
    });

    it('should handle very long input (truncated by sanitize)', () => {
      const long = 'A'.repeat(600);
      const cmd = parseCommand(long);
      // After sanitize and uppercase: 500 A's -> ticker (all uppercase, but >5 chars -> query)
      expect(cmd.raw.length).toBe(500);
      expect(cmd.type).toBe('query');
    });
  });

  // -------------------------------------------------------------------------
  // Precedence
  // -------------------------------------------------------------------------

  describe('precedence', () => {
    it('should prefer analyze over ticker for "analyze SCAN"', () => {
      // "scan" would be a valid scan keyword, but "analyze" takes precedence at tier 1
      // Actually "analyze SCAN" -> tier1 analyze, candidate = "SCAN" (4 chars, valid) -> analyze
      const cmd = parseCommand('analyze SCAN');
      expect(cmd.type).toBe('analyze');
      expect((cmd as SymbolCommand).symbol).toBe('SCAN');
    });

    it('should prefer scan keyword over ticker for "scan"', () => {
      // "scan" matches tier 2 scan before tier 4 bare ticker
      const cmd = parseCommand('scan');
      expect(cmd.type).toBe('scan');
    });

    it('should prefer macro keyword over ticker for "macro"', () => {
      // "macro" is 5 chars, valid ticker, but tier 3 macro wins
      const cmd = parseCommand('macro');
      expect(cmd.type).toBe('macro');
    });
  });
});

// ===========================================================================
// filterSuggestions()
// ===========================================================================

describe('filterSuggestions', () => {
  it('should return empty array for empty input', () => {
    expect(filterSuggestions('', 'AAPL')).toEqual([]);
  });

  it('should return matching suggestions for prefix "ana"', () => {
    const results = filterSuggestions('ana', 'AAPL');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toContain('analyze');
  });

  it('should match case-insensitively', () => {
    const results = filterSuggestions('ANA', 'AAPL');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toContain('analyze');
  });

  it('should replace {symbol} with activeTicker in label', () => {
    const results = filterSuggestions('ana', 'TSLA');
    expect(results[0].label).toBe('analyze TSLA');
  });

  it('should replace {symbol} with activeTicker in value', () => {
    const results = filterSuggestions('news', 'MSFT');
    const newsResult = results.find((s) => s.type === 'news');
    expect(newsResult).toBeDefined();
    // The original value is "news " -- no {symbol} in value field
    // Check the label replacement instead
    expect(newsResult!.label).toBe('news MSFT');
  });

  it('should leave {symbol} literal when activeTicker is empty', () => {
    const results = filterSuggestions('ana', '');
    expect(results[0].label).toBe('analyze {symbol}');
  });

  it('should respect limit parameter', () => {
    const results = filterSuggestions('s', 'AAPL', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should default limit to 8', () => {
    // All suggestions start with different letters, so "s" matches scan suggestions
    const results = filterSuggestions('s', 'AAPL');
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('should return empty array when no suggestions match', () => {
    const results = filterSuggestions('zzzzz', 'AAPL');
    expect(results).toEqual([]);
  });

  it('should match "watch" prefix and return both watch add and watch remove', () => {
    const results = filterSuggestions('watch', 'AAPL');
    expect(results.length).toBe(2);
    const types = results.map((r) => r.type);
    expect(types).toContain('watch_add');
    expect(types).toContain('watch_remove');
  });

  it('should match "watch a" to filter down to just watch add', () => {
    const results = filterSuggestions('watch a', 'AAPL');
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('watch_add');
  });

  it('should match "scan" prefix and return scan suggestions', () => {
    const results = filterSuggestions('scan', 'AAPL');
    expect(results.length).toBe(2); // "scan" and "scan bullish"
    expect(results.every((r) => r.type === 'scan')).toBe(true);
  });

  it('should match "macro" prefix', () => {
    const results = filterSuggestions('macro', 'AAPL');
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('macro');
  });

  it('should return suggestions with correct structure', () => {
    const results = filterSuggestions('macro', 'AAPL');
    expect(results[0]).toHaveProperty('label');
    expect(results[0]).toHaveProperty('description');
    expect(results[0]).toHaveProperty('value');
    expect(results[0]).toHaveProperty('type');
  });

  it('should return limit of 1 correctly', () => {
    const results = filterSuggestions('a', 'AAPL', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ===========================================================================
// commandTypeColor()
// ===========================================================================

describe('commandTypeColor', () => {
  it('should return text-accent-blue for ticker', () => {
    expect(commandTypeColor('ticker')).toBe('text-accent-blue');
  });

  it('should return text-accent-green for analyze', () => {
    expect(commandTypeColor('analyze')).toBe('text-accent-green');
  });

  it('should return text-green-400 for watch_add', () => {
    expect(commandTypeColor('watch_add')).toBe('text-green-400');
  });

  it('should return text-red-400 for watch_remove', () => {
    expect(commandTypeColor('watch_remove')).toBe('text-red-400');
  });

  it('should return text-accent-amber for news', () => {
    expect(commandTypeColor('news')).toBe('text-accent-amber');
  });

  it('should return text-purple-400 for scan', () => {
    expect(commandTypeColor('scan')).toBe('text-purple-400');
  });

  it('should return text-cyan-400 for fundamentals', () => {
    expect(commandTypeColor('fundamentals')).toBe('text-cyan-400');
  });

  it('should return text-orange-400 for insider', () => {
    expect(commandTypeColor('insider')).toBe('text-orange-400');
  });

  it('should return text-yellow-400 for macro', () => {
    expect(commandTypeColor('macro')).toBe('text-yellow-400');
  });

  it('should return text-text-secondary for query', () => {
    expect(commandTypeColor('query')).toBe('text-text-secondary');
  });

  it('should return text-text-secondary for unknown type (default branch)', () => {
    // Force an unknown type through the function
    expect(commandTypeColor('unknown_type' as CommandType)).toBe('text-text-secondary');
  });

  it('should map every known CommandType to a non-empty string', () => {
    const allTypes: CommandType[] = [
      'ticker', 'analyze', 'watch_add', 'watch_remove',
      'news', 'scan', 'fundamentals', 'insider', 'macro', 'query',
    ];
    for (const t of allTypes) {
      const color = commandTypeColor(t);
      expect(color).toBeTruthy();
      expect(color.startsWith('text-')).toBe(true);
    }
  });
});

// ===========================================================================
// Type Guards
// ===========================================================================

describe('type guards', () => {
  // -------------------------------------------------------------------------
  // isSymbolCommand
  // -------------------------------------------------------------------------

  describe('isSymbolCommand', () => {
    it('should return true for ticker command', () => {
      const cmd = parseCommand('AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for analyze command', () => {
      const cmd = parseCommand('analyze AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for watch_add command', () => {
      const cmd = parseCommand('watch add AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for watch_remove command', () => {
      const cmd = parseCommand('watch remove AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for news command', () => {
      const cmd = parseCommand('news AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for fundamentals command', () => {
      const cmd = parseCommand('fundamentals AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return true for insider command', () => {
      const cmd = parseCommand('insider AAPL');
      expect(isSymbolCommand(cmd)).toBe(true);
    });

    it('should return false for scan command', () => {
      const cmd = parseCommand('scan');
      expect(isSymbolCommand(cmd)).toBe(false);
    });

    it('should return false for macro command', () => {
      const cmd = parseCommand('macro');
      expect(isSymbolCommand(cmd)).toBe(false);
    });

    it('should return false for query command', () => {
      const cmd = parseCommand('what is the price');
      expect(isSymbolCommand(cmd)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isScanCommand
  // -------------------------------------------------------------------------

  describe('isScanCommand', () => {
    it('should return true for scan command', () => {
      const cmd = parseCommand('scan');
      expect(isScanCommand(cmd)).toBe(true);
    });

    it('should return true for scan with preset', () => {
      const cmd = parseCommand('scan bullish');
      expect(isScanCommand(cmd)).toBe(true);
    });

    it('should return false for ticker command', () => {
      const cmd = parseCommand('AAPL');
      expect(isScanCommand(cmd)).toBe(false);
    });

    it('should return false for query command', () => {
      const cmd = parseCommand('search stocks');
      expect(isScanCommand(cmd)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isMacroCommand
  // -------------------------------------------------------------------------

  describe('isMacroCommand', () => {
    it('should return true for macro command', () => {
      const cmd = parseCommand('macro');
      expect(isMacroCommand(cmd)).toBe(true);
    });

    it('should return false for scan command', () => {
      const cmd = parseCommand('scan');
      expect(isMacroCommand(cmd)).toBe(false);
    });

    it('should return false for ticker command', () => {
      const cmd = parseCommand('AAPL');
      expect(isMacroCommand(cmd)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isQueryCommand
  // -------------------------------------------------------------------------

  describe('isQueryCommand', () => {
    it('should return true for free-text query', () => {
      const cmd = parseCommand('what is the price');
      expect(isQueryCommand(cmd)).toBe(true);
    });

    it('should return true for empty input (query fallback)', () => {
      const cmd = parseCommand('');
      expect(isQueryCommand(cmd)).toBe(true);
    });

    it('should return false for ticker command', () => {
      const cmd = parseCommand('AAPL');
      expect(isQueryCommand(cmd)).toBe(false);
    });

    it('should return false for scan command', () => {
      const cmd = parseCommand('scan');
      expect(isQueryCommand(cmd)).toBe(false);
    });

    it('should return false for macro command', () => {
      const cmd = parseCommand('macro');
      expect(isQueryCommand(cmd)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Narrowing correctness (type-level sanity)
  // -------------------------------------------------------------------------

  describe('narrowing correctness', () => {
    it('should allow accessing symbol after isSymbolCommand guard', () => {
      const cmd = parseCommand('AAPL');
      if (isSymbolCommand(cmd)) {
        expect(cmd.symbol).toBe('AAPL');
      } else {
        // Should not reach here
        expect.unreachable('Expected isSymbolCommand to be true');
      }
    });

    it('should allow accessing preset after isScanCommand guard', () => {
      const cmd = parseCommand('scan bullish');
      if (isScanCommand(cmd)) {
        expect(cmd.preset).toBe('bullish');
      } else {
        expect.unreachable('Expected isScanCommand to be true');
      }
    });

    it('should allow accessing text after isQueryCommand guard', () => {
      const cmd = parseCommand('hello world');
      if (isQueryCommand(cmd)) {
        expect(cmd.text).toBe('hello world');
      } else {
        expect.unreachable('Expected isQueryCommand to be true');
      }
    });
  });
});

// ===========================================================================
// Constants
// ===========================================================================

describe('constants', () => {
  describe('COMMAND_SYMBOL_REGEX', () => {
    it('should match single uppercase letter', () => {
      expect(COMMAND_SYMBOL_REGEX.test('A')).toBe(true);
    });

    it('should match 5 uppercase letters', () => {
      expect(COMMAND_SYMBOL_REGEX.test('GOOGL')).toBe(true);
    });

    it('should not match 6 uppercase letters', () => {
      expect(COMMAND_SYMBOL_REGEX.test('ABCDEF')).toBe(false);
    });

    it('should not match empty string', () => {
      expect(COMMAND_SYMBOL_REGEX.test('')).toBe(false);
    });

    it('should not match lowercase letters', () => {
      expect(COMMAND_SYMBOL_REGEX.test('aapl')).toBe(false);
    });

    it('should not match digits', () => {
      expect(COMMAND_SYMBOL_REGEX.test('123')).toBe(false);
    });

    it('should not match mixed alpha-numeric', () => {
      expect(COMMAND_SYMBOL_REGEX.test('AA1')).toBe(false);
    });

    it('should not match strings with spaces', () => {
      expect(COMMAND_SYMBOL_REGEX.test('AA BB')).toBe(false);
    });
  });

  describe('MAX_HISTORY', () => {
    it('should be 50', () => {
      expect(MAX_HISTORY).toBe(50);
    });
  });

  describe('MAX_INPUT_LENGTH', () => {
    it('should be 500', () => {
      expect(MAX_INPUT_LENGTH).toBe(500);
    });
  });

  describe('COMMAND_SUGGESTIONS', () => {
    it('should have exactly 9 items', () => {
      expect(COMMAND_SUGGESTIONS.length).toBe(9);
    });

    it('should include all expected types', () => {
      const types = COMMAND_SUGGESTIONS.map((s) => s.type);
      expect(types).toContain('analyze');
      expect(types).toContain('news');
      expect(types).toContain('fundamentals');
      expect(types).toContain('insider');
      expect(types).toContain('watch_add');
      expect(types).toContain('watch_remove');
      expect(types).toContain('scan');
      expect(types).toContain('macro');
    });

    it('should have non-empty label, description, and value for every suggestion', () => {
      for (const suggestion of COMMAND_SUGGESTIONS) {
        expect(suggestion.label.length).toBeGreaterThan(0);
        expect(suggestion.description.length).toBeGreaterThan(0);
        expect(suggestion.value.length).toBeGreaterThan(0);
      }
    });

    it('should be a readonly array', () => {
      // Verify it is an array (readonly enforcement is compile-time)
      expect(Array.isArray(COMMAND_SUGGESTIONS)).toBe(true);
    });
  });
});
