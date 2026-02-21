
import asyncio
import logging
import sys
import os

# Ensure backend directory is in path
from edgar import Company

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.data.edgar_ownership import EdgarOwnershipClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_company_lookup():
    symbol = "HL"
    print(f"Resolving {symbol}...")
    try:
        from edgar import set_identity
        set_identity("MarketTerminal stevenbahia@gmail.com")
        c = Company(symbol)
        print(f"Company: {c}")
        print(f"Name: {c.name}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_company_lookup()
