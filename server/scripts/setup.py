#!/usr/bin/env python3
"""
Automated setup script for the Telescope Control System
This script helps new users set up the project quickly and correctly.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_step(step, text):
    print(f"\n{step}. {text}")

def run_command(command, description):
    """Run a command and return success status"""
    try:
        print(f"   Running: {command}")
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"   ✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"   ✗ {description} failed: {e}")
        if e.stdout:
            print(f"   Output: {e.stdout}")
        if e.stderr:
            print(f"   Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"   ✗ Python {version.major}.{version.minor} detected. Python 3.8+ required.")
        return False
    print(f"   ✓ Python {version.major}.{version.minor} detected")
    return True

def setup_virtual_environment():
    """Create and activate virtual environment"""
    venv_path = Path("venv")
    
    if venv_path.exists():
        print("   ✓ Virtual environment already exists")
        return True
    
    if run_command("python -m venv venv", "Virtual environment creation"):
        print("   ✓ Virtual environment created")
        print("   📝 Remember to activate it:")
        if os.name == 'nt':  # Windows
            print("      venv\\Scripts\\activate")
        else:  # Linux/Mac
            print("      source venv/bin/activate")
        return True
    return False

def install_dependencies():
    """Install required Python packages"""
    if os.name == 'nt':  # Windows
        pip_command = "venv\\Scripts\\pip install -r requirements.txt"
    else:  # Linux/Mac
        pip_command = "venv/bin/pip install -r requirements.txt"
    
    return run_command(pip_command, "Dependencies installation")

def setup_environment_file():
    """Create .env file from template"""
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if env_file.exists():
        print("   ✓ .env file already exists")
        return True
    
    if env_example.exists():
        shutil.copy(env_example, env_file)
        print("   ✓ .env file created from template")
        print("   📝 You may need to update the ALPACA_BASE URL based on your simulator")
        return True
    else:
        print("   ✗ .env.example not found")
        return False

def check_simulator_connection():
    """Test connection to telescope simulator"""
    print("   Testing telescope simulator connection...")
    if os.name == 'nt':  # Windows
        python_command = "venv\\Scripts\\python scripts/find_alpaca_port.py"
    else:  # Linux/Mac
        python_command = "venv/bin/python scripts/find_alpaca_port.py"
    
    try:
        result = subprocess.run(python_command, shell=True, capture_output=True, text=True, timeout=10)
        if "Found Alpaca server" in result.stdout:
            print("   ✓ Telescope simulator detected")
            return True
        else:
            print("   ⚠ No telescope simulator detected")
            print("   📝 Make sure to start SimScope or another ASCOM Alpaca simulator")
            return False
    except subprocess.TimeoutExpired:
        print("   ⚠ Simulator check timed out")
        return False
    except Exception as e:
        print(f"   ⚠ Could not check simulator: {e}")
        return False

def main():
    print_header("Telescope Control System Setup")
    print("This script will help you set up the telescope control system.")
    print("Make sure you have Python 3.8+ installed.")
    
    # Step 1: Check Python version
    print_step(1, "Checking Python version")
    if not check_python_version():
        print("\n❌ Setup failed: Incompatible Python version")
        sys.exit(1)
    
    # Step 2: Create virtual environment
    print_step(2, "Setting up virtual environment")
    if not setup_virtual_environment():
        print("\n❌ Setup failed: Could not create virtual environment")
        sys.exit(1)
    
    # Step 3: Install dependencies
    print_step(3, "Installing dependencies")
    if not install_dependencies():
        print("\n❌ Setup failed: Could not install dependencies")
        sys.exit(1)
    
    # Step 4: Setup environment file
    print_step(4, "Creating environment configuration")
    if not setup_environment_file():
        print("\n❌ Setup failed: Could not create .env file")
        sys.exit(1)
    
    # Step 5: Check simulator connection
    print_step(5, "Checking telescope simulator")
    simulator_ok = check_simulator_connection()
    
    # Final instructions
    print_header("Setup Complete!")
    
    if simulator_ok:
        print("✅ Everything is ready to go!")
    else:
        print("⚠️  Setup complete, but no telescope simulator detected.")
        print("   Download and run SimScope from: https://github.com/rmorgan001/SimScope")
    
    print("\n📋 Next steps:")
    print("   1. Activate virtual environment:")
    if os.name == 'nt':  # Windows
        print("      venv\\Scripts\\activate")
    else:  # Linux/Mac
        print("      source venv/bin/activate")
    
    print("   2. Start the Flask server:")
    print("      docker compose up --build")
    
    print("   3. Test the API:")
    print("      python scripts/test_telescope_api.py")
    
    if not simulator_ok:
        print("   4. Make sure SimScope is running before testing")
    
    print("\n🔧 Troubleshooting:")
    print("   - Run 'python scripts/find_alpaca_port.py' to find your simulator")
    print("   - Check the .env file for correct ALPACA_BASE URL")
    print("   - See README.md for detailed instructions")

if __name__ == "__main__":
    main()
