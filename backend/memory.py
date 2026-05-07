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
    """하이브리드 백엔드 지원을 위한 메모리 관리 인터페이스"""
    def add_memory(self, agent_id: str, text: str, level: str):
        """에이전트의 기억을 추가함"""
        raise NotImplementedError

    def query_memory(self, agent_id: str, query: str, level: str) -> List[str]:
        """쿼리에 부합하는 기억을 조회함"""
        raise NotImplementedError

class SimpleMemoryManager(BaseMemoryManager):
    """JSON 파일을 사용하는 기본 메모리 관리자 (ChromaDB 사용 불가 시 폴백)"""
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
        """장기 기억 저장을 위해 텍스트를 요약함"""
        prompt = f"장기 기억 저장을 위해 다음 대화/텍스트를 핵심 내용 위주로 요약해줘:\n\n{text}"
        return self.connector.send_prompt(prompt)

    def add_memory(self, agent_id: str, text: str, level: str):
        """새로운 기억 추가 (텍스트가 길면 요약본 저장)"""
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
        """메모리 등급(Bronze/Silver/Gold)에 따른 기억 조회"""
        data = [m for m in self._load_data() if m["agent_id"] == agent_id]
        
        if level == "Bronze":
            # 브론즈: 최근 기억 3개 반환
            sorted_mems = sorted(data, key=lambda x: x["timestamp"], reverse=True)
            return [m["text"] for m in sorted_mems[:3]]
        
        # 실버/골드: LLM을 활용한 의미 기반 검색 시뮬레이션
        mems_to_search = data
        if level == "Silver":
            # 실버: 요약본(핵심 사건) 위주로 검색
            mems_to_search = [m for m in data if m["is_summary"]]
            if not mems_to_search: mems_to_search = data

        # LLM에게 관련 기억 추출 요청
        context_str = "\n".join([f"- {m['text']}" for m in mems_to_search[-15:]]) 
        prompt = f"""다음은 에이전트의 기억들입니다:
{context_str}

질문: {query}

질문에 답하는 데 가장 도움이 되는 기억을 최대 5개 선택해주세요. 기억의 텍스트만 한 줄씩 반환하세요."""
        
        response = self.connector.send_prompt(prompt)
        return [line.strip("- ") for line in response.split("\n") if line.strip()]

class ChromaMemoryManager(BaseMemoryManager):
    """ChromaDB를 사용하는 표준 벡터 데이터베이스 메모리 관리자"""
    def __init__(self, connector: GeminiConnector, db_path: str):
        import chromadb
        self.connector = connector
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="agent_memories")

    def _summarize(self, text: str) -> str:
        prompt = f"장기 기억 저장을 위해 다음 대화/텍스트를 핵심 내용 위주로 요약해줘:\n\n{text}"
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
        """벡터 유사도 기반의 고도화된 기억 검색"""
        if level == "Bronze":
            # 브론즈: 단순히 시간순 최근 기억 3개
            all_memories = self.collection.get(where={"agent_id": agent_id})
            combined = [{"doc": d, "ts": m["timestamp"]} for d, m in zip(all_memories["documents"], all_memories["metadatas"])]
            sorted_mems = sorted(combined, key=lambda x: x["ts"], reverse=True)
            return [x["doc"] for x in sorted_mems[:3]]
        
        where_clause = {"agent_id": agent_id}
        if level == "Silver":
             where_clause = {"$and": [{"agent_id": agent_id}, {"is_summary": True}]}
        
        # 벡터 검색 실행
        results = self.collection.query(
            query_texts=[query],
            n_results=10 if level == "Gold" else 5,
            where=where_clause
        )
        return results["documents"][0]

def MemoryManager(connector=None, db_path="./memory_data"):
    """시스템 환경에 맞춰 최적의 MemoryManager를 생성하는 팩토리 함수"""
    conn = connector or GeminiConnector()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    abs_path = os.path.join(base_dir, db_path)

    try:
        # SQLite 버전 체크 (ChromaDB 필수 조건)
        import sqlite3
        v = sqlite3.sqlite_version_info
        if v[0] < 3 or (v[0] == 3 and v[1] < 35):
            raise RuntimeError("SQLite 버전 부족")
        
        import chromadb
        return ChromaMemoryManager(conn, abs_path)
    except Exception:
        # 환경이 여의치 않으면 JSON 기반의 SimpleMemoryManager로 자동 폴백
        json_path = abs_path + ".json"
        return SimpleMemoryManager(conn, json_path)
