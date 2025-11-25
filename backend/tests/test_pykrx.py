try:
    from pykrx import stock
    import datetime as dt
    print("pykrx is installed")
    
    symbol = "005930"
    today = dt.datetime.now().strftime("%Y%m%d")
    # Use yesterday/today for test (hardcoded 2024 for safety if system time is wrong)
    start_date = "20241121"
    end_date = "20241122"
    
    print(f"Fetching minute data for {symbol} from {start_date} to {end_date}")
    
    # pykrx doesn't support minute data directly via get_market_ohlcv usually (it's daily)
    # But let's check documentation or common usage if I can recall
    # Actually pykrx is mostly for daily/fundamental data from KRX.
    
    # Let's try get_market_ohlcv
    df = stock.get_market_ohlcv(start_date, end_date, symbol)
    print("Daily data:")
    print(df.head())
    
except ImportError:
    print("pykrx is NOT installed")
except Exception as e:
    print(f"pykrx error: {e}")
