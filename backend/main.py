from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
import os

# Phase 2 & 3 modules
from persona import PersonaManager
from memory import MemoryManager
from connector import GeminiConnector

from fastapi.middleware.cors import CORSMiddleware
import socketio

# Socket.io Server Setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio_app = socketio.ASGIApp(sio)

app = FastAPI(title="AI Agent Office Engine")

# Explicitly mount with the default namespace if needed, 
# or keep as is if the client expects a specific path.
# The previous mount was app.mount("/socket.io", sio_app). 
# Let's try combining them directly or ensuring the middleware handles it correctly.
# Re-checking FastAPI Socket.io pattern:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@sio.event
async def connect(sid, environ, auth=None):
    print(f"Client connected: {sid}")
    # Send initial state
    m_data = current_map or MAP_TEMPLATES["standard_office"]
    # Pydantic v1 uses .dict(), Socket.io needs plain dict
    await sio.emit('map_update', m_data.dict(), to=sid)
    await sio.emit('agents_update', [a.dict() for a in agents.values()], to=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

# Helper to broadcast updates
async def broadcast_agents():
    await sio.emit('agents_update', [a.dict() for a in agents.values()])

async def broadcast_map(map_data):
    await sio.emit('map_update', map_data)

# --- Models ---
class MapZone(BaseModel):
    name: str
    x1: int
    y1: int
    x2: int
    y2: int
    color: Optional[str] = "#cccccc"
    icon: Optional[str] = "room"

class MapTemplate(BaseModel):
    id: str
    name: str
    width: int
    height: int
    zones: List[MapZone]

import asyncio

class AgentStatus(BaseModel):
    id: str
    name: str
    persona: Dict
    stats: Dict
    x: int
    y: int
    target_x: Optional[int] = None
    target_y: Optional[int] = None
    current_action: str
    current_thought: str
    current_speech: str

# --- In-memory Storage ---
agents: Dict[str, AgentStatus] = {}
current_map: Optional[MapTemplate] = None

# --- World Engine (Movement) ---

async def world_tick_loop():
    """Periodic loop to update agent positions."""
    while True:
        moved = False
        for agent_id, agent in agents.items():
            if agent.target_x is not None and agent.target_y is not None:
                # Simple step-by-step movement
                dx = agent.target_x - agent.x
                dy = agent.target_y - agent.y
                
                if dx != 0:
                    agent.x += 1 if dx > 0 else -1
                    moved = True
                elif dy != 0:
                    agent.y += 1 if dy > 0 else -1
                    moved = True
                else:
                    # Arrived at destination
                    agent.target_x = None
                    agent.target_y = None
                    agent.current_action = "Idle"
                    moved = True
        
        if moved:
            await broadcast_agents()
            
        await asyncio.sleep(0.5) # Speed of movement

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(world_tick_loop())

# --- Endpoints ---

@app.post("/agents/{agent_id}/move")
async def move_agent(agent_id: str, x: int, y: int):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    agents[agent_id].target_x = x
    agents[agent_id].target_y = y
    agents[agent_id].current_action = f"Moving to ({x}, {y})"
    return {"message": "Movement started", "target": (x, y)}

# Default Templates
MAP_TEMPLATES = {
    "standard_office": MapTemplate(
        id="standard_office",
        name="Standard Office",
        width=10,
        height=10,
        zones=[
            MapZone(name="Meeting Room", x1=0, y1=0, x2=4, y2=4, color="#e3f2fd", icon="groups"),
            MapZone(name="Work Zone", x1=5, y1=0, x2=9, y2=9, color="#f5f5f5", icon="desktop_windows"),
            MapZone(name="Break Area", x1=0, y1=5, x2=4, y2=9, color="#e8f5e9", icon="coffee")
        ]
    ),
    "minimal_cafe": MapTemplate(
        id="minimal_cafe",
        name="Minimal Cafe",
        width=8,
        height=8,
        zones=[
            MapZone(name="Counter", x1=0, y1=0, x2=7, y2=2, color="#fff3e0", icon="store"),
            MapZone(name="Tables", x1=1, y1=3, x2=6, y2=7, color="#fafafa", icon="table_restaurant")
        ]
    ),
    "zen_garden": MapTemplate(
        id="zen_garden",
        name="Zen Garden",
        width=12,
        height=8,
        zones=[
            MapZone(name="Meditation Pond", x1=2, y1=2, x2=6, y2=5, color="#e0f7fa", icon="water"),
            MapZone(name="Rock Garden", x1=8, y1=1, x2=11, y2=6, color="#efebe9", icon="grass")
        ]
    )
}

# --- Endpoints ---

@app.get("/map/templates")
async def get_templates():
    return MAP_TEMPLATES

@app.post("/map/select/{template_id}")
async def select_map(template_id: str):
    global current_map
    if template_id not in MAP_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    current_map = MAP_TEMPLATES[template_id]
    await broadcast_map(current_map.dict())
    return {"message": f"Map changed to {current_map.name}", "map": current_map}

@app.post("/map/custom")
async def create_custom_map(custom_map: MapTemplate):
    global current_map
    current_map = custom_map
    await broadcast_map(current_map.dict())
    return {"message": "Custom map applied", "map": current_map}

@app.get("/map/current")
async def get_current_map():
    if not current_map:
        return MAP_TEMPLATES["standard_office"]
    return current_map

@app.post("/agents/spawn")
async def spawn_agent(description: str):
    pm = PersonaManager()
    persona_data = pm.analyze_persona(description)
    
    agent_id = str(uuid.uuid4())[:8]
    new_agent = AgentStatus(
        id=agent_id,
        name=persona_data.get("Name", f"Agent_{agent_id}"),
        persona=persona_data,
        stats={k: v for k, v in persona_data.items() if k != "Name"},
        x=5, y=5,
        current_action="Idle",
        current_thought="Just arrived at the office.",
        current_speech="Hello everyone!"
    )
    agents[agent_id] = new_agent
    await broadcast_agents()
    return new_agent

@app.get("/agents")
async def list_agents():
    return list(agents.values())

@app.get("/")
async def root():
    return {"status": "AI Agent Office Engine Running", "phase": 4}

if __name__ == "__main__":
    import uvicorn
    # Wrap FastAPI app with Socket.io ASGI app so both routes work
    combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
    uvicorn.run(combined_app, host="0.0.0.0", port=8000)
