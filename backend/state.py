import os
import json
import asyncio
from typing import Dict, Optional
from schemas import MapTemplate, Agent, MapZone, MapObstacle

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "world_state.json")
SKILLS_DIR = os.path.join(BASE_DIR, "skills")
OUTPUT_DIR = os.path.join(BASE_DIR, "work_outputs")

subscription_plan: str = "enterprise"
agents: Dict[str, Agent] = {}
current_map: Optional[MapTemplate] = None
USER_SAVED_MODULES: Dict[str, MapTemplate] = {}
USER_COMPANIES: Dict[str, MapTemplate] = {}
interactive_queue: Optional[asyncio.PriorityQueue] = None
background_queue: Optional[asyncio.PriorityQueue] = None

MAP_TEMPLATES = {
    "standard_office": MapTemplate(
        id="standard_office",
        name="Standard Neon Office",
        width=24,
        height=24,
        zone_data=[
            ["neon_border" if (i == 0 or i == 23 or j == 0 or j == 23) else "none" for i in range(24)]
            for j in range(24)
        ],
        zones=[MapZone(name="Reception", x1=1, y1=1, x2=5, y2=5, color="#00f2ff")],
        obstacles=[MapObstacle(x=3, y=3, type="obstacle_desk")],
    ),
    "open_plan": MapTemplate(
        id="open_plan",
        name="Open Space Studio",
        width=24,
        height=24,
        zone_data=[
            ["grid_dot" if (i % 4 == 0 and j % 4 == 0) else "none" for i in range(24)]
            for j in range(24)
        ],
        zones=[MapZone(name="Dev Cluster", x1=8, y1=8, x2=16, y2=16, color="#3b82f6")],
        obstacles=[MapObstacle(x=12, y=12, type="obstacle_desk")]
    ),
    "executive_hub": MapTemplate(
        id="executive_hub",
        name="Executive HQ",
        width=24,
        height=24,
        zone_data=[
            ["premium_carpet" if (8 <= i <= 15 and 8 <= j <= 15) else "none" for i in range(24)]
            for j in range(24)
        ],
        zones=[MapZone(name="CEO Suite", x1=9, y1=9, x2=14, y2=14, color="#a855f7")],
        obstacles=[MapObstacle(x=11, y=11, type="obstacle_plant")]
    )
}

def save_state():
    state = {
        "subscription_plan": subscription_plan,
        "agents": {id: a.model_dump() for id, a in agents.items()},
        "current_map": current_map.model_dump() if current_map else None,
        "saved_modules": {k: v.model_dump() for k, v in USER_SAVED_MODULES.items()},
        "companies": {k: v.model_dump() for k, v in USER_COMPANIES.items()},
    }
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state():
    global current_map, subscription_plan, agents, USER_SAVED_MODULES, USER_COMPANIES
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
        
        subscription_plan = state.get("subscription_plan", "enterprise")
        
        agents_data = state.get("agents", {})
        if isinstance(agents_data, dict):
            agents.clear()
            for k, v in agents_data.items():
                agents[k] = Agent(**v)
        
        current_map_data = state.get("current_map")
        if current_map_data:
            current_map = MapTemplate(**current_map_data)
            
        saved_modules_data = state.get("saved_modules", {})
        USER_SAVED_MODULES.clear()
        for k, v in saved_modules_data.items():
            USER_SAVED_MODULES[k] = MapTemplate(**v)
            
        companies_data = state.get("companies", {})
        USER_COMPANIES.clear()
        for k, v in companies_data.items():
            USER_COMPANIES[k] = MapTemplate(**v)
            
    except Exception as e:
        print(f"Error loading state: {e}")
