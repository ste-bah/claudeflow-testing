import type { MethodologySignal } from '../types';

interface MethodologyScoresProps {
  signals: MethodologySignal[];
}

/** Methodology scores panel -- will render signal cards in a future task. */
export default function MethodologyScores({ signals }: MethodologyScoresProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Methodology Scores
      </h3>
      {signals.length === 0 ? (
        <p className="text-text-muted font-mono text-xs">
          No analysis signals available
        </p>
      ) : (
        <p className="text-text-secondary font-mono text-xs">
          {signals.length} signal(s) — rendering not yet implemented
        </p>
      )}
    </div>
  );
}
