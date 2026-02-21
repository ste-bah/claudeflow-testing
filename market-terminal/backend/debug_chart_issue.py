
import asyncio
import logging
import sys
from app.data.yfinance_client import YFinanceClient
from app.data.cache import CacheManager

logging.basicConfig(level=logging.INFO)

async def test():
    symbol = "AAPL"
    
    print(f"--- Testing Direct YFinanceClient for {symbol} (1h) ---")
    client = YFinanceClient()
    # Fetch 1h data (intraday)
    data = await client.get_historical(symbol, period="2y", interval="1h")
    
    if not data:
        print("No data returned from YFinanceClient")
        return

    print(f"Returned {len(data)} bars")
    print("First 3 bars:", data[:3])
    print("Last 3 bars:", data[-3:])
    
    # Check for duplicate dates
    dates = [x['date'] for x in data]
    duplicates = set(x for x in dates if dates.count(x) > 1)
    if duplicates:
        print(f"CRITICAL: Found {len(duplicates)} duplicate timestamps! Example: {list(duplicates)[0]}")
    else:
        print("SUCCESS: No duplicate timestamps found in fresh fetch.")

    # Check sorting
    is_sorted = all(dates[i] <= dates[i+1] for i in range(len(dates)-1))
    print(f"Data is sorted: {is_sorted}")
    if not is_sorted:
        for i in range(len(dates)-1):
            if dates[i] > dates[i+1]:
                print(f"Unsorted at index {i}: {dates[i]} > {dates[i+1]}")
                break

    print("\n--- Checking CacheManager ---")
    cache = CacheManager()
    # Check what's in the cache
    cached_result = await cache.get_historical_prices(symbol, period="2y", interval="1h")
    
    if cached_result and cached_result.is_cached:
        print(f"Cache HIT. Age: {cached_result.cache_age_seconds}s")
        c_data = cached_result.data
        c_dates = [x['date'] for x in c_data]
        c_duplicates = set(x for x in c_dates if c_dates.count(x) > 1)
        if c_duplicates:
             print(f"CACHE DIRTY: Cache contains duplicates! (e.g. {list(c_duplicates)[0]})")
             print("Clearing cache for symbol...")
             await cache.invalidate(symbol)
             print("Cache invalidated.")
        else:
             print("Cache appears clean.")
    else:
        print("Cache MISS (or forced refresh).")

    await client.close()
    await cache.close()

if __name__ == "__main__":
    asyncio.run(test())
