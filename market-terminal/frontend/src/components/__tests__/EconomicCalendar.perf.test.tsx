import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EconomicCalendarComponent } from '../EconomicCalendar';

// Mock the hooks
import * as hooks from '../../hooks/useEconomicCalendar';

vi.mock('../../hooks/useEconomicCalendar', () => ({
    useWeeklyCalendar: vi.fn(),
    useTodayEvents: vi.fn(),
}));

describe('EconomicCalendar Performance', () => {
    it('renders 50 events in under 200ms', () => {
        // Generate 50 events across 5 days
        const largeEvents = [];
        const baseDate = new Date('2026-03-02');

        for (let i = 0; i < 50; i++) {
            const dayOffset = Math.floor(i / 10);
            const eventDate = new Date(baseDate);
            eventDate.setDate(eventDate.getDate() + dayOffset);
            const dateStr = eventDate.toISOString().split('T')[0];

            largeEvents.push({
                eventName: `Economic Event ${i}`,
                country: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'][i % 5],
                eventDate: dateStr,
                eventTime: `${10 + (i % 8)}:30`,
                impact: ['High', 'Medium', 'Low', 'unknown', null][i % 5] as any,
                impactColor: ['red', 'orange', 'yellow', null, null][i % 5] as any,
                forecast: `${100 + i}`,
                forecastDisplay: `${100 + i}`,
                previous: `${90 + i}`,
                actual: i % 2 === 0 ? `${110 + i}` : null, // Half released, half not
                comparison: ['better', 'worse', 'inline', null, null][i % 5] as any,
                comparisonColor: ['green', 'red', null, null, null][i % 5] as any,
                eventType: 'indicator',
                isReleased: i % 2 === 0,
                source: 'ForexFactory',
            });
        }

        vi.mocked(hooks.useTodayEvents).mockReturnValue({
            data: null,
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: null,
        });

        vi.mocked(hooks.useWeeklyCalendar).mockReturnValue({
            data: {
                weekStart: '2026-03-02',
                weekEnd: '2026-03-08',
                eventCount: 50,
                events: largeEvents as any,
            },
            isLoading: false,
            error: null,
            isStale: false,
            cacheAge: 10,
        });

        const start = performance.now();
        render(<EconomicCalendarComponent />);
        const end = performance.now();

        const renderTime = end - start;
        console.log(`Render time for 50 calendar events: ${renderTime.toFixed(2)}ms`);

        // Check against NFR-PERF-006 (< 200ms)
        expect(renderTime).toBeLessThan(200);
    });
});
