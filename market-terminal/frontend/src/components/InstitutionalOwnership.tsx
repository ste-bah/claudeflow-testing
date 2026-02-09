interface InstitutionalOwnershipProps {
  symbol: string;
}

/** Institutional ownership panel -- will display 13F data in a future task. */
export default function InstitutionalOwnership({ symbol }: InstitutionalOwnershipProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Institutional Ownership {symbol ? `— ${symbol}` : ''}
      </h3>
      <p className="text-text-secondary font-mono text-xs">
        Institutional Ownership — Not yet implemented
      </p>
    </div>
  );
}
