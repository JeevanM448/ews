import httpx
import os
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

API_KEY = os.getenv("OPENWEATHER_API_KEY")

async def fetch_weather_data(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch real-time weather data from OpenWeather API."""
    if not API_KEY:
        # Fallback mock data if API key is missing
        return {
            "coord": {"lon": lon, "lat": lat},
            "weather": [{"main": "Clear", "description": "clear sky"}],
            "main": {"temp": 25.0, "feels_like": 26.5, "humidity": 60, "temp_min": 22.0, "temp_max": 28.0},
            "wind": {"speed": 5.0},
            "rain": {"1h": 0.5},
            "uvi": 6.5,
            "name": "Local Area",
            "mock": True
        }

    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            # In free tier, we might need separate call for UVI or use OneCall if available
            # For now, we'll try to get what we can from current weather
            response.raise_for_status()
            data = response.json()
            
            # If UVI is missing (standard on free tier current weather), we add a mock/default
            if "uvi" not in data:
                data["uvi"] = 5.0 
            
            return data
        except httpx.HTTPError as e:
            logger.error(f"Error fetching weather data: {e}")
            return {
                "coord": {"lon": lon, "lat": lat},
                "weather": [{"main": "Unknown", "description": "data unavailable"}],
                "main": {"temp": 0, "feels_like": 0, "humidity": 0},
                "wind": {"speed": 0},
                "rain": {"1h": 0},
                "uvi": 0,
                "error": str(e)
            }
