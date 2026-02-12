import { TickerProvider } from './contexts/TickerContext';
import Terminal from './layouts/Terminal';

export default function App() {
  return (
    <div className="dark">
      <TickerProvider>
        <Terminal />
      </TickerProvider>
    </div>
  );
}
