
import asyncio
import sys
import os
import requests
from collections import Counter

# Ensure we can import app modules
sys.path.append(os.getcwd())

BASE_URL = "http://localhost:8000/api/ticker"

def check_duplicates(symbol="AAPL", period="4h"):
    print(f"Checking {symbol} for period {period}...")
    try:
        url = f"{BASE_URL}/{symbol}"
        # Map period from user types (1h, 4h) to our API types (h1, h4, d1, w1)
        # Note: Chart passes '1h', '4h'. API expects '1d', '1w' or '1h', '4h'?
        # In ticker.py: Period enum has h1, h4. 
        # But chart passes Timeframe enum ('1h', '4h').
        params = {"period": period, "include_history": "true"}
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        ohlcv = data.get("ohlcv", [])
        
        if not ohlcv:
            print("No OHLCV data returned.")
            return

        dates = [bar["date"] for bar in ohlcv]
        counts = Counter(dates)
        duplicates = {date: count for date, count in counts.items() if count > 1}
        
        if duplicates:
            print(f"FAILED: Found {len(duplicates)} duplicate timestamps!")
            for date, count in list(duplicates.items())[:5]:
                print(f"  {date}: {count} times")
            return
        else:
            print(f"SUCCESS: No duplicates found. Total bars: {len(ohlcv)}")
            
        # Check sorting
        # Intraday might use ISO strings that sort correctly
        sorted_dates = sorted(dates)
        if dates != sorted_dates:
            print("FAILED: Data is not sorted by date!")
            # Print first unsorted pair
            for i in range(len(dates) - 1):
                if dates[i] > dates[i+1]:
                    print(f"  Unsorted at index {i}: {dates[i]} > {dates[i+1]}")
                    break
        else:
            print("SUCCESS: Data is sorted.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test typical periods
    # Note: frontend passes '1h', '4h', but backend expects '1h', '4h' (Enum Period)
    # Let's test what chart sends.
    periods = ["1h", "4h", "1d", "1w"]
    symbols = ["NVDA", "SPY", "TSLA", "AAPL"]
    for s in symbols:
        for p in periods:
            check_duplicates(s, p)
        print("-" * 20)
