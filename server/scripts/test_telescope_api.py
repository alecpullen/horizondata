#!/usr/bin/env python3
"""
Test script for telescope API endpoints
Run this script to test all telescope control functionality
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:8080/api/telescope"

def make_request(method, endpoint, data=None):
    """Make HTTP request and handle response"""
    url = f"{BASE_URL}/{endpoint}"
    
    try:
        if method == 'GET':
            response = requests.get(url)
        elif method == 'POST':
            response = requests.post(url, json=data)
        
        print(f"\n{method} {endpoint}")
        if data:
            print(f"Request: {json.dumps(data, indent=2)}")
        
        print(f"Status: {response.status_code}")
        
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            return result
        except:
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to {url}")
        print("Make sure the telescope service is running on port 8080")
        return None
    except Exception as e:
        print(f"ERROR: {e}")
        return None

def test_telescope_workflow():
    """Test complete telescope workflow"""
    print("=== Telescope API Test ===")
    
    # 1. Get initial status
    print("\n1. Getting initial status...")
    status = make_request('GET', 'status')
    if not status:
        return False
    
    # 2. Connect telescope
    print("\n2. Connecting telescope...")
    result = make_request('POST', 'connect', {'connected': True})
    if not result or not result.get('connected'):
        print("Failed to connect telescope")
        return False
    
    # 3. Enable tracking
    print("\n3. Enabling tracking...")
    result = make_request('POST', 'tracking', {'on': True})
    if not result or not result.get('tracking'):
        print("Failed to enable tracking")
        return False
    
    # 4. Unpark telescope
    print("\n4. Unparking telescope...")
    result = make_request('POST', 'park', {'action': 'unpark'})
    if not result:
        return False
    
    # 5. Slew to coordinates
    print("\n5. Slewing to RA/Dec coordinates...")
    result = make_request('POST', 'slew/coords', {'ra': 6.75, 'dec': -16.7})
    if not result:
        return False
    
    # Wait a moment for slew
    time.sleep(2)
    
    # 6. Slew to Alt/Az coordinates
    print("\n6. Slewing to Alt/Az coordinates...")
    result = make_request('POST', 'slew/altaz', {'az': 180.0, 'alt': 45.0})
    if not result:
        return False
    
    # 7. Get final status
    print("\n7. Getting final status...")
    status = make_request('GET', 'status')
    
    # 8. Park telescope
    print("\n8. Parking telescope...")
    result = make_request('POST', 'park', {'action': 'park'})
    
    # 9. Disconnect
    print("\n9. Disconnecting telescope...")
    result = make_request('POST', 'connect', {'connected': False})
    
    print("\n=== Test Complete ===")
    return True

def test_error_conditions():
    """Test error handling"""
    print("\n=== Error Condition Tests ===")
    
    # Test slewing without connection
    print("\n1. Testing slew without connection...")
    make_request('POST', 'slew/coords', {'ra': 12.0, 'dec': 0.0})
    
    # Connect first
    make_request('POST', 'connect', {'connected': True})
    
    # Test slewing without tracking
    print("\n2. Testing slew without tracking...")
    make_request('POST', 'slew/coords', {'ra': 12.0, 'dec': 0.0})
    
    # Enable tracking but keep parked
    make_request('POST', 'tracking', {'on': True})
    
    # Test slewing while parked
    print("\n3. Testing slew while parked...")
    make_request('POST', 'slew/coords', {'ra': 12.0, 'dec': 0.0})
    
    # Test invalid coordinates
    make_request('POST', 'park', {'action': 'unpark'})
    print("\n4. Testing invalid coordinates...")
    make_request('POST', 'slew/coords', {'ra': 25.0, 'dec': 0.0})  # Invalid RA
    make_request('POST', 'slew/coords', {'ra': 12.0, 'dec': 95.0})  # Invalid Dec
    
    # Cleanup
    make_request('POST', 'connect', {'connected': False})

if __name__ == "__main__":
    print("Telescope API Test Script")
    print("Make sure:")
    print("1. ASCOM Alpaca simulator is running (e.g., SimScope on port 32323)")
    print("2. Telescope service is running (docker-compose up -d) on port 8080")
    print("\nPress Enter to continue or Ctrl+C to exit...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
    
    # Run main workflow test
    success = test_telescope_workflow()
    
    if success:
        print("\nRunning error condition tests...")
        test_error_conditions()
    
    print("\nTest script completed!")
