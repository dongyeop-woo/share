import requests
import ast
import pandas as pd
import datetime as dt

def test_naver_minute_parsing():
    print("--- Testing Naver API Minute Data Parsing ---")
    symbol = "005930"
    
    # Requesting 1-minute data
    # timeframe=1 (1 minute)
    # requestType=1
    # startTime/endTime format: YYYYMMDD
    
    # System time is 2025, but real data is 2024. Hardcoding 2024 dates for test.
    end_str = "20241122"
    start_str = "20241121"
    
    for req_type in [0, 1, 2]:
        print(f"\nTesting requestType={req_type}...")
        url = f"https://api.finance.naver.com/siseJson.naver?symbol={symbol}&requestType={req_type}&startTime={start_str}&endTime={end_str}&timeframe=1"
        print(f"URL: {url}")
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                raw_text = response.text.strip()
                print(f"Raw text preview: {raw_text[:100]}")
                if "Validation Failed" not in raw_text:
                    print("SUCCESS? Validation Failed not found.")
            
            # Naver returns string with single quotes, e.g. [['Date', ...], ['2021...', ...]]
            # This is valid Python literal syntax
            try:
                data = ast.literal_eval(raw_text)
                print(f"Successfully parsed! Type: {type(data)}")
                print(f"Length: {len(data)}")
                
                if len(data) > 1:
                    columns = data[0]
                    print(f"Columns: {columns}")
                    print(f"First data row: {data[1]}")
                    
                    # Convert to DataFrame for easier handling
                    df = pd.DataFrame(data[1:], columns=columns)
                    print("\nDataFrame Head:")
                    print(df.head())
                    
                    # Check timestamp format
                    # '날짜' column usually has 'YYYYMMDDHHMMSS' or similar
                    first_date = df['날짜'].iloc[0]
                    print(f"\nSample Date format: {first_date} (Type: {type(first_date)})")
                    
            except Exception as e:
                print(f"Parsing error: {e}")
                
        except Exception as e:
            print(f"Request error: {e}")

if __name__ == "__main__":
    test_naver_minute_parsing()
