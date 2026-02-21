import { describe, it, expect } from 'vitest';
import {
    normalizeEconomicEvent,
    normalizeCalendarWeek,
    normalizeCalendarToday,
    normalizePrediction,
    EconomicEventRaw,
    CalendarWeekRaw,
    CalendarTodayRaw,
    PredictionRaw,
} from '../economicCalendar';

describe('economicCalendar.ts', () => {
    describe('normalizeEconomicEvent', () => {
        it('maps snake_case to camelCase', () => {
            const raw: EconomicEventRaw = {
                event_name: 'Nonfarm Payrolls',
                country: 'USD',
                event_date: '2026-03-06',
                event_time: '08:30',
                impact: 'High',
                impact_color: 'red',
                forecast: '200K',
                forecast_display: '200K',
                previous: '150K',
                actual: '250K',
                comparison: 'better',
                comparison_color: 'green',
                event_type: 'indicator',
                is_released: true,
                source: 'ForexFactory',
            };

            const display = normalizeEconomicEvent(raw);
            expect(display.eventName).toBe('Nonfarm Payrolls');
            expect(display.eventTime).toBe('08:30');
            expect(display.forecastDisplay).toBe('200K');
            expect(display.isReleased).toBe(true);
            expect(display.impactColor).toBe('red');
            expect(display.comparisonColor).toBe('green');
        });

        it('handles null values and defaults safely', () => {
            const raw: EconomicEventRaw = {
                event_name: 'Fed Chair Speaks',
                country: null,
                event_date: '2026-03-06',
                event_time: null,
                impact: null,
                impact_color: null,
                forecast: null,
                forecast_display: null,
                previous: null,
                actual: null,
                comparison: null,
                comparison_color: null,
                event_type: 'speech',
                is_released: null,
                source: 'ForexFactory',
            };

            const display = normalizeEconomicEvent(raw);
            expect(display.country).toBeNull();
            expect(display.eventTime).toBeNull();
            expect(display.impact).toBeNull();
            expect(display.impactColor).toBeNull();
            expect(display.forecastDisplay).toBe('N/A'); // Defaults to N/A when null
            expect(display.comparison).toBeNull();
            expect(display.comparisonColor).toBeNull();
            expect(display.isReleased).toBe(false); // Defaults to false when null
        });

        it('validates literal types', () => {
            const raw: EconomicEventRaw = {
                event_name: 'Test',
                country: 'USD',
                event_date: '2026-03-06',
                event_time: '08:30',
                impact: 'SuperHigh', // Invalid
                impact_color: 'blue', // Invalid
                forecast: null,
                forecast_display: null,
                previous: null,
                actual: null,
                comparison: 'amazing', // Invalid
                comparison_color: 'purple', // Invalid
                event_type: 'indicator',
                is_released: false,
                source: 'ForexFactory',
            };

            const display = normalizeEconomicEvent(raw);
            expect(display.impact).toBe('unknown'); // Fallback for invalid impact string
            expect(display.impactColor).toBeNull(); // Fallback for invalid color
            expect(display.comparison).toBeNull(); // Fallback for invalid comparison
            expect(display.comparisonColor).toBeNull(); // Fallback for invalid color
        });
    });

    describe('normalizeCalendarWeek', () => {
        it('maps wrapper wrapper snake_case to camelCase', () => {
            const raw: CalendarWeekRaw = {
                week_start: '2026-03-02',
                week_end: '2026-03-08',
                event_count: 0,
                events: [],
            };
            const display = normalizeCalendarWeek(raw);
            expect(display.weekStart).toBe('2026-03-02');
            expect(display.weekEnd).toBe('2026-03-08');
            expect(display.eventCount).toBe(0);
            expect(display.events).toEqual([]);
        });
    });

    describe('normalizeCalendarToday', () => {
        it('maps wrapper wrapper snake_case to camelCase', () => {
            const raw: CalendarTodayRaw = {
                date: '2026-03-05',
                event_count: 5,
                events: [],
            };
            const display = normalizeCalendarToday(raw);
            expect(display.date).toBe('2026-03-05');
            expect(display.eventCount).toBe(5);
            expect(display.events).toEqual([]);
        });
    });

    describe('normalizePrediction', () => {
        it('maps snake_case to camelCase gracefully', () => {
            const raw: PredictionRaw = {
                event_name: 'Core CPI',
                direction: 'bullish',
                probability: 0.75,
                horizon: '1m',
                model_accuracy: 0.65,
            };
            const display = normalizePrediction(raw);
            expect(display.eventName).toBe('Core CPI');
            expect(display.direction).toBe('bullish');
            expect(display.probability).toBe(0.75);
            expect(display.horizon).toBe('1m');
            expect(display.modelAccuracy).toBe(0.65);
        });

        it('defends against invalid probability parameters', () => {
            const raw = {
                event_name: 'Core CPI',
                direction: 'bullish',
                probability: NaN,
                horizon: '1m',
                model_accuracy: Infinity,
            } as PredictionRaw;
            const display = normalizePrediction(raw);
            expect(display.probability).toBe(0);
            expect(display.modelAccuracy).toBe(0);
        });
    });
});
