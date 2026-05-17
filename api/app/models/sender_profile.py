"""ORM :: SenderProfile."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ARRAY, Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SenderProfile(Base):
    __tablename__ = "sender_profile"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(Text)
    company: Mapped[Optional[str]] = mapped_column(Text)
    website: Mapped[str] = mapped_column(Text, nullable=False, default="https://yoquelvis.dev")
    bio: Mapped[Optional[str]] = mapped_column(Text)
    services: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    tech_stack: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    tone: Mapped[str] = mapped_column(Text, nullable=False, default="consultivo")
    email_signature: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
