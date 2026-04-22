"""
Sessions router — Phase 4 + Phase 5

POST   /api/sessions						  Create session
GET	   /api/sessions						  List recent (Phase 5)
GET	   /api/sessions/{id}					  Get single session
POST   /api/sessions/{id}/events			  Append events (extension → backend)
PATCH  /api/sessions/{id}/status			  Update status
GET	   /api/sessions/{id}/events			  Paginated event list

WebSocket: /ws/sessions/{id}  (mounted in main.py via ws_handler)
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.session import Session
from schemas.sessions import SessionCreate, SessionResponse, SessionUpdate
from websocket_manager import manager

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_PING_INTERVAL = 30	 # seconds

# ── Helpers ───────────────────────────────────────────────────────────────────


def _to_response(s: Session) -> dict:
	return {
		"id": s.id,
		"goal": s.goal,
		"status": s.status,
		"event_count": len(s.events or []),
		"page_title": s.page_title,
		"start_url": s.start_url,
		"created_at": s.created_at.isoformat(),
		"updated_at": s.updated_at.isoformat(),
	}


async def _get_or_404(session_id: str, db: AsyncSession) -> Session:
	result = await db.execute(select(Session).where(Session.id == session_id))
	obj = result.scalar_one_or_none()
	if not obj:
		raise HTTPException(status_code=404,
							detail=f"Session {session_id} not found")
	return obj


# ── REST endpoints ────────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
	payload: SessionCreate, db: AsyncSession = Depends(get_db)) -> dict:
	session = Session(
		goal=payload.goal,
		start_url=payload.start_url,
		page_title=payload.page_title,
		status="recording",
	)
	db.add(session)
	await db.flush()
	await db.refresh(session)
	log.info("session.created", session_id=session.id)
	return {"success": True, "data": _to_response(session), "error": None}


@router.get("")
async def list_sessions(
	limit: int = 20,
	offset: int = 0,
	db: AsyncSession = Depends(get_db),
) -> dict:
	result = await db.execute(
		select(Session).order_by(
			Session.created_at.desc()).limit(limit).offset(offset))
	return {
		"success": True,
		"data": [_to_response(s) for s in result.scalars().all()],
		"error": None
	}


@router.get("/{session_id}")
async def get_session(
	session_id: str, db: AsyncSession = Depends(get_db)) -> dict:
	s = await _get_or_404(session_id, db)
	return {"success": True, "data": _to_response(s), "error": None}


class EventsPayload(BaseModel):
	events: list[dict[str, Any]]


@router.post("/{session_id}/events")
async def append_events(
	session_id: str,
	payload: EventsPayload,
	db: AsyncSession = Depends(get_db),
) -> dict:
	"""Extension background → POST events here in batches."""
	s = await _get_or_404(session_id, db)
	if s.status != "recording":
		raise HTTPException(400, detail=f"Session is '{s.status}', not 'recording'")

	current = list(s.events or [])
	current.extend(payload.events)

	s.events = current
	await db.flush()

	total = len(s.events)
	# Broadcast to any WebSocket listeners (e.g. frontend)
	await manager.broadcast_to_session(session_id, {
		"type": "NEW_EVENTS",
		"events": payload.events,
		"total": total,
	})

	return {
		"success": True,
		"data": {
			"received": len(payload.events),
			"total": total
		},
		"error": None
	}


class StatusPayload(BaseModel):
	status: str


@router.patch("/{session_id}/status")
async def update_status(
	session_id: str,
	payload: StatusPayload,
	db: AsyncSession = Depends(get_db),
) -> dict:
	s = await _get_or_404(session_id, db)
	s.status = payload.status
	await db.flush()
	await db.refresh(s)
	return {"success": True, "data": _to_response(s), "error": None}


@router.get("/{session_id}/events")
async def get_events(
	session_id: str,
	limit: int = 100,
	offset: int = 0,
	db: AsyncSession = Depends(get_db),
) -> dict:
	s = await _get_or_404(session_id, db)
	events = (s.events or [])[offset:offset + limit]
	return {"success": True, "data": events, "error": None}


# ── WebSocket handler — called from main.py ───────────────────────────────────


async def ws_handler(session_id: str, websocket: WebSocket) -> None:
	"""
	Register client, send initial state, keep alive with ping, unregister on disconnect.
	"""
	from database import AsyncSessionLocal
	async with AsyncSessionLocal() as db:
		result = await db.execute(select(Session).where(Session.id == session_id))
		session = result.scalar_one_or_none()
		if not session:
			await websocket.close(code=4004)
			return
		event_count = len(session.events or [])
	# connection is released here as the block ends

	await manager.connect(session_id, websocket)
	try:
		await manager.send_personal(
			websocket, {
				"type": "CONNECTED",
				"session_id": session_id,
				"event_count": event_count,
			})

		# Keep-alive ping every 30 seconds
		while True:
			await asyncio.sleep(_PING_INTERVAL)
			await manager.send_personal(websocket, {"type": "PING"})

	except WebSocketDisconnect:
		pass
	except Exception as exc:
		log.warning("ws.error", session_id=session_id, error=str(exc))
	finally:
		await manager.disconnect(session_id, websocket)
