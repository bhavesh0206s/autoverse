"""pivot to action plan

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22 10:30:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	# 1. Add action_plan column
	op.add_column("workflows", sa.Column("action_plan", postgresql.JSONB(), nullable=False, server_default="[]"))
	
	# 2. Drop script column
	op.drop_column("workflows", "script")


def downgrade() -> None:
	# 1. Add script column back
	op.add_column("workflows", sa.Column("script", sa.Text(), nullable=True))
	
	# 2. Drop action_plan column
	op.drop_column("workflows", "action_plan")
