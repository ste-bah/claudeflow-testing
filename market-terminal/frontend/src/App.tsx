import { TickerProvider } from './contexts/TickerContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Terminal from './layouts/Terminal';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <div className="dark">
      <ErrorBoundary>
        <WebSocketProvider>
          <TickerProvider>
            <Terminal />
          </TickerProvider>
        </WebSocketProvider>
      </ErrorBoundary>
    </div>
  );
}
