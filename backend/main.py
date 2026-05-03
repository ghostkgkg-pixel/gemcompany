from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uuid
import os
import asyncio
from pathfinding import AStar

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
    aliases: List[str] = [] # Keywords like ["회의실", "meeting", "room"]
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

class MapTemplate(BaseModel):
    id: str
    name: str
    width: int
    height: int
    zones: List[MapZone]
    obstacles: List[MapObstacle] = []
    zone_data: Optional[List[List[str]]] = None # Tile-based zone types: 'work', 'meeting', 'break'

class Agent(BaseModel):
    id: str
    name: str
    persona: Dict
    stats: Dict
    x: int
    y: int
    target_x: Optional[int] = None
    target_y: Optional[int] = None
    path: List[List[int]] = [] # Current calculated path [[x1, y1], [x2, y2]...]
    current_action: str
    current_thought: str
    current_speech: str
    appearance: Dict = {} # {body: 'body_light', hair: 'hair_black_short', outfit: 'agent_dev'}

# --- In-memory Storage ---
agents: Dict[str, Agent] = {}
current_map: Optional[MapTemplate] = None

# --- World Engine (Movement) ---

async def world_tick_loop():
    """Periodic loop to update agent positions."""
    while True:
        m = current_map or MAP_TEMPLATES["standard_office"]
        # Convert obstacles to tuples for A*
        obs_tuples = [(o.x, o.y) for o in m.obstacles]
        astar = AStar(m.width, m.height, obs_tuples)
        
        changed = False
        for agent in agents.values():
            if agent.target_x is not None and agent.target_y is not None:
                # If target changed or no path, calculate new path
                target = (agent.target_x, agent.target_y)
                current = (agent.x, agent.y)
                
                if current == target:
                    agent.target_x = None
                    agent.target_y = None
                    agent.path = []
                    agent.current_action = "Idle"
                    changed = True
                    continue

                # Check if current path is invalidated by new obstacles
                path_invalid = False
                if agent.path:
                    for p in agent.path:
                        if p in m.obstacles:
                            path_invalid = True
                            break

                # Recalculate path if needed
                if not agent.path or tuple(agent.path[-1]) != target or path_invalid:
                    new_path = astar.find_path(current, target)
                    if new_path:
                        agent.path = [list(p) for p in new_path]
                    else:
                        # Unreachable
                        agent.target_x = None
                        agent.target_y = None
                        agent.path = []
                        agent.current_action = "Unreachable"
                        changed = True
                        continue
                
                # Move to the next step in path
                if agent.path:
                    next_step = agent.path.pop(0)
                    agent.x, agent.y = next_step[0], next_step[1]
                    changed = True
        
        if changed:
            await broadcast_agents()
            
        await asyncio.sleep(0.5) # Speed of movement

async def autonomous_decision_loop():
    """Periodically wakes up an idle agent to make an autonomous decision."""
    connector = GeminiConnector()
    while True:
        await asyncio.sleep(15) # Run every 15 seconds to avoid rate limits
        if not agents:
            continue
            
        m = current_map or MAP_TEMPLATES["standard_office"]
        
        # Find all idle agents
        idle_agents = [a for a in agents.values() if a.current_action in ["Idle", "Unreachable"]]
        if not idle_agents:
            continue
            
        # Pick one random idle agent to act (simplifies the loop and saves quota)
        import random
        agent = random.choice(idle_agents)
        
        # Determine current zone
        current_zone_name = "Hallway"
        for z in m.zones:
            if z.x1 <= agent.x <= z.x2 and z.y1 <= agent.y <= z.y2:
                current_zone_name = z.name
                break
                
        # Find nearby agents (within 3 units distance)
        nearby_agents = []
        for other in agents.values():
            if other.id != agent.id:
                dist = abs(agent.x - other.x) + abs(agent.y - other.y)
                if dist <= 3:
                    nearby_agents.append(f"{other.name} (at {other.x}, {other.y}, doing: {other.current_action})")
                    
        nearby_str = ", ".join(nearby_agents) if nearby_agents else "No one nearby."
        
        zones_info = [f"('{z.name}', {z.aliases})" for z in m.zones]
        available_zones = f"[{', '.join(zones_info)}]"
        
        prompt = f"""
    ROLE: You are an AI agent in a 2D virtual office simulation.
    PERSONA: {agent.persona}
    CONTEXT: 
    - Current Position: ({agent.x}, {agent.y}) in {current_zone_name}
    - Available Zones: {available_zones}
    - Nearby Agents: {nearby_str}
    
    INSTRUCTION: You have some free time. Choose your next action autonomously based on your persona.
    You can interact with someone nearby, move to a different zone, or just do your own thing.
    If you decide to move, you MUST set "action" to exactly "Moving to [Zone Name]".
    If you decide to stay, set "action" to "Idle" or a brief description of what you are doing (e.g. "Reading a book").
    Speak in Korean if you want.
    
    RESPONSE FORMAT (JSON ONLY):
    {{
        "thought": "short internal reasoning based on surroundings",
        "speech": "what you say out loud, or empty string",
        "action": "Moving to [Zone Name]" or "Idle"
    }}
    """
        try:
            print(f"Triggering autonomous tick for {agent.name}")
            response_data = connector.send_prompt_json(prompt)
            
            agent.current_thought = response_data.get("thought", "")
            agent.current_speech = response_data.get("speech", "")
            action = response_data.get("action", "Idle")
            
            if action.startswith("Moving to "):
                target_zone_name = action.replace("Moving to ", "").strip()
                target_zone = next((z for z in m.zones if z.name == target_zone_name or target_zone_name in z.aliases), None)
                if target_zone:
                    center_x = (target_zone.x1 + target_zone.x2) // 2
                    center_y = (target_zone.y1 + target_zone.y2) // 2
                    agent.target_x = center_x
                    agent.target_y = center_y
                    agent.current_action = f"Moving to {target_zone.name}"
                else:
                    agent.current_action = action
            else:
                agent.current_action = action
                
            await broadcast_agents()
        except Exception as e:
            print(f"Autonomous loop error for {agent.name}: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(world_tick_loop())
    asyncio.create_task(autonomous_decision_loop())

# --- Endpoints ---

@app.post("/agents/{agent_id}/move")
async def move_agent(agent_id: str, x: int, y: int):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    agents[agent_id].target_x = x
    agents[agent_id].target_y = y
    agents[agent_id].current_action = f"Moving to ({x}, {y})"
    return {"message": "Movement started", "target": (x, y)}

@app.post("/map/obstacles/place")
async def place_obstacle(x: int, y: int, type: str):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    
    # Remove existing obstacle at x, y if any
    m.obstacles = [obs for obs in m.obstacles if not (obs.x == x and obs.y == y)]
    # Add new obstacle
    m.obstacles.append(MapObstacle(x=x, y=y, type=type))
    
    current_map = m
    await broadcast_map(current_map.dict())
    return {"message": f"Obstacle placed at ({x}, {y})", "obstacles": m.obstacles}

@app.post("/map/obstacles/remove")
async def remove_obstacle(x: int, y: int):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    
    m.obstacles = [obs for obs in m.obstacles if not (obs.x == x and obs.y == y)]
    
    current_map = m
    await broadcast_map(current_map.dict())
    return {"message": f"Obstacle removed at ({x}, {y})", "obstacles": m.obstacles}

@app.post("/map/zones/set")
async def set_zone_tile(x: int, y: int, zone_type: str):
    global current_map
    m = current_map or MAP_TEMPLATES["standard_office"]
    
    # Initialize zone_data if it doesn't exist
    if not m.zone_data:
        m.zone_data = [["work" for _ in range(m.width)] for _ in range(m.height)]
        # Populate from existing zones (rectangles)
        for zone in m.zones:
            z_type = "work"
            if any(a in zone.aliases for a in ["회의실", "meeting"]): z_type = "meeting"
            elif any(a in zone.aliases for a in ["휴게실", "break"]): z_type = "break"
            
            for j in range(max(0, zone.y1), min(m.height, zone.y2 + 1)):
                for i in range(max(0, zone.x1), min(m.width, zone.x2 + 1)):
                    m.zone_data[j][i] = z_type
                    
    if 0 <= x < m.width and 0 <= y < m.height:
        m.zone_data[y][x] = zone_type
        
    current_map = m
    await broadcast_map(current_map.dict())
    return {"message": f"Zone at ({x}, {y}) set to {zone_type}", "zone_data": m.zone_data}

# Default Templates
MAP_TEMPLATES = {
    "standard_office": MapTemplate(
        id="standard_office",
        name="Standard Office",
        width=34,
        height=14,
        zones=[
            MapZone(name="Meeting Room", aliases=["회의실", "미팅룸", "meeting"], x1=0, y1=0, x2=8, y2=5, color="#e3f2fd", icon="groups"),
            MapZone(name="Work Zone", aliases=["업무구역", "사무실", "데스크", "work"], x1=9, y1=0, x2=33, y2=13, color="#f5f5f5", icon="desktop_windows"),
            MapZone(name="Break Area", aliases=["휴게실", "탕비실", "카페", "break"], x1=0, y1=6, x2=8, y2=13, color="#e8f5e9", icon="coffee")
        ],
        obstacles=[
            MapObstacle(x=8, y=6, type="obstacle_plant"),
            MapObstacle(x=8, y=7, type="obstacle_plant"),
            MapObstacle(x=8, y=8, type="obstacle_plant"),
            MapObstacle(x=8, y=9, type="obstacle_plant"),
            MapObstacle(x=8, y=10, type="obstacle_plant"),
            MapObstacle(x=8, y=11, type="obstacle_plant"),
            MapObstacle(x=8, y=12, type="obstacle_plant"),
            MapObstacle(x=8, y=13, type="obstacle_plant"),
            MapObstacle(x=0, y=5, type="obstacle_table"),
            MapObstacle(x=1, y=5, type="obstacle_table"),
            MapObstacle(x=2, y=5, type="obstacle_table"),
            MapObstacle(x=3, y=5, type="obstacle_table"),
            MapObstacle(x=4, y=5, type="obstacle_table"),
            MapObstacle(x=5, y=5, type="obstacle_table"),
            MapObstacle(x=6, y=5, type="obstacle_table"),
            MapObstacle(x=7, y=5, type="obstacle_table"),
            MapObstacle(x=8, y=5, type="obstacle_table"),
        ]
    ),
    "minimal_cafe": MapTemplate(
        id="minimal_cafe",
        name="Minimal Cafe",
        width=8,
        height=8,
        zones=[
            MapZone(name="Counter", aliases=["카운터", "주문", "데스크"], x1=0, y1=0, x2=7, y2=2, color="#fff3e0", icon="store"),
            MapZone(name="Tables", aliases=["테이블", "좌석", "자리"], x1=1, y1=3, x2=6, y2=7, color="#fafafa", icon="table_restaurant")
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
    # Randomly assign appearance for diversity
    import random
    bodies = ["body_light", "body_tan", "body_dark"]
    hairs = ["hair_black_short", "hair_brown_long", "none"]
    outfits = ["agent_dev", "agent_design", "agent_manage", "agent_market"]
    
    appearance = {
        "body": random.choice(bodies),
        "hair": random.choice(hairs),
        "outfit": random.choice(outfits)
    }

    new_agent = Agent(
        id=agent_id,
        name=persona_data.get("Name", f"Agent_{agent_id}"),
        persona=persona_data,
        stats={k: v for k, v in persona_data.items() if k != "Name"},
        x=5, y=5,
        current_action="Idle",
        current_thought="Just arrived at the office.",
        current_speech="Hello everyone!",
        appearance=appearance
    )
    agents[agent_id] = new_agent
    await broadcast_agents()
    return new_agent

@app.get("/agents")
async def list_agents():
    return list(agents.values())

@app.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, message: str):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = agents[agent_id]
    connector = GeminiConnector()
    
    # Get current map zones to give context to the agent
    m = current_map or MAP_TEMPLATES["standard_office"]
    zones_info = [f"{z.name} (area: {z.x1},{z.y1} to {z.x2},{z.y2})" for z in m.zones]
    
    # System prompt to ensure JSON response and zone awareness
    prompt = f"""
    ROLE: You are an AI agent in a 2D virtual office simulation.
    PERSONA: {agent.persona}
    CONTEXT: 
    - Current Position: ({agent.x}, {agent.y})
    - Available Zones: {[(z.name, z.aliases) for z in m.zones]}
    
    USER MESSAGE: "{message}"
    
    INSTRUCTION: Respond to the user's message while staying in character. 
    You can respond in the user's language (e.g. Korean).
    
    CRITICAL: If you decide to move, you MUST include the exact Zone Name 
    from the list above in your "action" field.
    Example: "Moving to Meeting Room" or "Going to Break Area".
    
    RESPONSE FORMAT (JSON ONLY):
    {{
        "thought": "short internal reasoning",
        "speech": "your spoken response",
        "action": "Moving to [Zone Name]" or "Idle" or "Working"
    }}
    """
    
    try:
        # Use the connector to get a JSON response from gemini-cli
        response_data = connector.send_prompt_json(prompt)
        print(f"Engine Response for {agent.name}: {response_data}") # Debug log
        
        agent.current_thought = response_data.get("thought", "...")
        agent.current_speech = response_data.get("speech", "Hello!")
        action_text = response_data.get("action", "Idle")
        agent.current_action = action_text
        
        # --- Test 11: Parse action and trigger movement (Enhanced) ---
        found_zone = False
        action_lower = action_text.lower()
        
        for zone in m.zones:
            # Check for exact name match
            if zone.name.lower() in action_lower:
                found_zone = True
            else:
                # Check for alias matches (Korean etc)
                for alias in zone.aliases:
                    if alias.lower() in action_lower:
                        found_zone = True
                        break
            
            if found_zone:
                # Set target to the center of the zone
                agent.target_x = (zone.x1 + zone.x2) // 2
                agent.target_y = (zone.y1 + zone.y2) // 2
                agent.current_action = f"Moving to {zone.name}"
                print(f"Match found! Moving {agent.name} to {zone.name} at ({agent.target_x}, {agent.target_y})")
                break
        
        await broadcast_agents()
        return agent
    except Exception as e:
        print(f"Error in chat_with_agent: {e}")
        raise HTTPException(status_code=500, detail=f"Engine Error: {str(e)}")

@app.get("/")
async def root():
    return {"status": "AI Agent Office Engine Running", "phase": 4}

if __name__ == "__main__":
    import uvicorn
    # Wrap FastAPI app with Socket.io ASGI app so both routes work
    combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
    uvicorn.run(combined_app, host="0.0.0.0", port=8000)
