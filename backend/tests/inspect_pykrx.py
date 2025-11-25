from pykrx import stock
import inspect

def inspect_pykrx():
    print("--- Inspecting pykrx.stock ---")
    functions = [o[0] for o in inspect.getmembers(stock, inspect.isfunction)]
    
    print(f"Found {len(functions)} functions.")
    
    # Filter for interesting names
    interesting = [f for f in functions if 'tick' in f or 'minute' in f or 'time' in f or 'intraday' in f]
    print("Interesting functions:", interesting)
    
    # Also check for get_market_ohlcv parameters
    print("\nChecking get_market_ohlcv signature:")
    try:
        sig = inspect.signature(stock.get_market_ohlcv)
        print(sig)
    except Exception as e:
        print(f"Could not get signature: {e}")

if __name__ == "__main__":
    inspect_pykrx()
