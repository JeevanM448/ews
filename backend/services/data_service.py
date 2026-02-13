from datetime import datetime
from backend.services.weather_api import fetch_weather_data
from backend.services.aqi_api import fetch_aqi_data
import logging
import math
from backend.utils.feature_engineering import feature_engineer

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
        
        # Simulated historical data inputs
        mock_temp_history = [temp * (1 + 0.05 * math.sin(i)) for i in range(3)]
        mock_rain_history = [weather_features["rainfall"] * (1 + 0.2 * i) for i in range(7)]

        avg_3d = feature_engineer.calculate_3day_temp_avg(mock_temp_history)
        rain_7d = feature_engineer.calculate_7day_rainfall_total(mock_rain_history)
        heat_idx = feature_engineer.compute_heat_index(temp, weather_features["humidity"])

        time_features = {
            "hour_of_day": now.hour,
            "day_of_week": now.weekday(),
            "3_day_temp_avg": avg_3d,
            "7_day_rain_total": rain_7d,
            "heat_index": heat_idx
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
