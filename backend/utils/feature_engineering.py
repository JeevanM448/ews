import logging
import math

logger = logging.getLogger(__name__)

class FeatureEngineer:
    """
    Utility module for specialized environmental feature engineering.
    """

    @staticmethod
    def calculate_3day_temp_avg(temps: list) -> float:
        """Calculates the average temperature over a 3-day window."""
        if not temps:
            return 0.0
        return round(sum(temps[:3]) / len(temps[:3]), 2)

    @staticmethod
    def calculate_7day_rainfall_total(rainfalls: list) -> float:
        """Calculates the total rainfall over a 7-day window."""
        if not rainfalls:
            return 0.0
        return round(sum(rainfalls[:7]), 2)

    @staticmethod
    def compute_heat_index(temp_c: float, humidity: float) -> float:
        """
        Computes the Heat Index (Apparent Temperature) in Celsius.
        Uses the Rothfusz regression formula (Standard NOAA algorithm).
        """
        # Heat Index is only defined for temperatures >= 80°F (26.7°C) 
        # and humidity >= 40%
        if temp_c < 26.7:
            return temp_c

        # Convert to Fahrenheit
        T = (temp_c * 9/5) + 32
        R = humidity

        # Standard Rothfusz Regression Coefficients
        c1 = -42.379
        c2 = 2.04901523
        c3 = 10.14333127
        c4 = -0.22475541
        c5 = -0.00683783
        c6 = -0.05481717
        c7 = 0.00122874
        c8 = 0.00085282
        c9 = -0.00000199

        hi = (c1 + (c2 * T) + (c3 * R) + (c4 * T * R) + (c5 * T**2) + 
              (c6 * R**2) + (c7 * T**2 * R) + (c8 * T * R**2) + (c9 * T**2 * R**2))

        # Adjustments
        if R < 13 and 80 <= T <= 112:
            adjustment = ((13 - R) / 4) * math.sqrt((17 - abs(T - 95)) / 17)
            hi -= adjustment
        elif R > 85 and 80 <= T <= 87:
            adjustment = ((R - 85) / 10) * ((87 - T) / 5)
            hi += adjustment

        return round((hi - 32) * 5/9, 2)

    @staticmethod
    def normalize_feature(value: float, min_val: float, max_val: float) -> float:
        """Performs Min-Max normalization."""
        if max_val == min_val:
            return 0.0
        norm_val = (value - min_val) / (max_val - min_val)
        return round(max(0.0, min(1.0, norm_val)), 4)

    def output_feature_vector(self, data: dict) -> list:
        """
        Processes raw environmental data into a normalized feature vector.
        Expected data keys: temperature, humidity, pm25, temps_hist, rains_hist
        """
        temp = data.get("temperature", 25)
        humidity = data.get("humidity", 50)
        pm25 = data.get("pm25", 20)
        temps_hist = data.get("temps_hist", [temp, temp, temp])
        rains_hist = data.get("rains_hist", [0.0] * 7)

        # 1. Feature Calculations
        temp_3d_avg = self.calculate_3day_temp_avg(temps_hist)
        rain_7d_total = self.calculate_7day_rainfall_total(rains_hist)
        heat_index = self.compute_heat_index(temp, humidity)

        # 2. Normalization (Target Ranges)
        # Temp: 0-50, Humidity: 0-100, PM25: 0-500, Rain: 0-200
        n_temp = self.normalize_feature(temp, 0, 50)
        n_hum = self.normalize_feature(humidity, 0, 100)
        n_pm25 = self.normalize_feature(pm25, 0, 500)
        n_hi = self.normalize_feature(heat_index, 0, 50)
        n_temp_3d = self.normalize_feature(temp_3d_avg, 0, 50)
        n_rain_7d = self.normalize_feature(rain_7d_total, 0, 200)

        # 3. Construct Vector
        # [Temp, Hum, PM25, HeatIndex, 3DayAvg, 7DayRain]
        feature_vector = [n_temp, n_hum, n_pm25, n_hi, n_temp_3d, n_rain_7d]
        
        logger.info(f"Generated Feature Vector: {feature_vector}")
        return feature_vector

# Singleton instance
feature_engineer = FeatureEngineer()
