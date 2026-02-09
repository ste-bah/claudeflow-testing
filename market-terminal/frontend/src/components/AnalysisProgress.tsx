interface AnalysisProgressProps {
  symbol: string;
  isAnalyzing: boolean;
}

/** Analysis progress panel -- will show methodology agent progress in a future task. */
export default function AnalysisProgress({ symbol, isAnalyzing }: AnalysisProgressProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Analysis {symbol ? `— ${symbol}` : ''}
      </h3>
      {isAnalyzing ? (
        <p className="text-accent-amber font-mono text-xs animate-pulse">
          Analyzing...
        </p>
      ) : (
        <p className="text-text-secondary font-mono text-xs">
          Analysis Progress — Not yet implemented
        </p>
      )}
    </div>
  );
}
