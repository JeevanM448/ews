import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Kerala Districts Configuration
KERALA_DISTRICTS = [
    {"name": "Thiruvananthapuram", "type": "Coastal"},
    {"name": "Kollam", "type": "Coastal"},
    {"name": "Pathanamthitta", "type": "Hilly"},
    {"name": "Alappuzha", "type": "Coastal"},
    {"name": "Kottayam", "type": "Midland"},
    {"name": "Idukki", "type": "Hilly"},
    {"name": "Ernakulam", "type": "Coastal"},
    {"name": "Thrissur", "type": "Coastal"},
    {"name": "Palakkad", "type": "Inland"},
    {"name": "Malappuram", "type": "Coastal"},
    {"name": "Kozhikode", "type": "Coastal"},
    {"name": "Wayanad", "type": "Hilly"},
    {"name": "Kannur", "type": "Coastal"},
    {"name": "Kasaragod", "type": "Coastal"}
]

def generate_kerala_dataset(years=3):
    print(f"Generating {years} years of historical data for Kerala districts...")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years*365)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    
    data = []

    for district in KERALA_DISTRICTS:
        name = district["name"]
        d_type = district["type"]
        
        for date in dates:
            month = date.month
            
            # --- Base Weather Logic (Kerala Seasons) ---
            
            # 1. Monsoon (Jun - Sep) & Northeast Monsoon (Oct - Nov)
            if month in [6, 7, 8, 9]: # Heavy Rain
                rainfall = random.gammavariate(alpha=2, beta=20) # Skewed distribution
                temp = random.normalvariate(26, 2)
                humidity = random.normalvariate(90, 5)
            elif month in [10, 11]: # Moderate Rain
                rainfall = random.gammavariate(alpha=2, beta=15)
                temp = random.normalvariate(27, 2)
                humidity = random.normalvariate(85, 5)
            elif month in [3, 4, 5]: # Summer (Heat)
                rainfall = random.uniform(0, 10) # Occasional showers
                temp = random.normalvariate(34, 3) # Hot
                if name == "Palakkad": temp += 3 # Palakkad gap heat
                humidity = random.normalvariate(70, 10)
            else: # Winter (Dec - Feb) - Mild
                rainfall = random.uniform(0, 5)
                temp = random.normalvariate(28, 2)
                humidity = random.normalvariate(65, 5)

            # --- Location Modifiers ---
            if d_type == "Hilly":
                temp -= 3 # Cooler in hills (Idukki, Wayanad)
                rainfall *= 1.2 # More rain in hills
            
            # --- Disaster Labeling Logic ---
            label = "None"
            
            # Flood: Extreme rain > 150mm (Coastal/Midland) or > 120mm (Hilly - flash floods)
            flood_threshold = 120 if d_type == "Hilly" else 150
            if rainfall > flood_threshold:
                label = "Flood"
                
            # Landslide: High rain in Hilly areas
            if d_type == "Hilly" and rainfall > 130:
                label = "Landslide"
                
            # Heatwave: Temp > 38 (Coastal) or > 40 (Inland)
            heat_threshold = 40 if d_type == "Inland" else 37
            if temp > heat_threshold:
                label = "Heatwave"

            # Clamp values
            rainfall = max(0, round(rainfall, 1))
            temp = round(temp, 1)
            humidity = min(100, max(20, round(humidity, 1)))

            data.append({
                "date": date.strftime("%Y-%m-%d"),
                "district": name,
                "rainfall_mm": rainfall,
                "temperature_c": temp,
                "humidity_p": humidity,
                "event_label": label
            })

    df = pd.DataFrame(data)
    
    # Save to CSV
    output_path = "backend/data/kerala_weather_history.csv"
    df.to_csv(output_path, index=False)
    print(f"Dataset generated: {len(df)} records saved to {output_path}")
    print(df["event_label"].value_counts())

if __name__ == "__main__":
    generate_kerala_dataset()
