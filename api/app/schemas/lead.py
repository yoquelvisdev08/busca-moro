"""Schemas Pydantic para Lead."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.services.lead_delete_reasons import REASON_CODES

from app.models.lead import LeadStatus


class LeadBase(BaseModel):
    url: AnyHttpUrl
    company_name: Optional[str] = None
    industry: Optional[str] = None
    country_code: Optional[str] = Field(default=None, max_length=2)
    city: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class LeadCreate(LeadBase):
    discovery_source: Optional[str] = None
    discovery_query: Optional[str] = None
    tech_stack: dict[str, Any] = Field(default_factory=dict)
    has_ssl: Optional[bool] = None
    load_time_ms: Optional[int] = Field(default=None, ge=0)
    score: int = 0
    commercial_score: int = 0
    segment: str = "D"
    revenue_signal: str = "none"
    has_pricing_page: bool = False
    has_testimonials: bool = False
    content_freshness_days: Optional[int] = None
    commercial_signals: list[str] = Field(default_factory=list)


class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[LeadStatus] = None
    score: Optional[int] = None
    notes: Optional[str] = None
    commercial_score: Optional[int] = None
    segment: Optional[str] = None
    revenue_signal: Optional[str] = None
    has_pricing_page: Optional[bool] = None
    has_testimonials: Optional[bool] = None
    content_freshness_days: Optional[int] = None
    commercial_signals: Optional[list[str]] = None


class LeadOutreachSummary(BaseModel):
    """Resumen de mensajería para listados de leads."""

    has_message_sent: bool = False
    messages_sent_count: int = 0
    has_reply_received: bool = False
    inbound_messages_count: int = 0


class LeadRead(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    normalized_domain: str
    secondary_emails: list[str] = Field(default_factory=list)
    status: LeadStatus
    score: int
    commercial_score: int
    segment: str
    revenue_signal: str
    has_pricing_page: bool
    has_testimonials: bool
    content_freshness_days: Optional[int] = None
    commercial_signals: list[str]
    lighthouse_score: Optional[int] = None
    mobile_friendly: Optional[bool] = None
    has_ssl: Optional[bool] = None
    load_time_ms: Optional[int] = None
    tech_stack: dict[str, Any]
    social_links: dict[str, Any]
    discovered_at: datetime
    audited_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None
    outreach: LeadOutreachSummary = Field(default_factory=LeadOutreachSummary)
    next_step_type: Optional[str] = None
    next_step_at: Optional[datetime] = None
    next_step_notes: Optional[str] = None
    needs_next_step: bool = False
    has_email: bool = False


class LeadNextStepSet(BaseModel):
    """Siguiente paso comercial tras contactar al lead."""

    step: Literal["call", "proposal", "discard"]
    scheduled_at: Optional[datetime] = Field(
        default=None,
        description="Fecha prevista de llamada o envío de propuesta",
    )
    notes: Optional[str] = Field(default=None, max_length=2000)
    close_as_lost: bool = Field(
        default=True,
        description="Si step=discard, marcar lead como closed_lost",
    )


class LeadDeleteRequest(BaseModel):
    """Motivo obligatorio al archivar un lead."""

    reason: str = Field(..., min_length=1, max_length=64)
    detail: Optional[str] = Field(default=None, max_length=500)

    @field_validator("reason")
    @classmethod
    def validate_reason_code(cls, value: str) -> str:
        if value not in REASON_CODES:
            raise ValueError(f"Motivo no válido: {value}")
        return value


class LeadListResponse(BaseModel):
    items: list[LeadRead]
    total: int
    limit: int
    offset: int
