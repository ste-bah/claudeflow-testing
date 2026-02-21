import {
    normalizeShortInterest,
    normalizeAnalystRatings,
    type ShortInterestRaw,
    type AnalystRatingsRaw,
} from '../fundamentals';

describe('Fundamentals Types', () => {
    describe('normalizeShortInterest', () => {
        it('converts basic valid responses successfully', () => {
            const raw: ShortInterestRaw = {
                symbol: 'AAPL',
                shares_short: 5000,
                short_ratio: 2.1,
                percent_of_float: 0.1,
                settlement_date: '2025-01-01',
            };

            const normalized = normalizeShortInterest(raw);
            expect(normalized.sharesShort).toBe(5000);
            expect(normalized.shortRatio).toBe(2.1);
            expect(normalized.percentOfFloat).toBe(0.1);
            expect(normalized.settlementDate).toBe('2025-01-01');
        });

        it('handles null mappings safely', () => {
            const raw: ShortInterestRaw = {
                symbol: 'UNKNOWN',
                shares_short: null,
                short_ratio: null,
                percent_of_float: null,
                settlement_date: null,
            };

            const normalized = normalizeShortInterest(raw);
            expect(normalized.sharesShort).toBeNull();
            expect(normalized.shortRatio).toBeNull();
            expect(normalized.percentOfFloat).toBeNull();
            expect(normalized.settlementDate).toBeNull();
        });
    });

    describe('normalizeAnalystRatings', () => {
        it('defaults out numerical overrides mapping cleanly', () => {
            const raw: AnalystRatingsRaw = {
                symbol: 'AAPL',
                buy: 10,
                hold: 2,
                sell: 1,
                consensus: 'buy',
                total_analysts: 13,
                price_target_mean: 150.5,
                price_target_high: 200,
                price_target_low: 100,
            };

            const normalized = normalizeAnalystRatings(raw);
            expect(normalized.buy).toBe(10);
            expect(normalized.hold).toBe(2);
            expect(normalized.sell).toBe(1);
            expect(normalized.consensus).toBe('buy');
            expect(normalized.totalAnalysts).toBe(13);
            expect(normalized.priceTargetMean).toBe(150.5);
        });

        it('handles edge condition missing parameters matching limits', () => {
            const raw = {
                symbol: 'BAD',
                consensus: 'hold',
            } as AnalystRatingsRaw;

            const normalized = normalizeAnalystRatings(raw);
            expect(normalized.buy).toBe(0);
            expect(normalized.hold).toBe(0);
            expect(normalized.sell).toBe(0);
            expect(normalized.totalAnalysts).toBe(0);
            expect(normalized.priceTargetMean).toBeNull();
            expect(normalized.priceTargetHigh).toBeNull();
            expect(normalized.priceTargetLow).toBeNull();
        });
    });
});
