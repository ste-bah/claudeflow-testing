/**
 * React Hooks for Economic Calendar Data
 * TASK-UPDATE-006
 */
import { useState, useEffect } from 'react';
import {
    CalendarWeek,
    CalendarWeekRaw,
    CalendarToday,
    CalendarTodayRaw,
    PredictionRaw,
    Prediction,
    normalizeCalendarWeek,
    normalizeCalendarToday,
    normalizePrediction,
} from '../types/economicCalendar';

const API_BASE_URL = '/api';

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
const CALENDAR_CACHE_TTL_MS = 300000; // 5 minutes

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const calendarCache = new Map<string, CacheEntry<CalendarWeek | CalendarToday>>();
const predictionsCache = new Map<string, CacheEntry<Record<string, Prediction[]>>>();

function enforceMapLimit(map: Map<string, unknown>, limit = 20) {
    if (map.size > limit) {
        const oldestKey = map.keys().next().value;
        if (oldestKey) map.delete(oldestKey);
    }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useWeeklyCalendar() {
    const [data, setData] = useState<CalendarWeek | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [cacheAge, setCacheAge] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const fetchWeek = async (retryCount = 0) => {
            const cacheKey = 'week';
            const cached = calendarCache.get(cacheKey);
            const now = Date.now();

            if (cached) {
                setCacheAge(now - cached.timestamp);
                if (!cancelled) {
                    setData(cached.data as CalendarWeek);
                    if (now - cached.timestamp < CALENDAR_CACHE_TTL_MS) {
                        setIsStale(false);
                        return;
                    } else {
                        setIsStale(true);
                    }
                }
            }

            setIsLoading(true);
            if (!cached) setError(null);

            try {
                const url = `${API_BASE_URL}/economic-calendar/week`;
                const res = await fetch(url, { signal: controller.signal });

                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }

                const json = await res.json();
                if (cancelled) return;

                const rawData: CalendarWeekRaw = json.data;
                const normalized = normalizeCalendarWeek(rawData);

                calendarCache.set(cacheKey, { data: normalized, timestamp: now });
                enforceMapLimit(calendarCache);

                setData(normalized);
                setCacheAge(0);
                setIsStale(false);
                setError(null);
            } catch (err: unknown) {
                if (cancelled) return;

                // Prevent showing underlying abort errors or server dumps to the user
                if (err instanceof DOMException && err.name === 'AbortError') return;

                if (retryCount < 1) {
                    setError('Retrying...');
                    setTimeout(() => fetchWeek(retryCount + 1), 2000);
                    return;
                }

                setError('Economic calendar temporarily unavailable');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchWeek();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    return { data, isLoading, error, isStale, cacheAge };
}

export function useTodayEvents() {
    const [data, setData] = useState<CalendarToday | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [cacheAge, setCacheAge] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const fetchToday = async (retryCount = 0) => {
            const cacheKey = 'today';
            const cached = calendarCache.get(cacheKey);
            const now = Date.now();

            if (cached) {
                setCacheAge(now - cached.timestamp);
                if (!cancelled) {
                    setData(cached.data as CalendarToday);
                    if (now - cached.timestamp < CALENDAR_CACHE_TTL_MS) {
                        setIsStale(false);
                        return;
                    } else {
                        setIsStale(true);
                    }
                }
            }

            setIsLoading(true);
            if (!cached) setError(null);

            try {
                const url = `${API_BASE_URL}/economic-calendar/today`;
                const res = await fetch(url, { signal: controller.signal });

                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }

                const json = await res.json();
                if (cancelled) return;

                const rawData: CalendarTodayRaw = json.data;
                const normalized = normalizeCalendarToday(rawData);

                calendarCache.set(cacheKey, { data: normalized, timestamp: now });
                enforceMapLimit(calendarCache);

                setData(normalized);
                setCacheAge(0);
                setIsStale(false);
                setError(null);
            } catch (err: unknown) {
                if (cancelled) return;

                // Prevent showing underlying abort errors or server dumps to the user
                if (err instanceof DOMException && err.name === 'AbortError') return;

                if (retryCount < 1) {
                    setError('Retrying...');
                    setTimeout(() => fetchToday(retryCount + 1), 2000);
                    return;
                }

                setError('Economic calendar temporarily unavailable');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchToday();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    return { data, isLoading, error, isStale, cacheAge };
}

export function usePredictions() {
    const [data, setData] = useState<Record<string, Prediction[]>>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const fetchPredictions = async () => {
            const cacheKey = 'global_preds';
            const cached = predictionsCache.get(cacheKey);
            const now = Date.now();

            if (cached && now - cached.timestamp < CALENDAR_CACHE_TTL_MS) {
                if (!cancelled) {
                    setData(cached.data);
                    return;
                }
            }

            setIsLoading(true);

            try {
                const url = `${API_BASE_URL}/economic-calendar/predictions`;
                const res = await fetch(url, { signal: controller.signal });

                if (!res.ok) throw new Error('Network response was not ok');
                const json = await res.json();
                if (cancelled) return;

                const rawList = json.data?.predictions || [];
                const dict: Record<string, Prediction[]> = {};

                for (const p of rawList) {
                    // Flattening nested prediction structures returned natively from JBlanked via the Proxy
                    const preds = [
                        p.prediction_1min,
                        p.prediction_30min,
                        p.prediction_1hr
                    ].filter(Boolean).map(raw => normalizePrediction(raw as PredictionRaw));

                    if (preds.length > 0) {
                        // Index strictly against eventName mapping safely
                        const eName = preds[0].eventName;
                        dict[eName] = preds;
                    }
                }

                predictionsCache.set(cacheKey, { data: dict, timestamp: now });
                setData(dict);
            } catch (err: unknown) {
                if (cancelled) return;
                // Graceful degradation when prediction source is unavailable
                setData({});
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchPredictions();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    return { data, isLoading };
}
