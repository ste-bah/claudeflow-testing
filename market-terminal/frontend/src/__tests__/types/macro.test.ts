/**
 * Unit tests for macro calendar types, normalizers, sanitizers, and formatters.
 *
 * Covers:
 * - sanitizeNumber (via normalizeCalendarEvent/normalizeReactionEntry which call it)
 * - normalizeImportance
 * - normalizeSurprise
 * - normalizeCalendarEvent
 * - normalizeCalendar
 * - normalizeReactionEntry
 * - normalizeReaction
 * - formatEventValue
 * - formatSurprise
 * - constants
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeImportance,
  normalizeSurprise,
  normalizeCalendarEvent,
  normalizeCalendar,
  normalizeReactionEntry,
  normalizeReaction,
  formatEventValue,
  formatSurprise,
  MACRO_CALENDAR_CACHE_TTL_MS,
  MACRO_REACTION_CACHE_TTL_MS,
  MACRO_CALENDAR_PAST_DAYS,
  MACRO_CALENDAR_FUTURE_DAYS,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_DISPLAY_NAMES,
  VALID_EVENT_TYPES,
  IMPORTANCE_CONFIG,
} from '../../types/macro';
import type {
  MacroCalendarEventRaw,
  MacroCalendarApiResponse,
  MacroReactionRaw,
  MacroReactionApiResponse,
  ImportanceLevel,
  SurpriseDirection,
  MacroEventType,
} from '../../types/macro';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete valid raw calendar event. */
function makeRawEvent(overrides: Partial<MacroCalendarEventRaw> = {}): MacroCalendarEventRaw {
  return {
    event_name: 'Consumer Price Index',
    event_type: 'cpi',
    date: '2024-06-15',
    time: '08:30',
    country: 'US',
    expected: 3.2,
    previous: 3.1,
    actual: 3.3,
    unit: 'percent',
    importance: 'high',
    description: 'Consumer Price Index (YoY)',
    ...overrides,
  };
}

/** Build a complete valid raw calendar API response. */
function makeCalendarResponse(
  overrides: Partial<MacroCalendarApiResponse> = {},
): MacroCalendarApiResponse {
  return {
    events: [makeRawEvent()],
    date_range: { from: '2024-06-01', to: '2024-07-01' },
    data_source: 'finnhub',
    data_timestamp: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

/** Build a complete valid raw reaction entry. */
function makeRawReaction(overrides: Partial<MacroReactionRaw> = {}): MacroReactionRaw {
  return {
    event_date: '2024-06-15',
    event_value: 3.3,
    expected: 3.2,
    surprise: 'above',
    price_before: 185.5,
    price_after_1d: 187.0,
    price_after_5d: 190.0,
    return_1d_percent: 0.81,
    return_5d_percent: 2.43,
    volume_ratio: 1.35,
    ...overrides,
  };
}

/** Build a complete valid raw reaction API response. */
function makeReactionResponse(
  overrides: Partial<MacroReactionApiResponse> = {},
): MacroReactionApiResponse {
  return {
    symbol: 'AAPL',
    event_type: 'cpi',
    reactions: [makeRawReaction()],
    averages: {
      avg_return_1d_on_beat: 0.45,
      avg_return_1d_on_miss: -0.32,
      avg_return_5d_on_beat: 1.1,
      avg_return_5d_on_miss: -0.88,
      avg_volume_ratio: 1.2,
    },
    sample_size: 12,
    data_sources: ['yfinance', 'finnhub'],
    data_timestamp: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Macro Constants', () => {
  it('should export MACRO_CALENDAR_CACHE_TTL_MS as 300000 (5 minutes)', () => {
    expect(MACRO_CALENDAR_CACHE_TTL_MS).toBe(300_000);
  });

  it('should export MACRO_REACTION_CACHE_TTL_MS as 900000 (15 minutes)', () => {
    expect(MACRO_REACTION_CACHE_TTL_MS).toBe(900_000);
  });

  it('should export MACRO_CALENDAR_PAST_DAYS as 7', () => {
    expect(MACRO_CALENDAR_PAST_DAYS).toBe(7);
  });

  it('should export MACRO_CALENDAR_FUTURE_DAYS as 30', () => {
    expect(MACRO_CALENDAR_FUTURE_DAYS).toBe(30);
  });

  it('should define EVENT_TYPE_COLORS for all 15 event types', () => {
    expect(Object.keys(EVENT_TYPE_COLORS)).toHaveLength(15);
    expect(EVENT_TYPE_COLORS.cpi).toBe('red');
    expect(EVENT_TYPE_COLORS.fomc).toBe('purple');
    expect(EVENT_TYPE_COLORS.gdp).toBe('emerald');
  });

  it('should define EVENT_TYPE_DISPLAY_NAMES for all 15 event types', () => {
    expect(Object.keys(EVENT_TYPE_DISPLAY_NAMES)).toHaveLength(15);
    expect(EVENT_TYPE_DISPLAY_NAMES.cpi).toBe('CPI');
    expect(EVENT_TYPE_DISPLAY_NAMES.nfp).toBe('NFP');
    expect(EVENT_TYPE_DISPLAY_NAMES.fomc).toBe('FOMC');
    expect(EVENT_TYPE_DISPLAY_NAMES.core_cpi).toBe('Core CPI');
    expect(EVENT_TYPE_DISPLAY_NAMES.ism_manufacturing).toBe('ISM Mfg');
    expect(EVENT_TYPE_DISPLAY_NAMES.ism_services).toBe('ISM Svc');
    expect(EVENT_TYPE_DISPLAY_NAMES.consumer_confidence).toBe('Consumer Conf');
    expect(EVENT_TYPE_DISPLAY_NAMES.fed_funds_rate).toBe('Fed Funds');
  });

  it('should define VALID_EVENT_TYPES as a Set with 15 entries', () => {
    expect(VALID_EVENT_TYPES.size).toBe(15);
    expect(VALID_EVENT_TYPES.has('cpi')).toBe(true);
    expect(VALID_EVENT_TYPES.has('nfp')).toBe(true);
    expect(VALID_EVENT_TYPES.has('fomc')).toBe(true);
    expect(VALID_EVENT_TYPES.has('unknown')).toBe(false);
  });

  it('should define IMPORTANCE_CONFIG for high, medium, low', () => {
    expect(IMPORTANCE_CONFIG.high).toEqual({ label: 'High', colorClass: 'text-accent-red' });
    expect(IMPORTANCE_CONFIG.medium).toEqual({ label: 'Med', colorClass: 'text-accent-yellow' });
    expect(IMPORTANCE_CONFIG.low).toEqual({ label: 'Low', colorClass: 'text-text-muted' });
  });
});

// ---------------------------------------------------------------------------
// normalizeImportance
// ---------------------------------------------------------------------------

describe('normalizeImportance', () => {
  it.each<[string, ImportanceLevel]>([
    ['high', 'high'],
    ['medium', 'medium'],
    ['low', 'low'],
  ])('should return "%s" for valid input "%s"', (input, expected) => {
    expect(normalizeImportance(input)).toBe(expected);
  });

  it('should fall back to "low" for unknown string', () => {
    expect(normalizeImportance('critical')).toBe('low');
    expect(normalizeImportance('MEDIUM')).toBe('low');
    expect(normalizeImportance('High')).toBe('low');
    expect(normalizeImportance('')).toBe('low');
  });

  it('should fall back to "low" for null', () => {
    expect(normalizeImportance(null)).toBe('low');
  });

  it('should fall back to "low" for undefined', () => {
    expect(normalizeImportance(undefined)).toBe('low');
  });

  it('should fall back to "low" for non-string types', () => {
    expect(normalizeImportance(42)).toBe('low');
    expect(normalizeImportance(true)).toBe('low');
    expect(normalizeImportance(false)).toBe('low');
    expect(normalizeImportance({})).toBe('low');
    expect(normalizeImportance([])).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// normalizeSurprise
// ---------------------------------------------------------------------------

describe('normalizeSurprise', () => {
  it.each<[string, SurpriseDirection]>([
    ['above', 'above'],
    ['below', 'below'],
    ['inline', 'inline'],
  ])('should return "%s" for valid input "%s"', (input, expected) => {
    expect(normalizeSurprise(input)).toBe(expected);
  });

  it('should fall back to "inline" for unknown string', () => {
    expect(normalizeSurprise('over')).toBe('inline');
    expect(normalizeSurprise('ABOVE')).toBe('inline');
    expect(normalizeSurprise('Below')).toBe('inline');
    expect(normalizeSurprise('')).toBe('inline');
  });

  it('should fall back to "inline" for null', () => {
    expect(normalizeSurprise(null)).toBe('inline');
  });

  it('should fall back to "inline" for undefined', () => {
    expect(normalizeSurprise(undefined)).toBe('inline');
  });

  it('should fall back to "inline" for non-string types', () => {
    expect(normalizeSurprise(42)).toBe('inline');
    expect(normalizeSurprise(true)).toBe('inline');
    expect(normalizeSurprise(false)).toBe('inline');
    expect(normalizeSurprise({})).toBe('inline');
    expect(normalizeSurprise([])).toBe('inline');
  });
});

// ---------------------------------------------------------------------------
// sanitizeNumber (tested indirectly through normalizeCalendarEvent)
// ---------------------------------------------------------------------------

describe('sanitizeNumber (via normalizeCalendarEvent)', () => {
  it('should preserve valid positive numbers', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: 42.5 }));
    expect(result.expected).toBe(42.5);
  });

  it('should preserve 0 (not treat as falsy)', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: 0 }));
    expect(result.expected).toBe(0);
  });

  it('should preserve negative numbers', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: -1.5 }));
    expect(result.expected).toBe(-1.5);
  });

  it('should return null for NaN', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: NaN as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for Infinity', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: Infinity as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for -Infinity', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: -Infinity as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for boolean true (bool is subclass of number)', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: true as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for boolean false', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: false as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for null', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: null }));
    expect(result.expected).toBeNull();
  });

  it('should return null for undefined', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: undefined as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for string "123"', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: '123' as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: '' as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should return null for object', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ expected: {} as unknown as number }));
    expect(result.expected).toBeNull();
  });

  it('should sanitize all three numeric fields independently', () => {
    const result = normalizeCalendarEvent(
      makeRawEvent({ expected: NaN as unknown as number, previous: 3.1, actual: Infinity as unknown as number }),
    );
    expect(result.expected).toBeNull();
    expect(result.previous).toBe(3.1);
    expect(result.actual).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeCalendarEvent
// ---------------------------------------------------------------------------

describe('normalizeCalendarEvent', () => {
  it('should normalize a complete valid event', () => {
    const raw = makeRawEvent();
    const result = normalizeCalendarEvent(raw);

    expect(result.eventName).toBe('Consumer Price Index');
    expect(result.eventType).toBe('cpi');
    expect(result.date).toBe('2024-06-15');
    expect(result.time).toBe('08:30');
    expect(result.country).toBe('US');
    expect(result.expected).toBe(3.2);
    expect(result.previous).toBe(3.1);
    expect(result.actual).toBe(3.3);
    expect(result.unit).toBe('percent');
    expect(result.importance).toBe('high');
    expect(result.description).toBe('Consumer Price Index (YoY)');
  });

  it('should set eventType to null for unknown event_type', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ event_type: 'unknown_event' }));
    expect(result.eventType).toBeNull();
  });

  it('should set eventType to null for null event_type', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ event_type: null }));
    expect(result.eventType).toBeNull();
  });

  it('should validate all 15 known event types', () => {
    const eventTypes: MacroEventType[] = [
      'cpi', 'core_cpi', 'ism_manufacturing', 'ism_services', 'nfp',
      'unemployment', 'fomc', 'gdp', 'ppi', 'retail_sales',
      'housing_starts', 'building_permits', 'consumer_confidence',
      'durable_goods', 'fed_funds_rate',
    ];
    for (const et of eventTypes) {
      const result = normalizeCalendarEvent(makeRawEvent({ event_type: et }));
      expect(result.eventType).toBe(et);
    }
  });

  it('should default missing string fields to empty string', () => {
    const raw = {
      event_name: undefined,
      event_type: null,
      date: undefined,
      time: undefined,
      country: undefined,
      expected: null,
      previous: null,
      actual: null,
      unit: undefined,
      importance: undefined,
      description: undefined,
    } as unknown as MacroCalendarEventRaw;

    const result = normalizeCalendarEvent(raw);
    expect(result.eventName).toBe('');
    expect(result.date).toBe('');
    expect(result.time).toBe('');
    expect(result.country).toBe('US'); // country defaults to 'US' via ?? 'US'
    expect(result.unit).toBe('');
    expect(result.description).toBe('');
  });

  it('should normalize importance for invalid values', () => {
    const result = normalizeCalendarEvent(makeRawEvent({ importance: 'CRITICAL' }));
    expect(result.importance).toBe('low');
  });

  it('should handle extra fields gracefully (ignored)', () => {
    const rawWithExtra = {
      ...makeRawEvent(),
      extra_field: 'should be ignored',
      another: 123,
    } as MacroCalendarEventRaw;
    const result = normalizeCalendarEvent(rawWithExtra);
    expect(result.eventName).toBe('Consumer Price Index');
    expect((result as unknown as Record<string, unknown>)['extra_field']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeCalendar
// ---------------------------------------------------------------------------

describe('normalizeCalendar', () => {
  it('should normalize a valid calendar response', () => {
    const raw = makeCalendarResponse();
    const result = normalizeCalendar(raw);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventName).toBe('Consumer Price Index');
    expect(result.dateRange).toEqual({ from: '2024-06-01', to: '2024-07-01' });
    expect(result.dataSource).toBe('finnhub');
    expect(result.dataTimestamp).toBe('2024-06-15T12:00:00Z');
  });

  it('should return empty events array when events is empty', () => {
    const result = normalizeCalendar(makeCalendarResponse({ events: [] }));
    expect(result.events).toEqual([]);
  });

  it('should return empty events array when events field is missing', () => {
    const raw = {
      date_range: { from: '2024-06-01', to: '2024-07-01' },
      data_source: 'mock',
      data_timestamp: '2024-06-15T12:00:00Z',
    } as unknown as MacroCalendarApiResponse;
    const result = normalizeCalendar(raw);
    expect(result.events).toEqual([]);
  });

  it('should return empty events array when events is not an array', () => {
    const raw = makeCalendarResponse({
      events: 'not-an-array' as unknown as MacroCalendarEventRaw[],
    });
    const result = normalizeCalendar(raw);
    expect(result.events).toEqual([]);
  });

  it('should normalize multiple events', () => {
    const raw = makeCalendarResponse({
      events: [
        makeRawEvent({ event_type: 'cpi', importance: 'high' }),
        makeRawEvent({ event_type: 'nfp', importance: 'medium' }),
        makeRawEvent({ event_type: 'fomc', importance: 'low' }),
      ],
    });
    const result = normalizeCalendar(raw);
    expect(result.events).toHaveLength(3);
    expect(result.events[0].eventType).toBe('cpi');
    expect(result.events[1].eventType).toBe('nfp');
    expect(result.events[2].eventType).toBe('fomc');
  });

  it('should default date_range to empty strings when missing', () => {
    const raw = makeCalendarResponse({
      date_range: undefined as unknown as { from: string; to: string },
    });
    const result = normalizeCalendar(raw);
    expect(result.dateRange).toEqual({ from: '', to: '' });
  });

  it('should default date_range to empty strings when null', () => {
    const raw = makeCalendarResponse({
      date_range: null as unknown as { from: string; to: string },
    });
    const result = normalizeCalendar(raw);
    expect(result.dateRange).toEqual({ from: '', to: '' });
  });

  it('should default date_range to empty strings when array', () => {
    const raw = makeCalendarResponse({
      date_range: ['2024-01-01', '2024-02-01'] as unknown as { from: string; to: string },
    });
    const result = normalizeCalendar(raw);
    expect(result.dateRange).toEqual({ from: '', to: '' });
  });

  it('should default data_source and data_timestamp to empty strings when missing', () => {
    const raw = {
      events: [],
      date_range: { from: '2024-06-01', to: '2024-07-01' },
      data_source: undefined,
      data_timestamp: undefined,
    } as unknown as MacroCalendarApiResponse;
    const result = normalizeCalendar(raw);
    expect(result.dataSource).toBe('');
    expect(result.dataTimestamp).toBe('');
  });
});

// ---------------------------------------------------------------------------
// normalizeReactionEntry
// ---------------------------------------------------------------------------

describe('normalizeReactionEntry', () => {
  it('should normalize a valid reaction entry', () => {
    const raw = makeRawReaction();
    const result = normalizeReactionEntry(raw);

    expect(result.eventDate).toBe('2024-06-15');
    expect(result.eventValue).toBe(3.3);
    expect(result.expected).toBe(3.2);
    expect(result.surprise).toBe('above');
    expect(result.priceBefore).toBe(185.5);
    expect(result.priceAfter1d).toBe(187.0);
    expect(result.priceAfter5d).toBe(190.0);
    expect(result.return1dPercent).toBe(0.81);
    expect(result.return5dPercent).toBe(2.43);
    expect(result.volumeRatio).toBe(1.35);
  });

  it('should sanitize all numeric fields independently', () => {
    const raw = makeRawReaction({
      event_value: NaN as unknown as number,
      expected: null,
      price_before: Infinity as unknown as number,
      price_after_1d: -Infinity as unknown as number,
      price_after_5d: true as unknown as number,
      return_1d_percent: false as unknown as number,
      return_5d_percent: '1.5' as unknown as number,
      volume_ratio: {} as unknown as number,
    });
    const result = normalizeReactionEntry(raw);
    expect(result.eventValue).toBeNull();
    expect(result.expected).toBeNull();
    expect(result.priceBefore).toBeNull();
    expect(result.priceAfter1d).toBeNull();
    expect(result.priceAfter5d).toBeNull();
    expect(result.return1dPercent).toBeNull();
    expect(result.return5dPercent).toBeNull();
    expect(result.volumeRatio).toBeNull();
  });

  it('should normalize surprise direction', () => {
    expect(normalizeReactionEntry(makeRawReaction({ surprise: 'below' })).surprise).toBe('below');
    expect(normalizeReactionEntry(makeRawReaction({ surprise: 'inline' })).surprise).toBe('inline');
    expect(normalizeReactionEntry(makeRawReaction({ surprise: 'ABOVE' })).surprise).toBe('inline');
    expect(normalizeReactionEntry(makeRawReaction({ surprise: '' })).surprise).toBe('inline');
  });

  it('should default event_date to empty string when missing', () => {
    const raw = makeRawReaction({ event_date: undefined as unknown as string });
    const result = normalizeReactionEntry(raw);
    expect(result.eventDate).toBe('');
  });

  it('should preserve 0 in numeric fields', () => {
    const raw = makeRawReaction({
      event_value: 0,
      return_1d_percent: 0,
      volume_ratio: 0,
    });
    const result = normalizeReactionEntry(raw);
    expect(result.eventValue).toBe(0);
    expect(result.return1dPercent).toBe(0);
    expect(result.volumeRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeReaction
// ---------------------------------------------------------------------------

describe('normalizeReaction', () => {
  it('should normalize a valid reaction response', () => {
    const raw = makeReactionResponse();
    const result = normalizeReaction(raw);

    expect(result.symbol).toBe('AAPL');
    expect(result.eventType).toBe('cpi');
    expect(result.reactions).toHaveLength(1);
    expect(result.averages.avgReturn1dOnBeat).toBe(0.45);
    expect(result.averages.avgReturn1dOnMiss).toBe(-0.32);
    expect(result.averages.avgReturn5dOnBeat).toBe(1.1);
    expect(result.averages.avgReturn5dOnMiss).toBe(-0.88);
    expect(result.averages.avgVolumeRatio).toBe(1.2);
    expect(result.sampleSize).toBe(12);
    expect(result.dataSources).toEqual(['yfinance', 'finnhub']);
    expect(result.dataTimestamp).toBe('2024-06-15T12:00:00Z');
  });

  it('should return empty reactions array when reactions is empty', () => {
    const result = normalizeReaction(makeReactionResponse({ reactions: [] }));
    expect(result.reactions).toEqual([]);
  });

  it('should return empty reactions array when reactions is not an array', () => {
    const raw = makeReactionResponse({
      reactions: 'not-array' as unknown as MacroReactionRaw[],
    });
    const result = normalizeReaction(raw);
    expect(result.reactions).toEqual([]);
  });

  it('should return null averages when averages is null', () => {
    const raw = makeReactionResponse({
      averages: null as unknown as MacroReactionApiResponse['averages'],
    });
    const result = normalizeReaction(raw);
    expect(result.averages.avgReturn1dOnBeat).toBeNull();
    expect(result.averages.avgReturn1dOnMiss).toBeNull();
    expect(result.averages.avgReturn5dOnBeat).toBeNull();
    expect(result.averages.avgReturn5dOnMiss).toBeNull();
    expect(result.averages.avgVolumeRatio).toBeNull();
  });

  it('should return null averages when averages is undefined', () => {
    const raw = makeReactionResponse({
      averages: undefined as unknown as MacroReactionApiResponse['averages'],
    });
    const result = normalizeReaction(raw);
    expect(result.averages.avgReturn1dOnBeat).toBeNull();
  });

  it('should return null averages when averages is an array', () => {
    const raw = makeReactionResponse({
      averages: [1, 2, 3] as unknown as MacroReactionApiResponse['averages'],
    });
    const result = normalizeReaction(raw);
    expect(result.averages.avgReturn1dOnBeat).toBeNull();
  });

  it('should sanitize numeric fields within averages', () => {
    const raw = makeReactionResponse({
      averages: {
        avg_return_1d_on_beat: NaN as unknown as number,
        avg_return_1d_on_miss: Infinity as unknown as number,
        avg_return_5d_on_beat: true as unknown as number,
        avg_return_5d_on_miss: '0.5' as unknown as number,
        avg_volume_ratio: null,
      },
    });
    const result = normalizeReaction(raw);
    expect(result.averages.avgReturn1dOnBeat).toBeNull();
    expect(result.averages.avgReturn1dOnMiss).toBeNull();
    expect(result.averages.avgReturn5dOnBeat).toBeNull();
    expect(result.averages.avgReturn5dOnMiss).toBeNull();
    expect(result.averages.avgVolumeRatio).toBeNull();
  });

  it('should clamp sample_size to non-negative integer', () => {
    const result = normalizeReaction(makeReactionResponse({ sample_size: 12.7 }));
    expect(result.sampleSize).toBe(13);
  });

  it('should clamp negative sample_size to 0', () => {
    const result = normalizeReaction(makeReactionResponse({ sample_size: -5 }));
    expect(result.sampleSize).toBe(0);
  });

  it('should default sample_size to 0 for invalid values', () => {
    const raw = makeReactionResponse({
      sample_size: NaN as unknown as number,
    });
    const result = normalizeReaction(raw);
    expect(result.sampleSize).toBe(0);
  });

  it('should default sample_size to 0 for boolean true', () => {
    const raw = makeReactionResponse({
      sample_size: true as unknown as number,
    });
    const result = normalizeReaction(raw);
    expect(result.sampleSize).toBe(0);
  });

  it('should return empty data_sources when it is not an array', () => {
    const raw = makeReactionResponse({
      data_sources: 'yfinance' as unknown as string[],
    });
    const result = normalizeReaction(raw);
    expect(result.dataSources).toEqual([]);
  });

  it('should default symbol and event_type to empty strings when missing', () => {
    const raw = {
      ...makeReactionResponse(),
      symbol: undefined as unknown as string,
      event_type: undefined as unknown as string,
    };
    const result = normalizeReaction(raw);
    expect(result.symbol).toBe('');
    expect(result.eventType).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatEventValue
// ---------------------------------------------------------------------------

describe('formatEventValue', () => {
  it('should return "--" for null value', () => {
    expect(formatEventValue(null, 'percent')).toBe('--');
    expect(formatEventValue(null, '')).toBe('--');
    expect(formatEventValue(null, 'index')).toBe('--');
  });

  it('should format 0 as a valid number, NOT "--"', () => {
    expect(formatEventValue(0, 'percent')).toBe('0.0%');
    expect(formatEventValue(0, 'index')).toBe('0.0');
    expect(formatEventValue(0, 'thousands')).toBe('0K');
    expect(formatEventValue(0, 'millions_usd')).toBe('$0M');
    expect(formatEventValue(0, 'billions_usd')).toBe('$0.0B');
    expect(formatEventValue(0, 'other')).toBe('0.00');
  });

  it('should format "percent" unit correctly', () => {
    expect(formatEventValue(3.2, 'percent')).toBe('3.2%');
    expect(formatEventValue(-1.5, 'percent')).toBe('-1.5%');
    expect(formatEventValue(100, 'percent')).toBe('100.0%');
  });

  it('should format "index" unit correctly', () => {
    expect(formatEventValue(52.3, 'index')).toBe('52.3');
    expect(formatEventValue(100, 'index')).toBe('100.0');
  });

  it('should format "thousands" unit correctly', () => {
    expect(formatEventValue(250, 'thousands')).toBe('250K');
    expect(formatEventValue(1234, 'thousands')).toBe('1234K');
  });

  it('should format "millions_usd" unit correctly', () => {
    expect(formatEventValue(500, 'millions_usd')).toBe('$500M');
    expect(formatEventValue(1234, 'millions_usd')).toBe('$1234M');
  });

  it('should format "billions_usd" unit correctly', () => {
    expect(formatEventValue(1.5, 'billions_usd')).toBe('$1.5B');
    expect(formatEventValue(100, 'billions_usd')).toBe('$100.0B');
  });

  it('should use default 2-decimal format for unknown unit', () => {
    expect(formatEventValue(42.567, '')).toBe('42.57');
    expect(formatEventValue(42.567, 'unknown_unit')).toBe('42.57');
    expect(formatEventValue(1, 'count')).toBe('1.00');
  });

  it('should handle negative values', () => {
    expect(formatEventValue(-0.5, 'percent')).toBe('-0.5%');
    expect(formatEventValue(-100, 'thousands')).toBe('-100K');
  });

  it('should handle very large values', () => {
    expect(formatEventValue(999999, 'percent')).toBe('999999.0%');
  });

  it('should handle very small fractional values', () => {
    expect(formatEventValue(0.001, 'percent')).toBe('0.0%');
    expect(formatEventValue(0.001, '')).toBe('0.00');
  });
});

// ---------------------------------------------------------------------------
// formatSurprise
// ---------------------------------------------------------------------------

describe('formatSurprise', () => {
  it('should return "--" for null delta', () => {
    expect(formatSurprise('above', null)).toBe('--');
    expect(formatSurprise('below', null)).toBe('--');
    expect(formatSurprise('inline', null)).toBe('--');
  });

  it('should format "above" direction with "+"', () => {
    expect(formatSurprise('above', 0.15)).toBe('+0.15');
    expect(formatSurprise('above', 1.234)).toBe('+1.23');
  });

  it('should format "below" direction with "-"', () => {
    expect(formatSurprise('below', -0.15)).toBe('-0.15');
    expect(formatSurprise('below', -1.234)).toBe('-1.23');
  });

  it('should format "inline" direction as "0.00"', () => {
    expect(formatSurprise('inline', 0)).toBe('0.00');
    expect(formatSurprise('inline', 0.01)).toBe('0.00');
  });

  it('should use absolute value of delta for above/below', () => {
    // Even if delta is negative with "above", it takes abs
    expect(formatSurprise('above', -0.5)).toBe('+0.50');
    // Even if delta is positive with "below", it takes abs
    expect(formatSurprise('below', 0.5)).toBe('-0.50');
  });

  it('should handle 0 delta', () => {
    expect(formatSurprise('above', 0)).toBe('+0.00');
    expect(formatSurprise('below', 0)).toBe('-0.00');
    expect(formatSurprise('inline', 0)).toBe('0.00');
  });
});
