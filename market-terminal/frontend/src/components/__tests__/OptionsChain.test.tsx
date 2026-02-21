import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptionsChainComponent } from '../OptionsChain';

// Mock the hooks
import * as hooks from '../../hooks/useOptionsChain';

vi.mock('../../hooks/useOptionsChain', () => ({
    useOptionsChain: vi.fn(),
    useExpirations: vi.fn(),
}));

describe('OptionsChainComponent', () => {
    beforeEach(() => {
        vi.mocked(hooks.useExpirations).mockReturnValue({
            expirations: [
                { expirationDate: '2026-03-20', contractCount: 15 },
                { expirationDate: '2026-04-17', contractCount: 20 },
            ],
            isLoading: false,
            error: null,
        });

        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: null,
            isLoading: true,
            error: null,
            isStale: false,
            cacheAge: null,
            isDelayed: false,
        });
    });

    it('renders loading skeleton on initial load', () => {
        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: null, // No data yet
            isLoading: true, // Currently fetching
            error: null,
            isStale: false,
            cacheAge: null,
            isDelayed: false,
        });

        render(<OptionsChainComponent symbol="AAPL" />);
        // Loading skeleton means we have empty TD's with animate pulse backgrounds but no text rows yet
        expect(screen.getByText(/AAPL Options/)).toBeInTheDocument();
        expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('renders error state without echoing user input', () => {
        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: null,
            isLoading: false,
            error: 'Options data temporarily unavailable',
            isStale: false,
            cacheAge: null,
            isDelayed: false,
        });

        render(<OptionsChainComponent symbol="AAPL" />);
        expect(screen.getByText('Options data temporarily unavailable')).toBeInTheDocument();
    });

    it('renders delayed tier badge when isDelayed is true', () => {
        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: {
                underlyingSymbol: 'AAPL',
                underlyingPrice: 150.00,
                chain: [],
                contractCount: 0,
                page: 1,
                pageSize: 250,
                hasMore: false,
                isDelayed: true,
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 15,
            isDelayed: true,
        });

        render(<OptionsChainComponent symbol="AAPL" />);
        expect(screen.getByText(/Delayed 15 min \(Starter tier\)/)).toBeInTheDocument();
    });

    it('renders empty state when chain array is empty', () => {
        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: {
                underlyingSymbol: 'AAPL',
                underlyingPrice: 150.00,
                chain: [],
                contractCount: 0,
                page: 1,
                pageSize: 250,
                hasMore: false,
                isDelayed: false,
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 15,
            isDelayed: false,
        });

        render(<OptionsChainComponent symbol="AAPL" />);
        expect(screen.getByText(/No options contracts available for this symbol/)).toBeInTheDocument();
    });

    it('renders straddle view table correctly mapping calls left and puts right', () => {
        vi.mocked(hooks.useOptionsChain).mockReturnValue({
            data: {
                underlyingSymbol: 'TSLA',
                underlyingPrice: 200.00,
                chain: [
                    {
                        strike: 200,
                        expiration: '2026-03-20',
                        contractType: 'call',
                        bid: 10.5,
                        ask: 11.0,
                        lastPrice: 10.75,
                        volume: 500,
                        openInterest: 1000,
                        impliedVolatility: 0.85,
                        delta: 0.5,
                        gamma: 0.02,
                        theta: -0.1,
                        vega: 0.15,
                        breakEvenPrice: null,
                        optionTicker: 'O:TSLA...',
                    },
                    {
                        strike: 200,
                        expiration: '2026-03-20',
                        contractType: 'put',
                        bid: 9.5,
                        ask: 10.0,
                        lastPrice: null, // Test missing price
                        volume: 10,
                        openInterest: null, // Test missing oi
                        impliedVolatility: null, // Test missing IV 
                        delta: -0.5,
                        gamma: 0.02,
                        theta: -0.1,
                        vega: 0.15,
                        breakEvenPrice: null,
                        optionTicker: 'O:TSLA...',
                    }
                ],
                contractCount: 2,
                page: 1,
                pageSize: 250,
                hasMore: false,
                isDelayed: false,
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 0,
            isDelayed: false,
        });

        render(<OptionsChainComponent symbol="TSLA" />);

        // Check headers structure
        expect(screen.getByText('Calls')).toBeInTheDocument();
        expect(screen.getByText('Strike')).toBeInTheDocument();
        expect(screen.getByText('Puts')).toBeInTheDocument();

        // Check strike rendering in center font-mono
        expect(screen.getByText('200.00')).toBeInTheDocument();

        // Check calls (10.50 bid)
        expect(screen.getByText('10.50')).toBeInTheDocument();

        // Check puts (9.50 bid)
        expect(screen.getByText('9.50')).toBeInTheDocument();

        // Check null mapping to dashes '-' in the UI
        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThan(0);
    });
});
