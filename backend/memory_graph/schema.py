from __future__ import annotations
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import time

class Entity(BaseModel):
    id: str
    type: str  # agent, file, concept, task
    name: str
    metadata: Dict[str, Any] = {}
    created_at: float = time.time()

class Relation(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: str  # CREATED_BY, REFERENCES, DISAGREES_WITH, PART_OF, COLLABORATED_WITH, OBSERVED
    metadata: Dict[str, Any] = {}
    created_at: float = time.time()

class GraphData(BaseModel):
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]
