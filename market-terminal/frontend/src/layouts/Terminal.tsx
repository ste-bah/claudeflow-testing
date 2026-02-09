import { useState } from 'react';
import CommandBar from '../components/CommandBar';
import Chart from '../components/Chart';
import Watchlist from '../components/Watchlist';
import NewsFeed from '../components/NewsFeed';
import Fundamentals from '../components/Fundamentals';
import MethodologyScores from '../components/MethodologyScores';
import MacroCalendar from '../components/MacroCalendar';

export default function Terminal() {
  const [activeTicker, setActiveTicker] = useState('');

  return (
    <div className="h-screen w-screen bg-terminal-bg p-2 flex flex-col gap-2 overflow-hidden">
      {/* Command bar */}
      <CommandBar onCommand={(text) => setActiveTicker(text.toUpperCase())} />

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-2 min-h-0">
        {/* Watchlist — left column */}
        <div className="col-span-2 row-span-6">
          <Watchlist items={[]} onSelect={setActiveTicker} />
        </div>

        {/* Chart — center top */}
        <div className="col-span-7 row-span-4">
          <Chart symbol={activeTicker} />
        </div>

        {/* Methodology scores — right column */}
        <div className="col-span-3 row-span-3">
          <MethodologyScores signals={[]} />
        </div>

        {/* News — right column bottom */}
        <div className="col-span-3 row-span-3">
          <NewsFeed symbol={activeTicker} />
        </div>

        {/* Fundamentals — center bottom left */}
        <div className="col-span-4 row-span-2">
          <Fundamentals symbol={activeTicker} />
        </div>

        {/* Macro calendar — center bottom right */}
        <div className="col-span-3 row-span-2">
          <MacroCalendar events={[]} />
        </div>
      </div>
    </div>
  );
}
