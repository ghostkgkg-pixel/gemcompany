from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import asyncio

@dataclass(order=True)
class Task:
    priority: int
    agent_id: str
    prompt: str
    model: str
    task_id: Optional[str] = None
    future: Optional[asyncio.Future] = field(default=None, compare=False)

class MapZone(BaseModel):
    name: str
    aliases: List[str] = []
    x1: int
    y1: int
    x2: int
    y2: int
    color: Optional[str] = "#cccccc"
    icon: Optional[str] = "room"

class MapObstacle(BaseModel):
    x: int
    y: int
    type: str
    rotation: int = 0
    flip_x: bool = False
    owner_id: Optional[str] = None

class MapTemplate(BaseModel):
    id: str
    name: str
    width: int
    height: int
    zones: List[MapZone]
    obstacles: List[MapObstacle] = []
    zone_data: Optional[List[List[str]]] = None

class Agent(BaseModel):
    id: str
    name: str
    persona: Dict
    stats: Dict
    x: int
    y: int
    target_x: Optional[int] = None
    target_y: Optional[int] = None
    path: List[List[int]] = []
    current_action: str
    current_thought: str
    current_speech: str
    appearance: Dict = {}
    work_history: List[str] = []
    last_action_time: float = 0.0
    skill_profile: Dict = {}
    current_task: Optional[Dict[str, Any]] = None

class ZoneCreateRequest(BaseModel):
    name: str
    x1: int
    y1: int
    x2: int
    y2: int
    color: str = "#3b82f6"

class ZoneRemoveRequest(BaseModel):
    name: str
