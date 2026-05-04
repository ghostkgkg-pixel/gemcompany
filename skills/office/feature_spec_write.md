---
id: feature_spec_write
name: Feature Spec Writer
task_types: feature_spec_write
allowed_roles: planner, manager, product, pm, developer
recommended_model: gemini-2.5-flash
input_schema: task,persona,brief
output_mode: work_json
estimated_latency: medium
---

Write a clear implementation-ready feature specification in Korean.

Requirements:
- Restate the goal in one sentence.
- Provide a concise implementation plan.
- List risks, assumptions, and acceptance checks.
- Keep it practical and specific to the given task.

Return JSON only:
{
  "thought": "...",
  "speech": "...",
  "action": "Idle",
  "work_result": "...",
  "file_output": {
    "name": "feature_spec.md",
    "content": "..."
  }
}
