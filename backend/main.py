from __future__ import annotations
import asyncio
import json
import os
import re
import socketio
import time
import uuid
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 모듈별 임포트 (상태, 스키마, 유틸리티, 엔진)
import state
from schemas import (
    Agent, MapTemplate, MapZone, MapObstacle, ZoneCreateRequest, ZoneRemoveRequest,
    AgentHireRequest, AgentSpawnRequest, Task
)
from utils import (
    sanitize_filename, append_work_history, zone_summary_for_agent, 
    set_agent_action
)
from engine import (
    world_tick_loop, autonomous_decision_loop, get_agent_lock
)

# 외부 서비스 및 LLM 커넥터 임포트
from connector import GeminiConnector
from persona import PersonaManager
from skill_system import FAST_MODEL, SkillRegistry, SkillRouter, TaskClassifier
from work_memory import WorkMemoryManager
from memory_graph.engine import KnowledgeGraphEngine

# 핵심 서비스 및 엔진 초기화
skill_registry = SkillRegistry(state.SKILLS_DIR)
task_classifier = TaskClassifier()
skill_router = SkillRouter(skill_registry)
work_memory = WorkMemoryManager(os.path.join(state.BASE_DIR, "work_memory.json"))
graph_db_path = os.path.join(state.BASE_DIR, "knowledge_graph.db")
graph_engine = KnowledgeGraphEngine(graph_db_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 애플리케이션 수명 주기 관리 (시작 시/종료 시)
    """
    # 비동기 처리를 위한 우선순위 큐 초기화
    state.interactive_queue = asyncio.PriorityQueue()
    state.background_queue = asyncio.PriorityQueue()
    
    # 디스크로부터 기존 상태 로드
    state.load_state()
    sync_all_agents()
    
    # Socket.io 브로드캐스트용 헬퍼 함수
    async def sio_broadcast(event, data):
        await sio.emit(event, data)
        
    # 각종 백그라운드 태스크(월드 틱, 자율 결정 루프, LLM 워커) 실행
    asyncio.create_task(world_tick_loop(sio_broadcast))
    asyncio.create_task(autonomous_decision_loop(skill_router, task_classifier))
    asyncio.create_task(cli_worker("interactive", state.interactive_queue, sio_broadcast))
    asyncio.create_task(cli_worker("background", state.background_queue, sio_broadcast))
    yield

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False, engineio_logger=False)
sio_app = socketio.ASGIApp(sio)
app = FastAPI(title="Gem Company AI Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(state.OUTPUT_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=state.OUTPUT_DIR), name="outputs")

# --- 헬퍼 함수 (Helper Functions) ---

def hydrate_agent_runtime(agent: Agent) -> None:
    """에이전트의 런타임 데이터(스킬, 현재 태스크 등) 동기화"""
    snapshot = work_memory.snapshot(agent.id)
    agent.skill_profile = snapshot["profile"]
    agent.current_task = snapshot["current_task"]

def sync_all_agents() -> None:
    """메모리 상의 모든 에이전트 데이터를 런타임 상태와 동기화"""
    for agent in state.agents.values():
        hydrate_agent_runtime(agent)

async def broadcast_agents():
    """모든 클라이언트에게 에이전트 목록 업데이트 브로드캐스트"""
    await sio.emit("agents_update", [a.model_dump() for a in state.agents.values()])

def initialize_agent_profile(agent: Agent) -> None:
    """신규 고용 에이전트의 초기 프로필 및 추천 스킬 설정"""
    job_text = " ".join(str(v).lower() for v in [agent.persona.get("Job", ""), agent.name])
    preferred = []
    if any(k in job_text for k in ["developer", "engineer", "개발"]):
        preferred = ["code_generation", "bug_fix", "code_review"]
    
    work_memory.ensure_profile(agent.id, list(skill_registry.skills.keys()))
    bucket = work_memory._agent_bucket(agent.id)
    if preferred and not bucket["preferred_skills"]:
        bucket["preferred_skills"] = preferred
        work_memory.save()
    hydrate_agent_runtime(agent)

# --- 비동기 워커 로직 (Async Worker Logic) ---

async def process_agent_response(agent: Agent, response_data: Dict[str, Any], task_id: Optional[str] = None):
    """LLM의 응답 데이터를 해석하여 에이전트 행동 및 상태에 반영"""
    if not isinstance(response_data, dict):
        response_data = {"thought": str(response_data), "speech": "응답 해석 오류", "action": "Idle"}

    agent.current_thought = response_data.get("thought", "")
    agent.current_speech = response_data.get("speech", "")
    # 맵 객체와 상호작용 액션 수행
    set_agent_action(agent, response_data.get("action", "Idle"), state.current_map, state.MAP_TEMPLATES)

    # 생성된 파일 결과물 저장
    file_out = response_data.get("file_output")
    file_name = ""
    if isinstance(file_out, dict) and file_out.get("name") and file_out.get("content"):
        file_name = sanitize_filename(file_out["name"])
        with open(os.path.join(state.OUTPUT_DIR, file_name), "w", encoding="utf-8") as f:
            f.write(file_out["content"])

    # 태스크 완료 처리 및 메모리 저장
    if task_id:
        work_memory.complete_task(agent.id, task_id, response_data.get("work_result", "완료"), file_name=file_name)
    
    hydrate_agent_runtime(agent)
    await broadcast_agents()
    state.save_state()

async def cli_worker(worker_id: str, queue: asyncio.PriorityQueue, sio_callback):
    """LLM 프롬프트 처리 및 에이전트 자율 행동을 관리하는 워커"""
    connector = GeminiConnector(default_model=FAST_MODEL)
    loop = asyncio.get_event_loop()
    if queue is None: return
    while True:
        task = await queue.get()
        try:
            agent = state.agents.get(task.agent_id)
            if not agent: continue
            # 에이전트 락을 통해 동시성 제어
            async with get_agent_lock(task.agent_id):
                if task.task_id:
                    work_memory.mark_in_progress(task.agent_id, task.task_id)
                    hydrate_agent_runtime(agent)
                    await broadcast_agents()
                
                # LLM API 비동기 호출
                result = await loop.run_in_executor(None, connector.send_prompt_json, task.prompt, task.model)
                await process_agent_response(agent, result, task.task_id)
        except Exception as e:
            print(f"Worker {worker_id} error: {e}")
        finally:
            queue.task_done()

# --- API 엔드포인트 (API Endpoints) ---

@app.get("/map/current")
async def get_current_map():
    """현재 활성화된 맵 데이터 반환"""
    return state.current_map or state.MAP_TEMPLATES["standard_office"]

@app.get("/map/templates")
async def get_map_templates():
    """기본 템플릿, 사용자 회사, 저장된 모듈 목록 반환"""
    return {"defaults": state.MAP_TEMPLATES, "companies": state.USER_COMPANIES, "modules": state.USER_SAVED_MODULES}

@app.post("/map/sync")
async def sync_map_endpoint(map_data: MapTemplate):
    """클라이언트 맵 데이터를 서버와 강제 동기화"""
    state.current_map = map_data
    if map_data.id in state.USER_COMPANIES: state.USER_COMPANIES[map_data.id] = map_data
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok", "map": state.current_map}

@app.post("/map/obstacles/place")
async def place_obstacle(x: int, y: int, type: str, rotation: int = 0, flip_x: bool = False):
    """특정 위치에 장애물(가구) 배치"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    obs = MapObstacle(x=x, y=y, type=type, rotation=rotation, flip_x=flip_x)
    # 해당 위치의 기존 장애물 제거 후 새로 추가
    state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == x and o.y == y)]
    state.current_map.obstacles.append(obs)
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/obstacles/remove")
async def remove_obstacle(x: int, y: int):
    """특정 위치의 장애물 제거"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == x and o.y == y)]
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/set")
async def set_zone_tile(x: int, y: int, zone_type: str):
    """타일별 존(Zone) 타입 설정"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    if not state.current_map.zone_data:
        state.current_map.zone_data = [["none" for _ in range(state.current_map.width)] for _ in range(state.current_map.height)]
    state.current_map.zone_data[y][x] = zone_type
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/floors/set")
async def set_floor_tile(x: int, y: int, floor_type: str):
    """타일별 바닥재(Flooring) 타입 설정"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    if not state.current_map.floor_data:
        state.current_map.floor_data = [["none" for _ in range(state.current_map.width)] for _ in range(state.current_map.height)]
    state.current_map.floor_data[y][x] = floor_type
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/add")
async def add_zone(req: ZoneCreateRequest):
    """새로운 커스텀 존 정의 추가"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.zones.append(MapZone(**req.model_dump()))
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/remove")
async def remove_zone(req: ZoneRemoveRequest):
    """존 정의 삭제"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.zones = [z for z in state.current_map.zones if z.name != req.name]
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/save")
async def save_map_endpoint(name: str):
    """현재 맵을 새로운 모듈로 저장"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    new_map = state.current_map.model_copy(update={"name": name, "id": str(uuid.uuid4())[:8]})
    state.USER_SAVED_MODULES[name] = new_map
    state.save_state()
    return {"status": "ok"}

@app.post("/map/merge")
async def merge_map_endpoint(source_name: str, target_x: int, target_y: int):
    """저장된 모듈을 현재 맵의 특정 위치에 병합"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    
    # 모듈이나 템플릿에서 병합 소스 찾기
    source = state.USER_SAVED_MODULES.get(source_name) or state.MAP_TEMPLATES.get(source_name)
    if not source:
        all_sources = list(state.USER_SAVED_MODULES.values()) + list(state.MAP_TEMPLATES.values())
        source = next((m for m in all_sources if m.name == source_name), None)
        
    if not source: raise HTTPException(404, f"Module '{source_name}' not found")
    
    for obs in source.obstacles:
        nx, ny = target_x + obs.x, target_y + obs.y
        state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == nx and o.y == ny)]
        state.current_map.obstacles.append(obs.model_copy(update={"x": nx, "y": ny}))
    
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/merge_data")
async def merge_map_data_endpoint(source: MapData, target_x: int, target_y: int):
    """원시 맵 데이터를 현재 맵의 특정 위치에 직접 병합"""
    if not state.current_map: raise HTTPException(400, "No map selected")
    
    for obs in source.obstacles:
        nx, ny = target_x + obs.x, target_y + obs.y
        # 해당 위치의 기존 장애물 제거 후 새 장애물 추가
        state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == nx and o.y == ny)]
        state.current_map.obstacles.append(obs.model_copy(update={"x": nx, "y": ny}))
    
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/company/create")
async def create_company(name: str, template_id: str):
    """템플릿을 기반으로 새로운 회사(독립된 맵) 생성"""
    if template_id not in state.MAP_TEMPLATES: raise HTTPException(404, "Template not found")
    template = state.MAP_TEMPLATES[template_id]
    new_id = str(uuid.uuid4())[:8]
    new_company = template.model_copy(update={"id": new_id, "name": name})
    state.USER_COMPANIES[new_id] = new_company
    state.save_state()
    return {"status": "ok", "company": new_company}

@app.get("/agents")
async def list_agents():
    """모든 에이전트 목록 조회 및 동기화"""
    sync_all_agents()
    return [a.model_dump() for a in state.agents.values()]

@app.post("/agents/hire")
async def hire_agent(req: AgentHireRequest):
    """수동으로 신규 에이전트 생성 및 고용"""
    persona_data = {"Name": req.name, "Job": req.job, "Description": req.persona}
    appearance = {
        "body": req.body, "hair_style": req.hair_style, "hair_color": req.hair_color, 
        "outfit": req.outfit, "gender": req.gender
    }
    new_agent = Agent(
        id=str(uuid.uuid4())[:8], name=req.name, persona=persona_data, stats={}, x=2, y=2,
        current_action="Idle", current_thought="Ready", current_speech="Hello!",
        appearance=appearance
    )
    initialize_agent_profile(new_agent)
    state.agents[new_agent.id] = new_agent
    state.save_state()
    await broadcast_agents()
    return new_agent

@app.post("/agents/spawn")
async def spawn_agent_endpoint(req: AgentSpawnRequest):
    """에이전트 자율 생성 유도 (LLM 태스크 큐 삽입)"""
    new_id = str(uuid.uuid4())[:8]
    new_agent = Agent(
        id=new_id, name=f"Agent_{new_id}", 
        persona={"Job": req.description, "Role": req.description},
        stats={}, x=2, y=2, current_action="Idle", current_thought="Initializing...",
        current_speech="시스템에 접속했습니다."
    )
    initialize_agent_profile(new_agent)
    state.agents[new_id] = new_agent
    state.save_state()
    await broadcast_agents()
    
    # 신규 정체성 확립을 위한 LLM 태스크 할당
    prompt = f"당신은 신입 에이전트입니다. 당신의 역할은 '{req.description}'입니다. 당신의 페르소나를 구체화하고 첫 인사를 건네세요."
    state.interactive_queue.put_nowait(Task(priority=1, agent_id=new_id, prompt=prompt, model=FAST_MODEL))
    
    return {"status": "ok", "agent_id": new_id}

@app.delete("/agents/{agent_id}")
async def fire_agent(agent_id: str):
    """에이전트 삭제(해고)"""
    if agent_id in state.agents:
        del state.agents[agent_id]
        state.save_state()
        await broadcast_agents()
        return {"status": "ok"}
    raise HTTPException(404, "Agent not found")

@app.get("/account/plan")
async def get_plan():
    """현재 구독 플랜 정보 조회"""
    return {"plan": state.subscription_plan}

@app.get("/graph/data")
async def get_graph_data():
    """지식 그래프 시각화용 데이터 조회"""
    return graph_engine.get_graph_data().dict()

@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    """에이전트와 수동 채팅 (디버그/테스트용)"""
    if agent_id not in state.agents: raise HTTPException(404, "Agent not found")
    agent = state.agents[agent_id]
    agent.current_speech = f"'{message}'에 대해 생각 중이에요."
    await broadcast_agents()
    return agent

@app.post("/agents/{agent_id}/move")
async def move_agent_endpoint(agent_id: str, x: int, y: int):
    """에이전트 강제 좌표 이동 명령"""
    if agent_id not in state.agents: raise HTTPException(404, "Agent not found")
    agent = state.agents[agent_id]
    agent.target_x = x
    agent.target_y = y
    agent.current_action = f"Moving to ({x}, {y})"
    await broadcast_agents()
    return agent

# --- Socket.io 이벤트 핸들러 ---
@sio.event
async def connect(sid, environ, auth=None):
    """클라이언트 연결 시 초기 맵 및 에이전트 데이터 전송"""
    m_data = state.current_map or state.MAP_TEMPLATES["standard_office"]
    await sio.emit("map_update", m_data.model_dump(), to=sid)
    await sio.emit("agents_update", [a.model_dump() for a in state.agents.values()], to=sid)

# FastAPI와 Socket.io를 통합하여 ASGI 앱으로 구성
app = socketio.ASGIApp(sio, app)

if __name__ == "__main__":
    import uvicorn
    # 서버 실행 (0.0.0.0:8000)
    uvicorn.run(app, host="0.0.0.0", port=8000)
