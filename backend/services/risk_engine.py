from backend.services.data_service import get_environmental_data
from backend.utils.risk_ml import risk_engine
from backend.services.risk_model import calculate_risk_score
from backend.services.social_service import social_service
import logging

logger = logging.getLogger(__name__)

class RiskEngine:
    """
    Orchestrator service that combines Data Fetching, Rule-based Heuristics,
    Machine Learning, and Social Sentiment to produce a final Assessment.
    """
    
    async def analyze_risk(self, lat: float, lon: float):
        """
        Full pipeline: Data -> ML -> Social -> Risk Score -> Result
        """
        # 1. Fetch Environmental Data
        data = await get_environmental_data(lat, lon)
        
        if "error" in data:
            logger.error(f"Risk Engine Data Error: {data['error']}")
            raise Exception(data["error"])

        # 2. ML Inference
        try:
            ml_risk_val = risk_engine.predict_risk(
                data["temperature"], 
                data["humidity"], 
                data["pm25"]
            )
            ml_label = "High Risk" if ml_risk_val == 1 else "Low Risk"
        except Exception as e:
            logger.error(f"ML Engine Error: {e}")
            ml_risk_val = 0
            ml_label = "Unavailable"

        # 3. Social Stress Analysis
        location_name = data.get("raw_weather", {}).get("name", "Local Area")
        social_data = await social_service.get_social_stress(location_name)

        # 4. Heuristic / Hybrid Calculation
        base_assessment = calculate_risk_score(data["raw_weather"], data["raw_aqi"])
        
        # Combine Scores (70% Environmental, 30% Social)
        env_score = base_assessment["score"]
        social_score = social_data["score"]
        combined_score = round((env_score * 0.7) + (social_score * 0.3), 1)

        # Determine Final Severity Label
        final_severity = "Low"
        if combined_score >= 8: final_severity = "Critical"
        elif combined_score >= 6: final_severity = "High"
        elif combined_score >= 4: final_severity = "Moderate"

        return {
            "score": combined_score,
            "severity_label": final_severity,
            "environmental_base": {
                "score": env_score,
                "label": base_assessment["level"]
            },
            "social_overlay": social_data,
            "ml_prediction": {
                "label": ml_label,
                "raw_value": ml_risk_val
            },
            "contributing_factors": base_assessment["factors"],
            "aggregated_metrics": {
                # Weather
                "temperature": data.get("temperature"),
                "feels_like": data.get("feels_like"),
                "humidity": data.get("humidity"),
                "wind_speed": data.get("wind_speed"),
                "rainfall": data.get("rainfall"),
                "uv_index": data.get("uv_index"),
                "temp_min": data.get("temp_min"),
                "temp_max": data.get("temp_max"),
                # Air Quality
                "pm25": data.get("pm25"),
                "pm10": data.get("pm10"),
                "no2": data.get("no2"),
                "o3": data.get("o3"),
                # Time-based
                "hour_of_day": data.get("hour_of_day"),
                "day_of_week": data.get("day_of_week"),
                "3_day_temp_avg": data.get("3_day_temp_avg"),
                "7_day_rain_total": data.get("7_day_rain_total"),
                "heat_index": data.get("heat_index")
            },
            "raw_data": data
        }

# Singleton
environmental_risk_engine = RiskEngine()
