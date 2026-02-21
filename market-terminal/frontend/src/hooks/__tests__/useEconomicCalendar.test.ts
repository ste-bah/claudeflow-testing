import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeeklyCalendar, useTodayEvents } from '../useEconomicCalendar';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useEconomicCalendar hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('useWeeklyCalendar', () => {
        it('fetches and normalizes weekly calendar successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        week_start: '2026-03-02',
                        week_end: '2026-03-08',
                        event_count: 1,
                        events: [
                            {
                                event_name: 'NFP',
                                event_date: '2026-03-06',
                                impact: 'High',
                                impact_color: 'red',
                                comparison: 'better',
                                comparison_color: 'green',
                                forecast_display: '200K',
                                actual: '250K',
                            }
                        ],
                    },
                }),
            });

            const { result } = renderHook(() => useWeeklyCalendar());

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data?.weekStart).toBe('2026-03-02');
            expect(result.current.data?.events[0].eventName).toBe('NFP');
            expect(result.current.data?.events[0].impact).toBe('High');
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
                        week_start: '2026-03-02',
                        week_end: '2026-03-08',
                        event_count: 0,
                        events: [],
                    },
                }),
            });

            const { result } = renderHook(() => useWeeklyCalendar());

            // Wait for the first failure state
            await waitFor(() => {
                expect(result.current.error).toBe('Retrying...');
            });

            // Advance the 2000ms retry timeout
            vi.advanceTimersByTime(2500);

            // Wait for successful retry data
            await waitFor(() => {
                expect(result.current.data?.eventCount).toBe(0);
                expect(result.current.error).toBeNull();
            });
        });
    });

    describe('useTodayEvents', () => {
        it('fetches and normalizes today calendar successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        date: '2026-03-06',
                        event_count: 1,
                        events: [
                            {
                                event_name: 'NFP',
                                event_date: '2026-03-06',
                                impact: 'High',
                                impact_color: 'red',
                                forecast_display: '200K',
                                actual: '250K',
                            }
                        ],
                    },
                }),
            });

            const { result } = renderHook(() => useTodayEvents());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.data?.date).toBe('2026-03-06');
            expect(result.current.data?.events[0].eventName).toBe('NFP');
        });
    });
});
