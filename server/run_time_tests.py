#!/usr/bin/env python3
"""
Simple test runner for TimeService tests
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    # Try to import and run the tests
    from tests.test_time_service import TestTimeService
    import unittest
    
    if __name__ == '__main__':
        # Create a test suite
        suite = unittest.TestLoader().loadTestsFromTestCase(TestTimeService)
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)
        
        # Exit with appropriate code
        sys.exit(0 if result.wasSuccessful() else 1)
        
except ImportError as e:
    print(f"Cannot run tests due to missing dependencies: {e}")
    print("Please install required packages: pip install pytz astropy")
    sys.exit(1)