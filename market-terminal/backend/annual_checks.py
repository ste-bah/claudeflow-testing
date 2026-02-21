import yfinance as yf
import pandas as pd

def check_annual(symbol):
    print(f"Checking {symbol}...")
    try:
        ticker = yf.Ticker(symbol, session=None)
        # Force a request
        inc = ticker.income_stmt
        print(f"\n--- Annual Income Statement for {symbol} ---")
        if inc is not None and not inc.empty:
            print(inc.head())
            print(f"Columns (Dates): {inc.columns.tolist()}")
            if "Diluted EPS" in inc.index:
                print(f"Diluted EPS row:\n{inc.loc['Diluted EPS']}")
            else:
                print("Diluted EPS not found in index.")
        else:
            print("No annual income statement found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_annual("AAPL")
