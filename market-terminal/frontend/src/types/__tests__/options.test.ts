import { describe, it, expect } from 'vitest';
import {
    sanitizeNumber,
    normalizeOptionContract,
    normalizeOptionsChain,
    OptionContractRaw,
    OptionsChainRaw,
} from '../options';

describe('options.ts', () => {
    describe('sanitizeNumber', () => {
        it('returns valid finite numbers', () => {
            expect(sanitizeNumber(42)).toBe(42);
            expect(sanitizeNumber(0)).toBe(0);
            expect(sanitizeNumber(-1.5)).toBe(-1.5);
        });

        it('rejects booleans to satisfy bool-is-subclass-of-number checks', () => {
            expect(sanitizeNumber(true)).toBeNull();
            expect(sanitizeNumber(false)).toBeNull();
        });

        it('rejects infinite and NaN and non-numbers', () => {
            expect(sanitizeNumber(Infinity)).toBeNull();
            expect(sanitizeNumber(-Infinity)).toBeNull();
            expect(sanitizeNumber(NaN)).toBeNull();
            expect(sanitizeNumber('42')).toBeNull();
            expect(sanitizeNumber(null)).toBeNull();
            expect(sanitizeNumber(undefined)).toBeNull();
            expect(sanitizeNumber({})).toBeNull();
        });
    });

    describe('normalizeOptionContract', () => {
        it('maps snake_case to camelCase', () => {
            const raw: OptionContractRaw = {
                strike: 150,
                expiration: '2026-03-20',
                contract_type: 'call',
                bid: 1.5,
                ask: 1.6,
                last_price: 1.55,
                volume: 100,
                open_interest: 500,
                implied_volatility: 0.45,
                delta: 0.6,
                gamma: 0.05,
                theta: -0.02,
                vega: 0.1,
                break_even_price: 151.6,
                option_ticker: 'O:AAPL260320C00150000',
            };

            const display = normalizeOptionContract(raw);
            expect(display.contractType).toBe('call');
            expect(display.impliedVolatility).toBe(0.45);
            expect(display.breakEvenPrice).toBe(151.6);
            expect(display.optionTicker).toBe('O:AAPL260320C00150000');
        });

        it('sanitizes null numbers', () => {
            const raw: OptionContractRaw = {
                strike: 150,
                expiration: '2026-03-20',
                contract_type: 'call',
                bid: null,
                ask: null,
                last_price: null,
                volume: null,
                open_interest: null,
                implied_volatility: null,
                delta: null,
                gamma: null,
                theta: null,
                vega: null,
                break_even_price: null,
                option_ticker: '',
            };
            const display = normalizeOptionContract(raw);
            expect(display.bid).toBeNull();
            expect(display.impliedVolatility).toBeNull();
        });
    });

    describe('normalizeOptionsChain', () => {
        it('maps wrapper wrapper snake_case to camelCase', () => {
            const raw: OptionsChainRaw = {
                underlying_symbol: 'AAPL',
                underlying_price: 145.2,
                chain: [],
                contract_count: 0,
                page: 2,
                page_size: 100,
                has_more: false,
                is_delayed: true,
            };
            const display = normalizeOptionsChain(raw);
            expect(display.underlyingSymbol).toBe('AAPL');
            expect(display.underlyingPrice).toBe(145.2);
            expect(display.contractCount).toBe(0);
            expect(display.isDelayed).toBe(true);
        });
    });
});
