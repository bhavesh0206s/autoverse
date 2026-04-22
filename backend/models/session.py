"""
Session model — one recording session per user action sequence.
Table: sessions
"""

import uuid

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models.base import Base, TimestampMixin


class Session(Base, TimestampMixin):
	__tablename__ = "sessions"

	id = Column(
		UUID(as_uuid=False),
		primary_key=True,
		default=lambda: str(uuid.uuid4()),
	)
	goal = Column(Text, nullable=False)	 # What user wants to automate
	status = Column(String(50), nullable=False,
					default="recording")  # recording|processing|done|failed
	events = Column(JSONB, nullable=False,
					default=list)  # Array of captured browser events
	page_title = Column(String(500), nullable=True)
	start_url = Column(Text, nullable=True)

	# relationship — one session → one workflow
	workflow = relationship("Workflow", back_populates="session", uselist=False)
