from __future__ import annotations

from dataclasses import asdict, dataclass, field
import os
import re
from typing import Dict, List, Optional


FAST_MODEL = os.getenv("GEMINI_FAST_MODEL", "gemini-3.1-flash-lite-preview")
WORK_MODEL = os.getenv("GEMINI_WORK_MODEL", "gemini-2.5-flash")


@dataclass
class SkillDefinition:
    id: str
    name: str
    task_types: List[str]
    allowed_roles: List[str]
    recommended_model: str
    input_schema: str
    output_mode: str
    estimated_latency: str
    prompt: str


@dataclass
class TaskClassification:
    task_type: str
    requires_cli: bool
    local_speech: str
    local_action: str = "Idle"
    target: Optional[str] = None
    reason: str = ""


@dataclass
class SkillSelectionResult:
    skill: SkillDefinition
    model: str
    score: float
    rationale: str


@dataclass
class AgentSkillProfile:
    preferred_skills: List[str] = field(default_factory=list)
    allowed_skills: List[str] = field(default_factory=list)
    success_counts: Dict[str, int] = field(default_factory=dict)
    failure_counts: Dict[str, int] = field(default_factory=dict)
    current_task_status: str = "idle"


@dataclass
class WorkBrief:
    current_task: str = ""
    recent_results: List[str] = field(default_factory=list)
    recent_failures: List[str] = field(default_factory=list)
    skill_success_rates: Dict[str, float] = field(default_factory=dict)


class SkillRegistry:
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.skills: Dict[str, SkillDefinition] = {}
        self.reload()

    def reload(self) -> None:
        self.skills = {}
        if not os.path.isdir(self.root_dir):
            return
        for filename in os.listdir(self.root_dir):
            if not filename.endswith(".md"):
                continue
            skill = self._load_skill(os.path.join(self.root_dir, filename))
            self.skills[skill.id] = skill

    def get(self, skill_id: str) -> SkillDefinition:
        return self.skills[skill_id]

    def get_skills_for_task(self, task_type: str) -> List[SkillDefinition]:
        return [skill for skill in self.skills.values() if task_type in skill.task_types]

    def _load_skill(self, path: str) -> SkillDefinition:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()

        metadata: Dict[str, str] = {}
        prompt = raw
        if raw.startswith("---"):
            parts = raw.split("---", 2)
            if len(parts) == 3:
                _, front_matter, prompt = parts
                metadata = self._parse_front_matter(front_matter.strip())

        return SkillDefinition(
            id=metadata.get("id", os.path.splitext(os.path.basename(path))[0]),
            name=metadata.get("name", os.path.splitext(os.path.basename(path))[0]),
            task_types=self._split_csv(metadata.get("task_types", "")),
            allowed_roles=self._split_csv(metadata.get("allowed_roles", "")),
            recommended_model=metadata.get("recommended_model", WORK_MODEL),
            input_schema=metadata.get("input_schema", "task"),
            output_mode=metadata.get("output_mode", "work_json"),
            estimated_latency=metadata.get("estimated_latency", "medium"),
            prompt=prompt.strip(),
        )

    def _parse_front_matter(self, raw: str) -> Dict[str, str]:
        metadata: Dict[str, str] = {}
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip()
        return metadata

    def _split_csv(self, value: str) -> List[str]:
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]


class TaskClassifier:
    GREETING_PATTERN = re.compile(r"\b(hello|hi|hey)\b", re.IGNORECASE)
    GREETING_KEYWORDS = ["안녕", "반가워", "좋은 아침", "좋은 오후"]
    MOVE_PATTERN = re.compile(
        r"(?:move|go|이동|가줘|가라|walk)\s*(?:to)?\s*(\(?\d+\s*,\s*\d+\)?|[A-Za-z가-힣 ]+)",
        re.IGNORECASE,
    )

    WORK_KEYWORDS = {
        "code_review": ["review", "리뷰", "검토", "code review", "diff", "pr"],
        "bug_fix": ["bug", "fix", "error", "debug", "버그", "에러", "고쳐", "수정"],
        "feature_spec_write": ["spec", "설계", "기획", "로드맵", "plan", "요구사항"],
        "research_summary": ["research", "조사", "요약", "정리", "analyze", "분석"],
        "marketing_copy": ["marketing", "마케팅", "광고", "copy", "캠페인", "홍보"],
        "code_generation": ["code", "개발", "구현", "build", "api", "component", "refactor"],
        "document_write": ["document", "문서", "write", "작성", "보고서", "proposal", "초안"],
    }

    def classify(self, message: str) -> TaskClassification:
        normalized = message.strip()
        lowered = normalized.lower()

        move_match = self.MOVE_PATTERN.search(normalized)
        if move_match:
            target = move_match.group(1).strip()
            return TaskClassification(
                task_type="movement",
                requires_cli=False,
                local_speech=f"{target} 쪽으로 바로 움직여볼게요.",
                local_action=f"Moving to {target}",
                target=target,
                reason="movement_rule",
            )

        if self.GREETING_PATTERN.search(normalized) or any(keyword in normalized for keyword in self.GREETING_KEYWORDS):
            return TaskClassification(
                task_type="greeting",
                requires_cli=False,
                local_speech="안녕하세요! 바로 도와드릴게요.",
                local_action="Idle",
                reason="greeting_rule",
            )

        for task_type, keywords in self.WORK_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                return TaskClassification(
                    task_type=task_type,
                    requires_cli=True,
                    local_speech=self._ack_for_task(task_type),
                    local_action="Queued",
                    reason=f"keyword:{task_type}",
                )

        if any(token in lowered for token in ["help", "도와", "부탁", "해줘", "please"]):
            return TaskClassification(
                task_type="document_write",
                requires_cli=True,
                local_speech="요청을 접수했어요. 필요한 결과물 형태로 정리해볼게요.",
                local_action="Queued",
                reason="generic_help_rule",
            )

        return TaskClassification(
            task_type="small_talk",
            requires_cli=False,
            local_speech="확인했어요. 더 구체적인 작업을 알려주시면 바로 시작할게요.",
            local_action="Idle",
            reason="small_talk_fallback",
        )

    def _ack_for_task(self, task_type: str) -> str:
        acknowledgements = {
            "code_review": "검토 요청을 접수했어요. 핵심 위험부터 빠르게 확인해볼게요.",
            "bug_fix": "버그 수정 작업을 바로 시작할게요. 원인부터 좁혀보겠습니다.",
            "feature_spec_write": "설계 작업을 접수했어요. 요구사항을 구조화해서 정리해볼게요.",
            "research_summary": "조사 요청을 받았어요. 필요한 정보만 추려서 정리해볼게요.",
            "marketing_copy": "마케팅 초안 작업을 시작할게요. 바로 문안을 만들어보겠습니다.",
            "code_generation": "구현 요청을 접수했어요. 필요한 코드 산출물을 준비할게요.",
            "document_write": "문서 작성 요청을 접수했어요. 보기 좋게 정리해볼게요.",
        }
        return acknowledgements.get(task_type, "요청을 접수했어요. 바로 작업에 들어갈게요.")


class SkillRouter:
    ROLE_HINTS = {
        "code_review": ["developer", "engineer", "backend", "frontend", "개발", "엔지니어"],
        "bug_fix": ["developer", "engineer", "qa", "개발", "엔지니어"],
        "code_generation": ["developer", "engineer", "backend", "frontend", "개발", "엔지니어"],
        "feature_spec_write": ["planner", "manager", "product", "기획", "pm", "manager"],
        "document_write": ["planner", "manager", "writer", "기획", "pm", "manager"],
        "research_summary": ["analyst", "research", "planner", "조사", "분석", "기획"],
        "marketing_copy": ["marketing", "marketer", "brand", "마케팅", "브랜드"],
    }

    STAT_WEIGHTS = {
        "code_review": "Intelligence",
        "bug_fix": "Intelligence",
        "code_generation": "Efficiency",
        "feature_spec_write": "Creativity",
        "document_write": "Efficiency",
        "research_summary": "Intelligence",
        "marketing_copy": "Creativity",
    }

    def __init__(self, registry: SkillRegistry):
        self.registry = registry

    def select_skill(self, agent: Dict, task_type: str, brief: WorkBrief, profile: AgentSkillProfile) -> SkillSelectionResult:
        candidates = self.registry.get_skills_for_task(task_type)
        if not candidates:
            raise KeyError(f"No skills registered for task type '{task_type}'")

        best_skill = candidates[0]
        best_score = float("-inf")
        best_rationale = "default"
        for skill in candidates:
            score, rationale = self._score_skill(agent, task_type, skill, brief, profile)
            if score > best_score:
                best_skill = skill
                best_score = score
                best_rationale = rationale

        return SkillSelectionResult(
            skill=best_skill,
            model=best_skill.recommended_model or WORK_MODEL,
            score=best_score,
            rationale=best_rationale,
        )

    def _score_skill(
        self,
        agent: Dict,
        task_type: str,
        skill: SkillDefinition,
        brief: WorkBrief,
        profile: AgentSkillProfile,
    ) -> tuple[float, str]:
        score = 10.0
        reasons: List[str] = ["task_match"]

        if profile.allowed_skills and skill.id not in profile.allowed_skills:
            score -= 100.0
            reasons.append("not_allowed")

        job_text = " ".join(
            str(value).lower()
            for value in [agent.get("persona", {}).get("Job", ""), agent.get("persona", {}).get("Role", ""), agent.get("name", "")]
        )
        role_hints = self.ROLE_HINTS.get(task_type, [])
        if any(hint in job_text for hint in role_hints):
            score += 6.0
            reasons.append("role_hint")

        if skill.allowed_roles and any(role.lower() in job_text for role in skill.allowed_roles):
            score += 4.0
            reasons.append("allowed_role")

        stat_name = self.STAT_WEIGHTS.get(task_type)
        if stat_name:
            stat_value = float(agent.get("stats", {}).get(stat_name, agent.get("persona", {}).get(stat_name, 5)))
            score += stat_value / 2.0
            reasons.append(f"stat:{stat_name}")

        if skill.id in profile.preferred_skills:
            score += 2.0
            reasons.append("preferred")

        success_rate = brief.skill_success_rates.get(skill.id, 0.5)
        score += success_rate * 4.0
        reasons.append("success_rate")

        if profile.current_task_status in {"queued", "in_progress"}:
            score -= 8.0
            reasons.append("busy_penalty")

        return score, ",".join(reasons)


def dataclass_to_dict(value):
    return asdict(value)
