"""
RunLog model — execution record of a single workflow run.
Table: run_logs
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models.base import Base


class RunLog(Base):
	"""
	No TimestampMixin — uses ran_at instead of created_at / updated_at
	because a run log is immutable after creation.
	"""
	__tablename__ = "run_logs"

	id = Column(UUID(as_uuid=False),
				primary_key=True,
				default=lambda: str(uuid.uuid4()))
	workflow_id = Column(UUID(as_uuid=False),
						 ForeignKey("workflows.id", ondelete="CASCADE"),
						 nullable=False)
	parameters_used = Column(JSONB, nullable=False, default=dict)
	status = Column(String(50), nullable=False,
					default="running")	# running|success|failed|timeout
	result = Column(JSONB, nullable=True)
	error = Column(Text, nullable=True)
	duration_ms = Column(Integer, nullable=True)
	screenshot_path = Column(Text, nullable=True)
	ran_at = Column(DateTime(timezone=True),
					nullable=False,
					default=lambda: datetime.now(timezone.utc))

	# relationships
	workflow = relationship("Workflow", back_populates="run_logs")
