interface NewsFeedProps {
  symbol: string;
}

/** News feed panel -- will fetch and display news articles in a future task. */
export default function NewsFeed({ symbol }: NewsFeedProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full">
      <h3 className="text-text-primary font-mono text-sm mb-2">
        News {symbol ? `— ${symbol}` : ''}
      </h3>
      <p className="text-text-secondary font-mono text-xs">
        News Feed — Not yet implemented
      </p>
    </div>
  );
}
