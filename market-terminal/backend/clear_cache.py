
import asyncio
import logging
from app.data.cache import get_cache_manager

logging.basicConfig(level=logging.INFO)

async def clear_cache():
    print("Connecting to CacheManager...")
    cache = get_cache_manager()
    symbol = "AAPL"
    
    print(f"Invalidating cache for {symbol}...")
    await cache.invalidate(symbol)
    
    print("Done. Closing CacheManager...")
    await cache.close()

if __name__ == "__main__":
    asyncio.run(clear_cache())
