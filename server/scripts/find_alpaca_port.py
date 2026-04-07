import requests
import time

def test_alpaca_ports():
    """Test common ASCOM Alpaca ports to find running simulator"""
    common_ports = [32323, 11111, 8080, 5555, 8000, 3000]
    
    print("🔍 Scanning for ASCOM Alpaca simulators...")
    print("=" * 50)
    
    found_simulators = []
    
    for port in common_ports:
        try:
            # Test basic connectivity
            response = requests.get(f"http://localhost:{port}", timeout=2)
            print(f"✅ Port {port}: Service responding")
            
            # Test if it's an Alpaca server
            try:
                alpaca_response = requests.get(f"http://localhost:{port}/api/v1/telescope/0/connected", timeout=2)
                print(f"   📡 Alpaca telescope API found on port {port}")
                found_simulators.append(port)
            except:
                print(f"   ℹ️  Service on port {port} but not Alpaca telescope")
                
        except requests.exceptions.RequestException:
            print(f"❌ Port {port}: No service")
    
    print("=" * 50)
    
    if found_simulators:
        print(f"🎯 Found ASCOM Alpaca simulators on ports: {found_simulators}")
        recommended_port = found_simulators[0]
        print(f"\n📝 Update your .env file:")
        print(f"ALPACA_BASE=http://localhost:{recommended_port}/api/v1/telescope/0")
    else:
        print("❌ No ASCOM Alpaca simulators found!")
        print("\n🔧 Make sure SimScope is running with Alpaca server enabled")

if __name__ == "__main__":
    test_alpaca_ports()
