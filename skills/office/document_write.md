---
id: document_write
name: Document Writer
task_types: document_write
allowed_roles: planner, manager, writer, marketer, developer
recommended_model: gemini-2.5-flash
input_schema: task,persona,brief
output_mode: work_json
estimated_latency: medium
---

Write a polished Korean document that directly addresses the request.

Requirements:
- Use a crisp title.
- Structure the content for fast reading.
- Avoid filler and keep the output practical.
- If the task suggests a filename, use it. Otherwise choose a sensible one.

Return JSON only:
{
  "thought": "...",
  "speech": "...",
  "action": "Idle",
  "work_result": "...",
  "file_output": {
    "name": "document.md",
    "content": "..."
  }
}
