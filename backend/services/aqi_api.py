import httpx
import os
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

API_KEY = os.getenv("OPENAQ_API_KEY")

async def fetch_aqi_data(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch real-time air quality from OpenAQ API."""
    # Note: OpenAQ is a public data aggregator. 
    # v2/locations?coordinates=lat,lon finds the nearest station within range.
    
    url = f"https://api.openaq.org/v2/latest?coordinates={lat},{lon}&radius=100000&limit=1"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get("results") and len(data["results"]) > 0:
                    result = data["results"][0]
                    measurements = {m["parameter"]: m["value"] for m in result.get("measurements", [])}
                    
                    # Map OpenAQ parameters to our internal structure
                    # Parameter names in OpenAQ: pm25, pm10, no2, o3, etc.
                    return {
                        "pm25": measurements.get("pm25", 0),
                        "pm10": measurements.get("pm10", 0),
                        "no2": measurements.get("no2", 0),
                        "o3": measurements.get("o3", 0),
                        "location_name": result.get("location", "Nearby Station"),
                        "city": result.get("city"),
                        "source": "OpenAQ"
                    }
            
            logger.warning(f"OpenAQ returned {response.status_code} or empty results for {lat},{lon}")
            return _get_mock_aqi(lat, lon)
            
        except Exception as e:
            logger.error(f"Error fetching OpenAQ data: {e}")
            return _get_mock_aqi(lat, lon)

def _get_mock_aqi(lat: float, lon: float) -> Dict[str, Any]:
    """Fallback mock data if API fails or yields no results."""
    return {
        "pm25": 12.5,
        "pm10": 20.1,
        "no2": 5.4,
        "o3": 22.8,
        "location_name": "Simulated Station",
        "mock": True
    }
