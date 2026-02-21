
import requests
import json
import time

BASE_URL = "http://localhost:8000/api/analyze"
SYMBOL = "AAPL"

INTERVALS = ["8h", "12h", "6m", "1y", "5y"]

def verify_analysis():
    print(f"Verifying analysis for {SYMBOL}...")
    
    for interval in INTERVALS:
        print(f"\nTriggering analysis for interval: {interval}")
        try:
            # POST to trigger analysis
            payload = {
                "methodologies": ["sentiment"], # use simple methodology for speed
                "use_cache": False,
                "interval": interval
            }
            response = requests.post(f"{BASE_URL}/{SYMBOL}", json=payload)
            
            if response.status_code != 200:
                print(f"FAILED {interval}: Status {response.status_code}")
                try:
                    print(response.json())
                except:
                    print(response.text)
                continue
                
            data = response.json()
            composite = data.get("composite", {})
            print(f"SUCCESS {interval}: Analysis completed.")
            print(f"  Direction: {composite.get('overall_direction')}")
            
            # Check if timeframe breakdown mentions the interval? 
            # Not strictly returned in structure, but success means no crash.
            
            # Check metadata sources
            sources = data.get("metadata", {}).get("data_sources_used", [])
            print(f"  Sources: {sources}")
            
        except Exception as e:
            print(f"ERROR {interval}: {e}")

if __name__ == "__main__":
    verify_analysis()
