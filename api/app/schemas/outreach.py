"""Pydantic schemas para Outreach Messages."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.outreach import OutreachChannel


MessageDirectionLiteral = Literal["outbound", "inbound"]


class OutreachCreate(BaseModel):
    lead_id: str
    sales_intel_id: Optional[str] = None
    channel: str = "email"
    direction: MessageDirectionLiteral = "outbound"
    recipient: str
    subject: Optional[str] = None
    body: str
    provider_message_id: Optional[str] = None


class InboundMessageCreate(BaseModel):
    """Registrar un mensaje recibido (respuesta del lead)."""

    lead_id: str
    sender_email: str = Field(..., min_length=3, max_length=320)
    subject: Optional[str] = Field(default=None, max_length=500)
    body: str = Field(..., min_length=1)
    channel: str = "email"


class OutreachUpdate(BaseModel):
    delivered: Optional[bool] = None
    opened: Optional[bool] = None
    clicked: Optional[bool] = None
    replied: Optional[bool] = None
    provider_message_id: Optional[str] = None


class OutreachRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    sales_intel_id: Optional[uuid.UUID] = None
    channel: str
    direction: str
    recipient: str
    subject: Optional[str] = None
    body: str
    provider_message_id: Optional[str] = None
    delivered: Optional[bool] = None
    opened: Optional[bool] = None
    clicked: Optional[bool] = None
    replied: Optional[bool] = None
    has_attachment: bool = False
    report_id: Optional[uuid.UUID] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    lead_domain: Optional[str] = None
    lead_company_name: Optional[str] = None


class OutreachListResponse(BaseModel):
    items: list[OutreachRead]
    total: int
    limit: int
    offset: int
