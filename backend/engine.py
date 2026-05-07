import asyncio
import time
import random
from typing import Dict, List, Optional
from schemas import Agent, MapTemplate, MapZone
from state import agents, current_map, MAP_TEMPLATES, save_state, interactive_queue, background_queue, subscription_plan
from utils import append_work_history, zone_summary_for_agent, set_agent_action
from pathfinding import AStar

# Shared locks for agents
agent_locks: Dict[str, asyncio.Lock] = {}

def get_agent_lock(agent_id: str) -> asyncio.Lock:
    if agent_id not in agent_locks:
        agent_locks[agent_id] = asyncio.Lock()
    return agent_locks[agent_id]

async def world_tick_loop(sio_callback):
    """Main world simulation loop."""
    while True:
        try:
            m = current_map or MAP_TEMPLATES["standard_office"]
            astar = AStar(m.width, m.height, m.obstacles)
            
            for agent in list(agents.values()):
                async with get_agent_lock(agent.id):
                    # Movement logic
                    if agent.target_x is not None and agent.target_y is not None:
                        if agent.x == agent.target_x and agent.y == agent.target_y:
                            agent.target_x = None
                            agent.target_y = None
                            agent.path = []
                        else:
                            path = astar.find_path((agent.x, agent.y), (agent.target_x, agent.target_y))
                            if path and len(path) > 1:
                                agent.path = path
                                agent.x, agent.y = path[1]
                            else:
                                agent.target_x = None
                                agent.target_y = None
                                agent.path = []
                                agent.current_action = "Stuck/Path Blocked"

                    # Random thought/speech simulation if idle
                    if not agent.target_x and random.random() < 0.05:
                        thoughts = ["Next goal...", "Need coffee", "Coding...", "Designing..."]
                        agent.current_thought = random.choice(thoughts)

            # Broadcast updates via Socket.io callback
            await sio_callback("agents_update", [a.model_dump() for a in agents.values()])
            save_state()
            
        except Exception as e:
            print(f"World tick error: {e}")
        await asyncio.sleep(1.0)

async def autonomous_decision_loop(skill_router, task_classifier):
    """Loop for agents to make autonomous decisions using LLM."""
    while True:
        try:
            for agent in list(agents.values()):
                if not agent.target_x and random.random() < 0.02: # Occasional decision
                    current_zone = zone_summary_for_agent(agent, current_map, MAP_TEMPLATES)
                    prompt = f"You are {agent.name} in {current_zone}. What is your next move?"
                    # This would call LLM via skill_router
                    # For now, we simulate a decision
                    decisions = ["Moving to Reception", "Working at desk", "Thinking about architecture"]
                    set_agent_action(agent, random.choice(decisions), current_map, MAP_TEMPLATES)

        except Exception as e:
            print(f"Autonomous loop error: {e}")
        await asyncio.sleep(10.0)

async def cli_worker(worker_id: str, queue: asyncio.PriorityQueue, skill_router, work_memory, sio_callback):
    """Worker for executing tasks from the queue."""
    print(f"CLI Worker {worker_id} started")
    while True:
        task = await queue.get()
        try:
            print(f"Worker {worker_id} executing task for agent {task.agent_id}")
            # Simulated execution
            await asyncio.sleep(2.0)
            if task.future:
                task.future.set_result({"status": "completed", "result": f"Task {task.task_id} done by {worker_id}"})
            
            # Broadcast update
            await sio_callback("task_update", {"agent_id": task.agent_id, "status": "completed"})
            
        except Exception as e:
            print(f"Worker {worker_id} error: {e}")
            if task.future:
                task.future.set_exception(e)
        finally:
            queue.task_done()
