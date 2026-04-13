"""Add GSC fields to clients

Revision ID: 003
Revises: 002
Create Date: 2026-04-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("gsc_property", sa.String(500)))
    op.add_column("clients", sa.Column("gsc_tokens", JSONB))


def downgrade() -> None:
    op.drop_column("clients", "gsc_tokens")
    op.drop_column("clients", "gsc_property")
