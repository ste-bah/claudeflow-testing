interface CommandBarProps {
  onCommand: (text: string) => void;
}

export default function CommandBar({ onCommand }: CommandBarProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-2 flex items-center gap-2">
      <span className="text-accent-green font-mono text-sm">&gt;</span>
      <input
        type="text"
        placeholder="Enter command or ticker..."
        className="flex-1 bg-transparent text-text-primary font-mono text-sm outline-none placeholder-text-muted"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommand(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}
