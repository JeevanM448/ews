import httpx
import os
from typing import Dict, Any

API_KEY = os.getenv("OPENAQ_API_KEY")

async def fetch_aqi_data(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch real-time air quality from OpenAQ API."""
    if not API_KEY:
        # Fallback mock data if API key is missing
        return {
            "coord": {"lon": lon, "lat": lat},
            "aqi": 2,
            "components": {
                "pm2_5": 30, 
                "pm10": 45, 
                "no2": 15, 
                "o3": 25,
                "co": 250
            },
            "main": {"aqi": 2},
            "status": "Moderate",
            "mock": True
        }

    url = f"https://api.openaq.org/v2/locations?coordinates={lat},{lon}&radius=10000&limit=1"
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data["results"]:
                # Simplify the response structure
                # For demo, using just raw structure or trying to parse it
                return data["results"][0]
            else:
                return {
                    "coord": {"lon": lon, "lat": lat},
                    "aqi": 3,
                    "status": "Unknown",
                    "components": {},
                    "error": "No data found for location"
                }
        except httpx.HTTPError as e:
            print(f"Error fetching AQI data: {e}")
            return {
                "coord": {"lon": lon, "lat": lat}, 
                "aqi": 0,
                "status": "Unknown",
                "components": {},
                "error": str(e)
            }
