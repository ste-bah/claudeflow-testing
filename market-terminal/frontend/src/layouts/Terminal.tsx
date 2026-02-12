import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTickerContext } from '../contexts/TickerContext';
import CommandBar from '../components/CommandBar';
import Chart from '../components/Chart';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';
import Fundamentals from '../components/Fundamentals';
import MethodologyScores from '../components/MethodologyScores';
import MacroCalendar from '../components/MacroCalendar';

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
  const { activeTicker, setActiveTicker } = useTickerContext();

  return (
    <div className="h-screen w-screen bg-terminal-bg flex flex-col overflow-hidden">
      <div className="shrink-0 p-2 pb-0">
        <CommandBar onCommand={(text) => setActiveTicker(text.toUpperCase())} />
      </div>

      <div className="flex-1 min-h-0 p-2">
        <PanelGroup direction="vertical" autoSaveId="terminal-vertical">
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="horizontal" autoSaveId="terminal-middle">
              <Panel defaultSize={20} minSize={10} maxSize={35}>
                <div className="h-full overflow-auto">
                  <Watchlist items={[]} onSelect={setActiveTicker} />
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
                  <MethodologyScores signals={[]} />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          <Panel defaultSize={30} minSize={15}>
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

          <Panel defaultSize={10} minSize={5} maxSize={25}>
            <div className="h-full overflow-auto">
              <MacroCalendar events={[]} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
