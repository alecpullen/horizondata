#!/usr/bin/env python3
"""
Debug script to test direct connection to ASCOM Alpaca simulator
"""
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_alpaca_connection():
    """Test direct connection to Alpaca simulator"""
    alpaca_base = os.getenv('ALPACA_BASE', 'http://localhost:32323/api/v1/telescope/0')
    client_id = int(os.getenv('CLIENT_ID', '1'))
    
    print(f"Testing connection to: {alpaca_base}")
    print(f"Client ID: {client_id}")
    print("-" * 50)
    
    # Test 1: Basic connectivity
    try:
        # Try to reach the base URL without /api path
        base_host = alpaca_base.split('/api')[0]
        print(f"1. Testing basic connectivity to {base_host}...")
        response = requests.get(base_host, timeout=5)
        print(f"   ✓ Base host reachable (Status: {response.status_code})")
    except Exception as e:
        print(f"   ✗ Base host unreachable: {e}")
        return False
    
    # Test 2: API management endpoint
    try:
        mgmt_url = f"{base_host}/management/apiversions"
        print(f"2. Testing management API: {mgmt_url}")
        response = requests.get(mgmt_url, timeout=5)
        print(f"   ✓ Management API reachable (Status: {response.status_code})")
        if response.status_code == 200:
            print(f"   API versions: {response.json()}")
    except Exception as e:
        print(f"   ✗ Management API failed: {e}")
    
    # Test 3: Device discovery
    try:
        devices_url = f"{base_host}/management/v1/configureddevices"
        print(f"3. Testing device discovery: {devices_url}")
        response = requests.get(devices_url, timeout=5)
        print(f"   ✓ Device discovery reachable (Status: {response.status_code})")
        if response.status_code == 200:
            devices = response.json()
            print(f"   Found {len(devices)} devices:")
            for device in devices:
                print(f"     - {device.get('DeviceName', 'Unknown')} (Type: {device.get('DeviceType', 'Unknown')}, Number: {device.get('DeviceNumber', 'Unknown')})")
    except Exception as e:
        print(f"   ✗ Device discovery failed: {e}")
    
    # Test 4: Direct telescope connection test
    try:
        conn_url = f"{alpaca_base}/connected"
        params = {'ClientID': client_id, 'ClientTransactionID': 1}
        print(f"4. Testing telescope connection endpoint: {conn_url}")
        response = requests.get(conn_url, params=params, timeout=5)
        print(f"   ✓ Telescope endpoint reachable (Status: {response.status_code})")
        if response.status_code == 200:
            result = response.json()
            print(f"   Response: {result}")
            if 'ErrorNumber' in result and result['ErrorNumber'] != 0:
                print(f"   ✗ Alpaca Error: {result.get('ErrorMessage', 'Unknown error')}")
            else:
                print(f"   ✓ Telescope connected: {result.get('Value', 'Unknown')}")
        else:
            print(f"   ✗ HTTP Error: {response.text}")
    except Exception as e:
        print(f"   ✗ Telescope connection test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("ASCOM Alpaca Connection Debug Tool")
    print("=" * 50)
    
    success = test_alpaca_connection()
    
    print("\n" + "=" * 50)
    if success:
        print("✓ Basic connectivity tests passed!")
        print("If Flask API still fails, check the alpaca_client.py implementation.")
    else:
        print("✗ Connection tests failed!")
        print("\nTroubleshooting steps:")
        print("1. Make sure SimScope (or other Alpaca simulator) is running")
        print("2. Check if it's running on port 32323 (default)")
        print("3. Try accessing http://localhost:32323 in your browser")
        print("4. Verify the ALPACA_BASE URL in your .env file")
