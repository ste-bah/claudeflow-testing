import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OptionsChainComponent } from '../OptionsChain';

// Mock the hooks
import * as hooks from '../../hooks/useOptionsChain';

vi.mock('../../hooks/useOptionsChain', () => ({
    useOptionsChain: vi.fn(),
    useExpirations: vi.fn(),
}));

describe('OptionsChain Performance', () => {
    it('renders 500 contracts in under 500ms', () => {
        // Generate 500 contracts (250 strikes, call/put each)
        const largeChain = [];
        let startStrike = 100;

        for (let i = 0; i < 250; i++) {
            largeChain.push({
                strike: startStrike + i,
                expiration: '2026-03-20',
                contractType: 'call',
                bid: 1.5, ask: 1.6, lastPrice: 1.55,
                volume: 100, openInterest: 500,
                impliedVolatility: 0.45,
                delta: 0.5, gamma: 0.1, theta: -0.1, vega: 0.2,
                breakEvenPrice: (startStrike + i) + 1.5,
                optionTicker: `O:TEST260320C00${startStrike + i}000`,
            });
            largeChain.push({
                strike: startStrike + i,
                expiration: '2026-03-20',
                contractType: 'put',
                bid: 1.0, ask: 1.1, lastPrice: 1.05,
                volume: 50, openInterest: 250,
                impliedVolatility: 0.40,
                delta: -0.5, gamma: 0.1, theta: -0.1, vega: 0.2,
                breakEvenPrice: (startStrike + i) - 1.0,
                optionTicker: `O:TEST260320P00${startStrike + i}000`,
            });
        }

        vi.mocked(hooks.useExpirations).mockReturnValue({
            expirations: [{ expirationDate: '2026-03-20', contractCount: 500 }],
            isLoading: false,
            error: null,
        });

        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: {
                underlyingSymbol: 'TEST',
                underlyingPrice: 200,
                chain: largeChain as any,
                contractCount: 500,
                page: 1,
                pageSize: 500,
                hasMore: false,
                isDelayed: false,
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 0,
            isDelayed: false,
        });

        const start = performance.now();
        render(<OptionsChainComponent symbol="TEST" />);
        const end = performance.now();

        const renderTime = end - start;
        console.log(`Render time for 500 contracts: ${renderTime.toFixed(2)}ms`);

        // Check against NFR-PERF-005
        expect(renderTime).toBeLessThan(500);
    });
});
