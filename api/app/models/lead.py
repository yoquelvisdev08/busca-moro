"""ORM :: Lead."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import ARRAY, Boolean, CheckConstraint, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LeadStatus(str, enum.Enum):
    new = "new"
    queued = "queued"
    auditing = "auditing"
    audited = "audited"
    enriched = "enriched"
    contacted = "contacted"
    interested = "interested"
    negotiation = "negotiation"
    closed_won = "closed_won"
    closed_lost = "closed_lost"
    replied = "replied"
    won = "won"
    rejected = "rejected"
    error = "error"


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("lighthouse_score BETWEEN 0 AND 100", name="lead_lh_range"),
        CheckConstraint("load_time_ms >= 0", name="lead_load_pos"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_domain: Mapped[str] = mapped_column(CITEXT(), nullable=False, unique=True)
    company_name: Mapped[Optional[str]] = mapped_column(Text)
    industry: Mapped[Optional[str]] = mapped_column(Text)
    country_code: Mapped[Optional[str]] = mapped_column(String(2))
    city: Mapped[Optional[str]] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(CITEXT())
    secondary_emails: Mapped[list[str]] = mapped_column(ARRAY(CITEXT()), default=list)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    secondary_phones: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    social_links: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    tech_stack: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    lighthouse_score: Mapped[Optional[int]] = mapped_column(Integer)
    mobile_friendly: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_ssl: Mapped[Optional[bool]] = mapped_column(Boolean)
    load_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    discovery_source: Mapped[Optional[str]] = mapped_column(Text)
    discovery_query: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, name="lead_status", native_enum=True, create_type=False),
        nullable=False,
        default=LeadStatus.new,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    commercial_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    segment: Mapped[str] = mapped_column(String(1), nullable=False, default="D")
    revenue_signal: Mapped[str] = mapped_column(Text, nullable=False, default="none")
    has_pricing_page: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_testimonials: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    content_freshness_days: Mapped[Optional[int]] = mapped_column(Integer)
    commercial_signals: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    audited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    contacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_reason: Mapped[Optional[str]] = mapped_column(Text)
    next_step_type: Mapped[Optional[str]] = mapped_column(String(32))
    next_step_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    next_step_notes: Mapped[Optional[str]] = mapped_column(Text)
