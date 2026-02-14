import pandas as pd
import numpy as np
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataCleaner:
    def __init__(self, input_path="backend/data/kerala_weather_history.csv", 
                 output_path="backend/data/cleaned_kerala_data.csv"):
        self.input_path = input_path
        self.output_path = output_path
        self.df = None

    def load_data(self):
        if not os.path.exists(self.input_path):
            logger.error(f"Input file {self.input_path} not found.")
            return False
        # Prevent 'None' event labels from being treated as NaN
        self.df = pd.read_csv(self.input_path, na_values=['', 'NA', 'NAN'], keep_default_na=False)
        logger.info(f"Loaded {len(self.df)} records.")
        return True

    def remove_missing(self):
        initial_len = len(self.df)
        self.df.dropna(inplace=True)
        dropped = initial_len - len(self.df)
        if dropped > 0:
            logger.info(f"Removed {dropped} rows with missing values.")
        return dropped

    def handle_outliers(self):
        """
        Replace extreme or invalid values based on Kerala's climate context.
        """
        # Temperature: 10C (coldest hills) to 50C (extreme heat)
        temp_mask = (self.df['temperature_c'] < 10) | (self.df['temperature_c'] > 50)
        
        # Humidity: 0% to 100%
        humid_mask = (self.df['humidity_p'] < 0) | (self.df['humidity_p'] > 100)
        
        # Rainfall: 0 to 1000mm (Extreme but possible)
        rain_mask = (self.df['rainfall_mm'] < 0) | (self.df['rainfall_mm'] > 1000)

        # Replacing outliers with median (more robust than mean)
        self.df.loc[temp_mask, 'temperature_c'] = self.df['temperature_c'].median()
        self.df.loc[humid_mask, 'humidity_p'] = self.df['humidity_p'].median()
        self.df.loc[rain_mask, 'rainfall_mm'] = self.df['rainfall_mm'].median()
        
        logger.info("Outliers handled and replaced with medians.")

    def engineer_features(self):
        """
        Create advanced predictive features:
        - Rolling rainfall totals (1d, 3d, 7d)
        - Temperature and Humidity trends
        """
        # Ensure data is sorted by district and date for correct rolling/shift
        self.df['date'] = pd.to_datetime(self.df['date'])
        self.df.sort_values(['district', 'date'], inplace=True)
        
        # Rainfall Accumulation
        self.df['rain_1d_lag'] = self.df.groupby('district')['rainfall_mm'].shift(1).fillna(0)
        self.df['rain_3d_total'] = self.df.groupby('district')['rainfall_mm'].transform(lambda x: x.rolling(window=3, min_periods=1).sum())
        self.df['rain_7d_total'] = self.df.groupby('district')['rainfall_mm'].transform(lambda x: x.rolling(window=7, min_periods=1).sum())
        
        # Trends (Current - Previous)
        self.df['temp_trend'] = self.df.groupby('district')['temperature_c'].diff().fillna(0)
        self.df['humid_trend'] = self.df.groupby('district')['humidity_p'].diff().fillna(0)
        
        logger.info("Advanced predictive features engineered.")

    def normalize_features(self):
        """
        Normalize all numerical features to 0-1 range.
        """
        cols_to_norm = [
            'rainfall_mm', 'temperature_c', 'humidity_p',
            'rain_1d_lag', 'rain_3d_total', 'rain_7d_total',
            'temp_trend', 'humid_trend'
        ]
        for col in cols_to_norm:
            if col in self.df.columns:
                min_val = self.df[col].min()
                max_val = self.df[col].max()
                if max_val - min_val != 0:
                    self.df[f'{col}_norm'] = (self.df[col] - min_val) / (max_val - min_val)
                else:
                    self.df[f'{col}_norm'] = 0
        logger.info("Numerical features normalized (0-1 range).")

    def validate_continuity(self):
        """
        Ensure each district has a continuous time-series (no missing dates).
        """
        self.df['date'] = pd.to_datetime(self.df['date'])
        districts = self.df['district'].unique()
        issues = []

        for district in districts:
            district_data = self.df[self.df['district'] == district].sort_values('date')
            min_date = district_data['date'].min()
            max_date = district_data['date'].max()
            
            expected_range = pd.date_range(start=min_date, end=max_date)
            actual_dates = district_data['date']
            
            missing_dates = expected_range.difference(actual_dates)
            if not missing_dates.empty:
                issues.append(f"{district}: {len(missing_dates)} missing dates.")
        
        if issues:
            for issue in issues:
                logger.warning(issue)
        else:
            logger.info("Time-series continuity validated for all districts.")

    def save_cleaned_data(self):
        self.df.to_csv(self.output_path, index=False)
        logger.info(f"Cleaned data saved to {self.output_path}")

    def run_pipeline(self):
        if self.load_data():
            self.remove_missing()
            self.handle_outliers()
            self.engineer_features()
            self.normalize_features()
            self.validate_continuity()
            self.save_cleaned_data()
            return True
        return False

if __name__ == "__main__":
    cleaner = DataCleaner()
    cleaner.run_pipeline()
