import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOptionsChain, useExpirations } from '../useOptionsChain';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useOptionsChain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fetches and normalizes options chain successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: {
                    underlying_symbol: 'AAPL',
                    underlying_price: 150.0,
                    chain: [],
                    contract_count: 0,
                    page: 1,
                    page_size: 250,
                    has_more: false,
                    is_delayed: true,
                },
            }),
        });

        const { result } = renderHook(() => useOptionsChain('AAPL'));

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data?.underlyingSymbol).toBe('AAPL');
        expect(result.current.isDelayed).toBe(true);
        expect(result.current.error).toBeNull();
        // Cache age should be initialized
        expect(result.current.cacheAge).toBe(0);
    });

    it('triggers auto-retry loop on first failure', async () => {
        // 1st fails
        mockFetch.mockRejectedValueOnce(new Error('Network disconnected'));
        // 2nd succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: {
                    underlying_symbol: 'TSLA',
                    chain: [],
                    is_delayed: false,
                },
            }),
        });

        const { result } = renderHook(() => useOptionsChain('TSLA'));

        // Wait for the first failure state
        await waitFor(() => {
            expect(result.current.error).toBe('Retrying...');
        });

        // Advance the 2000ms retry timeout
        vi.advanceTimersByTime(2500);

        // Wait for successful retry data
        await waitFor(() => {
            expect(result.current.data?.underlyingSymbol).toBe('TSLA');
            expect(result.current.error).toBeNull();
        });
    });

    it('sets static error message after retries fail to prevent echo inputs', async () => {
        mockFetch.mockRejectedValue(new Error('Persistent failure'));

        const { result } = renderHook(() => useOptionsChain('MSFT'));

        await waitFor(() => {
            expect(result.current.error).toBe('Retrying...');
        });

        vi.advanceTimersByTime(2500);

        await waitFor(() => {
            expect(result.current.error).toBe('Options data temporarily unavailable');
            expect(result.current.isLoading).toBe(false);
        });
    });

    it('cancels fetch cleanly on unmount', async () => {
        mockFetch.mockImplementation(() => new Promise(() => { })); // Never resolves

        const { unmount } = renderHook(() => useOptionsChain('AMZN'));
        unmount(); // Should trigger abort controller

        // Check that abort was called (fetch signal is truthy and aborted)
        const callArgs = mockFetch.mock.calls[0][1];
        expect(callArgs.signal.aborted).toBe(true);
    });
});

describe('useExpirations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes expiration dates', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: {
                    expirations: [
                        { expiration_date: '2026-03-20', contract_count: 50 },
                        { expiration_date: '2026-04-17', contract_count: 55 },
                    ]
                },
            }),
        });

        const { result } = renderHook(() => useExpirations('AAPL'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.expirations).toHaveLength(2);
        expect(result.current.expirations[0].expirationDate).toBe('2026-03-20');
    });
});
