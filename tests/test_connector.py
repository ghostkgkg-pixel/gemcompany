import pytest
import json
import os
import sys

# Add backend to path so we can import connector
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from connector import GeminiConnector

def test_connector_basic_prompt():
    connector = GeminiConnector()
    # Use a simple prompt that should return a string
    response = connector.send_prompt("Say 'Hello'")
    assert isinstance(response, str)
    assert len(response) > 0
    assert "Hello" in response

def test_connector_json_response():
    connector = GeminiConnector()
    # Request a JSON response
    prompt = "Return a JSON object with a key 'status' and value 'ok'. Return ONLY the JSON."
    response_json = connector.send_prompt_json(prompt)
    
    assert isinstance(response_json, dict)
    assert response_json.get("status") == "ok"
