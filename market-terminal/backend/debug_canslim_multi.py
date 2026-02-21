
import asyncio
import logging
from app.data.fundamentals_service import get_fundamentals_data
from app.data.yfinance_client import get_yfinance_client

# Configure logging to capture service logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.data.fundamentals_service")
logger.setLevel(logging.INFO)

async def check_symbols():
    symbols = ["AAPL", "NVDA", "MSFT", "TSLA", "AMD", "GOOGL"]
    
    print(f"{'SYMBOL':<10} | {'ANNUAL EPS (Len)':<20} | {'INST OWNERSHIP':<20} | {'SOURCE':<10}")
    print("-" * 70)

    for sym in symbols:
        try:
            data = await get_fundamentals_data(sym)
            
            annual_eps = data.get("annual_eps") or []
            inst_own = data.get("institutional_ownership")
            source = data.get("data_sources", {}).get("financials", "N/A")
            
            eps_str = f"{annual_eps} ({len(annual_eps)})"
            inst_str = str(inst_own)
            
            print(f"{sym:<10} | {str(len(annual_eps)) + ' yrs':<20} | {inst_str:<20} | {source:<10}")
            
            if len(annual_eps) < 3:
                 print(f"   [WARN] {sym}: Insufficient Annual EPS. Data: {annual_eps}")

            if inst_own is None:
                 print(f"   [WARN] {sym}: Missing Institutional Ownership.")

        except Exception as e:
            print(f"{sym:<10} | ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(check_symbols())
