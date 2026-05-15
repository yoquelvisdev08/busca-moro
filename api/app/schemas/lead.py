"""Schemas Pydantic para Lead."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, EmailStr, Field

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


class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[LeadStatus] = None
    score: Optional[int] = None
    notes: Optional[str] = None


class LeadRead(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    normalized_domain: str
    status: LeadStatus
    score: int
    lighthouse_score: Optional[int] = None
    mobile_friendly: Optional[bool] = None
    has_ssl: Optional[bool] = None
    load_time_ms: Optional[int] = None
    tech_stack: dict[str, Any]
    social_links: dict[str, Any]
    discovered_at: datetime
    audited_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None


class LeadListResponse(BaseModel):
    items: list[LeadRead]
    total: int
    limit: int
    offset: int
