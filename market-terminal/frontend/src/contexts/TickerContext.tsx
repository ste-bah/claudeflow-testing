import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface TickerContextType {
  activeTicker: string;
  setActiveTicker: (ticker: string) => void;
}

const TickerContext = createContext<TickerContextType | null>(null);

export function TickerProvider({ children }: { children: ReactNode }) {
  const [activeTicker, setActiveTicker] = useState('');

  return (
    <TickerContext.Provider value={{ activeTicker, setActiveTicker }}>
      {children}
    </TickerContext.Provider>
  );
}

export function useTickerContext(): TickerContextType {
  const ctx = useContext(TickerContext);
  if (ctx === null) {
    throw new Error('useTickerContext must be used within a TickerProvider');
  }
  return ctx;
}
