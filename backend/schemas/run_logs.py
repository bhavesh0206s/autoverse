from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class RunLogCreate(BaseModel):
	workflow_id: str
	parameters_used: dict[str, Any] = Field(default_factory=dict)
	status: str = "running"


class RunLogResponse(BaseModel):
	id: str
	workflow_id: str
	parameters_used: dict[str, Any]
	status: str
	result: Optional[Any]
	error: Optional[str]
	duration_ms: Optional[int]
	screenshot_path: Optional[str]
	ran_at: datetime

	model_config = {"from_attributes": True}
