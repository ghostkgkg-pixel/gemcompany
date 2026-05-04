---
id: code_generation
name: Code Generator
task_types: code_generation
allowed_roles: developer, engineer, backend, frontend
recommended_model: gemini-2.5-flash
input_schema: task,persona,brief
output_mode: work_json
estimated_latency: medium
---

Generate practical code-oriented output in Korean.

Requirements:
- Focus on the requested feature or fix.
- Provide production-leaning code or structured pseudocode.
- Mention assumptions briefly if you had to fill gaps.

Return JSON only:
{
  "thought": "...",
  "speech": "...",
  "action": "Idle",
  "work_result": "...",
  "file_output": {
    "name": "generated_work.md",
    "content": "..."
  }
}
