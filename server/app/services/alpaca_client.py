import requests
import time
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)

class AlpacaClient:
    """Client for communicating with ASCOM Alpaca telescope simulator"""
    
    def __init__(self, base_url: str, client_id: int = 1):
        self.base_url = base_url.rstrip('/')
        self.client_id = client_id
        self._transaction_id = 0
        
    def _get_next_transaction_id(self) -> int:
        """Get monotonically increasing transaction ID"""
        self._transaction_id += 1
        return self._transaction_id
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to Alpaca API with retry logic"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        logger.info(f"Making {method} request to: {url}")
        
        # Prepare common parameters
        params = {
            'ClientID': self.client_id,
            'ClientTransactionID': self._get_next_transaction_id()
        }
        
        if data:
            params.update(data)
        
        logger.debug(f"Request parameters: {params}")
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, params=params, timeout=10)
            elif method.upper() == 'PUT':
                # Alpaca requires form-encoded data for PUT requests
                response = requests.put(url, data=params, timeout=10)
            else:
                response = requests.request(method, url, json=params, timeout=10)
            
            logger.info(f"Response status: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            logger.debug(f"Response data: {result}")
            
            # Check for Alpaca-specific errors
            if 'ErrorNumber' in result and result['ErrorNumber'] != 0:
                error_msg = result.get('ErrorMessage', 'Unknown Alpaca error')
                logger.error(f"Alpaca error {result['ErrorNumber']}: {error_msg}")
                raise AlpacaError(result['ErrorNumber'], error_msg)
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"Request failed to {url}: {e}")
            logger.error(f"Request method: {method}, params: {params}")
            raise AlpacaConnectionError(f"Failed to communicate with telescope at {url}: {e}")
    
    def get_connected(self) -> bool:
        """Get telescope connection status"""
        result = self._make_request('GET', 'connected')
        return result.get('Value', False)
    
    def set_connected(self, connected: bool) -> None:
        """Set telescope connection status"""
        self._make_request('PUT', 'connected', {'Connected': connected})
    
    def get_tracking(self) -> bool:
        """Get telescope tracking status"""
        result = self._make_request('GET', 'tracking')
        return result.get('Value', False)
    
    def set_tracking(self, tracking: bool) -> None:
        """Set telescope tracking status"""
        self._make_request('PUT', 'tracking', {'Tracking': tracking})
    
    def get_parked(self) -> bool:
        """Get telescope park status"""
        result = self._make_request('GET', 'atpark')
        return result.get('Value', False)
    
    def park(self) -> None:
        """Park the telescope"""
        self._make_request('PUT', 'park')
    
    def unpark(self) -> None:
        """Unpark the telescope"""
        self._make_request('PUT', 'unpark')
    
    def get_slewing(self) -> bool:
        """Get telescope slewing status"""
        result = self._make_request('GET', 'slewing')
        return result.get('Value', False)
    
    def abort_slew(self) -> None:
        """Abort current slew operation"""
        self._make_request('PUT', 'abortslew')
    
    def get_coordinates(self) -> Dict[str, float]:
        """Get current telescope coordinates"""
        ra_result = self._make_request('GET', 'rightascension')
        dec_result = self._make_request('GET', 'declination')
        az_result = self._make_request('GET', 'azimuth')
        alt_result = self._make_request('GET', 'altitude')
        
        return {
            'ra': ra_result.get('Value', 0.0),
            'dec': dec_result.get('Value', 0.0),
            'az': az_result.get('Value', 0.0),
            'alt': alt_result.get('Value', 0.0)
        }
    
    def slew_to_coordinates(self, ra: float, dec: float) -> None:
        """Slew telescope to RA/Dec coordinates"""
        self._make_request('PUT', 'slewtocoordinates', {
            'RightAscension': ra,
            'Declination': dec
        })
    
    def slew_to_altaz(self, az: float, alt: float) -> None:
        """Slew telescope to Alt/Az coordinates"""
        self._make_request('PUT', 'slewtoaltaz', {
            'Azimuth': az,
            'Altitude': alt
        })
    
    def wait_for_slew_complete(self, timeout: int = 10) -> bool:
        """Wait for slew to complete, returns True if completed, False if timeout"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if not self.get_slewing():
                return True
            time.sleep(0.5)
        return False


class AlpacaError(Exception):
    """Exception for Alpaca-specific errors"""
    def __init__(self, error_number: int, message: str):
        self.error_number = error_number
        self.message = message
        super().__init__(f"Alpaca Error {error_number}: {message}")


class AlpacaConnectionError(Exception):
    """Exception for connection errors"""
    pass
