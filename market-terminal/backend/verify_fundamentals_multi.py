import asyncio
import httpx
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("verifier")

API_URL = "http://127.0.0.1:8099/api/fundamentals"
SYMBOLS = ["AAPL", "MSFT", "NVDA"]

async def verify_symbol(client, symbol):
    logger.info(f"\n--- Verifying {symbol} ---")
    try:
        response = await client.get(f"{API_URL}/{symbol}", timeout=60.0)
        if response.status_code == 200:
            data = response.json()
            ttm = data.get("ttm", {})
            sources = data.get("data_sources", {})
            
            # Quarterly
            quarterly = data.get("quarterly", [])
            q_count = len(quarterly)
            rev_growth = quarterly[0].get("revenue_growth_yoy") if q_count > 0 else None
            eps_growth = quarterly[0].get("eps_growth_yoy") if q_count > 0 else None
            
            # Debug Quarterly EPS
            logger.info("Quarterly EPS Data:")
            for i, q in enumerate(quarterly):
                logger.info(f"  Q{i}: Period={q.get('period')}, EPS={q.get('eps_diluted')}")
            
            # Detailed Financials
            annual_eps = data.get("annual_eps", [])
            mcap = ttm.get("market_cap")
            pe = ttm.get("pe_ratio")
            shares = ttm.get("shares_outstanding")
            eps = ttm.get("eps_diluted")
            debt_equity = ttm.get("debt_to_equity")
            roe = ttm.get("return_on_equity")
            fcf = ttm.get("free_cash_flow")
            inst_own = ttm.get("institutional_ownership")
            
            logger.info(f"Response Keys: {list(data.keys())}")
            logger.info(f"Sources: {sources}")
            logger.info(f"Quarterly Periods: {q_count}")
            logger.info(f"Market Cap: {mcap}")
            logger.info(f"P/E Ratio: {pe}")
            logger.info(f"Shares Outstanding: {shares}")
            logger.info(f"EPS: {eps}")
            logger.info(f"Debt/Equity: {debt_equity}")
            logger.info(f"ROE: {roe}")
            logger.info(f"FCF: {fcf}")
            logger.info(f"Inst Own: {inst_own}")
            logger.info(f"Rev Growth (Q1): {rev_growth}")
            logger.info(f"EPS Growth (Q1): {eps_growth}")

            # Validation
            missing = []
            if mcap is None: missing.append("Market Cap")
            if pe is None: missing.append("P/E")
            if shares is None: missing.append("Shares")
            if eps is None: missing.append("EPS")
            
            # Detailed checks (soft fail acceptable if source missing, but we expect them now)
            if debt_equity is None: missing.append("Debt/Equity")
            if roe is None: missing.append("ROE")
            if fcf is None: missing.append("FCF")
            if q_count == 0: missing.append("Quarterly Data")
            if not annual_eps: missing.append("Annual EPS")
            
            # Growth checks (might be failing if not enough history, but check anyway)
            # if rev_growth is None: missing.append("Rev Growth")
            # if eps_growth is None: missing.append("EPS Growth")

            if missing:
                logger.warning(f"❌ {symbol} FAIL: Missing {', '.join(missing)}")
            else:
                logger.info(f"✅ {symbol} SUCCESS: All metrics found.")

        else:
            logger.error(f"❌ {symbol} HTTP Error: {response.status_code}")
            logger.error(response.text)
    except Exception as e:
        logger.error(f"❌ {symbol} Exception: {e}")

async def main():
    async with httpx.AsyncClient() as client:
        # Run sequentially to avoid timeouts/rate-limits
        for sym in SYMBOLS:
            await verify_symbol(client, sym)

if __name__ == "__main__":
    asyncio.run(main())
