
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO)

def test_sync():
    symbol = "AAPL"
    print(f"--- Testing Direct YFinance Sync for {symbol} (1h) ---")
    
    # Direct fetch
    df = yf.download(symbol, period="2y", interval="1h", progress=False)
    
    if df.empty:
        print("No data returned")
        return

    print(f"Returned {len(df)} rows")
    print(df.head())
    print(df.tail())
    
    # Check index
    print("\nIndex type:", type(df.index))
    print("First index:", df.index[0])
    
    # Check duplicate dates if we were to format them
    print("\nChecking formatting logic:")
    for idx in df.index[:5]:
        if hasattr(idx, "hour") and (idx.hour != 0 or idx.minute != 0 or idx.second != 0):
            print(f"Intraday: {idx.isoformat()}")
        else:
            print(f"Daily/Midnight: {idx.strftime('%Y-%m-%d')}")

if __name__ == "__main__":
    test_sync()
