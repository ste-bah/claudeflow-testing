/**
 * Economic Calendar Visualizer
 * TASK-UPDATE-006
 */
import React, { useState } from 'react';
import { useWeeklyCalendar, useTodayEvents, usePredictions } from '../hooks/useEconomicCalendar';
import { EconomicEvent, ImpactLevel, ImpactColor, Prediction } from '../types/economicCalendar';

interface ImpactBadgeProps {
    impact: ImpactLevel;
    color: ImpactColor;
}

const ImpactBadge = React.memo(({ impact, color }: ImpactBadgeProps) => {
    if (!impact || impact === 'unknown') {
        return <span className="text-gray-400">Unknown</span>;
    }

    const dotColors = {
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        yellow: 'bg-yellow-400',
    };

    const bgClass = color && dotColors[color] ? dotColors[color] : 'bg-gray-300';

    return (
        <div className="flex items-center space-x-1.5">
            <div className={`w-2 h-2 rounded-full ${bgClass}`} />
            <span>{impact}</span>
        </div>
    );
});
ImpactBadge.displayName = 'ImpactBadge';

interface EventRowProps {
    event: EconomicEvent;
    predictions?: Prediction[];
    showDate?: boolean;
}

const PredictionTags = React.memo(({ predictions }: { predictions: Prediction[] }) => {
    if (!predictions || predictions.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded tracking-wide border border-gray-200 shadow-sm align-middle flex items-center justify-center">
                EXPERIMENTAL
            </span>
            {predictions.map((p, idx) => {
                const isBullish = p.direction.toLowerCase() === 'bullish';
                const isBearish = p.direction.toLowerCase() === 'bearish';
                const color = isBullish ? 'text-green-700 bg-green-50 border-green-200'
                    : isBearish ? 'text-red-700 bg-red-50 border-red-200'
                        : 'text-gray-700 bg-gray-50 border-gray-200';

                return (
                    <div key={idx} className={`text-xs px-2 py-0.5 rounded border ${color} flex items-center space-x-1.5`}>
                        <span className="font-semibold">{p.horizon}</span>
                        <span className="capitalize">{p.direction}</span>
                        <span className="opacity-75">{(p.probability * 100).toFixed(0)}%</span>
                    </div>
                );
            })}
        </div>
    );
});
PredictionTags.displayName = 'PredictionTags';

const EventRow = React.memo(({ event, predictions = [], showDate = false }: EventRowProps) => {
    // Determine comparison class
    let actualClass = '';
    if (event.comparisonColor === 'green') {
        actualClass = 'text-green-600 font-semibold';
    } else if (event.comparisonColor === 'red') {
        actualClass = 'text-red-600 font-semibold';
    }

    return (
        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            {showDate && (
                <td className="p-2 whitespace-nowrap text-gray-500">
                    {event.eventDate}
                </td>
            )}
            <td className="p-2 whitespace-nowrap font-mono text-gray-600">
                {event.eventTime || '-'}
            </td>
            <td className="p-2">
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{event.eventName}</span>
                    {event.eventType && event.eventType !== 'indicator' && (
                        <span className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{event.eventType}</span>
                    )}
                    <PredictionTags predictions={predictions} />
                </div>
            </td>
            <td className="p-2 font-mono font-medium">
                {event.country || '-'}
            </td>
            <td className="p-2">
                <ImpactBadge impact={event.impact} color={event.impactColor} />
            </td>
            <td className="p-2 text-right">
                {event.forecastDisplay}
            </td>
            <td className="p-2 text-right text-gray-600">
                {event.previous || '-'}
            </td>
            <td className={`p-2 text-right ${actualClass}`}>
                {event.actual || '-'}
            </td>
        </tr>
    );
});
EventRow.displayName = 'EventRow';

const DateGroupHeader = React.memo(({ dateStr }: { dateStr: string }) => {
    return (
        <tr className="bg-gray-100/70 border-b border-t border-gray-200">
            <td colSpan={7} className="p-2 py-3 text-sm font-semibold text-gray-700">
                {new Date(dateStr).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })}
            </td>
        </tr>
    );
});
DateGroupHeader.displayName = 'DateGroupHeader';

const SkeletonRow = () => (
    <tr className="border-b border-gray-100 animate-pulse">
        {[...Array(7)].map((_, i) => (
            <td key={`skel-${i}`} className="p-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
            </td>
        ))}
    </tr>
);


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const EconomicCalendarComponent: React.FC = () => {
    const [viewMode, setViewMode] = useState<'week' | 'today'>('week');

    const {
        data: weekData,
        isLoading: weekLoading,
        error: weekError,
        cacheAge: weekAge,
        isStale: weekStale
    } = useWeeklyCalendar();

    const {
        data: todayData,
        isLoading: todayLoading,
        error: todayError,
        cacheAge: todayAge,
        isStale: todayStale
    } = useTodayEvents();

    const isWeek = viewMode === 'week';
    const data = isWeek ? weekData : todayData;
    const isLoading = isWeek ? weekLoading : todayLoading;
    const error = isWeek ? weekError : todayError;
    const cacheAge = isWeek ? weekAge : todayAge;
    const isStale = isWeek ? weekStale : todayStale;

    const { data: predictionData } = usePredictions();

    // Group events organically by date
    const eventsByDate = new Map<string, EconomicEvent[]>();
    if (data?.events) {
        data.events.forEach(ev => {
            const d = ev.eventDate;
            if (!eventsByDate.has(d)) eventsByDate.set(d, []);
            eventsByDate.get(d)!.push(ev);
        });
    }

    return (
        <div className="w-full flex flex-col space-y-4">

            {/* ---------------- Header Area ---------------- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center space-x-3">
                        <span>Economic Calendar</span>
                    </h2>

                    <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                        {isWeek && data && 'weekStart' in data && (
                            <span>{data.weekStart} to {data.weekEnd}</span>
                        )}
                        {!isWeek && data && 'date' in data && (
                            <span>{data.date}</span>
                        )}

                        {isStale && (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                Data may be stale
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex rounded-md shadow-sm border border-gray-200 text-sm">
                    <button
                        onClick={() => setViewMode('today')}
                        className={`px-4 py-1.5 rounded-l-md truncate ${!isWeek ? 'bg-blue-50 text-blue-700 font-semibold border-r border-blue-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-r border-gray-200'}`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setViewMode('week')}
                        className={`px-4 py-1.5 rounded-r-md truncate ${isWeek ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                    >
                        This Week
                    </button>
                </div>
            </div>

            {/* ---------------- Error & Loading Overlays ---------------- */}
            {error && !isLoading && (
                <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
                    {error}
                </div>
            )}

            {/* ---------------- Calendar Table ---------------- */}
            <div className="overflow-x-auto rounded border shadow-sm relative bg-white">
                {isLoading && data && (
                    <div className="absolute inset-0 bg-white/50 flex place-content-center pt-24 z-10">
                        <span className="animate-pulse font-semibold text-gray-600">Updating...</span>
                    </div>
                )}

                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b uppercase text-xs text-gray-600">
                        <tr>
                            <th className="p-2 w-20">Time</th>
                            <th className="p-2">Event</th>
                            <th className="p-2 w-16">Country</th>
                            <th className="p-2 w-28">Impact</th>
                            <th className="p-2 w-24 text-right">Forecast</th>
                            <th className="p-2 w-24 text-right">Previous</th>
                            <th className="p-2 w-24 text-right">Actual</th>
                        </tr>
                    </thead>

                    <tbody>
                        {isLoading && !data && (
                            <React.Fragment>
                                <SkeletonRow /><SkeletonRow /><SkeletonRow />
                                <SkeletonRow /><SkeletonRow /><SkeletonRow />
                            </React.Fragment>
                        )}

                        {!isLoading && data && data.events.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-gray-500">
                                    {isWeek ? 'No economic events scheduled this week' : 'No economic events scheduled for today'}
                                </td>
                            </tr>
                        )}

                        {Array.from(eventsByDate.entries()).map(([dateStr, dateEvents]) => (
                            <React.Fragment key={dateStr}>
                                <DateGroupHeader dateStr={dateStr} />
                                {dateEvents.map((ev, idx) => (
                                    <EventRow
                                        key={`${ev.eventName}-${idx}`}
                                        event={ev}
                                        predictions={predictionData[ev.eventName]}
                                    />
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ---------------- Footer Stats ---------------- */}
            {data && (
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2">
                    <span>Showing {data.events.length} events</span>
                    <span>Source: ForexFactory | Updated: {cacheAge !== null ? cacheAge + 'ms ago' : 'just now'}</span>
                </div>
            )}

        </div>
    );
};
