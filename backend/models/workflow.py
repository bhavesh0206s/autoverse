"""
Workflow model — LLM-generated Playwright automation.
Table: workflows
"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Workflow(Base, TimestampMixin):
	__tablename__ = "workflows"

	id = Column(UUID(as_uuid=False),
				primary_key=True,
				default=lambda: str(uuid.uuid4()))
	session_id = Column(UUID(as_uuid=False),
						ForeignKey("sessions.id", ondelete="SET NULL"),
						nullable=True)
	name = Column(String(255), nullable=False)
	description = Column(Text, nullable=True)

	# JSONB shapes:
	# parameters: [{ name, type, description, default?, required }]
	# steps:	  [{ step, name, description, selector? }]
	parameters = Column(JSONB, nullable=False, default=list)
	steps = Column(JSONB, nullable=False, default=list)
	action_plan = Column(JSONB, nullable=False, default=list)
	storage_state = Column(JSONB, nullable=True)
	is_active = Column(Boolean, nullable=False, default=True)
	run_count = Column(Integer, nullable=False, default=0)
	last_run_at = Column(DateTime(timezone=True), nullable=True)

	# relationships
	session = relationship("Session", back_populates="workflow")
	run_logs = relationship("RunLog",
							back_populates="workflow",
							cascade="all, delete-orphan")
