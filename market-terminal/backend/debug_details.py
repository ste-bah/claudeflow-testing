import asyncio
import logging
import json
from datetime import date, datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("debugger")

# Import clients
from app.data.edgar_client import get_edgar_client
from app.data.yfinance_client import get_yfinance_client

# Helper for JSON serialization
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)

async def main():
    symbol = "NVDA"
    logger.info(f"--- Debugging Detailed Financials for {symbol} ---")

    edgar = get_edgar_client()
    yfinance = get_yfinance_client()
    
    # 1. EDGAR Fetch (Income Statement / EPS History)
    logger.info("\n--- EDGAR: get_eps_history ---")
    try:
        eps_hist = await edgar.get_eps_history(symbol, quarters=4)
        print(json.dumps(eps_hist, default=json_serial, indent=2))
    except Exception as e:
        logger.error(f"EDGAR EPS Error: {e}")

    # 2. EDGAR Fetch (Balance Sheet)
    logger.info("\n--- EDGAR: get_balance_sheet ---")
    try:
        bs = await edgar.get_balance_sheet(symbol, periods=1)
        print(json.dumps(bs, default=json_serial, indent=2))
    except Exception as e:
        logger.error(f"EDGAR BS Error: {e}")

    # 3. YFinance Fetch (Financials)
    logger.info("\n--- YFinance: get_financials ---")
    try:
        yf_fins = await yfinance.get_financials(symbol)
        
        if yf_fins:
            inc = yf_fins.get("income_statement", [])
            logger.info(f"YF Income Statement ({len(inc)} periods):")
            if inc:
                print(f"Keys: {list(inc[0].keys())}")
                print(f"Sample Period 0: {json.dumps(inc[0], indent=2)}")
        else:
            logger.warning("YFinance returned None or empty.")

    except Exception as e:
        logger.error(f"YFinance Error: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(main())
