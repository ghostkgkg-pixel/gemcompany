from connector import GeminiConnector
import json

class PersonaManager:
    def __init__(self, connector=None):
        self.connector = connector or GeminiConnector()
        self.stats_keys = ["Intelligence", "Creativity", "Efficiency", "Social"]

    def analyze_persona(self, description: str) -> dict:
        """
        Analyzes a natural language description and returns a JSON object with Name and stats.
        """
        prompt = (
            f"Analyze the following persona description: \"{description}\".\n"
            f"1. Extract the name (if provided, e.g., 'Aria') or generate a fitting name if not.\n"
            f"2. Assign scores (1-10) for Intelligence, Creativity, Efficiency, and Social.\n"
            "Return ONLY a JSON object with keys: 'Name', 'Intelligence', 'Creativity', 'Efficiency', 'Social'."
        )
        try:
            result = self.connector.send_prompt_json(prompt)
            # Basic validation and sanitization
            sanitized_result = {
                "Name": result.get("Name", "Unknown Agent")
            }
            for key in self.stats_keys:
                val = result.get(key, 5)
                if isinstance(val, (int, float)):
                    sanitized_result[key] = max(1, min(10, int(val)))
                else:
                    sanitized_result[key] = 5
            return sanitized_result
        except Exception as e:
            # Fallback in case of AI failure
            print(f"Error analyzing persona: {e}")
            return {key: 5 for key in self.stats_keys}

    def recommend_tools(self, stats: dict) -> list:
        """
        Recommends tools based on the highest stats.
        """
        recommendations = []
        
        # Logic for tool recommendations
        if stats.get("Creativity", 0) >= 7 or stats.get("Intelligence", 0) >= 7:
            recommendations.append("Code Execution")
            recommendations.append("Web Search")
        
        if stats.get("Efficiency", 0) >= 7:
            recommendations.append("File Management")
            
        if stats.get("Social", 0) >= 7:
            recommendations.append("Email & Communication")

        # Default tools if none recommended
        if not recommendations:
            recommendations = ["Web Search", "Note Taking"]
            
        return list(set(recommendations))
