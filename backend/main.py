from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import os
from pathfinding import AStar
from pydantic import BaseModel
import random
import re
import socketio
import time
from typing import Any, Dict, List, Optional
import uuid

from connector import GeminiConnector
from persona import PersonaManager
from skill_system import FAST_MODEL, SkillRegistry, SkillRouter, TaskClassifier
from work_memory import WorkMemoryManager
from memory_graph.engine import KnowledgeGraphEngine


@dataclass(order=True)
class CLITask:
    priority: int
    created_at: float = field(default_factory=time.time)
    prompt: str = field(compare=False, default="")
    kind: str = field(compare=False, default="work_execution")
    model: str = field(compare=False, default=FAST_MODEL)
    agent_id: str = field(compare=False, default="")
    task_id: str = field(compare=False, default="")
    summary: str = field(compare=False, default="")
    skill_id: str = field(compare=False, default="")
    workspace_dir: Optional[str] = field(compare=False, default=None)
    future: Optional[asyncio.Future] = field(compare=False, default=None)


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


class ZoneCreateRequest(BaseModel):
    name: str
    x1: int
    y1: int
    x2: int
    y2: int
    color: str = "#3b82f6"


class ZoneRemoveRequest(BaseModel):
    name: str


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


MAP_TEMPLATES = {
    "standard_office": MapTemplate(
        id="standard_office",
        name="Gem Company Headquarters",
        width=24,
        height=24,
        zone_data=[["none" for _ in range(24)] for _ in range(24)],
        zones=[],
        obstacles=[],
    )
}

agents: Dict[str, Agent] = {}
current_map: Optional[MapTemplate] = None
USER_SAVED_MAPS: Dict[str, MapTemplate] = {}
interactive_queue: Optional[asyncio.PriorityQueue] = None
background_queue: Optional[asyncio.PriorityQueue] = None
agent_locks: Dict[str, asyncio.Lock] = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
STATE_FILE = os.path.join(BASE_DIR, "world_state.json")
WORK_MEMORY_FILE = os.path.join(BASE_DIR, "work_memory.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "work_outputs")
SKILLS_DIR = os.path.join(ROOT_DIR, "skills", "office")

skill_registry = SkillRegistry(SKILLS_DIR)
task_classifier = TaskClassifier()
skill_router = SkillRouter(skill_registry)
work_memory = WorkMemoryManager(WORK_MEMORY_FILE)
graph_db_path = os.path.join(BASE_DIR, "knowledge_graph.db")
graph_engine = KnowledgeGraphEngine(graph_db_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global interactive_queue, background_queue
    interactive_queue = asyncio.PriorityQueue()
    background_queue = asyncio.PriorityQueue()
    load_state()
    sync_all_agents()
    asyncio.create_task(world_tick_loop())
    asyncio.create_task(autonomous_decision_loop())
    asyncio.create_task(cli_worker("interactive", interactive_queue))
    asyncio.create_task(cli_worker("background", background_queue))
    asyncio.create_task(cli_worker("background", background_queue))
    yield


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*", logger=False, engineio_logger=False)
sio_app = socketio.ASGIApp(sio)
app = FastAPI(title="AI Agent Office Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


def get_agent_lock(agent_id: str) -> asyncio.Lock:
    if agent_id not in agent_locks:
        agent_locks[agent_id] = asyncio.Lock()
    return agent_locks[agent_id]


def default_allowed_skills() -> List[str]:
    return list(skill_registry.skills.keys())


def hydrate_agent_runtime(agent: Agent) -> None:
    snapshot = work_memory.snapshot(agent.id)
    agent.skill_profile = snapshot["profile"]
    agent.current_task = snapshot["current_task"]


def sync_all_agents() -> None:
    for agent in agents.values():
        hydrate_agent_runtime(agent)


def sanitize_filename(name: str) -> str:
    cleaned = "".join(c for c in name if c.isalnum() or c in "._-").strip("._")
    if not cleaned:
        cleaned = f"work_{uuid.uuid4().hex[:8]}.md"
    if len(cleaned) > 80:
        prefix, _, suffix = cleaned.rpartition(".")
        cleaned = (prefix[:60] if prefix else cleaned[:60]) + (f".{suffix[:10]}" if suffix else "")
    return cleaned


def append_work_history(agent: Agent, message: str) -> None:
    agent.work_history.append(f"[{time.strftime('%H:%M')}] {message}")
    agent.work_history = agent.work_history[-12:]


def zone_summary_for_agent(agent: Agent) -> str:
    m = current_map or MAP_TEMPLATES["standard_office"]
    for zone in m.zones:
        if zone.x1 <= agent.x <= zone.x2 and zone.y1 <= agent.y <= zone.y2:
            return zone.name
    return "Hallway"


def set_agent_action(agent: Agent, action: str) -> None:
    m = current_map or MAP_TEMPLATES["standard_office"]
    if not action or not isinstance(action, str):
        action = "Idle"

    if action.startswith("Moving to "):
        target_str = action.replace("Moving to ", "").strip()
        coord_match = re.match(r"\(?(\d+)\s*,\s*(\d+)\)?", target_str)
        if coord_match:
            agent.target_x = int(coord_match.group(1))
            agent.target_y = int(coord_match.group(2))
            agent.current_action = f"Moving to ({agent.target_x}, {agent.target_y})"
            return

        target_zone = next(
            (
                zone
                for zone in m.zones
                if zone.name.lower() == target_str.lower()
                or any(alias.lower() == target_str.lower() for alias in zone.aliases)
            ),
            None,
        )
        if target_zone:
            agent.target_x = (target_zone.x1 + target_zone.x2) // 2
            agent.target_y = (target_zone.y1 + target_zone.y2) // 2
            agent.current_action = f"Moving to {target_zone.name}"
            return

    agent.current_action = action


def save_state() -> None:
    sync_all_agents()
    state = {
        "agents": [agent.dict() for agent in agents.values()],
        "current_map": current_map.dict() if current_map else None,
        "user_saved_maps": {k: v.dict() for k, v in USER_SAVED_MAPS.items()},
    }
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def load_state() -> None:
    global current_map
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
        for agent_data in state.get("agents", []):
            agent = Agent(**agent_data)
            hydrate_agent_runtime(agent)
            agents[agent.id] = agent
        if state.get("current_map"):
            current_map = MapTemplate(**state["current_map"])
        for map_id, map_data in state.get("user_saved_maps", {}).items():
            USER_SAVED_MAPS[map_id] = MapTemplate(**map_data)
    except Exception as exc:
        print(f"Failed to load state: {exc}")


@sio.event
async def connect(sid, environ, auth=None):
    sync_all_agents()
    m_data = current_map or MAP_TEMPLATES["standard_office"]
    await sio.emit("map_update", m_data.model_dump(), to=sid)
    await sio.emit("agents_update", [agent.model_dump() for agent in agents.values()], to=sid)


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


async def broadcast_agents():
    sync_all_agents()
    await sio.emit("agents_update", [agent.model_dump() for agent in agents.values()])


async def broadcast_map(map_data):
    await sio.emit("map_update", map_data)


def build_task_prompt(agent: Agent, message: str, task_type: str):
    brief = work_memory.build_brief(agent.id)
    profile = work_memory.ensure_profile(agent.id, default_allowed_skills())
    selection = skill_router.select_skill(agent.model_dump(), task_type, brief, profile)
    skill = selection.skill

    persona_summary = {
        "name": agent.name,
        "job": agent.persona.get("Job", agent.persona.get("Role", "Generalist")),
        "stats": agent.stats,
        "zone": zone_summary_for_agent(agent),
    }
    recent_results = "\n".join(f"- {item}" for item in brief.recent_results) or "- None"
    recent_failures = "\n".join(f"- {item}" for item in brief.recent_failures) or "- None"
    current_task = brief.current_task or "None"

    prompt = (
        "You are an office AI agent working inside a virtual office simulation.\n"
        "Use reasonable assumptions and make progress without asking for more detail unless you are truly blocked.\n"
        "If the request implies a codebase task, inspect the current project files and produce the best concrete artifact you can.\n"
        f"Persona Summary: {json.dumps(persona_summary, ensure_ascii=False)}\n"
        f"Current Task Brief: {current_task}\n"
        f"Recent Results:\n{recent_results}\n"
        f"Recent Failures:\n{recent_failures}\n"
        f"User Request: {message}\n\n"
        "Selected Skill:\n"
        f"{skill.prompt}\n\n"
        "Output Rules:\n"
        "- Respond in Korean.\n"
        "- Return JSON only.\n"
        "- 'action' should usually be 'Idle' unless movement is essential.\n"
        "- Include 'file_output' when the work benefits from a saved artifact.\n"
        "- Prefer delivering a useful draft, code snippet, or file over asking clarifying questions.\n"
    )
    return prompt, selection


def initialize_agent_profile(agent: Agent) -> None:
    job_text = " ".join(
        str(value).lower()
        for value in [agent.persona.get("Job", ""), agent.persona.get("Role", ""), agent.name]
    )
    preferred = []
    if any(keyword in job_text for keyword in ["developer", "engineer", "개발"]):
        preferred = ["code_generation", "bug_fix", "code_review"]
    elif any(keyword in job_text for keyword in ["marketing", "marketer", "마케팅"]):
        preferred = ["marketing_copy", "research_summary"]
    elif any(keyword in job_text for keyword in ["planner", "manager", "기획", "pm"]):
        preferred = ["feature_spec_write", "document_write", "research_summary"]

    snapshot = work_memory.snapshot(agent.id)
    profile = snapshot["profile"]
    if not profile["allowed_skills"]:
        work_memory.ensure_profile(agent.id, default_allowed_skills())
    bucket = work_memory._agent_bucket(agent.id)
    if preferred and not bucket["preferred_skills"]:
        bucket["preferred_skills"] = preferred
        work_memory.save()
    hydrate_agent_runtime(agent)


async def apply_local_response(agent: Agent, speech: str, action: str, thought: str = "") -> None:
    agent.current_speech = speech
    agent.current_thought = thought
    agent.last_action_time = time.time()
    set_agent_action(agent, action)
    hydrate_agent_runtime(agent)
    await broadcast_agents()
    save_state()


async def process_agent_response(agent: Agent, response_data: Dict[str, Any], cli_task: Optional[CLITask] = None):
    if not isinstance(response_data, dict):
        response_data = {
            "thought": str(response_data),
            "speech": "응답을 해석하는 중 문제가 생겼어요.",
            "action": "Idle",
        }

    agent.current_thought = response_data.get("thought", "")
    agent.current_speech = response_data.get("speech", "")
    agent.last_action_time = time.time()
    set_agent_action(agent, response_data.get("action", "Idle"))

    work_result = response_data.get("work_result", "")
    file_name = ""
    file_out = response_data.get("file_output")
    if isinstance(file_out, dict) and file_out.get("name") and file_out.get("content"):
        file_name = sanitize_filename(file_out["name"])
        with open(os.path.join(OUTPUT_DIR, file_name), "w", encoding="utf-8") as f:
            f.write(file_out["content"])

    if work_result:
        history_item = work_result
        if file_name:
            history_item = f"FILE:{file_name}|{work_result}"
        append_work_history(agent, history_item)

    if cli_task and cli_task.task_id:
        work_memory.complete_task(agent.id, cli_task.task_id, work_result or "작업 완료", file_name=file_name)

    hydrate_agent_runtime(agent)
    
    # Record work in knowledge graph (Approved Phase 6 Plan)
    graph_engine.record_entity(agent.id, "agent", agent.name, {"role": agent.persona.get("Job", "직원")})
    if file_name:
        file_id = f"file_{file_name}"
        graph_engine.record_entity(file_id, "file", file_name, {"path": f"work_outputs/{file_name}"})
        graph_engine.record_relation(agent.id, file_id, "CREATED_BY")
        
        # Collaborative observation
        for other_id, other_agent in agents.items():
            if other_id != agent.id:
                graph_engine.record_relation(other_id, file_id, "OBSERVED")

    await broadcast_agents()
    save_state()


async def handle_task_failure(agent: Agent, cli_task: CLITask, error: Exception):
    if cli_task.task_id:
        work_memory.fail_task(agent.id, cli_task.task_id, str(error))
    agent.current_thought = str(error)
    agent.current_speech = "작업 중 문제가 생겨서 다시 확인이 필요해요."
    agent.current_action = "Idle"
    hydrate_agent_runtime(agent)
    await broadcast_agents()
    save_state()


async def cli_worker(queue_name: str, queue: asyncio.PriorityQueue):
    connector = GeminiConnector(default_model=FAST_MODEL)
    loop = asyncio.get_event_loop()
    while True:
        task: CLITask = await queue.get()
        try:
            agent = agents.get(task.agent_id)
            if agent is None:
                continue

            async with get_agent_lock(task.agent_id):
                if task.task_id:
                    work_memory.mark_in_progress(task.agent_id, task.task_id)
                    hydrate_agent_runtime(agent)
                    await broadcast_agents()
                result = await loop.run_in_executor(
                    None,
                    connector.send_prompt_json,
                    task.prompt,
                    task.model,
                    task.workspace_dir,
                )
                await process_agent_response(agent, result, task)
                if task.future and not task.future.done():
                    task.future.set_result(result)
        except Exception as exc:
            agent = agents.get(task.agent_id)
            if agent is not None:
                await handle_task_failure(agent, task, exc)
            if task.future and not task.future.done():
                task.future.set_exception(exc)
        finally:
            queue.task_done()
            if queue_name == "background":
                await asyncio.sleep(0.2)


def create_agent(name: str, persona_data: Dict[str, Any], appearance: Dict[str, Any], x: int, y: int) -> Agent:
    agent = Agent(
        id=str(uuid.uuid4())[:8],
        name=name,
        persona=persona_data,
        stats={k: v for k, v in persona_data.items() if k not in {"Name", "Job"}},
        x=x,
        y=y,
        current_action="Idle",
        current_thought="Ready for work.",
        current_speech="안녕하세요!",
        appearance=appearance,
    )
    initialize_agent_profile(agent)
    return agent


def is_agent_busy(agent: Agent) -> bool:
    current_task = agent.current_task or {}
    return current_task.get("status") in {"queued", "in_progress"}


async def enqueue_skill_task(agent: Agent, message: str, task_type: str, priority: int = 1) -> None:
    prompt, selection = build_task_prompt(agent, message, task_type)
    task_id = str(uuid.uuid4())[:8]
    work_memory.start_task(agent.id, task_id, task_type, selection.skill.id, message)
    hydrate_agent_runtime(agent)
    agent.current_action = f"Working with {selection.skill.name}"
    append_work_history(agent, f"TASK:{task_type}|{message[:80]}")
    task = CLITask(
        priority=priority,
        prompt=prompt,
        kind="work_execution",
        model=selection.model,
        agent_id=agent.id,
        task_id=task_id,
        summary=message,
        skill_id=selection.skill.id,
        workspace_dir=ROOT_DIR,
    )
    target_queue = interactive_queue if priority == 0 else background_queue
    await target_queue.put(task)


async def world_tick_loop():
    while True:
        m = current_map or MAP_TEMPLATES["standard_office"]
        obs_tuples = [(obs.x, obs.y) for obs in m.obstacles]
        astar = AStar(m.width, m.height, obs_tuples)
        changed = False

        for agent in agents.values():
            if agent.target_x is None or agent.target_y is None:
                continue
            target = (agent.target_x, agent.target_y)
            current = (agent.x, agent.y)

            if current == target:
                agent.target_x = None
                agent.target_y = None
                agent.path = []
                if not is_agent_busy(agent):
                    agent.current_action = "Idle"
                changed = True
                continue

            path_invalid = any(tuple(step) in obs_tuples for step in agent.path)
            if not agent.path or tuple(agent.path[-1]) != target or path_invalid:
                new_path = astar.find_path(current, target)
                if new_path:
                    agent.path = [list(step) for step in new_path]
                else:
                    agent.target_x = None
                    agent.target_y = None
                    agent.path = []
                    agent.current_action = "Unreachable"
                    changed = True
                    continue

            if agent.path:
                next_step = agent.path.pop(0)
                agent.x, agent.y = next_step[0], next_step[1]
                changed = True

        if changed:
            await broadcast_agents()
        await asyncio.sleep(0.5)


async def autonomous_decision_loop():
    while True:
        await asyncio.sleep(8)
        if not agents:
            continue
        idle_agents = [agent for agent in agents.values() if not is_agent_busy(agent) and agent.current_action in {"Idle", "Unreachable"}]
        if not idle_agents:
            continue

        agent = random.choice(idle_agents)
        zone = zone_summary_for_agent(agent)
        if random.random() < 0.55:
            available_zones = [item for item in (current_map or MAP_TEMPLATES["standard_office"]).zones if item.name != zone]
            if available_zones:
                destination = random.choice(available_zones)
                set_agent_action(agent, f"Moving to {destination.name}")
                agent.current_speech = f"{destination.name} 쪽 상황을 보고 올게요."
                agent.current_thought = "Doing a lightweight patrol."
        else:
            job = agent.persona.get("Job", agent.persona.get("Role", "직원"))
            agent.current_speech = f"{job} 관점에서 다음 작업을 준비 중이에요."
            agent.current_thought = "Waiting for the next meaningful task."
            agent.current_action = "Idle"
        agent.last_action_time = time.time()
        await broadcast_agents()
        save_state()


@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agents[agent_id]
    hydrate_agent_runtime(agent)
    classification = task_classifier.classify(message)

    if not classification.requires_cli:
        await apply_local_response(
            agent,
            classification.local_speech,
            classification.local_action,
            thought=f"Handled locally via {classification.reason}",
        )
        return agent

    if is_agent_busy(agent):
        await apply_local_response(
            agent,
            "지금 다른 무거운 작업을 처리 중이라서, 완료 후 다시 요청해 주세요.",
            agent.current_action or "Idle",
            thought="Busy with an existing heavy task.",
        )
        return agent

    await enqueue_skill_task(agent, message, classification.task_type, priority=0)
    agent.current_speech = classification.local_speech
    agent.current_thought = f"Routing task as {classification.task_type}"
    agent.last_action_time = time.time()
    await broadcast_agents()
    save_state()
    return agent


@app.get("/map/current")
async def get_current_map():
    return current_map or MAP_TEMPLATES["standard_office"]


@app.get("/graph/data")
async def get_graph_data():
    return graph_engine.get_graph_data().dict()


@app.get("/agents")
async def list_agents():
    sync_all_agents()
    return [a.dict() for a in agents.values()]


@app.delete("/agents/{agent_id}")
async def fire_agent(agent_id: str):
    try:
        print(f"[DEBUG] Attempting to fire agent: {agent_id}")
        
        # Robust ID lookup
        target_key = None
        if agent_id in agents:
            target_key = agent_id
        else:
            for k, v in agents.items():
                if v.id == agent_id:
                    target_key = k
                    break
                    
        if not target_key:
            print(f"[ERROR] Agent {agent_id} not found. Keys: {list(agents.keys())}")
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        
        agent_obj = agents[target_key]
        agent_name = agent_obj.name
        
        # Remove from runtime
        del agents[target_key]
        
        # Update knowledge graph
        try:
            graph_engine.record_entity(agent_id, "agent", agent_name, {"status": "fired", "fired_at": time.time()})
        except Exception as ge_err:
            print(f"[WARNING] Graph recording failed: {ge_err}")
        except Exception as ge_err:
            print(f"[WARNING] Graph recording failed during fire: {ge_err}")
        
        save_state()
        await broadcast_agents()
        await sio.emit("agent_fired", {"agent_id": agent_id, "name": agent_name})
        
        print(f"[SUCCESS] Agent {agent_name} ({agent_id}) has been fired.")
        return {"status": "success", "message": f"Agent {agent_name} has been fired."}
    except Exception as e:
        print(f"[CRITICAL ERROR] Fire agent failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/map/select/{map_id}")
async def select_map(map_id: str):
    global current_map
    if map_id in MAP_TEMPLATES:
        current_map = MAP_TEMPLATES[map_id]
    elif map_id in USER_SAVED_MAPS:
        current_map = USER_SAVED_MAPS[map_id]
    else:
        raise HTTPException(status_code=404, detail="Map not found")
    await broadcast_map(current_map.model_dump())
    save_state()
    return current_map


@app.post("/agents/spawn")
async def spawn_agent(description: str):
    pm = PersonaManager()
    persona_data = pm.analyze_persona(description)
    m = current_map or MAP_TEMPLATES["standard_office"]
    agent = create_agent(
        name=persona_data.get("Name", "New Agent"),
        persona_data=persona_data,
        appearance={"body": "body_light", "hair_style": "hair_short", "hair_color": "#4B2C20", "outfit": "agent_dev", "gender": "male"},
        x=random.randint(0, m.width - 1),
        y=random.randint(0, m.height - 1),
    )
    agents[agent.id] = agent
    await broadcast_agents()
    save_state()
    return agent


@app.post("/agents/hire")
async def hire_agent(name: str, job: str, persona: str, body: str, hair_style: str, hair_color: str, outfit: str, gender: str = "male"):
    pm = PersonaManager()
    persona_data = pm.analyze_persona(f"Job: {job}. Personality: {persona}")
    persona_data["Job"] = job
    agent = create_agent(
        name=name,
        persona_data=persona_data,
        appearance={"body": body, "hair_style": hair_style, "hair_color": hair_color, "outfit": outfit, "gender": gender},
        x=5,
        y=5,
    )
    agents[agent.id] = agent
    await broadcast_agents()
    save_state()
    return agent


@app.post("/map/obstacles/place")
async def place_obstacle(x: int, y: int, type: str, rotation: int = 0, flip_x: bool = False):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    m.obstacles = [obs for obs in m.obstacles if not (obs.x == x and obs.y == y)]
    m.obstacles.append(MapObstacle(x=x, y=y, type=type, rotation=rotation, flip_x=flip_x))
    current_map = m
    await broadcast_map(m.model_dump())
    save_state()
    return {"message": "Placed", "obstacles": m.obstacles}


@app.post("/agents/{agent_id}/move")
async def move_agent(agent_id: str, x: int, y: int):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent = agents[agent_id]
    await apply_local_response(agent, f"({x}, {y}) 좌표로 이동할게요.", f"Moving to ({x}, {y})", thought="Move requested by user.")
    return agent


@app.post("/map/obstacles/remove")
async def remove_obstacle(x: int, y: int):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    m.obstacles = [obs for obs in m.obstacles if not (obs.x == x and obs.y == y)]
    current_map = m
    await broadcast_map(m.model_dump())
    save_state()
    return {"message": "Removed", "obstacles": m.obstacles}


    raise HTTPException(status_code=400, detail="Out of bounds")


@app.post("/map/zones/set")
async def set_zone_tile(x: int, y: int, zone_type: str):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    if not m.zone_data:
        m.zone_data = [["work" for _ in range(m.width)] for _ in range(m.height)]
    if 0 <= y < m.height and 0 <= x < m.width:
        m.zone_data[y][x] = zone_type
        current_map = m
        await broadcast_map(m.model_dump())
        save_state()
        return {"message": "Zone tile updated"}
    raise HTTPException(status_code=400, detail="Out of bounds")


@app.post("/map/zones/add")
async def add_zone(req: ZoneCreateRequest):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    new_zone = MapZone(
        name=req.name, 
        aliases=[req.name.lower()], 
        x1=min(req.x1, req.x2), 
        y1=min(req.y1, req.y2), 
        x2=max(req.x1, req.x2), 
        y2=max(req.y1, req.y2), 
        color=req.color, 
        icon="label"
    )
    m.zones.append(new_zone)
    current_map = m
    await broadcast_map(m.model_dump())
    save_state()
    return {"message": "Zone added", "zones": m.zones}


@app.post("/map/zones/remove")
async def remove_zone(req: ZoneRemoveRequest):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    m.zones = [z for z in m.zones if z.name != req.name]
    current_map = m
    await broadcast_map(m.model_dump())
    save_state()
    return {"message": "Zone removed", "zones": m.zones}


@app.post("/map/save")
async def save_map(name: str):
    global current_map
    if current_map:
        current_map.name = name
        USER_SAVED_MAPS[name] = current_map
        save_state()
        return {"message": f"Map '{name}' saved successfully"}
    raise HTTPException(status_code=400, detail="No map to save")


@app.post("/map/delete/{name}")
async def delete_map(name: str):
    if name in USER_SAVED_MAPS:
        del USER_SAVED_MAPS[name]
        save_state()
        return {"message": f"Map '{name}' deleted"}
    raise HTTPException(status_code=404, detail="Map not found")


@app.get("/map/templates")
async def get_map_templates():
    return {
        "defaults": MAP_TEMPLATES,
        "saved": USER_SAVED_MAPS,
    }


@app.get("/skills")
async def list_skills():
    return [skill.__dict__ for skill in skill_registry.skills.values()]


@app.get("/")
async def root():
    return {"status": "Running"}


if __name__ == "__main__":
    import uvicorn

    combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
    uvicorn.run(combined_app, host="0.0.0.0", port=8000)
