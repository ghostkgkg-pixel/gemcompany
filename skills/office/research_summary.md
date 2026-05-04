---
id: research_summary
name: Research Summary
task_types: research_summary
allowed_roles: analyst, researcher, planner, manager, marketer
recommended_model: gemini-2.5-flash
input_schema: task,persona,brief
output_mode: work_json
estimated_latency: medium
---

Summarize the requested topic in Korean.

Requirements:
- Extract only the most useful points.
- Organize them into a short, decision-friendly structure.
- Highlight open questions if the task is underspecified.

Return JSON only:
{
  "thought": "...",
  "speech": "...",
  "action": "Idle",
  "work_result": "...",
  "file_output": {
    "name": "research_summary.md",
    "content": "..."
  }
}
