import requests
import time

def test_quote_api():
    url = "http://localhost:8000/api/market/quote?symbol=005930"
    print(f"Testing Quote API: {url}")
    
    for i in range(5):
        try:
            response = requests.get(url)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print("Success!")
                print(data)
                return
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Exception: {e}")
        
        print("Retrying in 2 seconds...")
        time.sleep(2)

if __name__ == "__main__":
    test_quote_api()
