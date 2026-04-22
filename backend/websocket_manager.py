"""
WebSocket connection manager.
Tracks connections per session_id and broadcasts to all listeners.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

import structlog
from fastapi import WebSocket

log = structlog.get_logger(__name__)


class ConnectionManager:

	def __init__(self) -> None:
		# session_id → list of connected WebSockets
		self._connections: dict[str, list[WebSocket]] = defaultdict(list)
		self._lock = asyncio.Lock()

	async def connect(self, session_id: str, websocket: WebSocket) -> None:
		await websocket.accept()
		async with self._lock:
			self._connections[session_id].append(websocket)
		log.info("ws.connected", session_id=session_id)

	async def disconnect(self, session_id: str, websocket: WebSocket) -> None:
		async with self._lock:
			conns = self._connections.get(session_id, [])
			if websocket in conns:
				conns.remove(websocket)
			if not conns:
				self._connections.pop(session_id, None)
		log.info("ws.disconnected", session_id=session_id)

	async def broadcast_to_session(self, session_id: str,
								   data: dict[str, Any]) -> None:
		"""Send JSON to all WebSocket clients subscribed to this session."""
		async with self._lock:
			conns = list(self._connections.get(session_id, []))
		dead: list[WebSocket] = []
		for ws in conns:
			try:
				await ws.send_json(data)
			except Exception:
				dead.append(ws)
		for ws in dead:
			await self.disconnect(session_id, ws)

	async def send_personal(self, websocket: WebSocket, data: dict[str,
																   Any]) -> None:
		"""Send JSON to a single WebSocket client."""
		try:
			await websocket.send_json(data)
		except Exception as exc:
			log.warning("ws.send_personal.failed", error=str(exc))


# singleton — imported by routers and main
manager = ConnectionManager()
