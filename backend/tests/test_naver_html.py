import pandas as pd
import requests

def test_naver_html():
    print("--- Testing Naver HTML Scraping (sise_time) ---")
    symbol = "005930"
    url = f"https://finance.naver.com/item/sise_time.nhn?code={symbol}&page=1"
    print(f"URL: {url}")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            # Naver Finance uses euc-kr
            response.encoding = 'euc-kr'
            
            print(f"Raw HTML preview (first 1000 chars):")
            print(response.text[:1000])
            
            # Look for specific data patterns
            if "체결시각" in response.text:
                print("Found '체결시각' in HTML")
            
            # Try to find a row with data
            # e.g. <span class="tah p11">15:30</span>
            if 'class="tah p11"' in response.text:
                print("Found data span class 'tah p11'")
    except Exception as e:
        print(f"Scraping error: {e}")

if __name__ == "__main__":
    test_naver_html()
