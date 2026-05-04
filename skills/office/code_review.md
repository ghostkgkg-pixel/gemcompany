---
id: code_review
name: Code Review
task_types: code_review
allowed_roles: developer, engineer, reviewer, qa
recommended_model: gemini-2.5-flash
input_schema: task,persona,brief
output_mode: work_json
estimated_latency: medium
---

Perform a concise code review in Korean.

Requirements:
- Prioritize bugs, regressions, and missing tests.
- Order findings by severity.
- Keep the result actionable and brief.
- If no clear issue is present, say so and list residual risks.

Return JSON only:
{
  "thought": "...",
  "speech": "...",
  "action": "Idle",
  "work_result": "...",
  "file_output": {
    "name": "code_review.md",
    "content": "..."
  }
}
