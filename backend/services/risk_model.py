from typing import Dict, Any

def calculate_risk_score(weather: Dict, aqi_data: Dict) -> Dict[str, Any]:
    """Calculate environmental risk score based on weather and air quality."""
    
    score = 0
    factors = []
    
    # Weather factors
    temp = weather.get("main", {}).get("temp", 0)
    humidity = weather.get("main", {}).get("humidity", 0)
    wind_speed = weather.get("wind", {}).get("speed", 0)
    
    # AQI factors (OpenAQ structure or mock)
    # The structure might vary, so we should be defensive
    aqi_val = 0
    if "main" in aqi_data and "aqi" in aqi_data["main"]:
        aqi_val = aqi_data["main"]["aqi"]
    elif "measurements" in aqi_data:
        # Handle real OpenAQ results if needed, usually they return parameters
        # For simplicity, assume the mock structure or normalize before calling
        pass
    else:
        aqi_val = aqi_data.get("aqi", 0)

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
    
    # ML Prediction Integration
    try:
        from backend.utils.risk_ml import risk_engine
        # Extract PM2.5 safely (Mock structure or general fallback)
        pm25 = aqi_data.get("components", {}).get("pm2_5", 0) 
        if not pm25 and "measurements" in aqi_data:
            # Try to find PM2.5 in OpenAQ measurements list if present
            for m in aqi_data["measurements"]:
                if m["parameter"] == "pm25":
                    pm25 = m["value"]
                    break
        
        ml_risk_val = risk_engine.predict_risk(temp, humidity, pm25)
        ml_prediction = "High Risk" if ml_risk_val == 1 else "Low Risk"
        
        if ml_risk_val == 1:
            factors.append("ML Model Alert")
            # Boost score if ML predicts high risk
            final_score = max(final_score, 7)
            
    except Exception as e:
        print(f"ML Prediction Error: {e}")
        ml_prediction = "Unavailable"
        ml_risk_val = -1

    risk_level = "Low"
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
        "ml_raw_output": ml_risk_val,
        "timestamp": "now"
    }
