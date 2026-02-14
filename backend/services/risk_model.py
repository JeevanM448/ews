import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def calculate_risk_score(weather: Dict, aqi_data: Dict) -> Dict[str, Any]:
    """Calculate environmental risk score based on weather and air quality."""
    
    score = 0
    factors = []
    
    # Weather factors
    temp = weather.get("main", {}).get("temp", 0)
    humidity = weather.get("main", {}).get("humidity", 0)
    wind_speed = weather.get("wind", {}).get("speed", 0)
    
    # AQI factors (Handling flattened OpenAQ or component structure)
    aqi_val = aqi_data.get("aqi")
    if aqi_val is None:
        # Infer a simple 1-5 aqi from PM2.5 if missing
        pm25 = aqi_data.get("pm25", aqi_data.get("components", {}).get("pm2_5", 0))
        if pm25 > 150: aqi_val = 5
        elif pm25 > 100: aqi_val = 4
        elif pm25 > 50: aqi_val = 3
        elif pm25 > 10: aqi_val = 2
        else: aqi_val = 1

    # Logic
    if temp > 35:
        score += 2
        factors.append("High Temperature")
    elif temp > 30:
        score += 1
        factors.append("Warm Temperature")
        
    if humidity > 80:
        score += 1
        factors.append("High Humidity")
        
    if wind_speed < 2:
        score += 1
        factors.append("Stagnant Air")
    elif wind_speed > 10:
        score -= 1
        factors.append("Good Ventilation")

    # AQI Logic (Standard 1-5 scale often used, or 0-500)
    # If mock returns 1-5
    if aqi_val >= 4:
        score += 3
        factors.append("hazardous Air Quality")
    elif aqi_val >= 3:
        score += 2
        factors.append("Poor Air Quality")
        
    # Final Score normalization (1-10)
    final_score = max(1, min(10, score + 3)) # Base score 3
    
    # ML Flood Prediction Integration
    try:
        from backend.utils.risk_ml import risk_engine
        rainfall = weather.get("rain", {}).get("1h", 0)
        
        ml_res = risk_engine.predict_flood_risk(rainfall, temp, humidity)
        ml_prediction = f"Flood Risk: {ml_res['level']}"
        ml_score = ml_res['score']
        
        if ml_res['level'] in ["High", "Critical"]:
            factors.append(f"AI Alert: {ml_res['level']} Flood Risk")
            # Boost base score if AI detects flood danger
            final_score = max(final_score, 8 if ml_res['level'] == "Critical" else 6)
            
    except Exception as e:
        logger.error(f"ML Prediction Error: {e}")
        ml_prediction = "Unavailable"
        ml_score = 0
 
    risk_level = "Safe"
    if final_score >= 8:
        risk_level = "Critical"
    elif final_score >= 6:
        risk_level = "High"
    elif final_score >= 4:
        risk_level = "Moderate"

    return {
        "score": final_score,
        "level": risk_level,
        "factors": factors,
        "ml_model_prediction": ml_prediction,
        "ml_raw_output": ml_score,
        "timestamp": "now"
    }
