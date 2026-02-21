
import asyncio
import logging
import sys
import os
import yfinance as yf

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO)

def check_yfinance_cusip():
    tickers = ["META", "AAPL", "MSFT", "TSLA"]
    print("--- Checking yfinance CUSIPs ---")
    
    for t in tickers:
        try:
            tick = yf.Ticker(t)
            info = tick.info
            cusip = info.get("cusip")
            print(f"{t}: {cusip}")
        except Exception as e:
            print(f"{t}: Error {e}")

if __name__ == "__main__":
    check_yfinance_cusip()
