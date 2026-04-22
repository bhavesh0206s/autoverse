"""
Runner router — Phase 6

POST   /api/workflows/{id}/run			Execute workflow via Playwright
GET	   /api/workflows/{id}/runs			Paginated run history
GET	   /api/runs/{run_id}				Single run log
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.run_log import RunLog
from models.workflow import Workflow
from services.action_executor import ActionExecutor

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api", tags=["runner"])

# ── Schemas (local) ───────────────────────────────────────────────────────────


class RunRequest(BaseModel):
	parameters: dict[str, Any] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _run_out(r: RunLog) -> dict:
	return {
		"id": r.id,
		"workflow_id": r.workflow_id,
		"parameters_used": r.parameters_used,
		"status": r.status,
		"result": r.result,
		"error": r.error,
		"duration_ms": r.duration_ms,
		"screenshot_path": r.screenshot_path,
		"ran_at": r.ran_at.isoformat(),
	}


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/workflows/{workflow_id}/run",
			 status_code=status.HTTP_202_ACCEPTED)
async def run_workflow(
	workflow_id: str,
	payload: RunRequest,
	db: AsyncSession = Depends(get_db),
) -> dict:
	result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
	wf = result.scalar_one_or_none()
	if not wf:
		raise HTTPException(404, detail="Workflow not found")
	if not wf.is_active:
		raise HTTPException(400, detail="Workflow is archived")

	run = RunLog(
		workflow_id=wf.id,
		parameters_used=payload.parameters,
		status="running",
		ran_at=datetime.now(timezone.utc),
	)
	db.add(run)
	await db.flush()
	await db.refresh(run)

	start_ms = time.monotonic()
	# Prepare plan dict for executor
	plan = {
		"steps": wf.action_plan.get("steps", []) if isinstance(wf.action_plan, dict) else wf.action_plan,
		"parameters": wf.parameters
	}
	executor = ActionExecutor(plan, payload.parameters, storage_state=wf.storage_state)
	execution = await executor.run()
	duration_ms = int((time.monotonic() - start_ms) * 1000)

	# Map executor result to run status
	run_status = "success" if execution["success"] else "failed"

	run.status = run_status
	run.result = execution.get("data")
	run.error = None if execution["success"] else execution.get("error", "Execution failed")
	run.duration_ms = duration_ms

	# Update workflow stats & session state
	wf.storage_state = execution.get("storage_state")
	wf.run_count = (wf.run_count or 0) + 1
	wf.last_run_at = datetime.now(timezone.utc)

	await db.flush()
	await db.refresh(run)

	return {"success": True, "data": _run_out(run), "error": None}


@router.get("/workflows/{workflow_id}/runs")
async def list_runs(
	workflow_id: str,
	limit: int = 10,
	offset: int = 0,
	db: AsyncSession = Depends(get_db),
) -> dict:
	result = await db.execute(
		select(RunLog).where(RunLog.workflow_id == workflow_id).order_by(
			RunLog.ran_at.desc()).limit(limit).offset(offset))
	return {
		"success": True,
		"data": [_run_out(r) for r in result.scalars().all()],
		"error": None
	}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)) -> dict:
	result = await db.execute(select(RunLog).where(RunLog.id == run_id))
	run = result.scalar_one_or_none()
	if not run:
		raise HTTPException(404, detail="Run not found")
	return {"success": True, "data": _run_out(run), "error": None}
