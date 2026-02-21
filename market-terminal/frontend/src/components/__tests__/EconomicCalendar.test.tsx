import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EconomicCalendarComponent } from '../EconomicCalendar';

// Mock the hooks
import * as hooks from '../../hooks/useEconomicCalendar';

vi.mock('../../hooks/useEconomicCalendar', () => ({
    useWeeklyCalendar: vi.fn(),
    useTodayEvents: vi.fn(),
}));

describe('EconomicCalendarComponent', () => {
    beforeEach(() => {
        vi.mocked(hooks.useTodayEvents).mockReturnValue({
            data: null,
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: null,
        });

        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: null,
            isLoading: true,
            error: null,
            isStale: false,
            cacheAge: null,
        });
    });

    it('renders loading skeleton on initial load', () => {
        render(<EconomicCalendarComponent />);
        expect(screen.getByText('Economic Calendar')).toBeInTheDocument();

        // Skeleton row generates generic td with animate pulses mapping the cells
        const skeletonDivs = document.querySelectorAll('.animate-pulse > td > div');
        expect(skeletonDivs.length).toBeGreaterThan(0);
    });

    it('renders error state without echoing user input', () => {
        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: null,
            isLoading: false,
            error: 'Economic calendar temporarily unavailable',
            isStale: false,
            cacheAge: null,
        });

        render(<EconomicCalendarComponent />);
        expect(screen.getByText('Economic calendar temporarily unavailable')).toBeInTheDocument();
    });

    it('renders empty weekly state', () => {
        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: {
                weekStart: '2026-03-02',
                weekEnd: '2026-03-08',
                eventCount: 0,
                events: []
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 0,
        });

        render(<EconomicCalendarComponent />);
        expect(screen.getByText('No economic events scheduled this week')).toBeInTheDocument();
    });

    it('toggles successfully to Today view with populated events and date groupings', async () => {
        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: { weekStart: 'x', weekEnd: 'y', eventCount: 0, events: [] },
            isLoading: false, error: null, isStale: false, cacheAge: 0,
        });

        vi.mocked(hooks.useTodayEvents).mockReturnValue({
            data: {
                date: '2026-03-06',
                eventCount: 3,
                events: [
                    {
                        eventName: 'Nonfarm Payrolls',
                        country: 'USD',
                        eventDate: '2026-03-06',
                        eventTime: '08:30',
                        impact: 'High',
                        impactColor: 'red',
                        forecast: '200K',
                        forecastDisplay: '200K',
                        previous: '150K',
                        actual: '250K',
                        comparison: 'better',
                        comparisonColor: 'green',
                        eventType: 'indicator',
                        isReleased: true,
                        source: 'test'
                    },
                    {
                        eventName: 'Unemployment Rate',
                        country: 'USD',
                        eventDate: '2026-03-06',
                        eventTime: '08:30',
                        impact: 'High',
                        impactColor: 'red',
                        forecast: '4.0%',
                        forecastDisplay: '4.0%',
                        previous: '4.1%',
                        actual: '4.2%',
                        comparison: 'worse',
                        comparisonColor: 'red',
                        eventType: 'indicator',
                        isReleased: true,
                        source: 'test'
                    }
                ]
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 10,
        });

        render(<EconomicCalendarComponent />);

        // Switch to Today view
        const todayBtn = screen.getByText('Today');
        fireEvent.click(todayBtn);

        // Verify Date header grouping maps (Mar 6, 2026)
        expect(screen.getByText(/Mar 6, 2026/)).toBeInTheDocument();

        // Verify mapped NFP event
        expect(screen.getByText('Nonfarm Payrolls')).toBeInTheDocument();
        expect(screen.getByText('250K')).toHaveClass('text-green-600');
        expect(screen.getByText('200K')).toBeInTheDocument();

        // Verify Unemployment
        expect(screen.getByText('Unemployment Rate')).toBeInTheDocument();
        expect(screen.getByText('4.2%')).toHaveClass('text-red-600');

        // Both should show High impact badge mapping
        expect(screen.getAllByText('High')).toHaveLength(2);
    });

    it('displays N/A forecast logic for speech events', () => {
        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: {
                weekStart: '2026-03-02',
                weekEnd: '2026-03-08',
                eventCount: 1,
                events: [
                    {
                        eventName: 'Fed Chair Speaks',
                        country: 'USD',
                        eventDate: '2026-03-04',
                        eventTime: '14:00',
                        impact: 'Medium',
                        impactColor: 'orange',
                        forecast: null,
                        forecastDisplay: 'N/A',
                        previous: null,
                        actual: null,
                        comparison: null,
                        comparisonColor: null,
                        eventType: 'speech',
                        isReleased: true,
                        source: 'test'
                    }
                ]
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 0,
        });

        render(<EconomicCalendarComponent />);
        expect(screen.getByText('speech')).toBeInTheDocument();
        expect(screen.getByText('Fed Chair Speaks')).toBeInTheDocument();
        expect(screen.getByText('N/A')).toBeInTheDocument();
    });
});
