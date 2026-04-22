"""
Workflows router — Phase 6

GET	   /api/workflows				List with optional search
POST   /api/workflows				Manual workflow creation
GET	   /api/workflows/{id}			Single workflow + last 5 run logs
PATCH  /api/workflows/{id}			Update editable fields
DELETE /api/workflows/{id}			Soft delete (is_active=false)
"""

from __future__ import annotations

from typing import Any, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.workflow import Workflow
from models.run_log import RunLog
from schemas.workflows import WorkflowCreate, WorkflowUpdate, WorkflowResponse

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/workflows", tags=["workflows"])

# ── Helpers ───────────────────────────────────────────────────────────────────


def _wf_out(wf: Workflow, runs: list[RunLog] | None = None) -> dict:
	out: dict[str, Any] = {
		"id": wf.id,
		"session_id": wf.session_id,
		"name": wf.name,
		"description": wf.description,
		"parameters": wf.parameters or [],
		"steps": wf.steps or [],
		"action_plan": wf.action_plan,
		"is_active": wf.is_active,
		"run_count": wf.run_count,
		"last_run_at": wf.last_run_at.isoformat() if wf.last_run_at else None,
		"created_at": wf.created_at.isoformat(),
		"updated_at": wf.updated_at.isoformat(),
	}
	if runs is not None:
		out["recent_runs"] = [_run_out(r) for r in runs]
	return out


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


async def _get_or_404(workflow_id: str, db: AsyncSession) -> Workflow:
	result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
	wf = result.scalar_one_or_none()
	if not wf:
		raise HTTPException(404, detail="Workflow not found")
	return wf


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("")
async def list_workflows(
	limit: int = 20,
	offset: int = 0,
	search: Optional[str] = None,
	db: AsyncSession = Depends(get_db),
) -> dict:
	q = select(Workflow).where(Workflow.is_active == True)
	if search:
		q = q.where(
			or_(
				Workflow.name.ilike(f"%{search}%"),
				Workflow.description.ilike(f"%{search}%"),
			))
	q = q.order_by(
		Workflow.last_run_at.desc().nulls_last(),
		Workflow.created_at.desc(),
	).limit(limit).offset(offset)
	
	result = await db.execute(q)
	return {
		"success": True,
		"data": [_wf_out(wf) for wf in result.scalars().all()],
		"error": None
	}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workflow(
	payload: WorkflowCreate, db: AsyncSession = Depends(get_db)) -> dict:
	wf = Workflow(**payload.model_dump())
	db.add(wf)
	await db.flush()
	await db.refresh(wf)
	return {"success": True, "data": _wf_out(wf), "error": None}


@router.get("/{workflow_id}")
async def get_workflow(
	workflow_id: str, db: AsyncSession = Depends(get_db)) -> dict:
	wf = await _get_or_404(workflow_id, db)
	# Fetch last 5 run logs
	runs_result = await db.execute(
		select(RunLog).where(RunLog.workflow_id == workflow_id).order_by(
			RunLog.ran_at.desc()).limit(5))
	runs = list(runs_result.scalars().all())
	return {"success": True, "data": _wf_out(wf, runs=runs), "error": None}


@router.patch("/{workflow_id}")
async def update_workflow(
	workflow_id: str,
	payload: WorkflowUpdate,
	db: AsyncSession = Depends(get_db),
) -> dict:
	wf = await _get_or_404(workflow_id, db)
	for field, val in payload.model_dump(exclude_none=True).items():
		setattr(wf, field, val)
	await db.flush()
	await db.refresh(wf)
	return {"success": True, "data": _wf_out(wf), "error": None}


@router.delete("/{workflow_id}")
async def delete_workflow(
	workflow_id: str, db: AsyncSession = Depends(get_db)) -> dict:
	"""Soft delete — sets is_active=False."""
	wf = await _get_or_404(workflow_id, db)
	wf.is_active = False
	await db.flush()
	return {"success": True, "data": None, "error": None}
