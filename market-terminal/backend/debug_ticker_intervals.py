
import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/ticker"
SYMBOL = "AAPL"

# Timeframes reported as broken: 8h, 12h, 1W, 1M, 3M, 6M, 1y, 5y
# Note: frontend passes "1h", "4h", "8h", "12h" for intraday. 
# "1w", "1m", "3m", "6m", "1y", "5y" for daily/weekly/monthly?
# Let's check `ticker.py` Period enum and `_PERIOD_MAP`.
# Period enum: h1, h4, h8, h12, d1, w1, m1, m3, y6, y1, y5.
# Frontend typically sends these values.
# Let's test sending `period` parameter corresponding to these.

TEST_CASES = [
    ("8h", "h8"),
    ("12h", "h12"),
    ("1w", "w1"),
    ("1m", "m1"),
    ("3m", "m3"),
    ("6m", "6mo"), # backend expects "6mo"? Wait, `Period` uses "6mo".
    ("1y", "1y"),
    ("5y", "5y"),
]

# Let's verify what `Period` enum actually expects as input strings.
# ticker.py:
# class Period(str, Enum):
#     d1 = "1d"
#     w1 = "1w"
#     m1 = "1m"
#     m3 = "3m"
#     y6 = "6mo"  <-- check if client sends "6m" or "6mo"
#     y1 = "1y"
#     y5 = "5y"
#     h1 = "1h"
#     h4 = "4h"
#     h8 = "8h"
#     h12 = "12h"

# If client sends "6m", it might fail validation if enum expects "6mo".
# If client sends "1M", it might fail if enum expects "1m".

def test_intervals():
    print(f"Testing intervals for {SYMBOL}...")
    
    # Check these values against what the frontend likely sends
    intervals_to_test = [
        "8h", "12h", "1w", "1m", "3m", "6m", "1y", "5y"
    ]
    
    for interval in intervals_to_test:
        print(f"\nScanning interval: {interval}")
        try:
            params = {"period": interval, "include_history": "true"}
            response = requests.get(f"{BASE_URL}/{SYMBOL}", params=params)
            
            if response.status_code != 200:
                print(f"FAILED {interval}: Status {response.status_code}")
                # Print error details
                try:
                    print(response.json())
                except:
                    print(response.text)
                continue
                
            data = response.json()
            ohlcv = data.get("ohlcv", [])
            print(f"SUCCESS {interval}: {len(ohlcv)} bars returned.")
            if len(ohlcv) > 0:
                print(f"  First: {ohlcv[0]['date']}, Last: {ohlcv[-1]['date']}")
            else:
                print("  WARNING: 0 bars returned!")
                
        except Exception as e:
            print(f"ERROR {interval}: {e}")

if __name__ == "__main__":
    test_intervals()
