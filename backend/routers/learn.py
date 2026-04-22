"""
Learn router — Phase 5

POST /api/sessions/{session_id}/learn
→ Runs LLM on session events, saves Workflow, broadcasts via WebSocket
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.session import Session
from models.workflow import Workflow
from services.llm_service import generate_action_plan
from websocket_manager import manager

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["learn"])


@router.post("/{session_id}/learn", status_code=status.HTTP_201_CREATED)
async def learn(session_id: str, db: AsyncSession = Depends(get_db)) -> dict:
	"""
	Full LLM pipeline:
	a) Validate session
	b) Mark processing
	c) Call LLM
	d) Save Workflow
	e) Mark done
	f) Broadcast result via WebSocket
	"""
	# a) Fetch session
	result = await db.execute(select(Session).where(Session.id == session_id))
	session = result.scalar_one_or_none()
	if not session:
		raise HTTPException(404, detail="Session not found")
	if session.status == "failed":
		raise HTTPException(400, detail="Session already failed — cannot learn")
	if len(session.events or []) < 3:
		raise HTTPException(
			400, detail="Session needs at least 3 events to generate a workflow")

	# b) Mark processing
	session.status = "processing"
	await db.flush()

	# c) Broadcast start
	await manager.broadcast_to_session(session_id, {"type": "LEARNING_STARTED"})

	try:
		# d) Call LLM
		wf_data = await generate_action_plan(session)

		# e) Save Workflow
		wf = Workflow(**wf_data)
		db.add(wf)
		session.status = "done"
		await db.flush()
		await db.refresh(wf)

		log.info("learn.done", session_id=session_id, workflow_id=wf.id)

		# f) Broadcast success
		await manager.broadcast_to_session(session_id, {
			"type": "LEARNING_DONE",
			"workflow_id": wf.id,
		})

		return {
			"success": True,
			"data": {
				"id": wf.id,
				"session_id": wf.session_id,
				"name": wf.name,
				"description": wf.description,
				"parameters": wf.parameters or [],
				"steps": wf.steps or [],
				"action_plan": wf.action_plan,
				"is_active": wf.is_active,
				"run_count": wf.run_count,
				"last_run_at": None,
				"created_at": wf.created_at.isoformat(),
				"updated_at": wf.updated_at.isoformat(),
			},
			"error": None,
		}

	except Exception as exc:
		log.error("learn.failed", session_id=session_id, error=str(exc))
		session.status = "failed"
		await db.flush()
		await manager.broadcast_to_session(session_id, {
			"type": "LEARNING_FAILED",
			"error": str(exc),
		})
		raise HTTPException(500, detail=str(exc)) from exc
