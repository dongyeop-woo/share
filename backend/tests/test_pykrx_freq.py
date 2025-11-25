from pykrx import stock
import datetime as dt

def test_pykrx_freq():
    print("--- Testing pykrx frequency ---")
    symbol = "005930"
    start_date = "20240101"
    end_date = "20240201"
    
    print(f"Fetching with freq='m' (start={start_date}, end={end_date})")
    try:
        df = stock.get_market_ohlcv(start_date, end_date, symbol, "m")
        print(f"Rows: {len(df)}")
        print(df.head())
    except Exception as e:
        print(f"Error with freq='m': {e}")

    print("\nFetching with freq='t' (tick? minute?)")
    try:
        # Some libraries use 't' or '1m'
        df = stock.get_market_ohlcv("20241122", "20241122", symbol, "t")
        print(f"Rows: {len(df)}")
        print(df.head())
    except Exception as e:
        print(f"Error with freq='t': {e}")

if __name__ == "__main__":
    test_pykrx_freq()
