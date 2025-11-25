
import pandas as pd
import requests

def get_orderbook(symbol):
    url = f"https://finance.naver.com/item/sise.naver?code={symbol}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        # Use requests to get the content first to avoid 403
        response = requests.get(url, headers=headers)
        dfs = pd.read_html(response.text)
        
        print(f"Found {len(dfs)} tables")
        
        # Table 3 seems to be the orderbook
        if len(dfs) > 3:
            df = dfs[3]
            print("Full Table 3:")
            print(df.to_string())
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_orderbook("005930") # Samsung Electronics
