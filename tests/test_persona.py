import pytest
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from persona import PersonaManager
from connector import GeminiConnector

def test_analyze_persona_structure():
    manager = PersonaManager()
    description = "A highly creative UI designer who likes bright colors"
    result = manager.analyze_persona(description)
    
    # Check structure
    expected_keys = {"Intelligence", "Creativity", "Efficiency", "Social"}
    assert all(key in result for key in expected_keys)
    
    # Check values are between 1 and 10
    for key in expected_keys:
        assert 1 <= result[key] <= 10
    
    # Creativity should be high for this description
    assert result["Creativity"] >= 7

def test_recommend_tools_logic():
    manager = PersonaManager()
    
    # Test 1: High creativity and intelligence
    stats1 = {"Intelligence": 8, "Creativity": 9, "Efficiency": 5, "Social": 4}
    tools1 = manager.recommend_tools(stats1)
    assert "Code Execution" in tools1 or "Web Search" in tools1
    
    # Test 2: High efficiency
    stats2 = {"Intelligence": 5, "Creativity": 4, "Efficiency": 9, "Social": 5}
    tools2 = manager.recommend_tools(stats2)
    assert "File Management" in tools2
