import yfinance as yf
import json
import sys

def main():
    symbol = "NVDA"
    print(f"--- Fetching financials for {symbol} (sync) ---")
    
    ticker = yf.Ticker(symbol)
    
    # Income Statement
    print("\n--- Income Statement ---")
    try:
        inc = ticker.quarterly_income_stmt
        if inc is not None and not inc.empty:
            # Columns are dates, Index are line items
            print(f"Columns (Dates): {[str(d) for d in inc.columns]}")
            print(f"Index (Keys): {list(inc.index)}")
            
            # Sample value for first date
            first_date = inc.columns[0]
            print(f"\nSample Data for {first_date}:")
            for idx in inc.index:
                val = inc.loc[idx, first_date]
                print(f"  {idx}: {val}")
        else:
            print("Income Statement is empty.")
    except Exception as e:
        print(f"Error fetching Income Statement: {e}")

if __name__ == "__main__":
    main()
