import random
from textblob import TextBlob
from datetime import datetime

# --- 1. Social Signal AI ---
def analyze_social_signal(text_data: list):
    """
    Analyzes social media text updates to determine panic levels.
    Returns a social stress score (0-100).
    """
    if not text_data:
        return {"stress_score": 0, "sentiment": "Neutral", "panic_detected": False}

    total_polarity = 0
    panic_keywords = ["help", "trapped", "flood", "emergency", "urgent", "SOS", "landslide", "stuck", "water rising"]
    panic_count = 0

    for text in text_data:
        blob = TextBlob(text)
        total_polarity += blob.sentiment.polarity
        if any(word in text.lower() for word in panic_keywords):
            panic_count += 1

    avg_polarity = total_polarity / len(text_data)
    
    # Calculate Stress Score
    # Lower polarity (negative sentiment) -> Higher stress
    # More panic keywords -> Higher stress
    
    base_stress = (1 - avg_polarity) * 50  # Map -1..1 to 100..0 roughly
    panic_factor = min(panic_count * 10, 50) # Cap panic contribution
    
    stress_score = min(max(base_stress + panic_factor, 0), 100)
    
    sentiment_label = "Neutral"
    if avg_polarity < -0.3: sentiment_label = "Negative"
    if avg_polarity > 0.3: sentiment_label = "Positive"

    return {
        "stress_score": round(stress_score, 2),
        "sentiment": sentiment_label,
        "panic_detected": panic_count > 0,
        "keyword_hits": panic_count
    }

# --- 2. Satellite Image AI (Simulated CNN) ---
def analyze_satellite_image(image_id: str):
    """
    Simulates a CNN analysis on a satellite image for flood detection.
    In a real system, this would load a TensorFlow/PyTorch model.
    """
    # Deterministic simulation based on ID hash or random for demo
    random.seed(image_id) 
    water_level = random.uniform(0, 100)
    
    risk_type = "Safe"
    if water_level > 80: risk_type = "Critical Flood"
    elif water_level > 50: risk_type = "High Water Level"
    elif water_level > 30: risk_type = "Moderate Water Level"

    return {
        "analysis_id": image_id,
        "water_coverage_percent": round(water_level, 2),
        "detected_risk": risk_type,
        "confidence": round(random.uniform(85, 99), 2),
        "timestamp": datetime.now().isoformat()
    }

# --- 3. AI Risk Fusion Engine ---
def fuse_risk_scores(weather_score, social_score, satellite_score=0):
    """
    Combines multiple risk signals into a single 'Kerala SafeAI Score'.
    Weights: Weather (50%), Social (30%), Satellite (20%)
    """
    # Normalize inputs to 0-100
    w = 0.5
    s = 0.3
    sat = 0.2
    
    if satellite_score == 0: # If we don't have sat data, rebalance
        w = 0.6
        s = 0.4
        sat = 0

    final_score = (weather_score * w) + (social_score * s) + (satellite_score * sat)
    
    severity = "Safe"
    if final_score > 80: severity = "Critical"
    elif final_score > 60: severity = "High"
    elif final_score > 40: severity = "Moderate"
    
    return {
        "fused_score": round(final_score, 2),
        "severity": severity,
        "components": {
            "weather": weather_score,
            "social": social_score,
            "satellite": satellite_score
        }
    }

# --- 4. AI Safety Assistant (Chatbot) ---
def get_safety_advice(query: str):
    """
    Provides disaster-specific advice based on user query.
    """
    query = query.lower()
    
    # Simple Intent Matching
    if "flood" in query:
        return "Move to higher ground immediately. Disconnect electrical appliances. Do not walk through moving water."
    elif "landslide" in query:
        return "Evacuate slope areas. Listen for unusual sounds like trees cracking. Move to the nearest relief camp."
    elif "heat" in query or "sun" in query:
        return "Stay indoors between 11 AM and 3 PM. Drink plenty of water. Wear light cotton clothes."
    elif "emergency" in query or "help" in query:
        return "Please press the red SOS button on the dashboard or call 112 immediately."
    elif "food" in query or "water" in query:
        return "Stock non-perishable food and 3 days of water. Avoid flood water to prevent contamination."
    else:
        return "I am Kerala SafeAI Assistant. I can help with flood, landslide, and heatwave safety tips. Stay safe!"

# --- 5. Evacuation Recommendation ---
def recommend_evacuation(current_district, risk_level):
    """
    Suggests safer districts based on simple hardcoded adjacency/risk logic.
    """
    if risk_level not in ["High", "Critical"]:
        return {"action": "Stay Alert", "message": "No immediate evacuation needed."}
        
    # Mock Adjacency Graph for Kerala Districts
    neighbors = {
        "Idukki": ["Ernakulam", "Kottayam"],
        "Wayanad": ["Kozhikode", "Kannur"],
        "Pathanamthitta": ["Kollam", "Alappuzha"],
        "Alappuzha": ["Kottayam", "Kollam"],
        "Ernakulam": ["Thrissur", "Alappuzha"],
        # ... simplified
    }
    
    options = neighbors.get(current_district, ["nearest relief camp"])
    safe_haven = random.choice(options) # In real app, check neighbor risk scores
    
    return {
        "action": "Evacuate",
        "message": f"High risk detected in {current_district}. Proceed to safe zones in {safe_haven} or nearest government shelter.",
        "routes": f"Follow NH/SH towards {safe_haven}."
    }
