
import asyncio
import yfinance as yf
import json

async def main():
    symbol = "AAPL"
    print(f"--- Debugging {symbol} ---")
    
    # Check Info
    ticker = yf.Ticker(symbol)
    info = ticker.info
    print(f"Held Percent Institutions (raw): {info.get('heldPercentInstitutions')}")
    print(f"Held Percent Insiders (raw): {info.get('heldPercentInsiders')}")
    
    # Check Financials
    try:
        fin = ticker.quarterly_financials
        # fin is a DataFrame with columns as dates
        print("\n--- Quarterly Financials (Head) ---")
        # diluted EPS is usually "Diluted EPS" or similar index
        # Let's print index to see available rows
        print(fin.index)
        
        if "Diluted EPS" in fin.index:
            eps_row = fin.loc["Diluted EPS"]
            print("\nDiluted EPS row:")
            print(eps_row)
        elif "Basic EPS" in fin.index:
             print("\nBasic EPS row:", fin.loc["Basic EPS"])
             
    except Exception as e:
        print(f"Error fetching financials: {e}")

if __name__ == "__main__":
    asyncio.run(main())
