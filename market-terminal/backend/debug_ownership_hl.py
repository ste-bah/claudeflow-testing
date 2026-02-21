
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_hl_ownership_by_name():
    client = EdgarOwnershipClient()
    symbol = "HL"
    company_name_query = "HECLA MINING CO"
    
    print(f"--- Debugging Institutional Ownership for {symbol} (Search by Name: '{company_name_query}') ---")
    
    # Step 1: EFTS Search using Company Name
    print(f"\n[Step 1] Searching EFTS for '{company_name_query}'...")
    hits = await client._search_efts(
        company_name_query, 
        forms="13F-HR", 
        start_date="2025-01-01", 
        end_date="2026-12-31"
    )
    
    if not hits:
        print("!! No hits found via EFTS.")
        await client.close()
        return

    print(f"Found {len(hits)} hits.")
    
    # Step 2: Inspect hits
    print("\n[Step 2] Inspecting top hits...")
    
    client._ensure_identity()
    from edgar import Filing

    success_count = 0
    for i, hit in enumerate(hits[:5]):
        print(f"\n--- Hit {i+1}: {hit['institution_name']} ---")
        
        filing = Filing(
            cik=hit["cik"], 
            company=hit["institution_name"], 
            form="13F-HR",
            filing_date=hit["filing_date"], 
            accession_no=hit["accession_no"]
        )
        
        try:
            # We use the CLIENT'S parsing logic to see if it finds 'HL'
            result = await client._parse_13f_holding(
                cik=hit["cik"],
                company_name=hit["institution_name"],
                form="13F-HR",
                filing_date=hit["filing_date"],
                accession_no=hit["accession_no"],
                target_ticker=symbol, 
            )
            
            if result:
                print(f"✅ FOUND! {result['shares']} shares.")
                success_count += 1
            else:
                print("❌ Ticker 'HL' not found in this filing.")
                
                # Manual inspection to see what's there
                obj = filing.obj()
                if obj and hasattr(obj, "holdings"):
                    holdings = obj.holdings
                    # Check for partial matches or maybe the name is there but ticker is empty?
                    matches = holdings[holdings["Issuer"].astype(str).str.contains("HECLA", case=False, na=False)]
                    if not matches.empty:
                        print("   But found Issuer matches:")
                        print(matches[["Issuer", "Ticker", "Cusip"]].head())

        except Exception as e:
            print(f"Error: {e}")

    print(f"\nSummary: {success_count}/5 hits contained HL.")
    await client.close()

if __name__ == "__main__":
    asyncio.run(debug_hl_ownership_by_name())
