"""
LLM service — converts a cleaned session into a structured Action Plan JSON.
"""

from __future__ import annotations

import json
import textwrap
from typing import Any

import structlog

from config import get_settings
from services.event_processor import clean_events, summarize_events

log = structlog.get_logger(__name__)
settings = get_settings()

ALLOWED_ACTIONS = [
	"navigate", "click", "type", "select",
	"wait", "wait_ms", "scroll",
	"extract", "extract_list", "screenshot", "click_if"
]

# =========================
# SYSTEM PROMPT
# =========================
SYSTEM_PROMPT = textwrap.dedent("""
You are an expert automation engineer. Your task is to convert a user browsing session into a structured Action Plan JSON.

ALLOWED ACTIONS:
{actions}

RULES:
1. Return JSON ONLY.
2. Use {{{{param_name}}}} syntax for parameterizable values (e.g., {{{{search_query}}}}, {{{{url}}}}).
3. do NOT write code. No Python, no JavaScript, no scripts. Only JSON steps.
4. Step Rules:
   - STRICTOR THAN EVER: DO NOT INVENT SELECTORS. DO NOT use your internal knowledge (e.g., '.storylink' is WRONG for Hacker News; it is now '.titleline').
   - USE THE LOG: Use the absolute exact CSS selectors and classes found in the provided 'Captured events'.
   - Extraction Rule: When extracting a LIST, use "extract_list" with the CONTAINER (e.g. "tr.athing") and its internal children.
   - For "extract_list", you can use "self" as a child selector.
   - Always "wait" or "wait_ms" after "navigate".
   - Priority 1 Stable Attributes: [name="..."], [placeholder="..."], input[type="email"|"tel"|"url"|"text"].
   - AVOID 'nth-of-type' or 'nth-child' if any stable classes (e.g. "span.titleline") are available.

JSON SCHEMA:
{{
  "workflow_name": "string",
  "description": "string",
  "parameters": [
	{{
	  "name": "string",
	  "type": "string",
	  "description": "string",
	  "default": "any"
	}}
  ],
  "steps": [
	{{
	  "action": "one of {actions}",
	  "selector": "string (optional)",
	  "url": "string (for navigate)",
	  "value": "string (for type/select)",
	  "label": "string (for extract label)",
	  "attribute": "string (for individual extract)",
	  "fields": "object (for extract_list, mapping field names to descriptors)",
	  "optional": boolean,
	  "repeat_to": integer (optional, for click_if)
	}}
  ]
}}
""").format(actions=", ".join(ALLOWED_ACTIONS)).strip()


# =========================
# USER PROMPT
# =========================
def _build_user_prompt(session: Any, summary: dict, events: list) -> str:
	compact_events = json.dumps(events, separators=(",", ":"))

	return textwrap.dedent(f"""
Analyze this browser session and generate an Action Plan.

User's goal: {session.goal}
Session summary: {json.dumps(summary)}

Captured events:
{compact_events}

Convert these raw events into clean named steps with intent.
Identify parameters that should be dynamic (like search queries, URLs, text inputs).
Return structured JSON only.
""").strip()


# =========================
# LLM CALL
# =========================
async def _call_llm(messages: list[dict]) -> dict[str, Any]:
	from groq import AsyncGroq

	client = AsyncGroq(api_key=settings.groq_api_key)

	response = await client.chat.completions.create(
		model=settings.groq_model,
		messages=messages,
		response_format={"type": "json_object"},
		temperature=0.2,
		max_tokens=4000,
		timeout=120,
	)

	raw = response.choices[0].message.content or "{}"
	return json.loads(raw)


# =========================
# MAIN
# =========================
async def generate_action_plan(session: Any) -> dict[str, Any]:
	"""
	Main entry point — converts session events into a validated Action Plan.
	"""
	cleaned = clean_events(session.events or [])
	summary = summarize_events(cleaned)
	events_for_prompt = cleaned[-150:]

	log.info("llm.generate.start", session_id=session.id)

	# Call LLM
	parsed = await _call_llm([
		{"role": "system", "content": SYSTEM_PROMPT},
		{"role": "user", "content": _build_user_prompt(session, summary, events_for_prompt)},
	])

	if isinstance(parsed, list) and len(parsed) > 0:
		parsed = parsed[0]

	if not isinstance(parsed, dict):
		raise ValueError(f"Expected JSON object from LLM, got {type(parsed).__name__}")

	# VALIDATE
	if "steps" not in parsed or not isinstance(parsed["steps"], list) or len(parsed["steps"]) == 0:
		raise ValueError("LLM returned an empty or missing action plan.")

	# Filter invalid actions
	valid_steps = []
	for step in parsed["steps"]:
		action = step.get("action")
		if action in ALLOWED_ACTIONS:
			valid_steps.append(step)
		else:
			log.warning("llm.validation.unknown_action", action=action)

	parsed["steps"] = valid_steps

	log.info("llm.generate.success", workflow=parsed.get("workflow_name"))

	return {
		"session_id": session.id,
		"name": parsed.get("workflow_name", "Generated Workflow"),
		"description": parsed.get("description", ""),
		"parameters": parsed.get("parameters", []),
		"action_plan": {
			"steps": parsed.get("steps", []),
			"parameters": parsed.get("parameters", [])  # Redundant but helpful for executor
		}
	}