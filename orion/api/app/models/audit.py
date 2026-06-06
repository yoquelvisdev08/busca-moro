"""ORM :: Audit."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Audit(Base):
    __tablename__ = "audits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[AuditStatus] = mapped_column(
        Enum(AuditStatus, name="audit_status", native_enum=True, create_type=False),
        nullable=False,
        default=AuditStatus.pending,
    )
    lighthouse_score: Mapped[Optional[int]] = mapped_column(Integer)
    performance_score: Mapped[Optional[int]] = mapped_column(Integer)
    seo_score: Mapped[Optional[int]] = mapped_column(Integer)
    accessibility_score: Mapped[Optional[int]] = mapped_column(Integer)
    best_practices_score: Mapped[Optional[int]] = mapped_column(Integer)
    mobile_friendly: Mapped[Optional[bool]] = mapped_column()
    has_ssl: Mapped[Optional[bool]] = mapped_column()
    load_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    first_contentful_paint_ms: Mapped[Optional[int]] = mapped_column(Integer)
    largest_contentful_paint_ms: Mapped[Optional[int]] = mapped_column(Integer)
    cumulative_layout_shift: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 3))
    total_blocking_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    detected_tech: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    extracted_contacts: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    raw_json_data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    screenshot_path: Mapped[Optional[str]] = mapped_column(Text)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    proxy_used: Mapped[Optional[str]] = mapped_column(Text)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
