from sklearn.metrics import accuracy_score, precision_score, recall_score, mean_absolute_error, make_scorer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
import joblib
import pandas as pd
import numpy as np
import os
import logging
import random

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = "backend/models/kerala_safe_ai_boost.joblib"

class KeralaRiskModel:
    """
    Advanced Gradient Boosting Model with Validation Metrics
    Inputs: Rain_1d, Rain_3d, Rain_7d, Temperature, Humidity
    Outputs: Score (0-100), Severity Level
    """
    def __init__(self, model_path=MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                logger.info("Gradient Boosting Model loaded successfully.")
            except Exception as e:
                logger.error(f"Error loading model: {e}")
                self.train_and_save_model()
        else:
            self.train_and_save_model()

    def train_and_save_model(self):
        """Train model with 80/20 split and validation metrics."""
        np.random.seed(42)
        CLEANED_CSV = "backend/data/cleaned_kerala_data.csv"
        
        if os.path.exists(CLEANED_CSV):
            logger.info(f"Training on historical data: {CLEANED_CSV}")
            df = pd.read_csv(CLEANED_CSV)
            feature_cols = ['rain_1d_lag', 'rain_3d_total', 'rain_7d_total', 'temperature_c', 'humidity_p']
            X = df[feature_cols].rename(columns={
                'rain_1d_lag': 'rain_1d',
                'rain_3d_total': 'rain_3d',
                'rain_7d_total': 'rain_7d',
                'temperature_c': 'temp',
                'humidity_p': 'humidity'
            })
            
            scores = []
            for _, row in df.iterrows():
                if row['event_label'] in ['Flood', 'Landslide']:
                    base = 85 + random.uniform(5, 10)
                elif row['event_label'] == 'Heatwave':
                    base = 70 + (row['temperature_c'] - 38) * 5
                else:
                    r3 = row['rain_3d_total']
                    r7 = row['rain_7d_total']
                    base = (r3 / 250) * 35 + (r7 / 500) * 35 + (row['rainfall_mm'] / 100) * 20
                scores.append(min(100, max(0, float(base))))
            y = np.array(scores)
        else:
            logger.warning("No historical data found. Training aborted.")
            return

        # 1. Hyperparameter Tuning with GridSearchCV
        param_grid = {
            'n_estimators': [100, 150, 200],
            'max_depth': [3, 4, 5],
            'min_samples_leaf': [1, 2, 4],
            'learning_rate': [0.1]
        }
        
        base_gb = GradientBoostingRegressor(random_state=42)
        
        # Custom Scorer for tuning
        def threshold_accuracy(y_true, y_pred):
            return accuracy_score((y_true >= 60).astype(int), (y_pred >= 60).astype(int))
        acc_scorer = make_scorer(threshold_accuracy)

        logger.info("Starting Automatic Hyperparameter Tuning (GridSearchCV)...")
        grid_search = GridSearchCV(
            estimator=base_gb,
            param_grid=param_grid,
            cv=3, # Reduced to 3-fold for faster tuning
            scoring=acc_scorer,
            n_jobs=-1
        )
        grid_search.fit(X, y)
        
        best_gb = grid_search.best_estimator_
        logger.info(f"Best Parameters Found: {grid_search.best_params_}")

        # 2. Perform 5-Fold Cross-Validation on Best Model
        logger.info("Performing Cross-Validation on tuned model...")
        cv_scores = cross_val_score(best_gb, X, y, cv=5, scoring=acc_scorer)
        avg_cv_acc = cv_scores.mean()

        # 3. Final Evaluation
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)
        best_gb.fit(X_train, y_train)
        
        y_pred = best_gb.predict(X_test)
        y_test_class = (y_test >= 60).astype(int)
        y_pred_class = (y_pred >= 60).astype(int)
        
        acc = accuracy_score(y_test_class, y_pred_class)
        prec = precision_score(y_test_class, y_pred_class)
        rec = recall_score(y_test_class, y_pred_class)
        mae = mean_absolute_error(y_test, y_pred)
        
        logger.info("--- TUNED MODEL VALIDATION REPORT ---")
        logger.info(f"Dataset Size: {len(X)}")
        logger.info(f"Best Hyperparameters: {grid_search.best_params_}")
        logger.info(f"5-Fold CV Average Accuracy: {avg_cv_acc:.4f}")
        logger.info(f"Final Test Accuracy: {acc:.4f}")
        logger.info(f"Precision: {prec:.4f}")
        logger.info(f"Recall: {rec:.4f}")
        logger.info(f"Mean Absolute Error: {mae:.2f}")
        logger.info("-------------------------------------")
        
        # Ensure best_gb is saved
        gb_model = best_gb
        
        # 5. Save Model
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(gb_model, self.model_path)
            self.model = gb_model
            logger.info(f"Reliable Model saved: {self.model_path}")
        except Exception as e:
            logger.error(f"Save Failed: {e}")

    def predict_flood_risk(self, **features):
        """
        Predict usage Gradient Boosting model.
        Args: rain_1d, rain_3d, rain_7d, temp, humidity
        """
        if not self.model: self.load_model()
        
        feature_order = ['rain_1d', 'rain_3d', 'rain_7d', 'temp', 'humidity']
        input_values = [features.get(f, 0.0) for f in feature_order]
        
        input_df = pd.DataFrame([input_values], columns=feature_order)
        score = float(self.model.predict(input_df)[0])
        score = round(max(0, min(100, score)), 1)
        
        level = "Safe"
        if score >= 80: level = "Critical"
        elif score >= 60: level = "High"
        elif score >= 40: level = "Moderate"
        
        return {"score": score, "level": level}

# Singleton instance
risk_engine = KeralaRiskModel()
