import json
import os
import uuid
import datetime
from typing import List, Dict, Any, Optional

try:
    from connector import GeminiConnector
except ImportError:
    import sys
    sys.path.append(os.path.dirname(__file__))
    from connector import GeminiConnector

class BaseMemoryManager:
    """Interface for memory management to support hybrid backends."""
    def add_memory(self, agent_id: str, text: str, level: str):
        raise NotImplementedError

    def query_memory(self, agent_id: str, query: str, level: str) -> List[str]:
        raise NotImplementedError

class SimpleMemoryManager(BaseMemoryManager):
    """Fallback memory manager using JSON files."""
    def __init__(self, connector: GeminiConnector, storage_path: str):
        self.connector = connector
        self.storage_path = storage_path
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _load_data(self) -> List[Dict[str, Any]]:
        with open(self.storage_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_data(self, data: List[Dict[str, Any]]):
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _summarize(self, text: str) -> str:
        prompt = f"Summarize the following dialogue/text concisely for long-term memory. Keep key details:\n\n{text}"
        return self.connector.send_prompt(prompt)

    def add_memory(self, agent_id: str, text: str, level: str):
        content = text
        is_summary = False
        if len(text.split()) > 40:
            content = self._summarize(text)
            is_summary = True
        
        data = self._load_data()
        data.append({
            "id": str(uuid.uuid4()),
            "agent_id": agent_id,
            "text": content,
            "level": level,
            "timestamp": datetime.datetime.now().isoformat(),
            "is_summary": is_summary,
            "original_text": text if is_summary else ""
        })
        self._save_data(data)

    def query_memory(self, agent_id: str, query: str, level: str) -> List[str]:
        data = [m for m in self._load_data() if m["agent_id"] == agent_id]
        
        if level == "Bronze":
            # Recent 3 entries
            sorted_mems = sorted(data, key=lambda x: x["timestamp"], reverse=True)
            return [m["text"] for m in sorted_mems[:3]]
        
        # For Silver/Gold, in a simple implementation without embeddings, 
        # we can use keywords or ask Gemini to rank/filter.
        # SaaS ready: Ask Gemini to act as a semantic search engine
        mems_to_search = data
        if level == "Silver":
            mems_to_search = [m for m in data if m["is_summary"]]
            if not mems_to_search: mems_to_search = data

        # Simple semantic-ish search via prompt
        context_str = "\n".join([f"- {m['text']}" for m in mems_to_search[-15:]]) # Limit context
        prompt = f"""Given the following memories of an agent:
{context_str}

Query: {query}

Select up to 5 most relevant memories that help answer the query. Return ONLY the text of these memories, separated by newlines."""
        
        response = self.connector.send_prompt(prompt)
        return [line.strip("- ") for line in response.split("\n") if line.strip()]

class ChromaMemoryManager(BaseMemoryManager):
    """Standard ChromaDB implementation (requires SQLite 3.35+)."""
    def __init__(self, connector: GeminiConnector, db_path: str):
        import chromadb
        self.connector = connector
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="agent_memories")

    def _summarize(self, text: str) -> str:
        prompt = f"Summarize the following dialogue/text concisely for long-term memory. Keep key details:\n\n{text}"
        return self.connector.send_prompt(prompt)

    def add_memory(self, agent_id: str, text: str, level: str):
        content = text
        is_summary = False
        if len(text.split()) > 40:
            content = self._summarize(text)
            is_summary = True
        
        self.collection.add(
            documents=[content],
            metadatas=[{
                "agent_id": agent_id, 
                "level": level, 
                "timestamp": datetime.datetime.now().isoformat(),
                "is_summary": is_summary,
                "original_text": text if is_summary else ""
            }],
            ids=[str(uuid.uuid4())]
        )

    def query_memory(self, agent_id: str, query: str, level: str) -> List[str]:
        # (Chroma implementation kept same as original logic...)
        if level == "Bronze":
            all_memories = self.collection.get(where={"agent_id": agent_id})
            combined = [{"doc": d, "ts": m["timestamp"]} for d, m in zip(all_memories["documents"], all_memories["metadatas"])]
            sorted_mems = sorted(combined, key=lambda x: x["ts"], reverse=True)
            return [x["doc"] for x in sorted_mems[:3]]
        
        where_clause = {"agent_id": agent_id}
        if level == "Silver":
             where_clause = {"$and": [{"agent_id": agent_id}, {"is_summary": True}]}
        
        results = self.collection.query(
            query_texts=[query],
            n_results=10 if level == "Gold" else 5,
            where=where_clause
        )
        return results["documents"][0]

def MemoryManager(connector=None, db_path="./memory_data"):
    """Factory function to return the best available MemoryManager."""
    conn = connector or GeminiConnector()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    abs_path = os.path.join(base_dir, db_path)

    try:
        # Check SQLite version before attempting Chroma
        import sqlite3
        v = sqlite3.sqlite_version_info
        if v[0] < 3 or (v[0] == 3 and v[1] < 35):
            raise RuntimeError("SQLite version too low")
        
        import chromadb
        return ChromaMemoryManager(conn, abs_path)
    except Exception as e:
        # Fallback to SimpleMemoryManager
        json_path = abs_path + ".json"
        return SimpleMemoryManager(conn, json_path)
