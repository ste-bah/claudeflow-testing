interface InsiderActivityProps {
  symbol: string;
}

/** Insider activity panel -- will display insider transactions in a future task. */
export default function InsiderActivity({ symbol }: InsiderActivityProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Insider Activity {symbol ? `— ${symbol}` : ''}
      </h3>
      <p className="text-text-secondary font-mono text-xs">
        Insider Activity — Not yet implemented
      </p>
    </div>
  );
}
