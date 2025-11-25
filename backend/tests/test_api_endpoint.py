import requests
import time

def test_api():
    url = "http://localhost:8000/api/market/candles?symbol=005930&resolution=60&range_days=1"
    print(f"Testing API: {url}")
    
    for i in range(5):
        try:
            response = requests.get(url)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print("Success!")
                if 'data' in data and 'timestamps' in data['data']:
                    print(f"Data points: {len(data['data']['timestamps'])}")
                else:
                    print("Data format incorrect")
                return
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Exception: {e}")
        
        print("Retrying in 2 seconds...")
        time.sleep(2)

if __name__ == "__main__":
    test_api()
