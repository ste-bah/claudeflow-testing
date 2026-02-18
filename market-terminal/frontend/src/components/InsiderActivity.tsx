/**
 * Insider activity panel displaying recent Form 4 transactions.
 * Shows insider name/title, transaction type badge, shares, value, and date.
 */
import { useInsider } from '../hooks/useInsider';
import {
  formatShares,
  TRANSACTION_BADGE_MAP,
  isDisplayable,
} from '../types/ownership';
import { formatCurrency } from '../types/fundamentals';

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 animate-pulse bg-terminal-border rounded w-40" />
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
      No insider activity data available
    </p>
  );
}

function TransactionBadge({ type }: { readonly type: string }) {
  const badge = TRANSACTION_BADGE_MAP[type] ?? {
    label: type,
    colorClass: 'bg-gray-600',
  };
  return (
    <span
      className={`${badge.colorClass} text-white text-xs px-1.5 py-0.5 rounded font-mono`}
    >
      {badge.label}
    </span>
  );
}

function NetActivitySummary({
  netActivity,
  buys,
  sells,
  periodDays,
}: {
  readonly netActivity: string;
  readonly buys: number;
  readonly sells: number;
  readonly periodDays: number;
}) {
  const net = buys - sells;
  let colorClass = 'text-text-muted';
  if (netActivity === 'net_buying') colorClass = 'text-accent-green';
  else if (netActivity === 'net_selling') colorClass = 'text-accent-red';

  return (
    <div className="flex justify-between text-xs">
      <span className="text-text-muted">
        Net Insider Activity ({periodDays}d)
      </span>
      <span className={`font-mono ${colorClass}`}>
        {net >= 0 ? '+' : ''}{formatShares(net)} shares
      </span>
    </div>
  );
}

export default function InsiderActivity({ symbol }: { symbol: string }) {
  const { data, loading, error } = useInsider(symbol);

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full flex flex-col overflow-hidden">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        Insider Activity
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
            {/* Net activity summary */}
            <NetActivitySummary
              netActivity={data.summary.netActivity}
              buys={data.summary.totalInsiderBuys}
              sells={data.summary.totalInsiderSells}
              periodDays={data.summary.periodDays}
            />

            {/* Transactions table */}
            {data.transactions.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-text-muted border-b border-terminal-border">
                    <th className="text-left py-1 pr-2 font-normal">Insider</th>
                    <th className="text-left py-1 pr-2 font-normal">Type</th>
                    <th className="text-right py-1 pr-2 font-normal">Shares</th>
                    <th className="text-right py-1 pr-2 font-normal">Value</th>
                    <th className="text-right py-1 font-normal">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn, idx) => (
                    <tr key={idx} className="border-b border-terminal-border/30">
                      <td className="text-text-primary py-1 pr-2 truncate max-w-[120px]">
                        <div>{txn.insiderName}</div>
                        {txn.title && (
                          <div className="text-text-muted text-xs">{txn.title}</div>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <TransactionBadge type={txn.transactionType} />
                      </td>
                      <td className="text-text-primary text-right py-1 pr-2">
                        {formatShares(txn.shares)}
                      </td>
                      <td className="text-text-primary text-right py-1 pr-2">
                        {isDisplayable(txn.totalValue)
                          ? formatCurrency(txn.totalValue)
                          : '--'}
                      </td>
                      <td className="text-text-muted text-right py-1">
                        {txn.transactionDate ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Data freshness */}
            <div className="text-text-muted text-xs pt-1 border-t border-terminal-border/30">
              Form 4 data as of: {data.dataTimestamp}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
