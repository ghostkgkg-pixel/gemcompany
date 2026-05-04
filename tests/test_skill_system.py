import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from skill_system import SkillRegistry, SkillRouter, TaskClassifier
from work_memory import WorkMemoryManager


def test_registry_loads_office_skills():
    skills_dir = os.path.join(os.path.dirname(__file__), "..", "skills", "office")
    registry = SkillRegistry(skills_dir)
    loaded = set(registry.skills.keys())

    assert "feature_spec_write" in loaded
    assert "document_write" in loaded
    assert "code_review" in loaded
    assert "bug_fix" in loaded
    assert "research_summary" in loaded
    assert "marketing_copy" in loaded
    assert "code_generation" in loaded


def test_classifier_handles_local_and_work_tasks():
    classifier = TaskClassifier()

    greeting = classifier.classify("안녕, 오늘 어때?")
    assert greeting.requires_cli is False
    assert greeting.task_type == "greeting"

    movement = classifier.classify("move to 4, 7")
    assert movement.requires_cli is False
    assert movement.task_type == "movement"
    assert movement.target == "4, 7"

    review = classifier.classify("이 코드 리뷰해줘")
    assert review.requires_cli is True
    assert review.task_type == "code_review"


def test_router_prefers_role_appropriate_skill(tmp_path):
    skills_dir = os.path.join(os.path.dirname(__file__), "..", "skills", "office")
    registry = SkillRegistry(skills_dir)
    router = SkillRouter(registry)
    memory = WorkMemoryManager(str(tmp_path / "work_memory.json"))

    agent = {
        "name": "Mina",
        "persona": {"Job": "Product Planner"},
        "stats": {"Creativity": 9, "Intelligence": 7, "Efficiency": 6, "Social": 5},
    }

    profile = memory.ensure_profile("agent-1", list(registry.skills.keys()))
    brief = memory.build_brief("agent-1")
    selection = router.select_skill(agent, "feature_spec_write", brief, profile)

    assert selection.skill.id == "feature_spec_write"
    assert selection.model


def test_work_memory_tracks_success_and_failure(tmp_path):
    memory = WorkMemoryManager(str(tmp_path / "work_memory.json"))
    memory.ensure_profile("agent-2", ["document_write", "code_review"])

    task = memory.start_task("agent-2", "task-1", "document_write", "document_write", "Write a brief")
    assert task["status"] == "queued"

    memory.mark_in_progress("agent-2", "task-1")
    memory.complete_task("agent-2", "task-1", "Brief completed", file_name="brief.md")

    next_task = memory.start_task("agent-2", "task-2", "code_review", "code_review", "Review PR")
    assert next_task["status"] == "queued"
    memory.fail_task("agent-2", "task-2", "Timeout")

    brief = memory.build_brief("agent-2")
    assert any("Brief completed" in item for item in brief.recent_results)
    assert "Timeout" in brief.recent_failures
    assert brief.skill_success_rates["document_write"] == 1.0
    assert brief.skill_success_rates["code_review"] == 0.0
