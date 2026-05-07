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
from schemas import Agent, MapTemplate, MapZone, MapObstacle, ZoneCreateRequest, ZoneRemoveRequest
from state import (
    agents, current_map, MAP_TEMPLATES, USER_SAVED_MODULES, USER_COMPANIES,
    subscription_plan, interactive_queue, background_queue, 
    STATE_FILE, OUTPUT_DIR, ROOT_DIR, SKILLS_DIR, BASE_DIR,
    save_state, load_state
)
from utils import (
    sanitize_filename, append_work_history, zone_summary_for_agent, 
    set_agent_action
)
from engine import (
    world_tick_loop, autonomous_decision_loop, cli_worker, get_agent_lock
)

# External Logic Imports
from connector import GeminiConnector
from persona import PersonaManager
from skill_system import FAST_MODEL, SkillRegistry, SkillRouter, TaskClassifier
from work_memory import WorkMemoryManager
from memory_graph.engine import KnowledgeGraphEngine

# Initialize core services
skill_registry = SkillRegistry(SKILLS_DIR)
task_classifier = TaskClassifier()
skill_router = SkillRouter(skill_registry)
work_memory = WorkMemoryManager(os.path.join(BASE_DIR, "work_memory.json"))
graph_db_path = os.path.join(BASE_DIR, "knowledge_graph.db")
graph_engine = KnowledgeGraphEngine(graph_db_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global interactive_queue, background_queue
    load_state()
    sync_all_agents()
    
    # Setup Socket.io broadcast callbacks
    async def sio_agents_update(event, data):
        await sio.emit(event, data)
        
    asyncio.create_task(world_tick_loop(sio_agents_update))
    asyncio.create_task(autonomous_decision_loop(skill_router, task_classifier))
    
    # Start workers
    asyncio.create_task(cli_worker("interactive", interactive_queue, skill_router, work_memory, sio_agents_update))
    asyncio.create_task(cli_worker("background", background_queue, skill_router, work_memory, sio_agents_update))
    yield

# Socket.io & FastAPI Setup
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

os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Helper functions that depend on global services
def hydrate_agent_runtime(agent: Agent) -> None:
    snapshot = work_memory.snapshot(agent.id)
    agent.skill_profile = snapshot["profile"]
    agent.current_task = snapshot["current_task"]

def sync_all_agents() -> None:
    for agent in agents.values():
        hydrate_agent_runtime(agent)

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

# --- Socket.io Events ---
@sio.event
async def connect(sid, environ, auth=None):
    m_data = current_map or MAP_TEMPLATES["standard_office"]
    await sio.emit("map_update", m_data.model_dump(), to=sid)
    await sio.emit("agents_update", [a.model_dump() for a in agents.values()], to=sid)

# --- API Endpoints ---
@app.get("/map/current")
async def get_current_map():
    return current_map or MAP_TEMPLATES["standard_office"]

@app.get("/agents")
async def list_agents():
    sync_all_agents()
    return [a.model_dump() for a in agents.values()]

@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = agents[agent_id]
    classification = task_classifier.classify(message)
    # ... logic for handling chat ...
    return agent

# ... other endpoints (omitted for brevity in this snippet, but would be preserved/refactored) ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
