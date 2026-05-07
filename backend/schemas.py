from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import asyncio

@dataclass(order=True)
class Task:
    """
    LLM 워커가 처리할 태스크 정의
    """
    priority: int                   # 우선순위 (낮을수록 먼저 처리)
    agent_id: str                   # 대상을 에이전트 ID
    prompt: str                     # LLM에 전달할 프롬프트
    model: str                      # 사용할 LLM 모델명
    task_id: Optional[str] = None   # 워크 메모리와 연동될 태스크 ID
    future: Optional[asyncio.Future] = field(default=None, compare=False)

class MapZone(BaseModel):
    """
    맵 내의 특정 구역(Zone) 정의
    """
    name: str                       # 구역 이름
    aliases: List[str] = []         # 구역을 부르는 별칭 목록
    x1: int; y1: int                # 시작 좌표
    x2: int; y2: int                # 끝 좌표
    color: Optional[str] = "#cccccc" # 시각화 시 사용할 색상
    icon: Optional[str] = "room"    # 아이콘 타입

class MapObstacle(BaseModel):
    """
    맵 내에 배치된 장애물(가구 등) 정의
    """
    x: int; y: int                  # 배치 좌표
    type: str                       # 장애물 타입 (desk, plant 등)
    rotation: int = 0               # 회전 각도
    flip_x: bool = False            # 좌우 반전 여부
    owner_id: Optional[str] = None  # 소유자(에이전트) ID

class MapTemplate(BaseModel):
    """
    맵의 전체 구조를 담는 템플릿 모델
    """
    id: str
    name: str
    width: int; height: int         # 맵 크기
    zones: List[MapZone]            # 정의된 구역 목록
    obstacles: List[MapObstacle] = [] # 배치된 장애물 목록
    zone_data: Optional[List[List[str]]] = None # 타일별 존 타입 데이터 (2D 배열)

class Agent(BaseModel):
    """
    오피스 시뮬레이션의 주인공, 에이전트 모델
    """
    id: str
    name: str
    persona: Dict                   # 성격, 배경 지식 등 페르소나 데이터
    stats: Dict                     # 능력치 정보
    x: int; y: int                  # 현재 좌표
    target_x: Optional[int] = None  # 목적지 X 좌표
    target_y: Optional[int] = None  # 목적지 Y 좌표
    path: List[List[int]] = []      # 현재 이동 중인 경로
    current_action: str             # 현재 수행 중인 행동 텍스트
    current_thought: str            # 현재 에이전트의 생각 (말풍선 표시용)
    current_speech: str             # 현재 에이전트의 대사 (채팅창/말풍선)
    appearance: Dict = {}           # 외형 설정 (머리 스타일, 옷 등)
    work_history: List[str] = []    # 과거 업무 이력
    last_action_time: float = 0.0   # 마지막 행동 시각
    skill_profile: Dict = {}        # 보유 스킬 프로필
    current_task: Optional[Dict[str, Any]] = None # 현재 할당된 태스크 정보

# --- API 요청용 스키마 (Request Schemas) ---

class ZoneCreateRequest(BaseModel):
    """구역 생성 요청"""
    name: str; x1: int; y1: int; x2: int; y2: int
    color: str = "#3b82f6"

class ZoneRemoveRequest(BaseModel):
    """구역 삭제 요청"""
    name: str

class AgentHireRequest(BaseModel):
    """에이전트 수동 고용 요청"""
    name: str; job: str; persona: str
    body: str; hair_style: str; hair_color: str; outfit: str; gender: str

class AgentSpawnRequest(BaseModel):
    """에이전트 자율 생성 요청"""
    description: str
