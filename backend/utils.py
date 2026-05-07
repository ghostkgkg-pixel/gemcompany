import re
import uuid
import time
from typing import Dict, Any, List, Optional
from schemas import Agent, MapTemplate

def sanitize_filename(name: str) -> str:
    """
    파일명에 사용할 수 없는 문자를 제거하고 적절한 길이로 조정함
    """
    cleaned = "".join(c for c in name if c.isalnum() or c in "._-").strip("._")
    if not cleaned:
        cleaned = f"work_{uuid.uuid4().hex[:8]}.md"
    if len(cleaned) > 80:
        prefix, _, suffix = cleaned.rpartition(".")
        cleaned = (prefix[:60] if prefix else cleaned[:60]) + (f".{suffix[:10]}" if suffix else "")
    return cleaned

def append_work_history(agent: Agent, message: str) -> None:
    """
    에이전트의 업무 이력에 새로운 메시지를 추가 (최근 12개 유지)
    """
    agent.work_history.append(f"[{time.strftime('%H:%M')}] {message}")
    agent.work_history = agent.work_history[-12:]

def zone_summary_for_agent(agent: Agent, current_map: Optional[MapTemplate], default_templates: Dict[str, MapTemplate]) -> str:
    """
    에이전트의 현재 좌표를 기반으로 어느 구역(Zone)에 있는지 반환
    """
    m = current_map or default_templates["standard_office"]
    for zone in m.zones:
        if zone.x1 <= agent.x <= zone.x2 and zone.y1 <= agent.y <= zone.y2:
            return zone.name
    return "Hallway" # 구역 외 지역은 Hallway로 간주

def set_agent_action(agent: Agent, action: str, current_map: Optional[MapTemplate], default_templates: Dict[str, MapTemplate]) -> None:
    """
    LLM의 응답이나 사용자 명령에 따라 에이전트의 현재 액션과 목적지 설정
    """
    m = current_map or default_templates["standard_office"]
    if not action or not isinstance(action, str):
        action = "Idle"

    # "Moving to [구역명/좌표]" 형식의 액션 처리
    if action.startswith("Moving to "):
        target_str = action.replace("Moving to ", "").strip()
        # 좌표 형식 (x, y) 매칭 시도
        coord_match = re.match(r"\(?(\d+)\s*,\s*(\d+)\)?", target_str)
        if coord_match:
            agent.target_x = int(coord_match.group(1))
            agent.target_y = int(coord_match.group(2))
            agent.current_action = f"Moving to ({agent.target_x}, {agent.target_y})"
            return

        # 구역명(또는 별칭) 매칭 시도
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
            # 구역의 중심점을 목적지로 설정
            agent.target_x = (target_zone.x1 + target_zone.x2) // 2
            agent.target_y = (target_zone.y1 + target_zone.y2) // 2
            agent.current_action = f"Moving to {target_zone.name}"
            return

    # 그 외 일반적인 텍스트 액션 설정
    agent.current_action = action
