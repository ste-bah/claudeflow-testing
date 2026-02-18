import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTickerContext } from '../contexts/TickerContext';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import type { WsConnectionStatus } from '../types/websocket';
import CommandBar from '../components/CommandBar';
import Chart from '../components/Chart';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';
import Fundamentals from '../components/Fundamentals';
import MethodologyScores from '../components/MethodologyScores';
import MacroCalendar from '../components/MacroCalendar';
import InstitutionalOwnership from '../components/InstitutionalOwnership';
import InsiderActivity from '../components/InsiderActivity';
import AnalysisProgress from '../components/AnalysisProgress';

/** Map WebSocket status to colour + label. */
function getStatusIndicator(status: WsConnectionStatus): { colorClass: string; label: string } {
  switch (status) {
    case 'connected':
      return { colorClass: 'bg-green-500', label: 'Connected' };
    case 'connecting':
    case 'reconnecting':
      return { colorClass: 'bg-amber-500', label: status === 'connecting' ? 'Connecting' : 'Reconnecting' };
    case 'disconnected':
    default:
      return { colorClass: 'bg-red-500', label: 'Disconnected' };
  }
}

function ResizeHandle({ direction = 'horizontal' }: { direction?: 'horizontal' | 'vertical' }) {
  return (
    <PanelResizeHandle
      className={`
        ${direction === 'vertical' ? 'w-1' : 'h-1'}
        bg-terminal-border
        hover:bg-accent-blue
        active:bg-accent-blue
        transition-colors
        duration-150
      `}
    />
  );
}

export default function Terminal() {
  const { activeTicker } = useTickerContext();
  const { status } = useWebSocketContext();
  const statusIndicator = getStatusIndicator(status);

  return (
    <div className="h-screen w-screen bg-terminal-bg flex flex-col overflow-hidden">
      <div className="shrink-0 p-2 pb-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <CommandBar />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pr-1" data-testid="ws-status">
          <div className={`w-2 h-2 rounded-full ${statusIndicator.colorClass}`} />
          <span className="text-text-secondary font-mono text-xs">
            {statusIndicator.label}
          </span>
        </div>
      </div>

      {/* Analysis progress bar (only visible when analysis is running) */}
      <div className="shrink-0 px-2">
        <AnalysisProgress symbol={activeTicker} />
      </div>

      <div className="flex-1 min-h-0 p-2">
        <PanelGroup direction="vertical" autoSaveId="terminal-vertical">
          {/* Row 1: Watchlist | Chart | Methodology Scores */}
          <Panel defaultSize={50} minSize={25}>
            <PanelGroup direction="horizontal" autoSaveId="terminal-middle">
              <Panel defaultSize={20} minSize={10} maxSize={35}>
                <div className="h-full overflow-auto">
                  <Watchlist />
                </div>
              </Panel>
              <ResizeHandle direction="vertical" />
              <Panel defaultSize={50} minSize={25}>
                <div className="h-full overflow-auto">
                  <Chart symbol={activeTicker} />
                </div>
              </Panel>
              <ResizeHandle direction="vertical" />
              <Panel defaultSize={30} minSize={15}>
                <div className="h-full overflow-auto">
                  <MethodologyScores symbol={activeTicker} />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* Row 2: NewsFeed | Fundamentals */}
          <Panel defaultSize={22} minSize={12}>
            <PanelGroup direction="horizontal" autoSaveId="terminal-bottom">
              <Panel defaultSize={40} minSize={20}>
                <div className="h-full overflow-auto">
                  <NewsFeed symbol={activeTicker} />
                </div>
              </Panel>
              <ResizeHandle direction="vertical" />
              <Panel defaultSize={60} minSize={25}>
                <div className="h-full overflow-auto">
                  <Fundamentals symbol={activeTicker} />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* Row 3: Institutional Ownership | Insider Activity */}
          <Panel defaultSize={18} minSize={10}>
            <PanelGroup direction="horizontal" autoSaveId="terminal-ownership">
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-auto">
                  <InstitutionalOwnership symbol={activeTicker} />
                </div>
              </Panel>
              <ResizeHandle direction="vertical" />
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-auto">
                  <InsiderActivity symbol={activeTicker} />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* Row 4: Macro Calendar */}
          <Panel defaultSize={10} minSize={5} maxSize={25}>
            <div className="h-full overflow-auto">
              <MacroCalendar symbol={activeTicker} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
