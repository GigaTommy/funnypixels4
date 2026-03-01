
import requests
import json

BASE_URL = "http://localhost:3000/api"

def login(username, password):
    url = f"{BASE_URL}/auth/login"
    payload = {"username": username, "password": password}
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Login failed: {e}")
        if response:
            print(f"Response: {response.text}")
        return None

def check_endpoint(token, endpoint, method="GET"):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        else:
            response = requests.post(url, headers=headers)
        
        print(f"\n--- Checking {endpoint} ---")
        print(f"Status: {response.status_code}")
        try:
            data = response.json()
            print(f"JSON Response keys: {list(data.keys())}")
            print(f"Has 'success' key? {'YES' if 'success' in data else 'NO'}")
            # print(json.dumps(data, indent=2))
        except:
            print(f"Raw Response: {response.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")

def main():
    # Login to get token (replace with checks)
    # Assuming local backend is running.
    # If not running, I cannot test. 
    # But clearly the user is running the app against SOME backend.
    
    print("This script helps verify backend response structure.")
    print("Please manually verify if the backend is running and reachable.")

if __name__ == "__main__":
    main()
