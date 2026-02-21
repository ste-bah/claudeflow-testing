
import yfinance as yf
import json

def test_info():
    ticker = yf.Ticker("AAPL")
    info = ticker.info
    print("Keys found:", list(info.keys()))
    print("heldPercentInstitutions:", info.get("heldPercentInstitutions"))
    print("institutionOwnership?", info.get("institutionOwnership"))
    # Save to file for inspection
    with open("yf_info_dump.json", "w") as f:
        json.dump(info, f, indent=2)

if __name__ == "__main__":
    test_info()
