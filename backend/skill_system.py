from __future__ import annotations

from dataclasses import asdict, dataclass, field
import os
import re
from typing import Dict, List, Optional

# 환경 변수에서 사용할 모델명을 가져옴 (기본값 설정 포함)
FAST_MODEL = os.getenv("GEMINI_FAST_MODEL", "gemini-3.1-flash-lite-preview")
WORK_MODEL = os.getenv("GEMINI_WORK_MODEL", "gemini-2.5-flash")

@dataclass
class SkillDefinition:
    """
    에이전트가 수행할 수 있는 개별 스킬(기능) 정의
    """
    id: str                 # 스킬 고유 ID
    name: str               # 스킬 이름
    task_types: List[str]   # 이 스킬이 처리 가능한 태스크 유형 목록
    allowed_roles: List[str] # 이 스킬을 사용할 수 있는 역할(직업) 목록
    recommended_model: str  # 이 스킬에 최적화된 LLM 모델
    input_schema: str       # 입력 데이터 구조 가이드
    output_mode: str        # 출력 형식 (JSON, Text 등)
    estimated_latency: str  # 예상 지연 시간
    prompt: str             # 스킬 실행을 위한 시스템 프롬프트

@dataclass
class TaskClassification:
    """
    LLM에 의해 분류된 태스크의 결과 구조
    """
    task_type: str          # 분류된 태스크 유형
    requires_cli: bool      # CLI 실행(도구 사용)이 필요한지 여부
    local_speech: str       # 에이전트가 즉각적으로 할 말
    local_action: str = "Idle" # 에이전트가 즉각적으로 취할 행동
    target: Optional[str] = None # 행동의 대상 (구역명 등)
    reason: str = ""        # 분류 근거

@dataclass
class SkillSelectionResult:
    """
    태스크 해결을 위해 선택된 최적의 스킬 정보
    """
    skill: SkillDefinition  # 선택된 스킬
    model: str              # 사용할 모델
    score: float            # 적합도 점수
    rationale: str          # 선택 이유

@dataclass
class AgentSkillProfile:
    """
    개별 에이전트의 스킬 보유 및 숙련도 프로필
    """
    preferred_skills: List[str] = field(default_factory=list) # 선호하는 스킬
    allowed_skills: List[str] = field(default_factory=list)   # 사용 가능한 스킬 목록
    success_counts: Dict[str, int] = field(default_factory=dict) # 스킬별 성공 횟수
    failure_counts: Dict[str, int] = field(default_factory=dict) # 스킬별 실패 횟수
    current_task_status: str = "idle"


@dataclass
class WorkBrief:
    """
    에이전트의 최근 업무 성과 요약
    """
    current_task: str = ""                         # 현재 수행 중인 태스크
    recent_results: List[str] = field(default_factory=list) # 최근 성공 결과 요약
    recent_failures: List[str] = field(default_factory=list) # 최근 실패 사례
    skill_success_rates: Dict[str, float] = field(default_factory=dict) # 스킬별 성공률

class SkillRegistry:
    """
    스킬 정의(Markdown 파일)를 읽고 관리하는 레지스트리
    """
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.skills: Dict[str, SkillDefinition] = {}
        self.reload()

    def reload(self) -> None:
        """
        루트 디렉토리의 모든 .md 파일을 읽어 스킬 목록을 갱신
        """
        self.skills = {}
        if not os.path.isdir(self.root_dir):
            return
        for filename in os.listdir(self.root_dir):
            if not filename.endswith(".md"):
                continue
            skill = self._load_skill(os.path.join(self.root_dir, filename))
            self.skills[skill.id] = skill

    def get(self, skill_id: str) -> SkillDefinition:
        """특정 ID의 스킬 정의 반환"""
        return self.skills[skill_id]

    def get_skills_for_task(self, task_type: str) -> List[SkillDefinition]:
        """특정 태스크 유형을 처리할 수 있는 스킬 목록 반환"""
        return [skill for skill in self.skills.values() if task_type in skill.task_types]

    def _load_skill(self, path: str) -> SkillDefinition:
        """Markdown 파일로부터 스킬 정의 로드 (Front-matter 포함)"""
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()

        metadata: Dict[str, str] = {}
        prompt = raw
        # YAML Front-matter (--- 로 둘러싸인 부분) 파싱
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
        """YAML 스타일의 Front-matter 텍스트를 딕셔너리로 변환"""
        metadata: Dict[str, str] = {}
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip()
        return metadata

    def _split_csv(self, value: str) -> List[str]:
        """쉼표로 구분된 문자열을 리스트로 변환"""
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

class TaskClassifier:
    """
    사용자의 메시지를 분석하여 어떤 유형의 태스크인지 분류
    """
    # 인사 및 이동 명령 감지를 위한 정규식 패턴
    GREETING_PATTERN = re.compile(r"\b(hello|hi|hey)\b", re.IGNORECASE)
    GREETING_KEYWORDS = ["안녕", "반가워", "좋은 아침", "좋은 오후"]
    MOVE_PATTERN = re.compile(
        r"(?:move|go|이동|가줘|가라|walk)\s*(?:to)?\s*(\(?\d+\s*,\s*\d+\)?|[A-Za-z가-힣 ]+)",
        re.IGNORECASE,
    )

    # 태스크 유형별 키워드 매핑
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
        """메시지를 분석하여 TaskClassification 객체 반환"""
        normalized = message.strip()
        lowered = normalized.lower()

        # 이동(Movement) 명령 감지
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

        # 인사(Greeting) 감지
        if self.GREETING_PATTERN.search(normalized) or any(keyword in normalized for keyword in self.GREETING_KEYWORDS):
            return TaskClassification(
                task_type="greeting",
                requires_cli=False,
                local_speech="안녕하세요! 바로 도와드릴게요.",
                local_action="Idle",
                reason="greeting_rule",
            )

        # 업무(Work) 키워드 기반 분류
        for task_type, keywords in self.WORK_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                return TaskClassification(
                    task_type=task_type,
                    requires_cli=True,
                    local_speech=self._ack_for_task(task_type), # 업무 수락 멘트
                    local_action="Queued",
                    reason=f"keyword:{task_type}",
                )

        # 포괄적인 도움 요청 감지
        if any(token in lowered for token in ["help", "도와", "부탁", "해줘", "please"]):
            return TaskClassification(
                task_type="document_write",
                requires_cli=True,
                local_speech="요청을 접수했어요. 필요한 결과물 형태로 정리해볼게요.",
                local_action="Queued",
                reason="generic_help_rule",
            )

        # 기본 폴백: 일상 대화(Small Talk)
        return TaskClassification(
            task_type="small_talk",
            requires_cli=False,
            local_speech="확인했어요. 더 구체적인 작업을 알려주시면 바로 시작할게요.",
            local_action="Idle",
            reason="small_talk_fallback",
        )

    def _ack_for_task(self, task_type: str) -> str:
        """태스크 유형별 에이전트의 응답 멘트 정의"""
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
    """
    에이전트의 역량과 상황에 맞춰 최적의 스킬을 선택하는 라우터
    """
    # 업무 유형별 선호 직업군 매핑
    ROLE_HINTS = {
        "code_review": ["developer", "engineer", "backend", "frontend", "개발", "엔지니어"],
        "bug_fix": ["developer", "engineer", "qa", "개발", "엔지니어"],
        "code_generation": ["developer", "engineer", "backend", "frontend", "개발", "엔지니어"],
        "feature_spec_write": ["planner", "manager", "product", "기획", "pm", "manager"],
        "document_write": ["planner", "manager", "writer", "기획", "pm", "manager"],
        "research_summary": ["analyst", "research", "planner", "조사", "분석", "기획"],
        "marketing_copy": ["marketing", "marketer", "brand", "마케팅", "브랜드"],
    }

    # 업무 유형별 핵심 능력치 매핑
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
        """가장 점수가 높은 최적의 스킬을 선택"""
        candidates = self.registry.get_skills_for_task(task_type)
        if not candidates:
            raise KeyError(f"No skills registered for task type '{task_type}'")

        best_skill = candidates[0]
        best_score = float("-inf")
        best_rationale = "default"
        for skill in candidates:
            # 각 스킬의 적합도 점수 계산
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
        """에이전트-스킬 간 적합도 점수 계산 로직"""
        score = 10.0
        reasons: List[str] = ["task_match"]

        # 1. 허용된 스킬인지 체크
        if profile.allowed_skills and skill.id not in profile.allowed_skills:
            score -= 100.0
            reasons.append("not_allowed")

        # 2. 직무(Role) 적합도 체크
        job_text = " ".join(
            str(value).lower()
            for value in [agent.get("persona", {}).get("Job", ""), agent.get("persona", {}).get("Role", ""), agent.get("name", "")]
        )
        role_hints = self.ROLE_HINTS.get(task_type, [])
        if any(hint in job_text for hint in role_hints):
            score += 6.0
            reasons.append("role_hint")

        # 3. 명시적 허용 역할 체크
        if skill.allowed_roles and any(role.lower() in job_text for role in skill.allowed_roles):
            score += 4.0
            reasons.append("allowed_role")

        # 4. 능력치(Stat) 가중치 적용
        stat_name = self.STAT_WEIGHTS.get(task_type)
        if stat_name:
            stat_value = float(agent.get("stats", {}).get(stat_name, agent.get("persona", {}).get(stat_name, 5)))
            score += stat_value / 2.0
            reasons.append(f"stat:{stat_name}")

        # 5. 선호도 및 성공률 반영
        if skill.id in profile.preferred_skills:
            score += 2.0
            reasons.append("preferred")

        success_rate = brief.skill_success_rates.get(skill.id, 0.5)
        score += success_rate * 4.0
        reasons.append("success_rate")

        # 6. 업무 중인 경우 페널티 적용
        if profile.current_task_status in {"queued", "in_progress"}:
            score -= 8.0
            reasons.append("busy_penalty")

        return score, ",".join(reasons)


def dataclass_to_dict(value):
    """데이터클래스를 딕셔너리로 변환하는 유틸리티"""
    return asdict(value)
