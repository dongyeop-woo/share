import yfinance as yf
import pandas as pd

def test_yfinance():
    symbol = "005930.KS"
    print(f"Testing yfinance for {symbol}...")
    
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1mo", interval="1d")
        
        if hist.empty:
            print("Result is empty.")
        else:
            print(f"Success! Got {len(hist)} rows.")
            print(hist.head())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_yfinance()
