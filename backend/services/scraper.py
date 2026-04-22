"""
Playwright script runner — executes LLM-generated scripts via subprocess.

Uses subprocess (not exec()) so:
- The Playwright script runs in an isolated process
- stdout/stderr are captured cleanly
- Hard timeout kills the process if it hangs
- The caller's event loop is never blocked
"""

from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import os
import ast
from typing import Any

import structlog

log = structlog.get_logger(__name__)


async def execute_workflow(workflow: Any,
						   parameters: dict[str, Any]) -> dict[str, Any]:
	"""
	Execute a workflow's Playwright script and return structured results.

	Never raises — always returns { success, data, step_results, raw_output, error, returncode }
	"""
	# ── Merge parameters with defaults from workflow definition ───────────────
	print("workflow: ", workflow.parameters)
	param_defs = {p.get("name"): p for p in (workflow.parameters or [])}
	merged: dict[str, Any] = {}

	# 1. Fill with defaults
	for name, p_def in param_defs.items():
		merged[name] = p_def.get("default")

	# 2. Update with caller-supplied values, casting to correct type
	for name, val in parameters.items():
		p_def = param_defs.get(name)
		if not p_def:
			merged[name] = val
			continue

		p_type = p_def.get("type", "string")
		if p_type == "boolean":
			if isinstance(val, str):
				merged[name] = val.lower() in ("true", "1", "yes", "on")
			else:
				merged[name] = bool(val)
		elif p_type == "number":
			try:
				merged[name] = float(val) if "." in str(val) else int(val)
			except (ValueError, TypeError):
				merged[name] = val
		else:
			merged[name] = val

	# ── Build full script with injected PARAMS ────────────────────────────────
	full_script = f"PARAMS = {repr(merged)}\n\n{workflow.script}"

	timeout_s: int = int(merged.get("timeout_seconds", 60))
	tmp_path: str | None = None

	try:
		# Write to temp file
		with tempfile.NamedTemporaryFile(
			mode="w",
			suffix=".py",
			delete=False,
			encoding="utf-8",
		) as f:
			f.write(full_script)
			tmp_path = f.name

		log.info("runner.execute", workflow_id=workflow.id, timeout_s=timeout_s)

		# Launch subprocess using same venv's Python
		proc = await asyncio.create_subprocess_exec(
			sys.executable,
			tmp_path,
			stdout=asyncio.subprocess.PIPE,
			stderr=asyncio.subprocess.PIPE,
		)

		try:
			stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(),
														timeout=timeout_s)
		except asyncio.TimeoutError:
			proc.kill()
			await proc.communicate()
			log.warning("runner.timeout", workflow_id=workflow.id)
			return {
				"success": False,
				"data": None,
				"step_results": [],
				"raw_output": "",
				"error": f"Script timed out after {timeout_s}s",
				"returncode": -1,
			}

		stdout_str = stdout_b.decode("utf-8", errors="replace")
		stderr_str = stderr_b.decode("utf-8", errors="replace")
		returncode = proc.returncode

		# ── Parse JSON lines from stdout ──────────────────────────────────────
		step_results: list[dict] = []
		final_result: dict | None = None

		for line in stdout_str.splitlines():
			line = line.strip()
			if not line:
				continue
			try:
				obj = json.loads(line)
				step_results.append(obj)
				final_result = obj
			except json.JSONDecodeError:
				# Fallback for Python-style dict strings (single quotes)
				try:
					obj = ast.literal_eval(line)
					if isinstance(obj, dict):
						step_results.append(obj)
						final_result = obj
				except:
					pass

		success = (returncode == 0) and bool(final_result
											 and final_result.get("success", True))

		return {
			"success": success,
			"data": final_result.get("data") if final_result else None,
			"step_results": step_results,
			"raw_output": stdout_str,
			"error": stderr_str if not success else None,
			"returncode": returncode,
		}

	except Exception as exc:
		log.error("runner.exception", workflow_id=workflow.id, error=str(exc))
		return {
			"success": False,
			"data": None,
			"step_results": [],
			"raw_output": "",
			"error": str(exc),
			"returncode": -1,
		}
	finally:
		if tmp_path and os.path.exists(tmp_path):
			os.unlink(tmp_path)
