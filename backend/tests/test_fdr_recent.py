import FinanceDataReader as fdr
import pandas as pd
import datetime as dt

def test_fdr_recent():
    symbol = "005930"
    print(f"Testing FinanceDataReader for {symbol} (Recent)...")
    
    end_date = dt.datetime.now()
    # Try 1 day range
    start_date_1 = end_date - dt.timedelta(days=1)
    print(f"Requesting 1 day: {start_date_1} ~ {end_date}")
    
    try:
        df = fdr.DataReader(symbol, start=start_date_1, end=end_date)
        if df is None or df.empty:
            print("1 day result is empty.")
        else:
            print(f"1 day success! Got {len(df)} rows.")
            print(df)
            
    except Exception as e:
        print(f"1 day error: {e}")
        
    # Try 5 days range
    start_date_5 = end_date - dt.timedelta(days=5)
    print(f"Requesting 5 days: {start_date_5} ~ {end_date}")
    
    try:
        df = fdr.DataReader(symbol, start=start_date_5, end=end_date)
        if df is None or df.empty:
            print("5 days result is empty.")
        else:
            print(f"5 days success! Got {len(df)} rows.")
            print(df)
            
    except Exception as e:
        print(f"5 days error: {e}")

if __name__ == "__main__":
    test_fdr_recent()
