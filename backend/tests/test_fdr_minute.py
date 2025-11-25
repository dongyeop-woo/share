import FinanceDataReader as fdr
import yfinance as yf
import requests
import pandas as pd
import datetime as dt

def test_fdr_minute():
    print("--- Testing FDR Minute Data ---")
    try:
        # FDR doesn't standardly support 'interval' for KRX, but let's check
        # Some versions might support it or it might just ignore it
        df = fdr.DataReader('005930', start='2024-11-20', end='2024-11-22')
        print(f"Default FDR (Daily): {len(df)} rows")
        print(df.head(2))
    except Exception as e:
        print(f"FDR Error: {e}")

def test_yfinance_minute():
    print("\n--- Testing yfinance Minute Data ---")
    try:
        # yfinance often fails for KRX, but let's try 1m
        ticker = yf.Ticker("005930.KS")
        df = ticker.history(period="5d", interval="1m")
        print(f"yfinance 1m: {len(df)} rows")
        if not df.empty:
            print(df.head(2))
        else:
            print("yfinance returned empty data")
    except Exception as e:
        print(f"yfinance Error: {e}")

def test_naver_minute():
    print("\n--- Testing Naver Mobile API Minute Data ---")
    symbol = "005930"
    # https://m.stock.naver.com/front-api/external/chart/domestic/info?symbol=005930&requestType=1&startTime=20241121&endTime=20241122&timeframe=1
    
    # System time is 2025, but real data is 2024. Hardcoding 2024 dates for test.
    end_str = "20241122"
    start_str = "20241121"
    
    url = f"https://m.stock.naver.com/front-api/external/chart/domestic/info?symbol={symbol}&requestType=1&startTime={start_str}&endTime={end_str}&timeframe=1"
    print(f"URL: {url}")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Data type: {type(data)}")
            if isinstance(data, list) and len(data) > 0:
                print(f"First item: {data[0]}")
                print(f"Last item: {data[-1]}")
                print(f"Total items: {len(data)}")
            else:
                print("Data is empty or not a list")
    except Exception as e:
        print(f"Naver API Error: {e}")

if __name__ == "__main__":
    test_fdr_minute()
    test_yfinance_minute()
    test_naver_minute()
