"""
Diagnostic: test all 6 methodologies across different intervals.
Captures all exceptions so we can see which ones fail and why.
"""
import asyncio
import traceback
import sys

sys.path.insert(0, ".")

from app.data.cache import get_cache_manager
import pandas as pd
import numpy as np

METHODOLOGIES = [
    ("wyckoff",          "app.analysis.wyckoff",          "WyckoffAnalyzer"),
    ("elliott_wave",     "app.analysis.elliott_wave",     "ElliottWaveAnalyzer"),
    ("ict_smart_money",  "app.analysis.ict_smart_money",  "ICTSmartMoneyAnalyzer"),
    ("canslim",          "app.analysis.canslim",          "CANSLIMAnalyzer"),
    ("larry_williams",   "app.analysis.larry_williams",   "LarryWilliamsAnalyzer"),
    ("sentiment",        "app.analysis.sentiment",        "SentimentAnalyzer"),
]

# Same mapping as analysis.py
INTERVAL_MAPPING = {
    "1h":  ("2y",  "1h",   None),
    "4h":  ("2y",  "1h",   "4h"),
    "8h":  ("1y",  "1h",   "8h"),
    "12h": ("1y",  "1h",   "12h"),
    "1d":  ("max", "1d",   None),
    "1w":  ("max", "1wk",  None),
    "1m":  ("max", "1mo",  None),
    "3m":  ("max", "3mo",  None),
}

SYMBOL = "AAPL"
TEST_INTERVALS = ["1d", "4h", "8h", "1w", "1m"]


def _resample_df(df, rule):
    import pandas as pd
    df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"], utc=True)
    df = df.set_index("date")
    agg = {"open": "first", "high": "max", "low": "min", "close": "last"}
    if "volume" in df.columns:
        agg["volume"] = "sum"
    try:
        return df.resample(rule).agg(agg).dropna().reset_index()
    except Exception as e:
        print(f"      [RESAMPLE ERROR] {e}")
        return df.reset_index()


async def fetch_data(interval: str):
    cm = get_cache_manager()
    yf_period, yf_interval, resample_rule = INTERVAL_MAPPING.get(interval, ("2y", "1d", None))
    
    hist = await cm.get_historical_prices(SYMBOL, period=yf_period, interval=yf_interval)
    if hist is None or not isinstance(hist.data, list):
        return None, None
    
    df = pd.DataFrame(hist.data)
    df.columns = [c.lower() for c in df.columns]
    df = df.sort_values("date").reset_index(drop=True)
    
    price_df = df[["date", "open", "high", "low", "close"]].dropna()
    vol_df = df[["date", "volume"]].dropna() if "volume" in df.columns else price_df[["date"]].assign(volume=0)
    
    if resample_rule:
        merged = pd.merge(price_df, vol_df, on="date", how="left").fillna(0)
        resampled = _resample_df(merged, resample_rule)
        price_df = resampled[["date", "open", "high", "low", "close"]]
        vol_df = resampled[["date", "volume"]]
    
    return price_df, vol_df


async def run_diagnostics():
    print(f"DIAGNOSTIC: {SYMBOL} — methodology failures per interval")
    print("=" * 70)
    
    for interval in TEST_INTERVALS:
        print(f"\n{'─' * 70}")
        print(f"Interval: {interval}")
        print(f"{'─' * 70}")
        
        price_df, vol_df = await fetch_data(interval)
        if price_df is None:
            print("  [ERROR] Could not fetch data for this interval")
            continue
        
        print(f"  Data: {len(price_df)} bars | cols: {list(price_df.columns)}")
        if not price_df.empty:
            print(f"  Date range: {price_df['date'].min()} → {price_df['date'].max()}")
        
        for name, module_path, class_name in METHODOLOGIES:
            try:
                import importlib
                mod = importlib.import_module(module_path)
                cls = getattr(mod, class_name)
                analyzer = cls()
                
                kwargs = {}
                if name == "sentiment":
                    kwargs["articles"] = []
                if name == "larry_williams":
                    kwargs["cot_data"] = None
                
                signal = await analyzer.analyze(
                    SYMBOL,
                    price_data=price_df,
                    volume_data=vol_df,
                    fundamentals=None,
                    **kwargs,
                )
                print(f"  ✅ {name:18s} → {signal.direction} ({signal.confidence:.2f})")
            except Exception as e:
                # Print the full traceback for the first error
                print(f"  ❌ {name:18s} → {type(e).__name__}: {e}")
                tb = traceback.format_exc()
                # Only show the last 3 lines of the traceback (the relevant part)
                relevant = [l for l in tb.strip().split("\n") if l.strip()][-3:]
                for line in relevant:
                    print(f"       {line.strip()}")


if __name__ == "__main__":
    asyncio.run(run_diagnostics())
