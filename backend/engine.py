import asyncio
import time
import random
from typing import Dict, List, Optional
import state
from schemas import Agent, MapTemplate, MapZone
from utils import append_work_history, zone_summary_for_agent, set_agent_action
from pathfinding import AStar

# 에이전트별 데이터 동기화를 위한 비동기 락(Lock) 관리
agent_locks: Dict[str, asyncio.Lock] = {}

def get_agent_lock(agent_id: str) -> asyncio.Lock:
    """특정 에이전트 전용 락을 반환하거나 생성함"""
    if agent_id not in agent_locks:
        agent_locks[agent_id] = asyncio.Lock()
    return agent_locks[agent_id]

async def world_tick_loop(sio_callback):
    """
    메인 월드 시뮬레이션 루프 (약 1초마다 실행)
    에이전트의 이동 처리 및 주기적인 상태 브로드캐스트를 담당
    """
    while True:
        try:
            # 현재 맵 정보를 기반으로 길찾기 알고리즘 초기화
            m = state.current_map or state.MAP_TEMPLATES["standard_office"]
            astar = AStar(m.width, m.height, [(o.x, o.y) for o in m.obstacles])
            
            for agent in list(state.agents.values()):
                async with get_agent_lock(agent.id):
                    # 목적지가 설정된 경우 이동 로직 수행
                    if agent.target_x is not None and agent.target_y is not None:
                        # 목적지 도착 체크
                        if agent.x == agent.target_x and agent.y == agent.target_y:
                            agent.target_x = None
                            agent.target_y = None
                            agent.path = []
                        else:
                            # A* 알고리즘으로 경로 탐색 및 다음 칸으로 이동
                            path = astar.find_path((agent.x, agent.y), (agent.target_x, agent.target_y))
                            if path and len(path) > 1:
                                agent.path = path
                                agent.x, agent.y = path[1]
                            else:
                                # 길이 막힌 경우 목적지 초기화 및 상태 업데이트
                                agent.target_x = None
                                agent.target_y = None
                                agent.path = []
                                agent.current_action = "길이 막힘 (Path Blocked)"

                    # 대기 상태일 때 가끔 무작위 생각/대화 시뮬레이션
                    if not agent.target_x and random.random() < 0.05:
                        thoughts = ["다음 목표는...", "커피가 마시고 싶다", "코딩 중...", "설계 고민 중..."]
                        agent.current_thought = random.choice(thoughts)

            # Socket.io를 통해 변경된 에이전트 상태를 모든 클라이언트에 브로드캐스트
            await sio_callback("agents_update", [a.model_dump() for a in state.agents.values()])
            state.save_state()
            
        except Exception as e:
            print(f"World tick 오류: {e}")
        await asyncio.sleep(1.0)

async def autonomous_decision_loop(skill_router, task_classifier):
    """
    에이전트 자율 결정 루프 (약 10초마다 실행)
    에이전트가 현재 위치와 상황에 기반하여 스스로 무엇을 할지 결정하도록 유도
    """
    while True:
        try:
            for agent in list(state.agents.values()):
                # 목적지가 없고 특정 확률에 도달한 경우 새로운 자율 행동 결정
                if not agent.target_x and random.random() < 0.02:
                    current_zone = zone_summary_for_agent(agent, state.current_map, state.MAP_TEMPLATES)
                    # 실제 LLM 호출을 위한 프롬프트 가이드 (현재는 시뮬레이션 중)
                    # 프롬프트 예시: f"당신은 {current_zone}에 있는 {agent.name}입니다. 다음 행동은 무엇입니까?"
                    
                    decisions = ["리셉션으로 이동", "책상에서 업무 처리", "시스템 설계 고민"]
                    # 무작위 액션 할당 (실제 구현에서는 LLM의 응답이 들어오는 부분)
                    set_agent_action(agent, random.choice(decisions), state.current_map, state.MAP_TEMPLATES)

        except Exception as e:
            print(f"자율 결정 루프 오류: {e}")
        await asyncio.sleep(10.0)

