import FinanceDataReader as fdr
import pandas as pd
import datetime as dt

def test_fdr():
    symbol = "005930"
    print(f"Testing FinanceDataReader for {symbol}...")
    
    try:
        end_date = dt.datetime.now()
        start_date = end_date - dt.timedelta(days=30)
        
        df = fdr.DataReader(symbol, start=start_date, end=end_date)
        
        if df is None or df.empty:
            print("Result is empty.")
        else:
            print(f"Success! Got {len(df)} rows.")
            print(df.head())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fdr()
