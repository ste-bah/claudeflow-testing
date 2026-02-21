
import asyncio
import pandas as pd
import numpy as np
from app.analysis.elliott_wave import ElliottWaveAnalyzer

def generate_pattern_data(pattern_type: str) -> pd.DataFrame:
    """Generate OHLCV data for specific Elliott Wave patterns with enough bars."""
    data = []
    date_idx = 0
    
    def add_move(start_price, end_price, bars=20):
        nonlocal date_idx
        points = []
        step = (end_price - start_price) / bars
        current = start_price
        for b in range(bars):
            current += step
            noise = np.random.uniform(-abs(step) * 0.3, abs(step) * 0.3)
            c = current + noise
            h = max(current, c) + abs(step) * 0.2
            l = min(current, c) - abs(step) * 0.2
            o = c - noise * 0.5
            points.append({
                "date": pd.Timestamp("2023-01-01") + pd.Timedelta(days=date_idx),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": 1000 + np.random.randint(0, 500)
            })
            date_idx += 1
        return points
    
    if pattern_type == "diagonal_leading":
        # 5 waves with overlap and contracting wedge
        # W1: 100->120, W2: 120->107, W3: 107->122, W4: 122->112, W5: 112->118
        data.extend(add_move(100, 120, 25))
        data.extend(add_move(120, 107, 20))
        data.extend(add_move(107, 122, 22))  # shorter than W1
        data.extend(add_move(122, 112, 18))  # overlaps with W1 top (120)
        data.extend(add_move(112, 118, 15))  # shortest motive wave
        
    elif pattern_type == "flat_regular":
        # A-B-C with B retracing ~95% of A
        # A: 100->85, B: 85->99 (93% retrace), C: 85->82
        data.extend(add_move(100, 85, 25))
        data.extend(add_move(85, 99, 25))   # ~93% retrace
        data.extend(add_move(99, 82, 25))    # C extends slightly past A
        
    elif pattern_type == "flat_expanded":
        # A: 100->85, B: 85->103 (B > 100% of A), C: 103->80
        data.extend(add_move(100, 85, 25))
        data.extend(add_move(85, 103, 25))  # B exceeds A start
        data.extend(add_move(103, 80, 25))  # C beyond A end
        
    elif pattern_type == "triangle_contracting":
        # A-B-C-D-E with contracting amplitudes
        # A: 100->112, B: 112->103, C: 103->110, D: 110->105, E: 105->107
        data.extend(add_move(100, 112, 20))  # +12
        data.extend(add_move(112, 103, 18))  # -9
        data.extend(add_move(103, 110, 16))  # +7
        data.extend(add_move(110, 105, 14))  # -5
        data.extend(add_move(105, 107, 12))  # +2 (shortest)
    
    elif pattern_type == "wxy_correction":
        # W: 100->88, X: 88->95, Y: 95->82 (Y extends beyond W)
        data.extend(add_move(100, 88, 25))
        data.extend(add_move(88, 95, 20))
        data.extend(add_move(95, 82, 25))
        
    return pd.DataFrame(data)

async def test_patterns():
    analyzer = ElliottWaveAnalyzer()
    patterns = [
        "diagonal_leading", 
        "flat_regular", 
        "flat_expanded",
        "triangle_contracting", 
        "wxy_correction"
    ]
    
    print("=" * 60)
    print("Testing Advanced Elliott Wave Pattern Detection")
    print("=" * 60)
    
    np.random.seed(42)  # For reproducibility
    
    for p in patterns:
        print(f"\n{'─' * 50}")
        print(f"Testing: {p}")
        print(f"{'─' * 50}")
        df = generate_pattern_data(p)
        price_df = df[["date", "open", "high", "low", "close"]]
        volume_df = df[["date", "volume"]]
        
        signal = await analyzer.analyze("TEST", price_df, volume_df)
        
        print(f"  Direction:  {signal.direction}")
        print(f"  Confidence: {signal.confidence:.2f}")
        print(f"  Reasoning:  {signal.reasoning}")
        
        # Check key_levels for pattern type info
        kl = signal.key_levels
        if kl:
            print(f"  Wave:       {kl.get('current_wave', 'N/A')}")
            print(f"  Target:     {kl.get('primary_target', 'N/A')}")
            print(f"  Invalid:    {kl.get('invalidation', 'N/A')}")
            if kl.get('alternative_count'):
                print(f"  Alt:        {kl['alternative_count']}")

    print(f"\n{'=' * 60}")
    print("Done!")

if __name__ == "__main__":
    asyncio.run(test_patterns())
