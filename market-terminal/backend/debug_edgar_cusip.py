
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_edgar_cusip():
    client = EdgarOwnershipClient()
    symbol = "META"
    
    print(f"--- Debugging CUSIP for {symbol} ---")
    
    client._ensure_identity()
    from edgar import Company
    
    try:
        company = Company(symbol)
        print(f"Company: {company}")
        if hasattr(company, "tickers"):
            print(f"Tickers: {company.tickers}")
        if hasattr(company, "exchanges"):
            print(f"Exchanges: {company.exchanges}")
            
        # Check if company object has CUSIP or similar
        print(f"Dir(company): {[d for d in dir(company) if not d.startswith('_')]}")
        
    except Exception as e:
        print(f"Error getting company: {e}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(debug_edgar_cusip())
