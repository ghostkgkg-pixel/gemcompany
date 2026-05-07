import re
import uuid
import time
from typing import Dict, Any, List, Optional
from schemas import Agent, MapTemplate

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

def zone_summary_for_agent(agent: Agent, current_map: Optional[MapTemplate], default_templates: Dict[str, MapTemplate]) -> str:
    m = current_map or default_templates["standard_office"]
    for zone in m.zones:
        if zone.x1 <= agent.x <= zone.x2 and zone.y1 <= agent.y <= zone.y2:
            return zone.name
    return "Hallway"

def set_agent_action(agent: Agent, action: str, current_map: Optional[MapTemplate], default_templates: Dict[str, MapTemplate]) -> None:
    m = current_map or default_templates["standard_office"]
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
