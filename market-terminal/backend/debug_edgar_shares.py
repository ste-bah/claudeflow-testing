import asyncio
import logging
from app.data.edgar_client import get_edgar_client

# Configure logging
logging.basicConfig(level=logging.INFO)

async def main():
    edgar = get_edgar_client()
    symbol = "AAPL"
    
    print(f"Fetching balance sheet for {symbol}...")
    bs = await edgar.get_balance_sheet(symbol)
    
    if bs:
        print(f"Received {len(bs)} periods of balance sheet data.")
        latest = bs[0]
        print("Latest Balance Sheet Data:")
        for k, v in latest.items():
            print(f"  {k}: {v}")
            
        shares = latest.get("shares_outstanding")
        print(f"\nSHARES (Balance Sheet): {shares}")
    else:
        print("No balance sheet data found.")

    print(f"\nFetching key metrics for {symbol}...")
    metrics = await edgar.get_key_metrics(symbol)
    if metrics:
        print("Key Metrics:")
        for k, v in metrics.items():
            print(f"  {k}: {v}")
    else:
        print("No key metrics found.")

if __name__ == "__main__":
    asyncio.run(main())
