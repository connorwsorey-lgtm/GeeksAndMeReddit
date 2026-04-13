"""Add client_phrases table and gsc_excluded_queries column

Revision ID: 004
Revises: 003
Create Date: 2026-04-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("gsc_excluded_queries", JSONB))

    op.create_table(
        "client_phrases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phrase", sa.Text, nullable=False),
        sa.Column("source", sa.String(50), server_default=sa.text("'manual'")),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("client_phrases")
    op.drop_column("clients", "gsc_excluded_queries")
