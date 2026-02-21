import asyncio
import yfinance as yf
from app.data.finnhub_client import get_finnhub_client
from app.config import get_settings
from datetime import datetime, timedelta

async def main():
    ticker = "FET"
    print(f"--- Debugging {ticker} ---")
    
    # 1. Check yfinance
    yf_ticker = yf.Ticker(ticker)
    info = yf_ticker.info
    print(f"yfinance info: {info.get('longName')} ({info.get('quoteType')})")
    
    hist = yf_ticker.history(period="1mo")
    print(f"yfinance history (1mo): {len(hist)} bars")
    if len(hist) > 0:
        print(f"Price range: {hist['Low'].min()} - {hist['High'].max()}")
        print(f"Last bar price: {hist.iloc[-1]['Close']}")

    # 2. Check Finnhub News
    client = get_finnhub_client()
    if client.is_enabled:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        news = await client.get_company_news(ticker, start_date, end_date)
        if news is not None:
            print(f"Finnhub news articles: {len(news)}")
            if len(news) > 0:
                print(f"First news title: {news[0].get('headline')}")
        else:
            print("Finnhub news returned None")
    else:
        print("Finnhub API key not configured or client disabled")

if __name__ == "__main__":
    asyncio.run(main())
