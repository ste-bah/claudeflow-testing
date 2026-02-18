/**
 * Tests for analysis type normalizer functions.
 *
 * sanitizeNumber is private, so it is tested indirectly through the exported
 * normalizers that delegate to it (normalizeSignal, normalizeTimeframeBreakdown,
 * normalizeAnalysis).
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeDirection,
  normalizeOverallDirection,
  normalizeTimeframe,
  normalizeSignal,
  normalizeTimeframeBreakdown,
  normalizeAnalysis,
} from '../../types/analysis';
import type {
  AnalysisSignalRaw,
  TimeframeBreakdownRaw,
  AnalysisApiResponse,
} from '../../types/analysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignalRaw(
  overrides: Partial<AnalysisSignalRaw> = {},
): AnalysisSignalRaw {
  return {
    ticker: 'AAPL',
    methodology: 'wyckoff',
    direction: 'bullish',
    confidence: 0.85,
    timeframe: 'short',
    reasoning: 'Accumulation phase detected',
    key_levels: { support: 148.5, resistance: 155.0 },
    timestamp: '2024-02-15T10:00:00Z',
    ...overrides,
  };
}

function makeBreakdownRaw(
  overrides: Partial<TimeframeBreakdownRaw> = {},
): TimeframeBreakdownRaw {
  return {
    direction: 'bullish',
    confidence: 0.8,
    methodologies: ['wyckoff', 'canslim'],
    ...overrides,
  };
}

function makeApiResponse(
  overrides: Partial<AnalysisApiResponse> = {},
): AnalysisApiResponse {
  return {
    symbol: 'AAPL',
    composite: {
      overall_direction: 'bullish',
      overall_confidence: 0.75,
      confluence_count: 4,
      timeframe_breakdown: {
        short: { direction: 'bullish', confidence: 0.8, methodologies: ['wyckoff'] },
        medium: { direction: 'neutral', confidence: 0.5, methodologies: ['elliott_wave'] },
        long: { direction: 'bearish', confidence: 0.6, methodologies: ['canslim'] },
      },
      trade_thesis: 'Strong uptrend with healthy pullback',
      weights_used: { wyckoff: 1.0, elliott_wave: 0.8 },
      timestamp: '2024-02-15T10:00:00Z',
    },
    signals: [
      makeSignalRaw(),
      makeSignalRaw({ methodology: 'elliott_wave', direction: 'neutral', confidence: 0.6 }),
    ],
    metadata: {
      analysis_duration_ms: 1234,
      methodologies_requested: 6,
      methodologies_completed: 5,
      methodologies_failed: 1,
      failed_methodologies: ['sentiment'],
      cached: false,
      data_sources_used: ['yfinance', 'edgar'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sanitizeNumber (tested indirectly through normalizeSignal confidence)
// ---------------------------------------------------------------------------

describe('sanitizeNumber (via normalizeSignal confidence)', () => {
  it('should pass through a valid finite number', () => {
    const result = normalizeSignal(makeSignalRaw({ confidence: 0.5 }));
    expect(result.confidence).toBe(0.5);
  });

  it('should return 0 for boolean true (bool is subclass of number)', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: true as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for boolean false', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: false as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for NaN', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: NaN }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for Infinity', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: Infinity }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for -Infinity', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: -Infinity }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for string', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: '0.5' as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for null', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: null as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should return 0 for undefined', () => {
    const result = normalizeSignal(
      makeSignalRaw({ confidence: undefined as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should pass through zero', () => {
    const result = normalizeSignal(makeSignalRaw({ confidence: 0 }));
    expect(result.confidence).toBe(0);
  });

  it('should pass through negative zero', () => {
    const result = normalizeSignal(makeSignalRaw({ confidence: -0 }));
    expect(result.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeDirection
// ---------------------------------------------------------------------------

describe('normalizeDirection', () => {
  it('should return "bullish" for valid "bullish"', () => {
    expect(normalizeDirection('bullish')).toBe('bullish');
  });

  it('should return "bearish" for valid "bearish"', () => {
    expect(normalizeDirection('bearish')).toBe('bearish');
  });

  it('should return "neutral" for valid "neutral"', () => {
    expect(normalizeDirection('neutral')).toBe('neutral');
  });

  it('should return "neutral" for unknown string', () => {
    expect(normalizeDirection('sideways')).toBe('neutral');
  });

  it('should return "neutral" for "strong_bullish" (not a SignalDirection)', () => {
    expect(normalizeDirection('strong_bullish')).toBe('neutral');
  });

  it('should return "neutral" for empty string', () => {
    expect(normalizeDirection('')).toBe('neutral');
  });

  it('should return "neutral" for number', () => {
    expect(normalizeDirection(42)).toBe('neutral');
  });

  it('should return "neutral" for null', () => {
    expect(normalizeDirection(null)).toBe('neutral');
  });

  it('should return "neutral" for undefined', () => {
    expect(normalizeDirection(undefined)).toBe('neutral');
  });

  it('should return "neutral" for boolean', () => {
    expect(normalizeDirection(true)).toBe('neutral');
  });

  it('should return "neutral" for object', () => {
    expect(normalizeDirection({})).toBe('neutral');
  });

  it('should return "neutral" for array', () => {
    expect(normalizeDirection(['bullish'])).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// normalizeOverallDirection
// ---------------------------------------------------------------------------

describe('normalizeOverallDirection', () => {
  it('should return "strong_bullish" for valid value', () => {
    expect(normalizeOverallDirection('strong_bullish')).toBe('strong_bullish');
  });

  it('should return "bullish" for valid value', () => {
    expect(normalizeOverallDirection('bullish')).toBe('bullish');
  });

  it('should return "neutral" for valid value', () => {
    expect(normalizeOverallDirection('neutral')).toBe('neutral');
  });

  it('should return "bearish" for valid value', () => {
    expect(normalizeOverallDirection('bearish')).toBe('bearish');
  });

  it('should return "strong_bearish" for valid value', () => {
    expect(normalizeOverallDirection('strong_bearish')).toBe('strong_bearish');
  });

  it('should return "neutral" for unknown string', () => {
    expect(normalizeOverallDirection('mega_bullish')).toBe('neutral');
  });

  it('should return "neutral" for non-string (number)', () => {
    expect(normalizeOverallDirection(1)).toBe('neutral');
  });

  it('should return "neutral" for non-string (null)', () => {
    expect(normalizeOverallDirection(null)).toBe('neutral');
  });

  it('should return "neutral" for non-string (undefined)', () => {
    expect(normalizeOverallDirection(undefined)).toBe('neutral');
  });

  it('should return "neutral" for non-string (boolean)', () => {
    expect(normalizeOverallDirection(false)).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeframe
// ---------------------------------------------------------------------------

describe('normalizeTimeframe', () => {
  it('should return "short" for valid value', () => {
    expect(normalizeTimeframe('short')).toBe('short');
  });

  it('should return "medium" for valid value', () => {
    expect(normalizeTimeframe('medium')).toBe('medium');
  });

  it('should return "long" for valid value', () => {
    expect(normalizeTimeframe('long')).toBe('long');
  });

  it('should return "medium" for unknown string', () => {
    expect(normalizeTimeframe('weekly')).toBe('medium');
  });

  it('should return "medium" for empty string', () => {
    expect(normalizeTimeframe('')).toBe('medium');
  });

  it('should return "medium" for non-string (number)', () => {
    expect(normalizeTimeframe(3)).toBe('medium');
  });

  it('should return "medium" for non-string (null)', () => {
    expect(normalizeTimeframe(null)).toBe('medium');
  });

  it('should return "medium" for non-string (undefined)', () => {
    expect(normalizeTimeframe(undefined)).toBe('medium');
  });

  it('should return "medium" for non-string (boolean)', () => {
    expect(normalizeTimeframe(true)).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// normalizeSignal
// ---------------------------------------------------------------------------

describe('normalizeSignal', () => {
  it('should normalize a valid signal to camelCase', () => {
    const raw = makeSignalRaw();
    const result = normalizeSignal(raw);

    expect(result.ticker).toBe('AAPL');
    expect(result.methodology).toBe('wyckoff');
    expect(result.direction).toBe('bullish');
    expect(result.confidence).toBe(0.85);
    expect(result.timeframe).toBe('short');
    expect(result.reasoning).toBe('Accumulation phase detected');
    expect(result.keyLevels).toEqual({ support: 148.5, resistance: 155.0 });
    expect(result.timestamp).toBe('2024-02-15T10:00:00Z');
  });

  it('should clamp confidence above 1 to 1', () => {
    const result = normalizeSignal(makeSignalRaw({ confidence: 1.5 }));
    expect(result.confidence).toBe(1);
  });

  it('should clamp negative confidence to 0', () => {
    const result = normalizeSignal(makeSignalRaw({ confidence: -0.3 }));
    expect(result.confidence).toBe(0);
  });

  it('should normalize invalid direction to "neutral"', () => {
    const result = normalizeSignal(
      makeSignalRaw({ direction: 'sideways' }),
    );
    expect(result.direction).toBe('neutral');
  });

  it('should normalize invalid timeframe to "medium"', () => {
    const result = normalizeSignal(
      makeSignalRaw({ timeframe: 'weekly' }),
    );
    expect(result.timeframe).toBe('medium');
  });

  it('should replace non-object key_levels with empty object', () => {
    const result = normalizeSignal(
      makeSignalRaw({ key_levels: 'invalid' as unknown as Record<string, unknown> }),
    );
    expect(result.keyLevels).toEqual({});
  });

  it('should replace null key_levels with empty object', () => {
    const result = normalizeSignal(
      makeSignalRaw({ key_levels: null as unknown as Record<string, unknown> }),
    );
    expect(result.keyLevels).toEqual({});
  });

  it('should replace array key_levels with empty object', () => {
    const result = normalizeSignal(
      makeSignalRaw({ key_levels: [1, 2] as unknown as Record<string, unknown> }),
    );
    expect(result.keyLevels).toEqual({});
  });

  it('should default missing ticker to empty string', () => {
    const raw = makeSignalRaw();
    const patched = { ...raw, ticker: undefined } as unknown as AnalysisSignalRaw;
    const result = normalizeSignal(patched);
    expect(result.ticker).toBe('');
  });

  it('should default missing methodology to empty string', () => {
    const raw = makeSignalRaw();
    const patched = { ...raw, methodology: undefined } as unknown as AnalysisSignalRaw;
    const result = normalizeSignal(patched);
    expect(result.methodology).toBe('');
  });

  it('should default missing reasoning to empty string', () => {
    const raw = makeSignalRaw();
    const patched = { ...raw, reasoning: undefined } as unknown as AnalysisSignalRaw;
    const result = normalizeSignal(patched);
    expect(result.reasoning).toBe('');
  });

  it('should default missing timestamp to empty string', () => {
    const raw = makeSignalRaw();
    const patched = { ...raw, timestamp: undefined } as unknown as AnalysisSignalRaw;
    const result = normalizeSignal(patched);
    expect(result.timestamp).toBe('');
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeframeBreakdown
// ---------------------------------------------------------------------------

describe('normalizeTimeframeBreakdown', () => {
  it('should normalize a valid breakdown', () => {
    const raw = makeBreakdownRaw();
    const result = normalizeTimeframeBreakdown(raw);

    expect(result.direction).toBe('bullish');
    expect(result.confidence).toBe(0.8);
    expect(result.methodologies).toEqual(['wyckoff', 'canslim']);
  });

  it('should clamp confidence above 1 to 1', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({ confidence: 2.0 }),
    );
    expect(result.confidence).toBe(1);
  });

  it('should clamp negative confidence to 0', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({ confidence: -0.5 }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should default confidence to 0 for NaN', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({ confidence: NaN }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should default confidence to 0 for boolean', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({ confidence: true as unknown as number }),
    );
    expect(result.confidence).toBe(0);
  });

  it('should normalize invalid direction to "neutral"', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({ direction: 'strong_bullish' }),
    );
    expect(result.direction).toBe('neutral');
  });

  it('should replace non-array methodologies with empty array', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({
        methodologies: 'wyckoff' as unknown as string[],
      }),
    );
    expect(result.methodologies).toEqual([]);
  });

  it('should replace null methodologies with empty array', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({
        methodologies: null as unknown as string[],
      }),
    );
    expect(result.methodologies).toEqual([]);
  });

  it('should replace undefined methodologies with empty array', () => {
    const result = normalizeTimeframeBreakdown(
      makeBreakdownRaw({
        methodologies: undefined as unknown as string[],
      }),
    );
    expect(result.methodologies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeAnalysis
// ---------------------------------------------------------------------------

describe('normalizeAnalysis', () => {
  it('should normalize the full API response into display format', () => {
    const raw = makeApiResponse();
    const result = normalizeAnalysis(raw);

    expect(result.symbol).toBe('AAPL');
    expect(result.composite.overallDirection).toBe('bullish');
    expect(result.composite.overallConfidence).toBe(0.75);
    expect(result.composite.confluenceCount).toBe(4);
    expect(result.composite.tradeThesis).toBe('Strong uptrend with healthy pullback');
    expect(result.composite.timestamp).toBe('2024-02-15T10:00:00Z');
    expect(result.composite.weightsUsed).toEqual({ wyckoff: 1.0, elliott_wave: 0.8 });
  });

  it('should normalize timeframe breakdown with defaults for missing keys', () => {
    const raw = makeApiResponse();
    // Only provide "short" in breakdown
    (raw as { composite: { timeframe_breakdown: Record<string, unknown> } }).composite.timeframe_breakdown = {
      short: { direction: 'bullish', confidence: 0.9, methodologies: ['wyckoff'] },
    };
    const result = normalizeAnalysis(raw);

    expect(result.composite.timeframeBreakdown.short.direction).toBe('bullish');
    expect(result.composite.timeframeBreakdown.short.confidence).toBe(0.9);
    // medium and long should have defaults
    expect(result.composite.timeframeBreakdown.medium.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.medium.confidence).toBe(0);
    expect(result.composite.timeframeBreakdown.medium.methodologies).toEqual([]);
    expect(result.composite.timeframeBreakdown.long.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.long.confidence).toBe(0);
    expect(result.composite.timeframeBreakdown.long.methodologies).toEqual([]);
  });

  it('should clamp overall confidence to [0, 1]', () => {
    const raw = makeApiResponse();
    (raw as { composite: { overall_confidence: number } }).composite.overall_confidence = 1.5;
    const result = normalizeAnalysis(raw);
    expect(result.composite.overallConfidence).toBe(1);
  });

  it('should default overall confidence to 0 for NaN', () => {
    const raw = makeApiResponse();
    (raw as { composite: { overall_confidence: number } }).composite.overall_confidence = NaN;
    const result = normalizeAnalysis(raw);
    expect(result.composite.overallConfidence).toBe(0);
  });

  it('should round confluence count to integer', () => {
    const raw = makeApiResponse();
    (raw as { composite: { confluence_count: number } }).composite.confluence_count = 3.7;
    const result = normalizeAnalysis(raw);
    expect(result.composite.confluenceCount).toBe(4);
  });

  it('should default confluence count to 0 for non-number', () => {
    const raw = makeApiResponse();
    (raw as { composite: { confluence_count: unknown } }).composite.confluence_count = 'four';
    const result = normalizeAnalysis(raw);
    expect(result.composite.confluenceCount).toBe(0);
  });

  it('should normalize overall direction to "neutral" for unknown value', () => {
    const raw = makeApiResponse();
    (raw as { composite: { overall_direction: string } }).composite.overall_direction = 'mega_bullish';
    const result = normalizeAnalysis(raw);
    expect(result.composite.overallDirection).toBe('neutral');
  });

  it('should guard timeframe_breakdown against array value', () => {
    const raw = makeApiResponse();
    (raw as { composite: { timeframe_breakdown: unknown } }).composite.timeframe_breakdown = [1, 2];
    const result = normalizeAnalysis(raw);
    // All three keys should be defaults
    expect(result.composite.timeframeBreakdown.short.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.medium.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.long.direction).toBe('neutral');
  });

  it('should guard timeframe_breakdown against null', () => {
    const raw = makeApiResponse();
    (raw as { composite: { timeframe_breakdown: unknown } }).composite.timeframe_breakdown = null;
    const result = normalizeAnalysis(raw);
    expect(result.composite.timeframeBreakdown.short.confidence).toBe(0);
  });

  it('should guard weights_used against non-object', () => {
    const raw = makeApiResponse();
    (raw as { composite: { weights_used: unknown } }).composite.weights_used = 'invalid';
    const result = normalizeAnalysis(raw);
    expect(result.composite.weightsUsed).toEqual({});
  });

  it('should guard weights_used against array', () => {
    const raw = makeApiResponse();
    (raw as { composite: { weights_used: unknown } }).composite.weights_used = [1, 2];
    const result = normalizeAnalysis(raw);
    expect(result.composite.weightsUsed).toEqual({});
  });

  it('should guard weights_used against null', () => {
    const raw = makeApiResponse();
    (raw as { composite: { weights_used: unknown } }).composite.weights_used = null;
    const result = normalizeAnalysis(raw);
    expect(result.composite.weightsUsed).toEqual({});
  });

  it('should default trade_thesis to empty string when missing', () => {
    const raw = makeApiResponse();
    (raw as { composite: { trade_thesis: unknown } }).composite.trade_thesis = undefined;
    const result = normalizeAnalysis(raw);
    expect(result.composite.tradeThesis).toBe('');
  });

  it('should default composite timestamp to empty string when missing', () => {
    const raw = makeApiResponse();
    (raw as { composite: { timestamp: unknown } }).composite.timestamp = undefined;
    const result = normalizeAnalysis(raw);
    expect(result.composite.timestamp).toBe('');
  });

  // -- Signals array --------------------------------------------------------

  it('should normalize signals array', () => {
    const raw = makeApiResponse();
    const result = normalizeAnalysis(raw);
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0].methodology).toBe('wyckoff');
    expect(result.signals[1].methodology).toBe('elliott_wave');
  });

  it('should guard signals against non-array', () => {
    const raw = makeApiResponse();
    (raw as { signals: unknown }).signals = 'not-an-array';
    const result = normalizeAnalysis(raw);
    expect(result.signals).toEqual([]);
  });

  it('should guard signals against null', () => {
    const raw = makeApiResponse();
    (raw as { signals: unknown }).signals = null;
    const result = normalizeAnalysis(raw);
    expect(result.signals).toEqual([]);
  });

  // -- Metadata -------------------------------------------------------------

  it('should normalize metadata fields', () => {
    const raw = makeApiResponse();
    const result = normalizeAnalysis(raw);

    expect(result.metadata.analysisDurationMs).toBe(1234);
    expect(result.metadata.methodologiesRequested).toBe(6);
    expect(result.metadata.methodologiesCompleted).toBe(5);
    expect(result.metadata.methodologiesFailed).toBe(1);
    expect(result.metadata.failedMethodologies).toEqual(['sentiment']);
    expect(result.metadata.cached).toBe(false);
    expect(result.metadata.dataSourcesUsed).toEqual(['yfinance', 'edgar']);
  });

  it('should round duration and methodology counts', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { analysis_duration_ms: number } }).metadata.analysis_duration_ms = 1234.56;
    (raw as { metadata: { methodologies_requested: number } }).metadata.methodologies_requested = 6.9;
    const result = normalizeAnalysis(raw);
    expect(result.metadata.analysisDurationMs).toBe(1235);
    expect(result.metadata.methodologiesRequested).toBe(7);
  });

  it('should default metadata numeric fields to 0 for NaN', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { analysis_duration_ms: unknown } }).metadata.analysis_duration_ms = NaN;
    (raw as { metadata: { methodologies_requested: unknown } }).metadata.methodologies_requested = NaN;
    (raw as { metadata: { methodologies_completed: unknown } }).metadata.methodologies_completed = NaN;
    (raw as { metadata: { methodologies_failed: unknown } }).metadata.methodologies_failed = NaN;
    const result = normalizeAnalysis(raw);
    expect(result.metadata.analysisDurationMs).toBe(0);
    expect(result.metadata.methodologiesRequested).toBe(0);
    expect(result.metadata.methodologiesCompleted).toBe(0);
    expect(result.metadata.methodologiesFailed).toBe(0);
  });

  it('should default cached to false for non-boolean', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { cached: unknown } }).metadata.cached = 'yes';
    const result = normalizeAnalysis(raw);
    expect(result.metadata.cached).toBe(false);
  });

  it('should set cached to true when metadata.cached === true', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { cached: boolean } }).metadata.cached = true;
    const result = normalizeAnalysis(raw);
    expect(result.metadata.cached).toBe(true);
  });

  it('should guard failed_methodologies against non-array', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { failed_methodologies: unknown } }).metadata.failed_methodologies = 'sentiment';
    const result = normalizeAnalysis(raw);
    expect(result.metadata.failedMethodologies).toEqual([]);
  });

  it('should guard data_sources_used against non-array', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { data_sources_used: unknown } }).metadata.data_sources_used = 42;
    const result = normalizeAnalysis(raw);
    expect(result.metadata.dataSourcesUsed).toEqual([]);
  });

  // -- Symbol ---------------------------------------------------------------

  it('should default symbol to empty string when missing', () => {
    const raw = makeApiResponse();
    (raw as { symbol: unknown }).symbol = undefined;
    const result = normalizeAnalysis(raw);
    expect(result.symbol).toBe('');
  });

  // -- Metadata missing entirely --------------------------------------------

  it('should handle missing metadata gracefully', () => {
    const raw = makeApiResponse();
    (raw as { metadata: unknown }).metadata = undefined;
    const result = normalizeAnalysis(raw);

    expect(result.metadata.analysisDurationMs).toBe(0);
    expect(result.metadata.methodologiesRequested).toBe(0);
    expect(result.metadata.methodologiesCompleted).toBe(0);
    expect(result.metadata.methodologiesFailed).toBe(0);
    expect(result.metadata.failedMethodologies).toEqual([]);
    expect(result.metadata.cached).toBe(false);
    expect(result.metadata.dataSourcesUsed).toEqual([]);
  });

  // -- Composite missing entirely -------------------------------------------

  it('should handle missing composite gracefully', () => {
    const raw = makeApiResponse();
    (raw as { composite: unknown }).composite = undefined;
    const result = normalizeAnalysis(raw);

    expect(result.composite.overallDirection).toBe('neutral');
    expect(result.composite.overallConfidence).toBe(0);
    expect(result.composite.confluenceCount).toBe(0);
    expect(result.composite.tradeThesis).toBe('');
    expect(result.composite.timestamp).toBe('');
    expect(result.composite.weightsUsed).toEqual({});
    expect(result.composite.timeframeBreakdown.short.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.medium.direction).toBe('neutral');
    expect(result.composite.timeframeBreakdown.long.direction).toBe('neutral');
  });

  // -- Negative metadata values clamped to 0 --------------------------------

  it('should clamp negative metadata numeric values to 0', () => {
    const raw = makeApiResponse();
    (raw as { metadata: { analysis_duration_ms: number } }).metadata.analysis_duration_ms = -500;
    (raw as { metadata: { methodologies_failed: number } }).metadata.methodologies_failed = -1;
    const result = normalizeAnalysis(raw);
    expect(result.metadata.analysisDurationMs).toBe(0);
    expect(result.metadata.methodologiesFailed).toBe(0);
  });
});
