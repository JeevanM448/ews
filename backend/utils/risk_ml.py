import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from datetime import datetime
import os
import logging

# Configure logger (since we are in a module)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = "backend/models/random_forest_risk_model.joblib"

class RiskModelEngine:
    def __init__(self, model_path=MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_model()

    def load_model(self):
        """Load the trained model from file, or train a new one if not found."""
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                logger.info("ML Model loaded successfully.")
            except Exception as e:
                logger.error(f"Error loading model: {e}")
                self.train_and_save_model() # Recovery
        else:
            logger.info("No model found. Training initial model...")
            self.train_and_save_model()

    def train_and_save_model(self):
        """Generate synthetic data and train a RandomForest Classifier."""
        # 1. Generate Synthetic Data
        # Features: [Temperature, Humidity, PM2.5]
        # Label: 0 (Low Risk), 1 (High Risk)
        
        np.random.seed(42)
        n_samples = 1000
        
        # Temperature: range 10-45
        temps = np.random.uniform(10, 45, n_samples)
        # Humidity: range 20-100
        humidities = np.random.uniform(20, 100, n_samples)
        # PM2.5: range 0-300 (AQI levels)
        pm25s = np.random.uniform(0, 300, n_samples)
        
        # Determine labels based on thresholds (simple logic for training)
        labels = []
        for temp, hum, pm in zip(temps, humidities, pm25s):
            risk_score = 0
            if temp > 35: risk_score += 1
            if hum > 80: risk_score += 0.5
            if pm > 50: risk_score += 2 # PM2.5 is heavy factor
            
            # If total score exceeds threshold, mark as High Risk (1)
            labels.append(1 if risk_score >= 1.5 else 0)
            
        X = pd.DataFrame({'temp': temps, 'humidity': humidities, 'pm25': pm25s})
        y = np.array(labels)
        
        # 2. Train Model
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        clf = RandomForestClassifier(n_estimators=100, random_state=42)
        clf.fit(X_train, y_train)
        
        # Verify accuracy
        accuracy = clf.score(X_test, y_test)
        logger.info(f"Model trained with accuracy: {accuracy:.2f}")
        
        # 3. Save Model
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(clf, self.model_path)
            self.model = clf
            logger.info(f"Model saved to {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")

    def predict_risk(self, temp: float, humidity: float, pm25: float) -> int:
        """Predict risk level (0 or 1) based on inputs."""
        if not self.model:
            logger.warning("Model not ready. Retrying load...")
            self.load_model()
            
        if self.model:
            # Create DataFrame for prediction to match training features
            input_data = pd.DataFrame([[temp, humidity, pm25]], columns=['temp', 'humidity', 'pm25'])
            prediction = self.model.predict(input_data)
            return int(prediction[0])
        else:
            return 0 # Default safe fallback

# Singleton instance for import
risk_engine = RiskModelEngine()
