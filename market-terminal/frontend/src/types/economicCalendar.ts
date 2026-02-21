/**
 * Economic Calendar Data Types
 * TASK-UPDATE-006
 * Wire-to-Display types matching backend `snake_case` models to frontend `camelCase`.
 */

export type EventOutcome = 'better' | 'worse' | 'inline' | null;
export type ImpactLevel = 'High' | 'Medium' | 'Low' | 'unknown' | null;
export type ImpactColor = 'red' | 'orange' | 'yellow' | null;
export type ComparisonColor = 'green' | 'red' | null;

export interface EconomicEventRaw {
    event_name: string;
    country: string | null;
    event_date: string;
    event_time: string | null;
    impact: string | null;
    impact_color: string | null;
    forecast: string | null;
    forecast_display: string | null;
    previous: string | null;
    actual: string | null;
    comparison: string | null;
    comparison_color: string | null;
    event_type: string | null;
    is_released: boolean | null;
    source: string;
}

export interface EconomicEvent {
    eventName: string;
    country: string | null;
    eventDate: string;
    eventTime: string | null;
    impact: ImpactLevel;
    impactColor: ImpactColor;
    forecast: string | null;
    forecastDisplay: string;
    previous: string | null;
    actual: string | null;
    comparison: EventOutcome;
    comparisonColor: ComparisonColor;
    eventType: string | null;
    isReleased: boolean;
    source: string;
}

export interface CalendarWeekRaw {
    week_start: string;
    week_end: string;
    event_count: number;
    events: EconomicEventRaw[];
}

export interface CalendarWeek {
    weekStart: string;
    weekEnd: string;
    eventCount: number;
    events: EconomicEvent[];
}

export interface CalendarTodayRaw {
    date: string;
    event_count: number;
    events: EconomicEventRaw[];
}

export interface CalendarToday {
    date: string;
    eventCount: number;
    events: EconomicEvent[];
}

export interface PredictionRaw {
    event_name: string;
    direction: string;
    probability: number;
    horizon: string;
    model_accuracy: number;
}

export interface Prediction {
    eventName: string;
    direction: string;
    probability: number;
    horizon: string;
    modelAccuracy: number;
}


export function normalizeEconomicEvent(raw: EconomicEventRaw): EconomicEvent {
    // Validate impact level
    let impact: ImpactLevel = null;
    if (['High', 'Medium', 'Low', 'unknown'].includes(raw.impact as string)) {
        impact = raw.impact as ImpactLevel;
    } else if (raw.impact) {
        impact = 'unknown';
    }

    // Validate impact color
    let impactColor: ImpactColor = null;
    if (['red', 'orange', 'yellow'].includes(raw.impact_color as string)) {
        impactColor = raw.impact_color as ImpactColor;
    }

    // Validate comparison
    let comparison: EventOutcome = null;
    if (['better', 'worse', 'inline'].includes(raw.comparison as string)) {
        comparison = raw.comparison as EventOutcome;
    }

    // Validate comparison color
    let comparisonColor: ComparisonColor = null;
    if (['green', 'red'].includes(raw.comparison_color as string)) {
        comparisonColor = raw.comparison_color as ComparisonColor;
    }

    return {
        eventName: raw.event_name,
        country: raw.country,
        eventDate: raw.event_date,
        eventTime: raw.event_time,
        impact,
        impactColor,
        forecast: raw.forecast,
        forecastDisplay: raw.forecast_display ?? raw.forecast ?? 'N/A',
        previous: raw.previous,
        actual: raw.actual,
        comparison,
        comparisonColor,
        eventType: raw.event_type,
        isReleased: raw.is_released ?? false,
        source: raw.source,
    };
}

export function normalizeCalendarWeek(raw: CalendarWeekRaw): CalendarWeek {
    return {
        weekStart: raw.week_start,
        weekEnd: raw.week_end,
        eventCount: raw.event_count || 0,
        events: (raw.events || []).map(normalizeEconomicEvent),
    };
}

export function normalizeCalendarToday(raw: CalendarTodayRaw): CalendarToday {
    return {
        date: raw.date,
        eventCount: raw.event_count || 0,
        events: (raw.events || []).map(normalizeEconomicEvent),
    };
}

export function normalizePrediction(raw: PredictionRaw): Prediction {
    return {
        eventName: raw.event_name,
        direction: raw.direction,
        // sanitize model attributes defensively since probabilities shouldn't exceed limits
        probability: Number.isFinite(raw.probability) ? Number(raw.probability) : 0,
        horizon: raw.horizon,
        modelAccuracy: Number.isFinite(raw.model_accuracy) ? Number(raw.model_accuracy) : 0,
    };
}
