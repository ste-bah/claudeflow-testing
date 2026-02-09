import type { MacroEvent } from '../types';

interface MacroCalendarProps {
  events: MacroEvent[];
}

/** Macro calendar panel -- will display economic events in a future task. */
export default function MacroCalendar({ events }: MacroCalendarProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Macro Calendar
      </h3>
      {events.length === 0 ? (
        <p className="text-text-muted font-mono text-xs">No upcoming events</p>
      ) : (
        <p className="text-text-secondary font-mono text-xs">
          {events.length} event(s) — rendering not yet implemented
        </p>
      )}
    </div>
  );
}
