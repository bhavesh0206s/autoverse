from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
	goal: str = Field(..., description="What the user wants to automate")
	start_url: Optional[str] = None
	page_title: Optional[str] = None


class SessionUpdate(BaseModel):
	status: Optional[str] = None
	goal: Optional[str] = None
	page_title: Optional[str] = None


class SessionResponse(BaseModel):
	id: str
	goal: str
	status: str
	event_count: int
	page_title: Optional[str]
	start_url: Optional[str]
	created_at: datetime
	updated_at: datetime

	model_config = {"from_attributes": True}
