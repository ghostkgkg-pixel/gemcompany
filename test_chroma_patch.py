import sys
import sqlite3

# Original version
print(f"Original SQLite version: {sqlite3.sqlite_version}")

# Monkeypatch sqlite3
class Sqlite3Wrapper:
    def __init__(self, real_module):
        self.__dict__['real_module'] = real_module
        self.__dict__['sqlite_version'] = "3.35.0"
        self.__dict__['sqlite_version_info'] = (3, 35, 0)
    
    def __getattr__(self, name):
        return getattr(self.real_module, name)
    
    def __setattr__(self, name, value):
        setattr(self.real_module, name, value)

sys.modules['sqlite3'] = Sqlite3Wrapper(sqlite3)

# Mock posthog to avoid Python 3.8 type hint errors
from unittest.mock import MagicMock
sys.modules["posthog"] = MagicMock()

try:
    import chromadb
    print("ChromaDB imported successfully with monkeypatch!")
    client = chromadb.EphemeralClient()
    collection = client.get_or_create_collection("test")
    collection.add(documents=["hello"], ids=["1"])
    results = collection.query(query_texts=["hello"], n_results=1)
    print(f"Query result: {results['documents']}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed even with monkeypatch: {e}")
