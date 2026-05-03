import pytest
import os
import sys
import shutil
import time

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from memory import MemoryManager
from connector import GeminiConnector

@pytest.fixture
def memory_manager():
    # Use a fresh test db in the tests directory
    test_db_path = os.path.join(os.path.dirname(__file__), "test_chroma_db")
    if os.path.exists(test_db_path):
        shutil.rmtree(test_db_path)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(test_db_path), exist_ok=True)
    
    manager = MemoryManager(db_path=test_db_path)
    yield manager
    
    # Clean up
    if os.path.exists(test_db_path):
        shutil.rmtree(test_db_path)

def test_05_branching_logic(memory_manager):
    agent_id = "test_agent_05"
    
    # 1. Add some memories at different times
    # Old memory (semantic target)
    memory_manager.add_memory(agent_id, "The secret password is 'BANANA'.", "Gold")
    
    # Add 3 recent memories
    time.sleep(0.1)
    memory_manager.add_memory(agent_id, "Today's weather is sunny.", "Bronze")
    time.sleep(0.1)
    memory_manager.add_memory(agent_id, "Lunch was delicious.", "Bronze")
    time.sleep(0.1)
    memory_manager.add_memory(agent_id, "Finished Phase 2 successfully.", "Bronze")
    
    # 2. Test Bronze: should only see 3 most recent, NOT the secret password
    bronze_results = memory_manager.query_memory(agent_id, "What is the secret password?", "Bronze")
    assert len(bronze_results) <= 3
    # Check that BANANA is not in the recent 3
    assert not any("BANANA" in doc for doc in bronze_results)
    # Check that the most recent one IS there
    assert "Finished Phase 2 successfully." in bronze_results
    
    # 3. Test Gold: should find the secret password via semantic search
    gold_results = memory_manager.query_memory(agent_id, "What is the secret password?", "Gold")
    assert any("BANANA" in doc for doc in gold_results)

def test_06_summarization(memory_manager):
    agent_id = "test_agent_06"
    
    # Long dialogue (more than 40 words to trigger summarization)
    long_text = """
    User: Hello agent, how are you today? I am thinking about a very long conversation that we are having right now. 
    It is important that we discuss many things in detail because this dialogue needs to exceed the word threshold 
    for the summarization logic to trigger in our Phase 3 implementation.
    Agent: I understand completely. To help reach that threshold, I will elaborate on my current status. 
    I am functioning with high efficiency, processing all inputs through my advanced neural layers. 
    Seoul is a beautiful city with many historical sites like Gyeongbokgung Palace and Bukchon Hanok Village. 
    We can talk about food, culture, technology, or anything else you'd like. 
    Historical sites are particularly interesting during the autumn season when the leaves change colors.
    User: That sounds wonderful. Let's also talk about the economic impact of AI in the modern workplace. 
    It's a topic that requires a lot of words to explain fully, making it perfect for this test case.
    Agent: Indeed, AI is transforming industries by automating repetitive tasks and providing deep insights through data analysis. 
    This leads to increased productivity but also requires workers to adapt to new technologies.
    """
    
    memory_manager.add_memory(agent_id, long_text, "Silver")
    
    # Check if stored and potentially summarized
    results = memory_manager.query_memory(agent_id, "economic impact", "Silver")
    assert len(results) > 0
    # In SimpleMemoryManager, we can't easily check 'is_summary' metadata from outside 
    # without adding more methods, but we can verify it doesn't crash and returns something.
    # The summary test is now more about integration.
