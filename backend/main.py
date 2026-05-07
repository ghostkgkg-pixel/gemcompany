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

# Modular Imports
import state
from schemas import Agent, MapTemplate, MapZone, MapObstacle, ZoneCreateRequest, ZoneRemoveRequest
from utils import (
    sanitize_filename, append_work_history, zone_summary_for_agent, 
    set_agent_action
)
from engine import (
    world_tick_loop, autonomous_decision_loop, get_agent_lock
)

# External Logic Imports
from connector import GeminiConnector
from persona import PersonaManager
from skill_system import FAST_MODEL, SkillRegistry, SkillRouter, TaskClassifier
from work_memory import WorkMemoryManager
from memory_graph.engine import KnowledgeGraphEngine

# Initialize core services
skill_registry = SkillRegistry(state.SKILLS_DIR)
task_classifier = TaskClassifier()
skill_router = SkillRouter(skill_registry)
work_memory = WorkMemoryManager(os.path.join(state.BASE_DIR, "work_memory.json"))
graph_db_path = os.path.join(state.BASE_DIR, "knowledge_graph.db")
graph_engine = KnowledgeGraphEngine(graph_db_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    state.interactive_queue = asyncio.PriorityQueue()
    state.background_queue = asyncio.PriorityQueue()
    state.load_state()
    sync_all_agents()
    
    async def sio_broadcast(event, data):
        await sio.emit(event, data)
        
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

# --- Refactored Helper Functions ---
def hydrate_agent_runtime(agent: Agent) -> None:
    snapshot = work_memory.snapshot(agent.id)
    agent.skill_profile = snapshot["profile"]
    agent.current_task = snapshot["current_task"]

def sync_all_agents() -> None:
    for agent in state.agents.values():
        hydrate_agent_runtime(agent)

async def broadcast_agents():
    await sio.emit("agents_update", [a.model_dump() for a in state.agents.values()])

def initialize_agent_profile(agent: Agent) -> None:
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

# --- Complex Worker Logic (Restored) ---
async def process_agent_response(agent: Agent, response_data: Dict[str, Any], task_id: Optional[str] = None):
    if not isinstance(response_data, dict):
        response_data = {"thought": str(response_data), "speech": "응답 해석 오류", "action": "Idle"}

    agent.current_thought = response_data.get("thought", "")
    agent.current_speech = response_data.get("speech", "")
    set_agent_action(agent, response_data.get("action", "Idle"), state.current_map, state.MAP_TEMPLATES)

    file_out = response_data.get("file_output")
    file_name = ""
    if isinstance(file_out, dict) and file_out.get("name") and file_out.get("content"):
        file_name = sanitize_filename(file_out["name"])
        with open(os.path.join(state.OUTPUT_DIR, file_name), "w", encoding="utf-8") as f:
            f.write(file_out["content"])

    if task_id:
        work_memory.complete_task(agent.id, task_id, response_data.get("work_result", "완료"), file_name=file_name)
    
    hydrate_agent_runtime(agent)
    await broadcast_agents()
    state.save_state()

async def cli_worker(worker_id: str, queue: asyncio.PriorityQueue, sio_callback):
    connector = GeminiConnector(default_model=FAST_MODEL)
    loop = asyncio.get_event_loop()
    if queue is None: return
    while True:
        task = await queue.get()
        try:
            agent = state.agents.get(task.agent_id)
            if not agent: continue
            async with get_agent_lock(task.agent_id):
                if task.task_id:
                    work_memory.mark_in_progress(task.agent_id, task.task_id)
                    hydrate_agent_runtime(agent)
                    await broadcast_agents()
                
                result = await loop.run_in_executor(None, connector.send_prompt_json, task.prompt, task.model)
                await process_agent_response(agent, result, task.task_id)
        except Exception as e:
            print(f"Worker {worker_id} error: {e}")
        finally:
            queue.task_done()

# --- API Endpoints ---

@app.get("/map/current")
async def get_current_map():
    return state.current_map or state.MAP_TEMPLATES["standard_office"]

@app.get("/map/templates")
async def get_map_templates():
    return {"defaults": state.MAP_TEMPLATES, "companies": state.USER_COMPANIES, "modules": state.USER_SAVED_MODULES}

@app.post("/map/sync")
async def sync_map_endpoint(map_data: MapTemplate):
    state.current_map = map_data
    if map_data.id in state.USER_COMPANIES: state.USER_COMPANIES[map_data.id] = map_data
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok", "map": state.current_map}

@app.post("/map/obstacles/place")
async def place_obstacle(x: int, y: int, type: str, rotation: int = 0, flip_x: bool = False):
    if not state.current_map: raise HTTPException(400, "No map selected")
    obs = MapObstacle(x=x, y=y, type=type, rotation=rotation, flip_x=flip_x)
    state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == x and o.y == y)]
    state.current_map.obstacles.append(obs)
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/obstacles/remove")
async def remove_obstacle(x: int, y: int):
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == x and o.y == y)]
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/set")
async def set_zone_tile(x: int, y: int, zone_type: str):
    if not state.current_map: raise HTTPException(400, "No map selected")
    if not state.current_map.zone_data:
        state.current_map.zone_data = [["none" for _ in range(state.current_map.width)] for _ in range(state.current_map.height)]
    state.current_map.zone_data[y][x] = zone_type
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/add")
async def add_zone(req: ZoneCreateRequest):
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.zones.append(MapZone(**req.model_dump()))
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/zones/remove")
async def remove_zone(req: ZoneRemoveRequest):
    if not state.current_map: raise HTTPException(400, "No map selected")
    state.current_map.zones = [z for z in state.current_map.zones if z.name != req.name]
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/map/save")
async def save_map_endpoint(name: str):
    if not state.current_map: raise HTTPException(400, "No map selected")
    new_map = state.current_map.model_copy(update={"name": name, "id": str(uuid.uuid4())[:8]})
    state.USER_SAVED_MODULES[name] = new_map
    state.save_state()
    return {"status": "ok"}

@app.post("/map/merge")
async def merge_map_endpoint(source_name: str, target_x: int, target_y: int):
    if not state.current_map: raise HTTPException(400, "No map selected")
    source = state.USER_SAVED_MODULES.get(source_name)
    if not source: raise HTTPException(404, "Module not found")
    for obs in source.obstacles:
        nx, ny = target_x + obs.x, target_y + obs.y
        state.current_map.obstacles = [o for o in state.current_map.obstacles if not (o.x == nx and o.y == ny)]
        state.current_map.obstacles.append(obs.model_copy(update={"x": nx, "y": ny}))
    state.save_state()
    await sio.emit("map_update", state.current_map.model_dump())
    return {"status": "ok"}

@app.post("/company/create")
async def create_company(name: str, template_id: str):
    if template_id not in state.MAP_TEMPLATES: raise HTTPException(404, "Template not found")
    template = state.MAP_TEMPLATES[template_id]
    new_id = str(uuid.uuid4())[:8]
    new_company = template.model_copy(update={"id": new_id, "name": name})
    state.USER_COMPANIES[new_id] = new_company
    state.save_state()
    return {"status": "ok", "company": new_company}

@app.get("/agents")
async def list_agents():
    sync_all_agents()
    return [a.model_dump() for a in state.agents.values()]

@app.post("/agents/hire")
async def hire_agent(name: str, job: str, persona: str, body: str, hair_style: str, hair_color: str, outfit: str, gender: str):
    persona_data = {"Name": name, "Job": job, "Description": persona}
    appearance = {"body": body, "hair_style": hair_style, "hair_color": hair_color, "outfit": outfit, "gender": gender}
    new_agent = Agent(
        id=str(uuid.uuid4())[:8], name=name, persona=persona_data, stats={}, x=2, y=2,
        current_action="Idle", current_thought="Ready", current_speech="Hello!",
        appearance=appearance
    )
    initialize_agent_profile(new_agent)
    state.agents[new_agent.id] = new_agent
    state.save_state()
    await broadcast_agents()
    return new_agent

@app.delete("/agents/{agent_id}")
async def fire_agent(agent_id: str):
    if agent_id in state.agents:
        del state.agents[agent_id]
        state.save_state()
        await broadcast_agents()
        return {"status": "ok"}
    raise HTTPException(404, "Agent not found")

@app.get("/account/plan")
async def get_plan():
    return {"plan": state.subscription_plan}

@app.get("/graph/data")
async def get_graph_data():
    return graph_engine.get_graph_data().dict()

@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    if agent_id not in state.agents: raise HTTPException(404, "Agent not found")
    agent = state.agents[agent_id]
    # Simplified chat for refactor validation, real logic involves cli_worker
    agent.current_speech = f"'{message}'에 대해 생각 중이에요."
    await broadcast_agents()
    return agent

@app.post("/agents/{agent_id}/move")
async def move_agent_endpoint(agent_id: str, x: int, y: int):
    if agent_id not in state.agents: raise HTTPException(404, "Agent not found")
    agent = state.agents[agent_id]
    agent.target_x = x
    agent.target_y = y
    agent.current_action = f"Moving to ({x}, {y})"
    await broadcast_agents()
    return agent

# --- Socket.io Events ---
@sio.event
async def connect(sid, environ, auth=None):
    m_data = state.current_map or state.MAP_TEMPLATES["standard_office"]
    await sio.emit("map_update", m_data.model_dump(), to=sid)
    await sio.emit("agents_update", [a.model_dump() for a in state.agents.values()], to=sid)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
