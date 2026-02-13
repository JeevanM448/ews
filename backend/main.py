from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
import sqlite3
import os
import logging

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("backend.main")

# --- Services ---
from backend.services.data_service import get_environmental_data
from backend.services.risk_engine import environmental_risk_engine

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

@app.get("/risk")
async def get_simplified_legacy(lat: float, lon: float):
    # Support for legacy /risk requests
    try:
        result = await environmental_risk_engine.analyze_risk(lat, lon)
        return {
            "risk_score": result["score"],
            "level": result["severity_label"],
            "temp": result["aggregated_metrics"]["temperature"]
        }
    except Exception as e:
        logger.error(f"Legacy API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
