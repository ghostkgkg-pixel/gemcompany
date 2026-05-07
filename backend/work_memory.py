from __future__ import annotations

import json
import os
import time
from typing import Dict, Optional

from skill_system import AgentSkillProfile, WorkBrief

class WorkMemoryManager:
    """
    에이전트의 업무 기억(태스크 이력, 스킬 숙련도 등)을 관리하는 클래스
    """
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self._data = self._load()

    def _load(self) -> Dict:
        """저장된 업무 기억 데이터를 로드"""
        if not os.path.exists(self.storage_path):
            return {"agents": {}}
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return {"agents": {}}

    def save(self) -> None:
        """현재 데이터를 JSON 파일로 저장"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def _agent_bucket(self, agent_id: str) -> Dict:
        """특정 에이전트의 데이터 저장 공간(Bucket)을 반환하거나 생성"""
        agents = self._data.setdefault("agents", {})
        return agents.setdefault(
            agent_id,
            {
                "preferred_skills": [],    # 선호하는 스킬 목록
                "allowed_skills": [],      # 허용된 스킬 목록
                "success_counts": {},      # 스킬별 성공 횟수
                "failure_counts": {},      # 스킬별 실패 횟수
                "current_task": None,      # 현재 수행 중인 태스크
                "recent_results": [],      # 최근 성공 결과 요약
                "recent_failures": [],     # 최근 실패 사유
                "history": [],             # 전체 활동 이력
            },
        )

    def ensure_profile(self, agent_id: str, default_allowed_skills: Optional[list[str]] = None) -> AgentSkillProfile:
        """에이전트의 스킬 프로필 객체를 생성하여 반환"""
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
        """LLM 프롬프트에 활용할 에이전트의 업무 성과 요약(Brief) 생성"""
        bucket = self._agent_bucket(agent_id)
        success_rates = {}
        all_skill_ids = set(bucket["success_counts"]) | set(bucket["failure_counts"])
        
        for skill_id in all_skill_ids:
            success = bucket["success_counts"].get(skill_id, 0)
            failure = bucket["failure_counts"].get(skill_id, 0)
            total = success + failure
            # 스킬별 성공률 계산 (데이터가 없으면 기본 50%)
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
        """새로운 업무를 시작하고 큐에 등록"""
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
        bucket["history"] = bucket["history"][-20:] # 최근 20개 기록만 유지
        self.save()
        return task

    def mark_in_progress(self, agent_id: str, task_id: str) -> Optional[Dict]:
        """업무 상태를 '진행 중'으로 변경"""
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            current_task["status"] = "in_progress"
            self.save()
            return current_task
        return None

    def complete_task(self, agent_id: str, task_id: str, work_result: str, file_name: str = "") -> None:
        """업무가 성공적으로 완료되었을 때 기록 업데이트"""
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            skill_id = current_task.get("skill_id", "")
            # 성공 횟수 증가
            bucket["success_counts"][skill_id] = bucket["success_counts"].get(skill_id, 0) + 1
            
            result_label = work_result
            if file_name:
                result_label = f"{work_result} ({file_name})"
            
            bucket["recent_results"].append(result_label)
            bucket["recent_results"] = bucket["recent_results"][-5:]
            bucket["history"].append({"kind": "completed", "task": current_task, "result": result_label})
            bucket["history"] = bucket["history"][-20:]
            bucket["current_task"] = None # 현재 태스크 초기화
            self.save()

    def fail_task(self, agent_id: str, task_id: str, reason: str) -> None:
        """업무가 실패했을 때 기록 업데이트"""
        bucket = self._agent_bucket(agent_id)
        current_task = bucket.get("current_task")
        if current_task and current_task.get("task_id") == task_id:
            skill_id = current_task.get("skill_id", "")
            # 실패 횟수 증가
            bucket["failure_counts"][skill_id] = bucket["failure_counts"].get(skill_id, 0) + 1
            bucket["recent_failures"].append(reason)
            bucket["recent_failures"] = bucket["recent_failures"][-5:]
            bucket["history"].append({"kind": "failed", "task": current_task, "reason": reason})
            bucket["history"] = bucket["history"][-20:]
            bucket["current_task"] = None
            self.save()

    def snapshot(self, agent_id: str) -> Dict:
        """UI 표시를 위한 에이전트 업무 상태 스냅샷 반환"""
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
