from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
	session_id: Optional[str] = None
	name: str
	description: Optional[str] = None
	parameters: list[dict[str, Any]] = Field(default_factory=list)
	steps: list[dict[str, Any]] = Field(default_factory=list)
	action_plan: list[dict[str, Any]] = Field(default_factory=list)
	storage_state: Optional[dict[str, Any]] = None
	is_active: bool = True


class WorkflowUpdate(BaseModel):
	name: Optional[str] = None
	description: Optional[str] = None
	parameters: Optional[list[dict[str, Any]]] = None
	steps: Optional[list[dict[str, Any]]] = None
	is_active: Optional[bool] = None


class WorkflowResponse(BaseModel):
	id: str
	session_id: Optional[str]
	name: str
	description: Optional[str]
	parameters: list[dict[str, Any]]
	steps: list[dict[str, Any]]
	action_plan: list[dict[str, Any]]
	storage_state: Optional[dict[str, Any]]
	is_active: bool
	run_count: int
	last_run_at: Optional[datetime]
	created_at: datetime
	updated_at: datetime

	model_config = {"from_attributes": True}
