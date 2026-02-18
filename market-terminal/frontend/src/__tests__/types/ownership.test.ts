import { describe, it, expect } from 'vitest';
import {
  normalizeHolder,
  normalizeOwnership,
  normalizeInsiderTransaction,
  normalizeInsider,
  formatShares,
  formatChangePercent,
  OWNERSHIP_CACHE_TTL_MS,
  INSIDER_CACHE_TTL_MS,
} from '../../types/ownership';
import type {
  OwnershipHolderRaw,
  OwnershipApiResponse,
  InsiderTransactionRaw,
  InsiderApiResponse,
} from '../../types/ownership';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid raw holder record. */
function makeRawHolder(
  overrides: Partial<OwnershipHolderRaw> = {},
): OwnershipHolderRaw {
  return {
    holder_name: 'Vanguard Group',
    cik: '0000102909',
    shares: 1300000000,
    value: 234000000000,
    percent_of_outstanding: null,
    change_shares: 5000000,
    change_percent: 0.39,
    filing_date: '2024-08-14',
    ...overrides,
  };
}

/** Build a valid raw ownership API response. */
function makeRawOwnership(
  overrides: Partial<OwnershipApiResponse> = {},
): OwnershipApiResponse {
  return {
    symbol: 'AAPL',
    filing_period: 'Q3 2024',
    total_institutional_shares: 15000000000,
    total_institutional_value: 2700000000000,
    institutional_ownership_percent: null,
    holders: [makeRawHolder()],
    quarter_over_quarter: {
      new_positions: 0,
      increased_positions: 12,
      decreased_positions: 5,
      closed_positions: 0,
      net_shares_change: 50000000,
    },
    data_source: 'edgar_13f',
    data_timestamp: '2024-12-01T12:00:00Z',
    note: '13F filings have a 45-day reporting delay.',
    ...overrides,
  };
}

/** Build a valid raw insider transaction record. */
function makeRawTransaction(
  overrides: Partial<InsiderTransactionRaw> = {},
): InsiderTransactionRaw {
  return {
    insider_name: 'Tim Cook',
    title: 'CEO',
    transaction_type: 'S-Sale',
    transaction_date: '2024-11-15',
    shares: 50000,
    price_per_share: 185.50,
    total_value: 9275000,
    shares_remaining: 3000000,
    filing_date: '2024-11-17',
    filing_url: null,
    ...overrides,
  };
}

/** Build a valid raw insider API response. */
function makeRawInsider(
  overrides: Partial<InsiderApiResponse> = {},
): InsiderApiResponse {
  return {
    symbol: 'AAPL',
    transactions: [makeRawTransaction()],
    summary: {
      period_days: 90,
      total_insider_buys: 10000,
      total_insider_sells: 50000,
      total_buy_value: 1850000,
      total_sell_value: 9275000,
      net_activity: 'net_selling',
      buy_sell_ratio: 0.2,
    },
    data_source: 'edgar_form4',
    data_timestamp: '2024-12-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Ownership Constants', () => {
  it('should export OWNERSHIP_CACHE_TTL_MS as 900000 (15 minutes)', () => {
    expect(OWNERSHIP_CACHE_TTL_MS).toBe(900_000);
  });

  it('should export INSIDER_CACHE_TTL_MS as 900000 (15 minutes)', () => {
    expect(INSIDER_CACHE_TTL_MS).toBe(900_000);
  });
});

// ---------------------------------------------------------------------------
// normalizeHolder
// ---------------------------------------------------------------------------

describe('normalizeHolder', () => {
  it('should map snake_case to camelCase', () => {
    const raw = makeRawHolder();
    const result = normalizeHolder(raw);

    expect(result.holderName).toBe('Vanguard Group');
    expect(result.cik).toBe('0000102909');
    expect(result.shares).toBe(1300000000);
    expect(result.value).toBe(234000000000);
    expect(result.percentOfOutstanding).toBeNull();
    expect(result.changeShares).toBe(5000000);
    expect(result.changePercent).toBe(0.39);
    expect(result.filingDate).toBe('2024-08-14');
  });

  it('should sanitize NaN shares to 0', () => {
    const raw = makeRawHolder({ shares: NaN as unknown as number });
    const result = normalizeHolder(raw);

    expect(result.shares).toBe(0);
  });

  it('should preserve null percentOfOutstanding', () => {
    const raw = makeRawHolder({ percent_of_outstanding: null });
    const result = normalizeHolder(raw);

    expect(result.percentOfOutstanding).toBeNull();
  });

  it('should sanitize Infinity shares to 0', () => {
    const raw = makeRawHolder({ shares: Infinity as unknown as number });
    const result = normalizeHolder(raw);

    expect(result.shares).toBe(0);
  });

  it('should sanitize boolean shares to 0', () => {
    const raw = makeRawHolder({ shares: true as unknown as number });
    const result = normalizeHolder(raw);

    expect(result.shares).toBe(0);
  });

  it('should sanitize NaN value to 0', () => {
    const raw = makeRawHolder({ value: NaN as unknown as number });
    const result = normalizeHolder(raw);

    expect(result.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeOwnership
// ---------------------------------------------------------------------------

describe('normalizeOwnership', () => {
  it('should map all fields correctly', () => {
    const raw = makeRawOwnership();
    const result = normalizeOwnership(raw);

    expect(result.symbol).toBe('AAPL');
    expect(result.filingPeriod).toBe('Q3 2024');
    expect(result.totalInstitutionalShares).toBe(15000000000);
    expect(result.totalInstitutionalValue).toBe(2700000000000);
    expect(result.institutionalOwnershipPercent).toBeNull();
    expect(result.dataSource).toBe('edgar_13f');
    expect(result.dataTimestamp).toBe('2024-12-01T12:00:00Z');
    expect(result.note).toBe('13F filings have a 45-day reporting delay.');

    // Quarter-over-quarter
    expect(result.quarterOverQuarter.newPositions).toBe(0);
    expect(result.quarterOverQuarter.increasedPositions).toBe(12);
    expect(result.quarterOverQuarter.decreasedPositions).toBe(5);
    expect(result.quarterOverQuarter.closedPositions).toBe(0);
    expect(result.quarterOverQuarter.netSharesChange).toBe(50000000);

    // Holders
    expect(result.holders).toHaveLength(1);
    expect(result.holders[0].holderName).toBe('Vanguard Group');
  });

  it('should guard non-array holders to empty array', () => {
    const raw = makeRawOwnership({
      holders: 'not-an-array' as unknown as OwnershipHolderRaw[],
    });
    const result = normalizeOwnership(raw);

    expect(result.holders).toEqual([]);
  });

  it('should default note to empty string when undefined', () => {
    const raw = makeRawOwnership();
    // Remove the note property to simulate undefined
    const { note: _, ...rawWithoutNote } = raw;
    const result = normalizeOwnership(
      rawWithoutNote as unknown as OwnershipApiResponse,
    );

    expect(result.note).toBe('');
  });

  it('should sanitize NaN totalInstitutionalShares to 0', () => {
    const raw = makeRawOwnership({
      total_institutional_shares: NaN as unknown as number,
    });
    const result = normalizeOwnership(raw);

    expect(result.totalInstitutionalShares).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeInsiderTransaction
// ---------------------------------------------------------------------------

describe('normalizeInsiderTransaction', () => {
  it('should map snake_case to camelCase and drop filing_url', () => {
    const raw = makeRawTransaction();
    const result = normalizeInsiderTransaction(raw);

    expect(result.insiderName).toBe('Tim Cook');
    expect(result.title).toBe('CEO');
    expect(result.transactionType).toBe('S-Sale');
    expect(result.transactionDate).toBe('2024-11-15');
    expect(result.shares).toBe(50000);
    expect(result.pricePerShare).toBe(185.50);
    expect(result.totalValue).toBe(9275000);
    expect(result.sharesRemaining).toBe(3000000);
    expect(result.filingDate).toBe('2024-11-17');
    // filing_url is dropped (not present in output type)
    expect('filingUrl' in result).toBe(false);
  });

  it('should sanitize NaN shares to 0', () => {
    const raw = makeRawTransaction({ shares: NaN as unknown as number });
    const result = normalizeInsiderTransaction(raw);

    expect(result.shares).toBe(0);
  });

  it('should sanitize Infinity shares to 0', () => {
    const raw = makeRawTransaction({ shares: Infinity as unknown as number });
    const result = normalizeInsiderTransaction(raw);

    expect(result.shares).toBe(0);
  });

  it('should sanitize boolean shares to 0', () => {
    const raw = makeRawTransaction({ shares: true as unknown as number });
    const result = normalizeInsiderTransaction(raw);

    expect(result.shares).toBe(0);
  });

  it('should preserve null pricePerShare', () => {
    const raw = makeRawTransaction({ price_per_share: null });
    const result = normalizeInsiderTransaction(raw);

    expect(result.pricePerShare).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeInsider
// ---------------------------------------------------------------------------

describe('normalizeInsider', () => {
  it('should guard non-array transactions to empty array', () => {
    const raw = makeRawInsider({
      transactions: 'not-an-array' as unknown as InsiderTransactionRaw[],
    });
    const result = normalizeInsider(raw);

    expect(result.transactions).toEqual([]);
  });

  it('should map summary fields correctly', () => {
    const raw = makeRawInsider();
    const result = normalizeInsider(raw);

    expect(result.summary.periodDays).toBe(90);
    expect(result.summary.totalInsiderBuys).toBe(10000);
    expect(result.summary.totalInsiderSells).toBe(50000);
    expect(result.summary.totalBuyValue).toBe(1850000);
    expect(result.summary.totalSellValue).toBe(9275000);
    expect(result.summary.netActivity).toBe('net_selling');
    expect(result.summary.buySellRatio).toBe(0.2);
  });

  it('should map top-level fields correctly', () => {
    const raw = makeRawInsider();
    const result = normalizeInsider(raw);

    expect(result.symbol).toBe('AAPL');
    expect(result.dataSource).toBe('edgar_form4');
    expect(result.dataTimestamp).toBe('2024-12-01T12:00:00Z');
  });

  it('should sanitize NaN in summary fields to 0', () => {
    const raw = makeRawInsider();
    // Override summary with NaN values
    const rawWithNaN = {
      ...raw,
      summary: {
        ...raw.summary,
        total_insider_buys: NaN as unknown as number,
        buy_sell_ratio: NaN as unknown as number,
      },
    };
    const result = normalizeInsider(rawWithNaN);

    expect(result.summary.totalInsiderBuys).toBe(0);
    expect(result.summary.buySellRatio).toBe(0);
  });

  it('should handle empty transactions array', () => {
    const raw = makeRawInsider({ transactions: [] });
    const result = normalizeInsider(raw);

    expect(result.transactions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sanitizeNumber (tested indirectly via normalizers)
// ---------------------------------------------------------------------------

describe('sanitizeNumber (via normalizers)', () => {
  it('should treat boolean true as null (via normalizeHolder)', () => {
    const raw = makeRawHolder({
      change_shares: true as unknown as number | null,
    });
    const result = normalizeHolder(raw);

    expect(result.changeShares).toBeNull();
  });

  it('should treat boolean false as null (via normalizeHolder)', () => {
    const raw = makeRawHolder({
      change_shares: false as unknown as number | null,
    });
    const result = normalizeHolder(raw);

    expect(result.changeShares).toBeNull();
  });

  it('should treat NaN as null (via normalizeInsiderTransaction)', () => {
    const raw = makeRawTransaction({
      price_per_share: NaN as unknown as number | null,
    });
    const result = normalizeInsiderTransaction(raw);

    expect(result.pricePerShare).toBeNull();
  });

  it('should treat Infinity as null (via normalizeInsiderTransaction)', () => {
    const raw = makeRawTransaction({
      total_value: Infinity as unknown as number | null,
    });
    const result = normalizeInsiderTransaction(raw);

    expect(result.totalValue).toBeNull();
  });

  it('should treat -Infinity as null (via normalizeHolder)', () => {
    const raw = makeRawHolder({
      change_percent: -Infinity as unknown as number | null,
    });
    const result = normalizeHolder(raw);

    expect(result.changePercent).toBeNull();
  });

  it('should preserve 0 as a valid number (via normalizeHolder)', () => {
    const raw = makeRawHolder({ shares: 0 });
    const result = normalizeHolder(raw);

    expect(result.shares).toBe(0);
  });

  it('should preserve negative numbers (via normalizeHolder)', () => {
    const raw = makeRawHolder({ change_shares: -5000 });
    const result = normalizeHolder(raw);

    expect(result.changeShares).toBe(-5000);
  });
});

// ---------------------------------------------------------------------------
// formatShares
// ---------------------------------------------------------------------------

describe('formatShares', () => {
  it('should format billions with B suffix', () => {
    expect(formatShares(1500000000)).toBe('1.50B');
  });

  it('should format millions with M suffix', () => {
    expect(formatShares(1500000)).toBe('1.50M');
  });

  it('should format thousands with K suffix', () => {
    expect(formatShares(1500)).toBe('1.50K');
  });

  it('should format small numbers with locale formatting', () => {
    expect(formatShares(500)).toBe('500');
  });

  it('should return "--" for null', () => {
    expect(formatShares(null)).toBe('--');
  });

  it('should handle negative values correctly', () => {
    expect(formatShares(-2300000)).toBe('-2.30M');
  });

  it('should handle negative thousands', () => {
    expect(formatShares(-2300)).toBe('-2.30K');
  });

  it('should handle zero', () => {
    expect(formatShares(0)).toBe('0');
  });

  it('should handle exactly 1 billion', () => {
    expect(formatShares(1000000000)).toBe('1.00B');
  });

  it('should handle exactly 1 million', () => {
    expect(formatShares(1000000)).toBe('1.00M');
  });

  it('should handle exactly 1 thousand', () => {
    expect(formatShares(1000)).toBe('1.00K');
  });
});

// ---------------------------------------------------------------------------
// formatChangePercent
// ---------------------------------------------------------------------------

describe('formatChangePercent', () => {
  it('should format positive values with "+" prefix', () => {
    expect(formatChangePercent(12.5)).toBe('+12.50%');
  });

  it('should format negative values without extra prefix', () => {
    expect(formatChangePercent(-3.2)).toBe('-3.20%');
  });

  it('should return "--" for null', () => {
    expect(formatChangePercent(null)).toBe('--');
  });

  it('should handle zero without "+" prefix', () => {
    expect(formatChangePercent(0)).toBe('0.00%');
  });

  it('should handle small positive values', () => {
    expect(formatChangePercent(0.01)).toBe('+0.01%');
  });

  it('should handle small negative values', () => {
    expect(formatChangePercent(-0.01)).toBe('-0.01%');
  });
});
