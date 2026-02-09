interface ChartProps {
  symbol: string;
}

/** Price chart panel -- will integrate lightweight-charts in a future task. */
export default function Chart({ symbol }: ChartProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Chart &mdash; {symbol || 'No ticker selected'}
      </h3>
      <p className="text-text-secondary font-mono text-xs">
        Chart — Not yet implemented
      </p>
    </div>
  );
}
