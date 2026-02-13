from textblob import TextBlob
import random
from typing import List, Dict

class SocialAnalysisService:
    """
    Service to collect text data (simulated/real) and perform sentiment analysis
    to determine the social stress score of a region.
    """
    
    async def get_social_stress(self, location_name: str) -> Dict:
        """
        Collects text data for a location and calculates a social stress score.
        For a real production app, this would use Twitter/X API via Tweepy.
        """
        # Simulated recent "tweets" or reports about the area
        mock_messages = [
            f"The air in {location_name} feels heavy today. Not good for a walk.",
            f"Why is it so hot in {location_name} suddenly? Is there a heatwave coming?",
            f"Stay safe everyone in {location_name}! The weather is looking rough.",
            f"Great day to be out in {location_name}!",
            f"I'm worried about the pollution levels here in {location_name}.",
            f"Does anyone else think the humidity in {location_name} is unbearable today?",
            f"Just saw a weather warning for {location_name}. Stay hydrated!",
            "Normal day, nothing much to report.",
            f"The smog in {location_name} is getting worse every year.",
            f"Feeling a bit anxious about the upcoming storm in {location_name}."
        ]
        
        # Randomly select a few messages to simulate a real-time feed
        selected_messages = random.sample(mock_messages, k=5)
        
        total_sentiment = 0
        stress_indicators = 0
        
        processed_data = []
        for msg in selected_messages:
            analysis = TextBlob(msg)
            polarity = analysis.sentiment.polarity
            processed_data.append({
                "text": msg,
                "sentiment": polarity
            })
            total_sentiment += polarity
            
            # Negative sentiment increases stress indicator
            if polarity < 0:
                stress_indicators += 1
                
        # Calculate Stress Score (1-10)
        # Low polarity and high stress indicators lead to higher stress score
        avg_sentiment = total_sentiment / len(selected_messages)
        # Normalize: -1 sentiment -> 10 stress, 1 sentiment -> 1 stress
        base_stress = 5 - (avg_sentiment * 5) 
        # Add factor for frequency of negative mentions
        stress_score = min(10, max(1, base_stress + (stress_indicators * 0.5)))
        
        severity = "Low"
        if stress_score >= 8: severity = "Critical"
        elif stress_score >= 6: severity = "High"
        elif stress_score >= 4: severity = "Moderate"

        return {
            "score": round(stress_score, 1),
            "severity": severity,
            "sentiment_average": round(avg_sentiment, 2),
            "recent_shouts": selected_messages,
            "stress_count": stress_indicators
        }

social_service = SocialAnalysisService()
