
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_hl_fix_public_api():
    client = EdgarOwnershipClient()
    symbol = "HL"
    
    print(f"--- Verifying HL Fix via Public API ---")
    print(f"Calling get_institutional_holders('{symbol}')...")
    
    try:
        # This calls the method we just modified
        result = await client.get_institutional_holders(symbol, quarters=4)
        
        if result:
            cached = result.get("_cached", False)
            print(f"Result returned (cached={cached})")
            
            holders = result.get("holders", [])
            print(f"Holders found: {len(holders)}")
            
            if holders:
                print("Top 3 holders:")
                for h in holders[:3]:
                    print(f" - {h['holder_name']}: {h['shares']} shares")
                print("✅ SUCCESS! Full flow working.")
            else:
                print("⚠️  Result returned but 'holders' list is empty.")
        else:
            print("❌ FAILED. get_institutional_holders returned None.")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

    await client.close()

if __name__ == "__main__":
    asyncio.run(verify_hl_fix_public_api())
