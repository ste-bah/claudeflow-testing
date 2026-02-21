/**
 * Candlestick + volume chart using TradingView Lightweight Charts.
 * Displays OHLCV data for the active ticker with timeframe selection.
 *
 * Elliott Wave overlay:
 *  - LineSeries zigzag connecting each wave turning point
 *  - Horizontal price lines for Fibonacci retracements (amber) and extensions (cyan)
 *  - Red dotted line for invalidation level
 *  - Cyan dashed line for primary target
 *  - HTML badges at each wave node (0,1,2,3,4,5 / 0,A,B,C)
 *  - "EW" toggle button in the chart header
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type IPriceLine,
  type Time,
} from 'lightweight-charts';
import { useTickerChart } from '../hooks/useTickerChart';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  DEFAULT_TIMEFRAME,
  type Timeframe,
  type OHLCVBar,
} from '../types/ticker';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { WS_CHANNELS } from '../types/websocket';
import type { EWaveOverlayData, EWavePoint } from '../types/analysis';

interface ChartProps {
  readonly symbol: string;
  readonly ewOverlay?: EWaveOverlayData | null;
  readonly onTimeframeChange?: (tf: Timeframe) => void;
}

/** Dark-theme colour palette for the chart. */
const COLORS = {
  background: '#0a0e17',
  up: '#22c55e',
  down: '#ef4444',
  grid: '#1f2937',
  text: '#8b8b9e',
  border: '#1f2937',
  crosshair: '#4b5563',
  volumeUp: 'rgba(34, 197, 94, 0.3)',
  volumeDown: 'rgba(239, 68, 68, 0.3)',
  ewLine: '#f59e0b',       // amber wave zigzag
  fibRetrace: '#f59e0b',   // amber fib retracements
  fibExtend: '#22d3ee',    // cyan fib extensions / targets
  fibAligned: '#a855f7',   // purple for confluence-aligned fibs
  invalidation: '#ef4444', // red invalidation line
  target: '#22d3ee',       // cyan primary target line
  sma50: '#eab308',        // thick yellow SMA
} as const;

interface ChartSeriesData {
  readonly candles: CandlestickData[];
  readonly volumes: HistogramData[];
}

function mapBarsSinglePass(bars: readonly OHLCVBar[]): ChartSeriesData {
  const candles: CandlestickData[] = [];
  const volumes: HistogramData[] = [];

  const parseTime = (date: string): Time => {
    if (date.includes('T') || date.includes(':')) {
      return (new Date(date).getTime() / 1000) as Time;
    }
    return date as Time;
  };

  for (const bar of bars) {
    const time = parseTime(bar.date);
    candles.push({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    volumes.push({ time, value: bar.volume, color: bar.close >= bar.open ? COLORS.volumeUp : COLORS.volumeDown });
  }

  return { candles, volumes };
}

/** Convert an ISO date/datetime string to a Lightweight Charts Time value. */
function isoToTime(iso: string): Time | null {
  try {
    if (!iso) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso as Time;
    const ms = new Date(iso).getTime();
    if (isNaN(ms)) return null;
    return (ms / 1000) as Time;
  } catch {
    return null;
  }
}

/** Price chart panel with candlestick and volume series. */
export default function Chart({ symbol, ewOverlay, onTimeframeChange }: ChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const { bars, loading, error } = useTickerChart(symbol, timeframe);


  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const waveLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const fibLinesRef = useRef<IPriceLine[]>([]);
  const labelNodesRef = useRef<HTMLDivElement[]>([]);
  const labelContainerRef = useRef<HTMLDivElement>(null);

  const lastBarRef = useRef<{
    time: Time; open: number; high: number; low: number; close: number;
  } | null>(null);

  const { subscribe, unsubscribe, onMessage } = useWebSocketContext();

  /** EW overlay toggle */
  const [ewVisible, setEwVisible] = useState(true);
  const hasEwData = !!(ewOverlay && ewOverlay.wavePoints.length > 0);

  // -- helpers ---------------------------------------------------------------

  const clearLabels = useCallback(() => {
    for (const node of labelNodesRef.current) node.remove();
    labelNodesRef.current = [];
  }, []);

  const clearPriceLines = useCallback(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    for (const pl of fibLinesRef.current) {
      try { series.removePriceLine(pl); } catch { /* already removed */ }
    }
    fibLinesRef.current = [];
  }, []);

  const clearWaveLine = useCallback(() => {
    if (chartRef.current && waveLineSeriesRef.current) {
      try { chartRef.current.removeSeries(waveLineSeriesRef.current); } catch { /* ok */ }
      waveLineSeriesRef.current = null;
    }
  }, []);

  const clearSmaLine = useCallback(() => {
    if (chartRef.current && smaSeriesRef.current) {
      try { chartRef.current.removeSeries(smaSeriesRef.current); } catch { /* ok */ }
      smaSeriesRef.current = null;
    }
  }, []);

  const clearOverlay = useCallback(() => {
    clearLabels();
    clearPriceLines();
    clearWaveLine();
    clearSmaLine();
  }, [clearLabels, clearPriceLines, clearWaveLine, clearSmaLine]);

  // -- Mount-only: create chart ----------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let chart: IChartApi;
    try {
      chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: COLORS.background },
          textColor: COLORS.text,
        },
        grid: {
          vertLines: { color: COLORS.grid },
          horzLines: { color: COLORS.grid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: COLORS.border },
        timeScale: { borderColor: COLORS.border, timeVisible: false, secondsVisible: false },
      });
    } catch {
      return;
    }

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: COLORS.up, downColor: COLORS.down,
      borderUpColor: COLORS.up, borderDownColor: COLORS.down,
      wickUpColor: COLORS.up, wickDownColor: COLORS.down,
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' }, priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearOverlay();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []); // mount-only

  // -- Data update effect ----------------------------------------------------

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (bars.length === 0) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastBarRef.current = null;
      return;
    }

    const { candles, volumes } = mapBarsSinglePass(bars);
    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);

    // -- SMA 50 Calculation --
    if (chartRef.current && candles.length >= 50) {
      if (!smaSeriesRef.current) {
        smaSeriesRef.current = chartRef.current.addLineSeries({
          color: COLORS.sma50,
          lineWidth: 3,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'SMA 50',
          crosshairMarkerVisible: false,
        });
      }

      const smaData = [];
      for (let i = 49; i < candles.length; i++) {
        const window = candles.slice(i - 49, i + 1);
        const avg = window.reduce((sum, c) => sum + c.close, 0) / 50;
        smaData.push({ time: candles[i].time, value: avg });
      }
      smaSeriesRef.current.setData(smaData);
    } else if (smaSeriesRef.current) {
      smaSeriesRef.current.setData([]);
    }

    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      lastBarRef.current = {
        time: lastCandle.time,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      };
    }

    if (chartRef.current) {
      const isIntraday = ['1h', '4h', '8h', '12h'].includes(timeframe);
      chartRef.current.applyOptions({
        timeScale: { timeVisible: isIntraday, secondsVisible: false },
      });
      chartRef.current.timeScale().fitContent();
    }
  }, [bars, timeframe]);

  // -- EW overlay effect -----------------------------------------------------

  useEffect(() => {
    clearOverlay();

    if (!ewVisible || !hasEwData || !ewOverlay || !chartRef.current || !candleSeriesRef.current) {
      return;
    }

    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const isIntraday = ['1h', '4h', '8h', '12h'].includes(timeframe);

    // 1. Wave zigzag line
    const lineData = ewOverlay.wavePoints
      .map((p: EWavePoint) => {
        const t = isoToTime(p.time);
        return t !== null ? { time: t, value: p.price } : null;
      })
      .filter((d): d is { time: Time; value: number } => d !== null)
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

    // Deduplicate by time
    const deduped = new Map<Time, { time: Time; value: number }>();
    for (const pt of lineData) deduped.set(pt.time, pt);
    const uniqueLine = Array.from(deduped.values()).sort((a, b) =>
      a.time < b.time ? -1 : a.time > b.time ? 1 : 0,
    );

    if (uniqueLine.length >= 2) {
      const lineSeries = chart.addLineSeries({
        color: COLORS.ewLine, lineWidth: 2, lineStyle: 0,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      lineSeries.setData(uniqueLine);
      waveLineSeriesRef.current = lineSeries;
    }

    // 2. Fibonacci price lines
    const newFibLines: IPriceLine[] = [];
    for (const fib of ewOverlay.fibLevels) {
      if (!fib.price || fib.price <= 0) continue;
      const color = fib.aligned
        ? COLORS.fibAligned
        : fib.type === 'extension' ? COLORS.fibExtend : COLORS.fibRetrace;
      newFibLines.push(candleSeries.createPriceLine({
        price: fib.price, color, lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: fib.label,
      }));
    }

    // 3. Invalidation line
    if (ewOverlay.invalidation !== null && ewOverlay.invalidation > 0) {
      newFibLines.push(candleSeries.createPriceLine({
        price: ewOverlay.invalidation, color: COLORS.invalidation,
        lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Invalidation',
      }));
    }

    // 4. Primary target line
    if (ewOverlay.primaryTarget !== null && ewOverlay.primaryTarget > 0) {
      newFibLines.push(candleSeries.createPriceLine({
        price: ewOverlay.primaryTarget, color: COLORS.target,
        lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '⊙ Target',
      }));
    }

    fibLinesRef.current = newFibLines;

    // 5. Wave label badges
    const container = containerRef.current;
    const labelContainer = labelContainerRef.current;
    if (!container || !labelContainer) return;

    const newNodes: HTMLDivElement[] = [];
    const timeScale = chart.timeScale();

    for (const pt of ewOverlay.wavePoints) {
      const t = isoToTime(pt.time);
      if (t === null) continue;
      if (isIntraday && typeof t !== 'number') continue;

      let x: number | null = null;
      try { x = timeScale.timeToCoordinate(t); } catch { continue; }
      if (x === null) continue;

      let y: number | null = null;
      try { y = candleSeries.priceToCoordinate(pt.price); } catch { continue; }
      if (y === null) continue;

      const badge = document.createElement('div');
      const isOrigin = pt.label === '0';
      badge.style.cssText = `
        position: absolute;
        left: ${x - 10}px;
        top: ${y - 20}px;
        background: ${isOrigin ? '#6b7280' : COLORS.ewLine};
        color: #0a0e17;
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
        padding: 1px 4px;
        border-radius: 3px;
        pointer-events: none;
        z-index: 10;
        white-space: nowrap;
        transform: translateX(-50%);
        opacity: 0.92;
      `;
      badge.textContent = pt.label;
      labelContainer.appendChild(badge);
      newNodes.push(badge);
    }

    labelNodesRef.current = newNodes;
  }, [ewOverlay, ewVisible, timeframe, hasEwData, clearOverlay]);

  // -- WebSocket live price --------------------------------------------------

  useEffect(() => {
    if (!symbol) return;
    subscribe(WS_CHANNELS.PriceUpdates);
    const removeListener = onMessage('price_update', (msg) => {
      if (msg.symbol !== symbol) return;
      if (!lastBarRef.current || !candleSeriesRef.current) return;
      const bar = lastBarRef.current;
      bar.close = msg.price;
      bar.high = Math.max(bar.high, msg.price);
      bar.low = Math.min(bar.low, msg.price);
      candleSeriesRef.current.update({
        time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
      });
    });
    return () => { removeListener(); unsubscribe(WS_CHANNELS.PriceUpdates); };
  }, [symbol, subscribe, unsubscribe, onMessage]);

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-4 h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-text-primary font-mono text-sm shrink-0">
          Chart &mdash; {symbol || 'No ticker selected'}
        </h3>

        <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
          {/* EW toggle */}
          {hasEwData && (
            <button
              type="button"
              onClick={() => setEwVisible((v) => !v)}
              title={ewVisible ? 'Hide Elliott Wave overlay' : 'Show Elliott Wave overlay'}
              className={`
                px-2 py-0.5 text-xs font-mono rounded border transition-colors duration-150
                ${ewVisible
                  ? 'bg-amber-500 text-terminal-bg border-amber-500'
                  : 'text-text-muted border-terminal-border hover:text-text-secondary'
                }
              `}
            >
              EW
            </button>
          )}

          {/* Timeframe selector */}
          {symbol && (
            <div className="flex gap-1 flex-wrap">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => { setTimeframe(tf); onTimeframeChange?.(tf); }}
                  className={`
                    px-2 py-0.5 text-xs font-mono rounded transition-colors duration-150
                    ${tf === timeframe
                      ? 'bg-amber-500 text-terminal-bg'
                      : 'text-text-secondary hover:text-text-primary hover:bg-terminal-border'
                    }
                  `}
                >
                  {TIMEFRAME_LABELS[tf]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart body */}
      <div className="flex-1 min-h-0 relative">
        {/* EW pattern type badge */}
        {hasEwData && ewVisible && ewOverlay && (
          <div className="absolute top-1 left-1 z-20 pointer-events-none">
            <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-xs px-1.5 py-0.5 rounded">
              {ewOverlay.patternType.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-text-secondary font-mono text-xs animate-pulse">
              Loading chart data...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-red-400 font-mono text-xs">{error}</p>
          </div>
        )}

        {!symbol && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-secondary font-mono text-xs">
              Enter a ticker symbol to view chart
            </p>
          </div>
        )}

        {symbol && !loading && !error && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-text-secondary font-mono text-xs">No chart data available</p>
          </div>
        )}

        {/* Wave label badges container */}
        <div
          ref={labelContainerRef}
          className="absolute inset-0 pointer-events-none overflow-hidden z-10"
        />

        {/* Chart canvas */}
        <div
          ref={containerRef}
          className="w-full h-full"
          data-testid="chart-container"
        />
      </div>
    </div>
  );
}
