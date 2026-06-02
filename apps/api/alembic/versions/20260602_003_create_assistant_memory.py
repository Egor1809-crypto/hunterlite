"""create assistant memory tables (Manyasha knowledge agent, ТЗ-3)

Revision ID: 20260602_003
Revises: 20260531_003
Create Date: 2026-06-02

Server-side conversational memory for the Manyasha knowledge assistant:

  * ``assistant_conversations`` — named threads, one per row, owned by a
    user. The default thread is the most recently active (DECISION-B).
  * ``assistant_messages`` — one row per turn (user / assistant / tool),
    carrying the tool call + the RAG chunk ids the turn was grounded on.

``role`` and ``status`` are plain ``String`` columns (not PG enums) so an
incident-time corrective UPDATE in psql needs no enum-type juggling — same
convention as ``legal_knowledge_chunks.knowledge_status``.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260602_003"
# Chains directly onto the current origin/main head. The constructor agent's
# 20260602_001/002 are a SEPARATE unmerged PR — do not depend on them here
# (a merge migration reconciles the two heads when both land).
down_revision: Union[str, None] = "20260531_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assistant_conversations",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), nullable=False,
        ),
        sa.Column(
            "title", sa.String(length=200), nullable=False,
            server_default=sa.text("'Новый диалог'"),
        ),
        sa.Column(
            "is_archived", sa.Boolean(), nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_message_at", sa.DateTime(timezone=True), nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_assistant_conversations_user_id",
        "assistant_conversations",
        ["user_id"],
    )
    op.create_index(
        "idx_assistant_conversations_user_active",
        "assistant_conversations",
        ["user_id", "is_archived", "last_message_at"],
    )

    op.create_table(
        "assistant_messages",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False,
        ),
        sa.Column(
            "conversation_id", postgresql.UUID(as_uuid=True), nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column(
            "content", sa.Text(), nullable=False, server_default=sa.text("''"),
        ),
        sa.Column("tool_name", sa.String(length=80), nullable=True),
        sa.Column("tool_args", postgresql.JSONB(), nullable=True),
        sa.Column("rag_chunk_ids", postgresql.JSONB(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False,
            server_default=sa.text("'ok'"),
        ),
        sa.Column("tokens", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["assistant_conversations.id"], ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_assistant_messages_conversation_id",
        "assistant_messages",
        ["conversation_id"],
    )
    op.create_index(
        "ix_assistant_messages_created_at",
        "assistant_messages",
        ["created_at"],
    )
    op.create_index(
        "idx_assistant_messages_conv_created",
        "assistant_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_assistant_messages_conv_created", table_name="assistant_messages")
    op.drop_index("ix_assistant_messages_created_at", table_name="assistant_messages")
    op.drop_index("ix_assistant_messages_conversation_id", table_name="assistant_messages")
    op.drop_table("assistant_messages")
    op.drop_index("idx_assistant_conversations_user_active", table_name="assistant_conversations")
    op.drop_index("ix_assistant_conversations_user_id", table_name="assistant_conversations")
    op.drop_table("assistant_conversations")
