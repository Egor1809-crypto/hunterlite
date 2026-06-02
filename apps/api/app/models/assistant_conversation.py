"""Server-side memory for the Manyasha knowledge assistant (ТЗ-3).

Two tables back the agent's conversational memory so a multi-turn dialogue
survives reloads and so a follow-up question can see the prior turns:

  * :class:`AssistantConversation` — one named thread per row. A user may
    own several; the default thread is simply the most recently active one
    (DECISION-B). ``title`` is auto-derived from the first user question.
  * :class:`AssistantMessage` — one row per turn, including the model's
    tool-call turns and the ``rag_chunk_ids`` a turn was grounded on. The
    ``role`` column is a plain ``String`` (not a DB enum) on purpose — it
    mirrors how ``LegalKnowledgeChunk.knowledge_status`` stores its
    vocabulary as a string, which keeps incident-time ``UPDATE``s in psql
    trivial and avoids an enum-type migration.

Deliberately independent of the ``knowledge_quiz`` subsystem (ТЗ §5 —
that quiz layer is being retired and must not be a dependency here).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Message roles. Stored as a string column (see module docstring) — these
# constants are the canonical vocabulary the service layer writes/reads.
ROLE_SYSTEM = "system"
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"
ROLE_TOOL = "tool"

MESSAGE_ROLES = (ROLE_SYSTEM, ROLE_USER, ROLE_ASSISTANT, ROLE_TOOL)

# Assistant message lifecycle. ``ok`` is the normal terminal state; ``failed``
# marks a turn where navy/LLM was unreachable so the FE can render a graceful
# "Маняша недоступна" bubble without us throwing away the user's question
# (ТЗ §5).
STATUS_OK = "ok"
STATUS_FAILED = "failed"


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Новый диалог")
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    messages: Mapped[list["AssistantMessage"]] = relationship(
        "AssistantMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AssistantMessage.created_at",
    )

    __table_args__ = (
        # "Default conversation = most recently active" lookups order by
        # last_message_at within a user — index both for a cheap scan.
        Index(
            "idx_assistant_conversations_user_active",
            "user_id",
            "is_archived",
            "last_message_at",
        ),
    )


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assistant_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Tool turns: which tool the assistant invoked and with what args.
    tool_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tool_args: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # RAG grounding: the chunk ids this turn was built on, so the FE can render
    # clickable sources and skeptics can audit grounding (ТЗ §7б).
    rag_chunk_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # ok | failed (see STATUS_* constants).
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=STATUS_OK)
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True,
    )

    conversation: Mapped["AssistantConversation"] = relationship(
        "AssistantConversation", back_populates="messages",
    )

    __table_args__ = (
        Index("idx_assistant_messages_conv_created", "conversation_id", "created_at"),
    )
