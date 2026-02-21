
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_meta_fix():
    client = EdgarOwnershipClient()
    symbol = "META"
    
    print(f"--- Verifying META Fix (FB Alias) ---")
    
    # Step 1: EFTS Search (Recent)
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
    
    # Step 2: Test _parse_13f_holding with the top 5 hits
    print("\n[Step 2] Testing _parse_13f_holding...")
    
    success_count = 0
    for i, hit in enumerate(hits[:5]):
        print(f"\n--- Hit {i+1}: {hit['institution_name']} ---")
        
        # Call the method we just patched
        result = await client._parse_13f_holding(
            cik=hit["cik"],
            company_name=hit["institution_name"],
            form="13F-HR",
            filing_date=hit["filing_date"],
            accession_no=hit["accession_no"],
            target_ticker=symbol,
        )
        
        if result:
            print(f"✅ SUCCESS! Found {result['shares']} shares.")
            print(f"   Value: ${result['value_usd']}")
            success_count += 1
        else:
            print("❌ FAILED. Ticker not found.")

    print(f"\nSummary: {success_count}/5 successful parses.")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(verify_meta_fix())
