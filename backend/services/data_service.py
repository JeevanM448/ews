from datetime import datetime
from backend.services.weather_api import fetch_weather_data
from backend.services.aqi_api import fetch_aqi_data
import logging

logger = logging.getLogger(__name__)

async def get_environmental_data(lat: float, lon: float):
    """
    Fetches and aggregates comprehensive environmental data.
    Features: Weather (temp, feels_like, humidity, wind, rain, UV),
              Air Quality (PM2.5, PM10, NO2, O3),
              Time-based (hour, day, averages).
    """
    try:
        # Fetch data
        weather_data = await fetch_weather_data(lat, lon)
        aqi_data = await fetch_aqi_data(lat, lon)
        
        # 1. Weather Features
        main_weather = weather_data.get("main", {})
        temp = main_weather.get("temp", 0)
        
        weather_features = {
            "temperature": temp,
            "feels_like": main_weather.get("feels_like", temp),
            "humidity": main_weather.get("humidity", 0),
            "wind_speed": weather_data.get("wind", {}).get("speed", 0),
            "rainfall": weather_data.get("rain", {}).get("1h", 0),
            "uv_index": weather_data.get("uvi", 0),
            "temp_min": main_weather.get("temp_min", temp),
            "temp_max": main_weather.get("temp_max", temp)
        }
        
        # 2. Air Quality Features
        comps = aqi_data.get("components", {})
        # Fallback logic for various API response styles
        pm25 = comps.get("pm2_5", comps.get("pm25", aqi_data.get("pm25", 0)))
        pm10 = comps.get("pm10", 0)
        no2 = comps.get("no2", 0)
        o3 = comps.get("o3", 0)
        
        aqi_features = {
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "o3": o3
        }
        
        # 3. Time-based Features
        now = datetime.now()
        
        # Placeholder for real historical data (requires DB or historical API)
        # We simulate these based on current values for now
        simulated_3d_avg = round(temp * 0.98, 1) # Simulation
        simulated_7d_rain = round(weather_features["rainfall"] * 2.5, 1)

        time_features = {
            "hour_of_day": now.hour,
            "day_of_week": now.weekday(), # 0=Monday, 6=Sunday
            "3_day_temp_avg": simulated_3d_avg,
            "7_day_rain_total": simulated_7d_rain
        }

        # Aggregate Result
        result = {
            **weather_features,
            **aqi_features,
            **time_features,
            "location_name": weather_data.get("name", "Unknown"),
            "raw_weather": weather_data,
            "raw_aqi": aqi_data
        }

        return result
        
    except Exception as e:
        logger.error(f"Error in data service: {e}")
        return {
            "temperature": 0, 
            "humidity": 0, 
            "pm25": 0, 
            "error": str(e)
        }
