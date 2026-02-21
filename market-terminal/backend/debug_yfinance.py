import asyncio
import logging
from app.data.yfinance_client import get_yfinance_client

logging.basicConfig(level=logging.INFO)

async def main():
    yf = get_yfinance_client()
    symbol = "AAPL"
    
    print(f"Fetching info for {symbol}...")
    info = await yf.get_info(symbol)
    
    if info:
        print("Received info:")
        print(f"Example keys: {list(info.keys())}")
        print(f"shares_outstanding: {info.get('shares_outstanding')}")
        print(f"market_cap: {info.get('market_cap')}")
    else:
        print("No info received.")
        
    # Also dump raw info if possible via private access (hack for debug)
    # yfinance client wrapper hides raw info.
    # Instead, let's use yfinance directly here.
    import yfinance as _yf
    print("\n--- Raw yfinance ---")
    ticker = _yf.Ticker(symbol)
    raw = ticker.info
    print(f"Raw sharesOutstanding: {raw.get('sharesOutstanding')}")
    print(f"Raw impliedSharesOutstanding: {raw.get('impliedSharesOutstanding')}")

if __name__ == "__main__":
    asyncio.run(main())
