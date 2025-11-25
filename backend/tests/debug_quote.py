import FinanceDataReader as fdr
import pandas as pd
import datetime as dt
import traceback

def test_quote_logic():
    symbol = "005930"
    print(f"Testing quote logic for {symbol}...")
    
    try:
        target_symbol = symbol.split('.')[0]
        
        end_date = dt.datetime.now()
        start_date = end_date - dt.timedelta(days=7)
        
        print(f"Fetching from {start_date} to {end_date}")
        
        df = fdr.DataReader(target_symbol, start=start_date, end=end_date)
        
        if df is None or df.empty:
            print("Data is empty")
            return
            
        print("Data found:")
        print(df.tail())
        
        last = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else last
        
        print(f"Last: {last['Close']}, Prev: {prev['Close']}")
        
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_quote_logic()
