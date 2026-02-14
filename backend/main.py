from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
import sqlite3
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from dotenv import load_dotenv

try:
    from twilio.rest import Client as TwilioClient
except ImportError:
    TwilioClient = None

# Load environment variables
load_dotenv()

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("backend.main")

# --- Services ---
from backend.services.data_service import get_environmental_data
from backend.services.risk_engine import environmental_risk_engine
from backend.services.ai_engine import (
    analyze_social_signal,
    analyze_satellite_image,
    fuse_risk_scores,
    get_safety_advice,
    recommend_evacuation
)

# --- Database Integration ---
DB_PATH = "backend/data/predictions.db"
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                location TEXT,
                lat REAL,
                lon REAL,
                risk_score REAL,
                risk_level TEXT,
                temp REAL,
                pm25 REAL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emergencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL,
                lon REAL,
                district TEXT,
                risk_level TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                alert_status TEXT
            )
        ''')
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

init_db()

def save_prediction(location, lat, lon, score, level, temp, pm25):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO predictions (location, lat, lon, risk_score, risk_level, temp, pm25)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (location, lat, lon, score, level, temp, pm25))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to save prediction: {e}")

# --- API Setup ---
app = FastAPI(title="EcoGuard AI Risk Engine", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/risk-data")
async def get_risk_data(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    try:
        # 1. Pipeline Analysis
        risk_result = await environmental_risk_engine.analyze_risk(lat, lon)
        
        # 2. Persistence (Async to DB)
        try:
            loc_name = risk_result["raw_data"].get("location_name", f"{lat}, {lon}")
            save_prediction(
                loc_name, lat, lon,
                risk_result["score"],
                risk_result["severity_label"],
                risk_result["aggregated_metrics"].get("temperature", 0),
                risk_result["aggregated_metrics"].get("pm25", 0)
            )
        except Exception as db_err:
            logger.error(f"Persistence error: {db_err}")

        # 3. Response Construction
        return {
            "location": {"lat": lat, "lon": lon},
            "weather": risk_result["raw_data"]["raw_weather"],
            "air_quality": risk_result["raw_data"]["raw_aqi"],
            "risk_assessment": {
                "score": risk_result["score"],
                "level": risk_result["severity_label"],
                "factors": risk_result["contributing_factors"],
                "ml_model_prediction": risk_result["ml_prediction"]["label"],
                "ml_raw_output": risk_result["ml_prediction"]["raw_value"],
                "social_stress_score": risk_result["social_overlay"]["score"],
                "social_severity": risk_result["social_overlay"]["severity"],
                "recent_social_sentiment": risk_result["social_overlay"]["sentiment_average"],
                "timestamp": "now"
            },
            "social_data": risk_result["social_overlay"],
            "environmental_data": risk_result["environmental_base"],
            "aggregated_metrics": risk_result["aggregated_metrics"]
        }
    except Exception as e:
        logger.error(f"API Error in risk-data: {e}")
        status = 500
        if "No data" in str(e): status = 404
        raise HTTPException(status_code=status, detail=str(e))

class EmergencyRequest(BaseModel):
    latitude: float
    longitude: float
    district: Optional[str] = "Unknown District"

class EmergencySubmission(BaseModel):
    latitude: float
    longitude: float
    district: str
    risk_level: Optional[str] = "Critical"
    alert_status: str

@app.post("/api/send-emergency-email")
async def send_emergency_email(request: EmergencyRequest):
    try:
        # Configuration
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        recipient = os.getenv("RECIPIENT_EMAIL", "jeevanelias1@gmail.com")

        # Check for missing OR placeholder values
        placeholders = ["your_email@gmail.com", "your_app_password", "your_openweather_api_key_here"]
        if not smtp_user or not smtp_pass or smtp_user in placeholders or smtp_pass in placeholders:
            msg = "SMTP credentials are not configured in .env file. Please set SMTP_USER and SMTP_PASS (App Password) to enable real email alerts."
            logger.warning(msg)
            # Return a specific message that the UI can show
            return {
                "status": "warning", 
                "message": msg,
                "debug_link": f"https://www.google.com/maps?q={request.latitude},{request.longitude}"
            }

        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = recipient
        msg['Subject'] = "Kerala SafeAI Emergency Alert"

        body = (
            "Kerala SafeAI Emergency Alert: Person in danger or needs help.\n\n"
            "--- USER GPS LOCATION ---\n"
            f"Latitude:  {request.latitude}\n"
            f"Longitude: {request.longitude}\n"
            f"District:  {request.district or 'Unknown'}\n\n"
            "Open in Google Maps:\n"
            f"https://www.google.com/maps?q={request.latitude},{request.longitude}\n"
        )
        msg.attach(MIMEText(body, 'plain'))

        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        logger.info(f"Emergency email sent to {recipient}")
        return {"status": "success", "message": "Emergency alert sent successfully."}

    except Exception as e:
        logger.error(f"Failed to send emergency email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send emergency alert.")

@app.post("/api/send-emergency-sms")
async def send_emergency_sms(request: EmergencyRequest):
    try:
        sid = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        from_phone = os.getenv("TWILIO_PHONE_NUMBER")
        to_phone = os.getenv("EMERGENCY_SMS_NUMBER", "+916238275699")

        placeholders = ["your_twilio_sid", "your_twilio_token", "your_twilio_phone"]
        
        if not sid or not token or not from_phone or sid in placeholders or token in placeholders:
            msg = "Twilio credentials are not configured in .env. SMS skipped."
            logger.warning(f"{msg} Would have sent SMS to {to_phone} with location: {request.latitude}, {request.longitude}")
            return {"status": "warning", "message": "SMS alert processed (Twilio not configured)"}

        if TwilioClient is None:
            logger.error("Twilio package not installed.")
            return {"status": "error", "message": "SMS service unavailable (library missing)"}

        client = TwilioClient(sid, token)
        message_body = (
            "EMERGENCY ALERT\n"
            f"Person in danger in {request.district}, Kerala.\n"
            f"Location: {request.latitude}, {request.longitude}\n"
            f"Maps: https://www.google.com/maps?q={request.latitude},{request.longitude}\n"
            "Sent from Kerala SafeAI."
        )
        
        client.messages.create(
            body=message_body,
            from_=from_phone,
            to=to_phone
        )

        logger.info(f"Emergency SMS sent to {to_phone}")
        return {"status": "success", "message": "Emergency SMS sent successfully."}

    except Exception as e:
        logger.error(f"Failed to send emergency SMS: {e}")
        raise HTTPException(status_code=500, detail="Failed to send emergency SMS.")

@app.get("/api/admin/history")
async def get_admin_history():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM predictions ORDER BY timestamp DESC LIMIT 100")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Admin history error: {e}")
        return []

@app.get("/api/admin/emergencies")
async def get_admin_emergencies():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM emergencies ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Admin emergencies error: {e}")
        return []

# --- AI Endpoints ---

class SocialRequest(BaseModel):
    texts: list[str]

@app.post("/api/ai/social")
async def ai_social_analysis(request: SocialRequest):
    return analyze_social_signal(request.texts)

@app.get("/api/ai/satellite")
async def ai_satellite_analysis(image_id: str = "demo_sat_1"):
    return analyze_satellite_image(image_id)

@app.get("/api/ai/fusion")
async def ai_risk_fusion(
    weather_score: float,
    district: str,
    social_texts: Optional[str] = None # simple comma sep for GET convenience or use default
):
    # 1. Social
    s_score = 0
    if social_texts:
        s_res = analyze_social_signal(social_texts.split(","))
        s_score = s_res["stress_score"]
    
    # 2. Satellite (Simulated random for now)
    sat_res = analyze_satellite_image(district)
    sat_score = sat_res["water_coverage_percent"]

    # 3. Fuse
    fusion = fuse_risk_scores(weather_score, s_score, sat_score)
    
    # 4. Evacuation
    evac = recommend_evacuation(district, fusion["severity"])
    
    return {
        "district": district,
        "fused_risk": fusion,
        "evacuation": evac,
        "satellite_insight": sat_res
    }

class ChatRequest(BaseModel):
    message: str

@app.post("/api/ai/chat")
async def ai_chat(request: ChatRequest):
    response = get_safety_advice(request.message)
    return {"reply": response}

KERALA_DISTRICTS = [
    {"name": "Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366},
    {"name": "Kollam", "lat": 8.8932, "lon": 76.6141},
    {"name": "Pathanamthitta", "lat": 9.2648, "lon": 76.7870},
    {"name": "Alappuzha", "lat": 9.4981, "lon": 76.3388},
    {"name": "Kottayam", "lat": 9.5916, "lon": 76.5222},
    {"name": "Idukki", "lat": 9.8517, "lon": 76.9746},
    {"name": "Ernakulam", "lat": 9.9816, "lon": 76.2999},
    {"name": "Thrissur", "lat": 10.5276, "lon": 76.2144},
    {"name": "Palakkad", "lat": 10.7867, "lon": 76.6547},
    {"name": "Malappuram", "lat": 11.0735, "lon": 76.0740},
    {"name": "Kozhikode", "lat": 11.2588, "lon": 75.7804},
    {"name": "Wayanad", "lat": 11.6854, "lon": 76.1320},
    {"name": "Kannur", "lat": 11.8745, "lon": 75.3704},
    {"name": "Kasaragod", "lat": 12.5101, "lon": 74.9852}
]

@app.get("/api/kerala/districts-risk")
async def get_kerala_districts_risk():
    all_risks = []
    for district in KERALA_DISTRICTS:
        try:
            risk = await environmental_risk_engine.analyze_risk(district["lat"], district["lon"])
            all_risks.append({
                "district": district["name"],
                "score": risk["score"],
                "level": risk["severity_label"],
                "lat": district["lat"],
                "lon": district["lon"]
            })
        except:
            continue
    return all_risks

@app.get("/risk", response_model=dict)
async def get_district_risk(district: str = Query(..., description="Name of the Kerala district")):
    """
    Returns risk predictions for a specific Kerala district.
    Returns: Rainfall, Temperature, Humidity, Risk score, Severity level.
    """
    # 1. Validate District
    district_data = next((d for d in KERALA_DISTRICTS if d["name"].lower() == district.lower()), None)
    if not district_data:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found in Kerala. Please use one of the 14 districts.")

    try:
        # 2. Analyze Risk using Kerala-specific engine
        result = await environmental_risk_engine.analyze_risk(district_data["lat"], district_data["lon"])
        
        # 3. Extract requested metrics
        metrics = result.get("aggregated_metrics", {})
        return {
            "rainfall": metrics.get("rainfall", 0),
            "temperature": metrics.get("temperature", 0),
            "humidity": metrics.get("humidity", 0),
            "risk_score": result["score"],
            "severity_level": result["severity_label"]
        }
    except Exception as e:
        logger.error(f"District Risk API error for {district}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch district-based predictions.")

@app.post("/emergency", response_model=dict)
async def log_emergency_status(request: EmergencySubmission):
    """
    Stores emergency details for a district.
    Stores: User location, District, Timestamp, Alert status.
    """
    # Optional: Validate district if it's supposed to be one of the 14
    district_valid = any(d["name"].lower() == request.district.lower() for d in KERALA_DISTRICTS)
    if not district_valid:
        logger.warning(f"Emergency reported for unknown district: {request.district}")

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO emergencies (lat, lon, district, risk_level, alert_status)
            VALUES (?, ?, ?, ?, ?)
        ''', (request.latitude, request.longitude, request.district, request.risk_level, request.alert_status))
        
        # Get the timestamp and ID of the inserted record
        item_id = cursor.lastrowid
        cursor.execute("SELECT timestamp FROM emergencies WHERE id = ?", (item_id,))
        timestamp = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        logger.info(f"Emergency logged [ID:{item_id}] for {request.district}: {request.alert_status}")
        return {
            "status": "success", 
            "message": "Emergency status logged successfully.",
            "data": {
                "id": item_id,
                "lat": request.latitude,
                "lon": request.longitude,
                "district": request.district,
                "timestamp": timestamp,
                "alert_status": request.alert_status
            }
        }
    except Exception as e:
        logger.error(f"Failed to log emergency: {e}")
        raise HTTPException(status_code=500, detail="Failed to log emergency status.")

# --- Frontend Mounting ---
# Try multiple paths to ensure success
frontend_paths = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend"),
    "frontend",
    "../frontend"
]

mounted = False
for path in frontend_paths:
    if os.path.exists(path):
        app.mount("/", StaticFiles(directory=path, html=True), name="frontend")
        logger.info(f"Frontend mounted from: {os.path.abspath(path)}")
        mounted = True
        break

if not mounted:
    logger.error("COULD NOT FIND FRONTEND DIRECTORY. System UI will be unavailable.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
