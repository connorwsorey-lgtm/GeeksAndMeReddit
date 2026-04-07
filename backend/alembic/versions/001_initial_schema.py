"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255)),
        sa.Column("vertical", sa.String(255)),
        sa.Column("products_services", sa.Text),
        sa.Column("competitors", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "searches",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("keywords", ARRAY(sa.String), nullable=False),
        sa.Column("negative_keywords", ARRAY(sa.String), server_default="{}"),
        sa.Column("subreddits", ARRAY(sa.String), server_default="{}"),
        sa.Column("intent_filters", ARRAY(sa.String), server_default="{}"),
        sa.Column("alert_threshold", sa.Integer, server_default="50"),
        sa.Column("scan_frequency", sa.String(50), server_default="'daily'"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_scan_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "signals",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("search_id", sa.Integer, sa.ForeignKey("searches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("post_title", sa.Text, nullable=False),
        sa.Column("post_body", sa.Text),
        sa.Column("post_url", sa.Text, nullable=False),
        sa.Column("community", sa.String(255)),
        sa.Column("author", sa.String(255)),
        sa.Column("engagement_score", sa.Integer, server_default="0"),
        sa.Column("post_created_at", sa.DateTime),
        sa.Column("top_responses", JSONB, server_default="'[]'"),
        sa.Column("intent_labels", ARRAY(sa.String), server_default="{}"),
        sa.Column("intent_confidences", JSONB, server_default="'{}'"),
        sa.Column("relevance_score", sa.Integer, server_default="0"),
        sa.Column("signal_summary", sa.Text),
        sa.Column("thread_gap_detected", sa.Boolean, server_default="false"),
        sa.Column("status", sa.String(50), server_default="'new'"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("source_type", "external_id"),
    )

    op.create_table(
        "notification_config",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("recipient", sa.String(255), nullable=False),
        sa.Column("mode", sa.String(50), server_default="'immediate'"),
        sa.Column("digest_time", sa.Time),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "alert_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("signal_id", sa.Integer, sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("recipient", sa.String(255)),
        sa.Column("message_preview", sa.Text),
        sa.Column("sent_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("delivery_status", sa.String(50), server_default="'sent'"),
    )


def downgrade() -> None:
    op.drop_table("alert_log")
    op.drop_table("notification_config")
    op.drop_table("signals")
    op.drop_table("searches")
    op.drop_table("clients")
