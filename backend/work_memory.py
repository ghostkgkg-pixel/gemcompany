from __future__ import annotations

import json
import os
import time
from typing import Dict, Optional

from skill_system import AgentSkillProfile, WorkBrief


class WorkMemoryManager:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self._data = self._load()

    def _load(self) -> Dict:
        if not os.path.exists(self.storage_path):
            return {"agents": {}}
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return {"agents": {}}

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def _agent_bucket(self, agent_id: str) -> Dict:
        agents = self._data.setdefault("agents", {})
        return agents.setdefault(
            agent_id,
            {
                "preferred_skills": [],
                "allowed_skills": [],
                "success_counts": {},
                "failure_counts": {},
                "current_task": None,
                "recent_results": [],
                "recent_failures": [],
                "history": [],
            },
        )

    def ensure_profile(self, agent_id: str, default_allowed_skills: Optional[list[str]] = None) -> AgentSkillProfile:
        bucket = self._agent_bucket(agent_id)
        if default_allowed_skills and not bucket["allowed_skills"]:
            bucket["allowed_skills"] = default_allowed_skills
        status = "idle"
        if bucket["current_task"]:
            status = bucket["current_task"].get("status", "idle")
        return AgentSkillProfile(
            preferred_skills=bucket["preferred_skills"],
            allowed_skills=bucket["allowed_skills"],
            success_counts=bucket["success_counts"],
            failure_counts=bucket["failure_counts"],
            current_task_status=status,
        )

    def build_brief(self, agent_id: str) -> WorkBrief:
        bucket = self._agent_bucket(agent_id)
        success_rates = {}
        all_skill_ids = set(bucket["success_counts"]) | set(bucket["failure_counts"])
        for skill_id in all_skill_ids:
            success = bucket["success_counts"].get(skill_id, 0)
            failure = bucket["failure_counts"].get(skill_id, 0)
            total = success + failure
            success_rates[skill_id] = (success / total) if total else 0.5

        current_task = ""
        if bucket["current_task"]:
            current_task = bucket["current_task"].get("summary", "")

        return WorkBrief(
            current_task=current_task,
            recent_results=bucket["recent_results"][-3:],
            recent_failures=bucket["recent_failures"][-2:],
            skill_success_rates=success_rates,
        )

    def start_task(self, agent_id: str, task_id: str, task_type: str, skill_id: str, summary: str) -> Dict:
        bucket = self._agent_bucket(agent_id)
        task = {
            "task_id": task_id,
            "task_type": task_type,
            "skill_id": skill_id,
            "summary": summary,
            "status": "queued",
            "started_at": time.time(),
        }
        bucket["current_task"] = task
        bucket["history"].append({"kind": "queued", "task": task})
        bucket["history"] = bucket["history"][-20:]
        self.save()
        return task

    def mark_in_progress(self, agent_id: str, task_id: str) -> Optional[Dict]:
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            current_task["status"] = "in_progress"
            self.save()
            return current_task
        return None

    def complete_task(self, agent_id: str, task_id: str, work_result: str, file_name: str = "") -> None:
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            skill_id = current_task.get("skill_id", "")
            bucket["success_counts"][skill_id] = bucket["success_counts"].get(skill_id, 0) + 1
            result_label = work_result
            if file_name:
                result_label = f"{work_result} ({file_name})"
            bucket["recent_results"].append(result_label)
            bucket["recent_results"] = bucket["recent_results"][-5:]
            bucket["history"].append({"kind": "completed", "task": current_task, "result": result_label})
            bucket["history"] = bucket["history"][-20:]
            bucket["current_task"] = None
            self.save()

    def fail_task(self, agent_id: str, task_id: str, reason: str) -> None:
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            skill_id = current_task.get("skill_id", "")
            bucket["failure_counts"][skill_id] = bucket["failure_counts"].get(skill_id, 0) + 1
            bucket["recent_failures"].append(reason)
            bucket["recent_failures"] = bucket["recent_failures"][-5:]
            bucket["history"].append({"kind": "failed", "task": current_task, "reason": reason})
            bucket["history"] = bucket["history"][-20:]
            bucket["current_task"] = None
            self.save()

    def snapshot(self, agent_id: str) -> Dict:
        bucket = self._agent_bucket(agent_id)
        profile = self.ensure_profile(agent_id)
        return {
            "profile": {
                "preferred_skills": profile.preferred_skills,
                "allowed_skills": profile.allowed_skills,
                "success_counts": profile.success_counts,
                "failure_counts": profile.failure_counts,
                "current_task_status": profile.current_task_status,
            },
            "current_task": bucket.get("current_task"),
            "recent_results": bucket.get("recent_results", [])[-3:],
            "recent_failures": bucket.get("recent_failures", [])[-2:],
        }
