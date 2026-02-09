import type { WatchlistItem } from '../types';

interface WatchlistProps {
  items: WatchlistItem[];
  onSelect: (symbol: string) => void;
}

/** Watchlist panel -- will integrate AG Grid in a future task. */
export default function Watchlist({ items, onSelect }: WatchlistProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full overflow-auto">
      <h3 className="text-text-primary font-mono text-sm mb-2">Watchlist</h3>
      {items.length === 0 ? (
        <p className="text-text-muted font-mono text-xs">No tickers in watchlist</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.symbol}>
              <button
                type="button"
                onClick={() => onSelect(item.symbol)}
                className="text-text-secondary font-mono text-xs hover:text-accent-blue w-full text-left"
              >
                {item.symbol}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
