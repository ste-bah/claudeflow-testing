
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_meta_ownership():
    client = EdgarOwnershipClient()
    symbol = "META"
    
    print(f"--- Debugging Institutional Ownership for {symbol} (Recent) ---")
    
    # Step 1: EFTS Search RECENT
    print("\n[Step 1] Searching EFTS (2025-01-01 to Present)...")
    hits = await client._search_efts(
        symbol, 
        forms="13F-HR", 
        start_date="2025-01-01", 
        end_date="2026-12-31"
    )
    
    if not hits:
        print("!! No hits found via EFTS.")
        await client.close()
        return

    print(f"Found {len(hits)} hits.")
    
    # Inspect the first VALID hit
    # Use edgar tools
    client._ensure_identity()
    from edgar import Filing

    for i, hit in enumerate(hits[:3]):
        print(f"\n--- Inspecting Hit {i+1}: {hit['institution_name']} (CIK: {hit['cik']}) ---")
        print(f"Accession: {hit['accession_no']}")
        print(f"Filing Date: {hit['filing_date']}")

        filing = Filing(
            cik=hit["cik"], 
            company=hit["institution_name"], 
            form="13F-HR",
            filing_date=hit["filing_date"], 
            accession_no=hit["accession_no"]
        )
        
        try:
            print("Downloading filing object...")
            obj = filing.obj()
            if obj is None:
                print("Filing object is None")
                continue

            holdings = getattr(obj, "holdings", None)
            if holdings is None:
                print("No 'holdings' attribute")
                continue
                
            print(f"Holdings Rows: {len(holdings)}")
            
            # Check for META or FB
            meta_rows = holdings[holdings["Ticker"] == "META"]
            fb_rows = holdings[holdings["Ticker"] == "FB"]
            
            print(f"Rows with Ticker='META': {len(meta_rows)}")
            print(f"Rows with Ticker='FB': {len(fb_rows)}")
            
            if len(meta_rows) > 0:
                print("SAMPLE META ROW:")
                print(meta_rows.iloc[0])
            
            if len(fb_rows) > 0:
                print("SAMPLE FB ROW:")
                print(fb_rows.iloc[0])

        except Exception as e:
            print(f"Error parsing: {e}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(debug_meta_ownership())
