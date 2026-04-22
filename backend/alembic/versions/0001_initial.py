"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-18 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	# Enable pgcrypto for gen_random_uuid() if needed
	op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

	# ── sessions ──────────────────────────────────────────────────────────────
	op.create_table(
		"sessions",
		sa.Column("id",			postgresql.UUID(as_uuid=False), primary_key=True),
		sa.Column("goal",		sa.Text(),		  nullable=False),
		sa.Column("status",		sa.String(50),	  nullable=False, server_default="recording"),
		sa.Column("events",		postgresql.JSONB(), nullable=False, server_default="[]"),
		sa.Column("page_title", sa.String(500),	  nullable=True),
		sa.Column("start_url",	sa.Text(),		  nullable=True),
		sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
		sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
	)
	op.create_index("ix_sessions_status",	  "sessions", ["status"])
	op.create_index("ix_sessions_created_at", "sessions", ["created_at"])

	# ── workflows ─────────────────────────────────────────────────────────────
	op.create_table(
		"workflows",
		sa.Column("id",			 postgresql.UUID(as_uuid=False), primary_key=True),
		sa.Column("session_id",	 postgresql.UUID(as_uuid=False),
				  sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
		sa.Column("name",		 sa.String(255), nullable=False),
		sa.Column("description", sa.Text(),		 nullable=True),
		sa.Column("parameters",	 postgresql.JSONB(), nullable=False, server_default="[]"),
		sa.Column("steps",		 postgresql.JSONB(), nullable=False, server_default="[]"),
		sa.Column("script",		 sa.Text(),		 nullable=False),
		sa.Column("is_active",	 sa.Boolean(),	 nullable=False, server_default="true"),
		sa.Column("run_count",	 sa.Integer(),	 nullable=False, server_default="0"),
		sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
		sa.Column("created_at",	 sa.DateTime(timezone=True), nullable=False),
		sa.Column("updated_at",	 sa.DateTime(timezone=True), nullable=False),
	)
	op.create_index("ix_workflows_is_active",  "workflows", ["is_active"])
	op.create_index("ix_workflows_session_id", "workflows", ["session_id"])

	# ── run_logs ──────────────────────────────────────────────────────────────
	op.create_table(
		"run_logs",
		sa.Column("id",				 postgresql.UUID(as_uuid=False), primary_key=True),
		sa.Column("workflow_id",	 postgresql.UUID(as_uuid=False),
				  sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
		sa.Column("parameters_used", postgresql.JSONB(), nullable=False, server_default="{}"),
		sa.Column("status",			 sa.String(50), nullable=False, server_default="running"),
		sa.Column("result",			 postgresql.JSONB(), nullable=True),
		sa.Column("error",			 sa.Text(),		nullable=True),
		sa.Column("duration_ms",	 sa.Integer(),	nullable=True),
		sa.Column("screenshot_path", sa.Text(),		nullable=True),
		sa.Column("ran_at",			 sa.DateTime(timezone=True), nullable=False),
	)
	op.create_index("ix_run_logs_workflow_id", "run_logs", ["workflow_id"])
	op.create_index("ix_run_logs_status",	   "run_logs", ["status"])
	op.create_index("ix_run_logs_ran_at",	   "run_logs", ["ran_at"])


def downgrade() -> None:
	op.drop_table("run_logs")
	op.drop_table("workflows")
	op.drop_table("sessions")
