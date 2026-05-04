from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uuid
import os
import asyncio
import json
import time
import random
from pathfinding import AStar

# Phase 2 & 3 modules
from persona import PersonaManager
from memory import MemoryManager
from connector import GeminiConnector

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

# --- Models ---
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

# --- Default Data ---
MAP_TEMPLATES = {
    "standard_office": MapTemplate(
        id="standard_office", name="Standard Office", width=27, height=11,
        zones=[
            MapZone(name="Meeting Room", aliases=["회의실", "미팅룸", "meeting"], x1=0, y1=0, x2=6, y2=4, color="#e3f2fd", icon="groups"),
            MapZone(name="Work Zone", aliases=["업무구역", "사무실", "데스크", "work"], x1=7, y1=0, x2=26, y2=10, color="#f5f5f5", icon="desktop_windows"),
            MapZone(name="Break Area", aliases=["휴게실", "탕비실", "카페", "break"], x1=0, y1=5, x2=6, y2=10, color="#e8f5e9", icon="coffee")
        ],
        obstacles=[MapObstacle(x=6, y=5, type="obstacle_plant")]
    )
}

# --- In-memory Storage ---
agents: Dict[str, Agent] = {}
current_map: Optional[MapTemplate] = None
USER_SAVED_MAPS: Dict[str, MapTemplate] = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "world_state.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "work_outputs")

# --- Socket.io Server Setup ---
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio_app = socketio.ASGIApp(sio)

app = FastAPI(title="AI Agent Office Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

@sio.event
async def connect(sid, environ, auth=None):
    print(f"Client connected: {sid}")
    m_data = current_map or MAP_TEMPLATES["standard_office"]
    await sio.emit('map_update', m_data.model_dump(), to=sid)
    await sio.emit('agents_update', [a.model_dump() for a in agents.values()], to=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

async def broadcast_agents():
    await sio.emit('agents_update', [a.model_dump() for a in agents.values()])

async def broadcast_map(map_data):
    await sio.emit('map_update', map_data)

# --- State Management ---
def save_state():
    state = {
        "agents": [a.model_dump() for a in agents.values()],
        "current_map": current_map.model_dump() if current_map else None,
        "user_saved_maps": {k: v.model_dump() for k, v in USER_SAVED_MAPS.items()}
    }
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state():
    global current_map
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
            for a_data in state.get("agents", []):
                agents[a_data["id"]] = Agent(**a_data)
            if state.get("current_map"):
                current_map = MapTemplate(**state["current_map"])
            for k, v in state.get("user_saved_maps", {}).items():
                USER_SAVED_MAPS[k] = MapTemplate(**v)
            print(f"State loaded: {len(agents)} agents.")
    except Exception as e:
        print(f"Failed to load state: {e}")

# --- Agent Processing ---
async def process_agent_response(agent, response_data):
    m = current_map or MAP_TEMPLATES["standard_office"]
    agent.current_thought = response_data.get("thought", "")
    agent.current_speech = response_data.get("speech", "")
    agent.last_action_time = time.time()
    
    work_result = response_data.get("work_result")
    if work_result:
        file_out = response_data.get("file_output")
        if file_out and file_out.get("name") and file_out.get("content"):
            f_name = "".join(c for c in file_out["name"] if c.isalnum() or c in "._-").strip()
            if f_name:
                f_path = os.path.join(OUTPUT_DIR, f_name)
                with open(f_path, "w", encoding="utf-8") as f:
                    f.write(file_out["content"])
                work_result = f"FILE:{f_name}|{work_result}"
        
        agent.work_history.append(f"[{time.strftime('%H:%M')}] {work_result}")
        if len(agent.work_history) > 10: agent.work_history.pop(0)
    
    action = response_data.get("action", "Idle")
    if action.startswith("Moving to "):
        target_zone_name = action.replace("Moving to ", "").strip()
        target_zone = next((z for z in m.zones if z.name.lower() == target_zone_name.lower() or any(a.lower() == target_zone_name.lower() for a in z.aliases)), None)
        if target_zone:
            agent.target_x = (target_zone.x1 + target_zone.x2) // 2
            agent.target_y = (target_zone.y1 + target_zone.y2) // 2
            agent.current_action = f"Moving to {target_zone.name}"
        else:
            agent.current_action = action
    else:
        agent.current_action = action
        
    await broadcast_agents()
    save_state()

# --- World Engine Loops ---
async def world_tick_loop():
    while True:
        m = current_map or MAP_TEMPLATES["standard_office"]
        obs_tuples = [(o.x, o.y) for o in m.obstacles]
        astar = AStar(m.width, m.height, obs_tuples)
        
        changed = False
        for agent in agents.values():
            if agent.target_x is not None and agent.target_y is not None:
                target = (agent.target_x, agent.target_y)
                current = (agent.x, agent.y)
                
                if current == target:
                    agent.target_x = None
                    agent.target_y = None
                    agent.path = []
                    agent.current_action = "Idle"
                    changed = True
                    continue

                path_invalid = False
                if agent.path:
                    for p in agent.path:
                        if tuple(p) in obs_tuples:
                            path_invalid = True
                            break

                if not agent.path or tuple(agent.path[-1]) != target or path_invalid:
                    new_path = astar.find_path(current, target)
                    if new_path:
                        agent.path = [list(p) for p in new_path]
                    else:
                        agent.target_x = None; agent.target_y = None; agent.path = []
                        agent.current_action = "Unreachable"; changed = True; continue
                
                if agent.path:
                    next_step = agent.path.pop(0)
                    agent.x, agent.y = next_step[0], next_step[1]
                    changed = True
        
        if changed: await broadcast_agents()
        await asyncio.sleep(0.5)

async def autonomous_decision_loop():
    connector = GeminiConnector()
    loop = asyncio.get_event_loop()
    while True:
        await asyncio.sleep(5)
        if not agents: continue
        m = current_map or MAP_TEMPLATES["standard_office"]
        now = time.time()
        candidates = [a for a in agents.values() if a.current_action in ["Idle", "Unreachable"] or (now - a.last_action_time > 30)]
        if not candidates: continue
        
        to_act = random.sample(candidates, min(len(candidates), 3))
        async def act(agent):
            current_zone_name = "Hallway"
            for z in m.zones:
                if z.x1 <= agent.x <= z.x2 and z.y1 <= agent.y <= z.y2:
                    current_zone_name = z.name; break
            
            nearby_agents = [f"{o.name} (doing: {o.current_action})" for o in agents.values() if o.id != agent.id and abs(agent.x-o.x)+abs(agent.y-o.y)<=3]
            nearby_str = ", ".join(nearby_agents) if nearby_agents else "No one nearby."
            zones_info = [f"('{z.name}', {z.aliases})" for z in m.zones]
            
            prompt = f"ROLE: Office AI Agent. PERSONA: {agent.persona}. CONTEXT: ({agent.x}, {agent.y}) in {current_zone_name}. Zones: {zones_info}. Nearby: {nearby_str}. INSTRUCTION: Act. Korean only. JSON {{thought, speech, action, work_result, file_output}}"
            try:
                response_data = await loop.run_in_executor(None, connector.send_prompt_json, prompt)
                await process_agent_response(agent, response_data)
            except Exception as e:
                print(f"Autonomous error for {agent.name}: {e}")

        await asyncio.gather(*(act(a) for a in to_act))

# --- API Endpoints ---
@app.on_event("startup")
async def startup_event():
    load_state()
    asyncio.create_task(world_tick_loop())
    asyncio.create_task(autonomous_decision_loop())

@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    if agent_id not in agents: raise HTTPException(status_code=404, detail="Agent not found")
    agent = agents[agent_id]
    connector = GeminiConnector()
    loop = asyncio.get_event_loop()
    prompt = f"ROLE: Office AI Agent. PERSONA: {agent.persona}. CONTEXT: ({agent.x}, {agent.y}). USER MESSAGE: \"{message}\". INSTRUCTION: Respond and act. Korean only. JSON {{thought, speech, action, work_result, file_output}}"
    try:
        response_data = await loop.run_in_executor(None, connector.send_prompt_json, prompt)
        await process_agent_response(agent, response_data)
        return agent
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/map/current")
async def get_current_map():
    return current_map or MAP_TEMPLATES["standard_office"]

@app.get("/agents")
async def list_agents():
    return list(agents.values())

@app.post("/agents/hire")
async def hire_agent(name: str, job: str, persona: str, body: str, hair_style: str, hair_color: str, outfit: str, gender: str = "male"):
    pm = PersonaManager()
    persona_data = pm.analyze_persona(f"Job: {job}. Personality: {persona}")
    persona_data["Job"] = job
    agent_id = str(uuid.uuid4())[:8]
    new_agent = Agent(
        id=agent_id, name=name, persona=persona_data, stats={k: v for k, v in persona_data.items() if k != "Name"},
        x=5, y=5, current_action="Idle", current_thought="Joined!", current_speech="Excited!",
        appearance={"body": body, "hair_style": hair_style, "hair_color": hair_color, "outfit": outfit, "gender": gender}
    )
    agents[agent_id] = new_agent
    await broadcast_agents()
    save_state()
    return new_agent

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
    if agent_id not in agents: raise HTTPException(status_code=404, detail="Agent not found")
    agent = agents[agent_id]
    agent.target_x = x
    agent.target_y = y
    agent.current_action = f"Moving to ({x}, {y})"
    await broadcast_agents()
    save_state()
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
        return {"message": "Zone updated"}
    raise HTTPException(status_code=400, detail="Out of bounds")

@app.post("/map/save")
async def save_map(name: str):
    global current_map, USER_SAVED_MAPS
    if current_map:
        current_map.name = name
        USER_SAVED_MAPS[name] = current_map
        save_state()
        return {"message": f"Map '{name}' saved successfully"}
    raise HTTPException(status_code=400, detail="No map to save")

@app.get("/map/templates")
async def get_map_templates():
    return {
        "defaults": MAP_TEMPLATES,
        "saved": USER_SAVED_MAPS
    }

@app.get("/")
async def root():
    return {"status": "Running"}

if __name__ == "__main__":
    import uvicorn
    combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
    uvicorn.run(combined_app, host="0.0.0.0", port=8000)
