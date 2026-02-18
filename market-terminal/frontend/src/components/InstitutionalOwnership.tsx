/**
 * Institutional ownership panel displaying top holders from 13F filings.
 * Shows holder name, shares, % outstanding, QoQ change, and filing date.
 */
import { useOwnership } from '../hooks/useOwnership';
import {
  formatShares,
  formatChangePercent,
  isDisplayable,
} from '../types/ownership';
import { formatCurrency } from '../types/fundamentals';

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 animate-pulse bg-terminal-border rounded w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-3 animate-pulse bg-terminal-border rounded w-full" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <p className="text-accent-red text-xs text-center py-4">{message}</p>
  );
}

function EmptyState() {
  return (
    <p className="text-text-muted text-xs text-center py-4">
      No institutional ownership data available
    </p>
  );
}

function ChangeCell({ value }: { readonly value: number | null }) {
  if (!isDisplayable(value)) {
    return <span className="text-text-muted">--</span>;
  }
  let colorClass = 'text-text-muted';
  if (value > 0) colorClass = 'text-accent-green';
  else if (value < 0) colorClass = 'text-accent-red';
  return <span className={colorClass}>{formatChangePercent(value)}</span>;
}

export default function InstitutionalOwnership({ symbol }: { symbol: string }) {
  const { data, loading, error } = useOwnership(symbol);

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full flex flex-col overflow-hidden">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Institutional Ownership
      </h3>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {/* Summary row */}
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">
                Total Institutional Ownership
              </span>
              <span className="text-text-primary font-mono">
                {isDisplayable(data.institutionalOwnershipPercent)
                  ? `${data.institutionalOwnershipPercent.toFixed(1)}%`
                  : formatCurrency(data.totalInstitutionalValue)}
              </span>
            </div>

            {data.note && (
              <p className="text-text-muted text-xs italic">{data.note}</p>
            )}

            {/* Holders table */}
            {data.holders.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-text-muted border-b border-terminal-border">
                    <th className="text-left py-1 pr-2 font-normal">Holder</th>
                    <th className="text-right py-1 pr-2 font-normal">Shares</th>
                    <th className="text-right py-1 pr-2 font-normal">% Out</th>
                    <th className="text-right py-1 pr-2 font-normal">Change</th>
                    <th className="text-right py-1 font-normal">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holders.slice(0, 10).map((holder, idx) => (
                    <tr key={idx} className="border-b border-terminal-border/30">
                      <td className="text-text-primary py-1 pr-2 truncate max-w-[120px]">
                        {holder.holderName}
                      </td>
                      <td className="text-text-primary text-right py-1 pr-2">
                        {formatShares(holder.shares)}
                      </td>
                      <td className="text-text-primary text-right py-1 pr-2">
                        {isDisplayable(holder.percentOfOutstanding)
                          ? `${holder.percentOfOutstanding.toFixed(2)}%`
                          : '--'}
                      </td>
                      <td className="text-right py-1 pr-2">
                        <ChangeCell value={holder.changePercent} />
                      </td>
                      <td className="text-text-muted text-right py-1">
                        {holder.filingDate ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Data freshness */}
            {data.filingPeriod && (
              <div className="text-text-muted text-xs pt-1 border-t border-terminal-border/30">
                13F data as of: {data.filingPeriod}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
