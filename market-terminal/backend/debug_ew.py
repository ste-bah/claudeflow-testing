
import asyncio
import pandas as pd
from app.api.routes.analysis import _TIMEFRAME_DATA_MAP
from app.data.cache import get_cache_manager
from app.analysis.elliott_wave import ElliottWaveAnalyzer, _DEGREES

async def debug_ew(symbol="QSI"):
    cm = get_cache_manager()
    period, interval = _TIMEFRAME_DATA_MAP["1d"]
    print(f"Fetching {symbol} with period={period}, interval={interval}...")
    
    res = await cm.get_historical_prices(symbol, period=period, interval=interval)
    if not res or res.data is None:
        print("No data found")
        return
    
    df = pd.DataFrame(res.data)
    print(f"Total bars: {len(df)}")
    print(f"Date range: {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
    
    analyzer = ElliottWaveAnalyzer()
    # Mocking volume if missing
    if 'volume' not in df.columns:
        df['volume'] = 0
        
    price_data = df[['date', 'open', 'high', 'low', 'close']]
    volume_data = df[['date', 'volume']]
    
    print("\nDegree Breakdown:")
    for name, min_pct, atr_mult, target_bars, max_bars in _DEGREES:
        segments = analyzer._construct_segments(df, min_pct, atr_mult)
        print(f"\nDegree: {name} | MinPct: {min_pct} | Segments: {len(segments)}")
        
        # Check waves for this degree
        # Note: _find_all_valid_counts might not be public or easily accessible, 
        # but let's assume we can get to it or use _analyze_degree directly
        res = analyzer._analyze_degree(name, min_pct, atr_mult, target_bars, max_bars, df, float(df['close'].iloc[-1]))
        if res.count:
            cnt = res.count
            dur = cnt.waves[-1].end_index - cnt.waves[0].start_index
            print(f"  Top Label: {res.wave_label} | Duration: {dur} bars | Score: {cnt.total_score:.2f}")
            print(f"  Reasoning: {res.wave_label} spanning from {df['date'].iloc[cnt.waves[0].start_index]} to {df['date'].iloc[cnt.waves[-1].end_index]}")

if __name__ == "__main__":
    import sys
    symbol = sys.argv[1] if len(sys.argv) > 1 else "QSI"
    asyncio.run(debug_ew(symbol))
