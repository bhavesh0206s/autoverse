from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Depends, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from routers import sessions_router, workflows_router, runner_router, learn_router
from routers.sessions import ws_handler
from websocket_manager import manager

settings = get_settings()
log = structlog.get_logger(__name__)




@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
	log.info("startup", app=settings.app_name, env=settings.env)
	yield
	log.info("shutdown")




app = FastAPI(
	title="Autoverse API",
	version="2.0.0",
	description="AI-powered browser workflow automation",
	lifespan=lifespan,
	docs_url="/docs",
	redoc_url="/redoc",
)



app.add_middleware(
	CORSMiddleware,
	allow_origins=settings.cors_origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)




@app.middleware("http")
async def log_requests(request: Request, call_next):  # type: ignore[return]
	start = time.monotonic()
	response = await call_next(request)
	duration_ms = int((time.monotonic() - start) * 1000)
	log.info(
		"http.request",
		method=request.method,
		path=request.url.path,
		status=response.status_code,
		duration_ms=duration_ms,
	)
	return response





@app.exception_handler(Exception)
async def global_error_handler(request: Request,
							   exc: Exception) -> JSONResponse:
	log.error("unhandled_exception", path=str(request.url), error=str(exc))
	return JSONResponse(
		status_code=500,
		content={
			"success": False,
			"data": None,
			"error": "Internal server error"
		},
	)




app.include_router(sessions_router)
app.include_router(workflows_router)
app.include_router(runner_router)
app.include_router(learn_router)




@app.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(
	session_id: str,
	websocket: WebSocket,
) -> None:
	await ws_handler(session_id, websocket)





@app.get("/health")
async def health() -> dict:
	return {
		"success": True,
		"data": {
			"status": "ok",
			"version": "2.0.0"
		},
		"error": None
	}
