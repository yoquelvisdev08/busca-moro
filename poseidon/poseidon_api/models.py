"""ORM :: Poseidon intent signals (personas pidiendo ayuda activamente)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PoseidonSignalStatus(str, enum.Enum):
    new = "new"
    reviewed = "reviewed"
    contacted = "contacted"
    dismissed = "dismissed"
    converted = "converted"


class PoseidonSignal(Base):
    __tablename__ = "poseidon_signals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(64), nullable=False, default="other")
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    snippet: Mapped[str] = mapped_column(Text, nullable=False, default="")
    author_hint: Mapped[Optional[str]] = mapped_column(Text)
    intent_category: Mapped[str] = mapped_column(String(32), nullable=False, default="general")
    intent_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    keyword_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_score: Mapped[Optional[int]] = mapped_column(Integer)
    query_used: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[PoseidonSignalStatus] = mapped_column(
        Enum(PoseidonSignalStatus, name="poseidon_signal_status", native_enum=True, create_type=False),
        nullable=False,
        default=PoseidonSignalStatus.new,
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
    )
    llm_summary: Mapped[Optional[str]] = mapped_column(Text)
    reply_angle: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    raw_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
