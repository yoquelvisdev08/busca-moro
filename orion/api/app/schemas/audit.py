"""Schemas Pydantic para Audit."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.audit import AuditStatus


class AuditCreate(BaseModel):
    """Payload publicado por el worker Auditor al completar una corrida."""

    lead_id: uuid.UUID
    status: AuditStatus = AuditStatus.completed
    lighthouse_score: Optional[int] = Field(default=None, ge=0, le=100)
    performance_score: Optional[int] = Field(default=None, ge=0, le=100)
    seo_score: Optional[int] = Field(default=None, ge=0, le=100)
    accessibility_score: Optional[int] = Field(default=None, ge=0, le=100)
    best_practices_score: Optional[int] = Field(default=None, ge=0, le=100)
    mobile_friendly: Optional[bool] = None
    has_ssl: Optional[bool] = None
    load_time_ms: Optional[int] = Field(default=None, ge=0)
    first_contentful_paint_ms: Optional[int] = None
    largest_contentful_paint_ms: Optional[int] = None
    cumulative_layout_shift: Optional[float] = None
    total_blocking_time_ms: Optional[int] = None
    detected_tech: dict[str, Any] = Field(default_factory=dict)
    extracted_contacts: dict[str, Any] = Field(default_factory=dict)
    raw_json_data: dict[str, Any] = Field(default_factory=dict)
    screenshot_path: Optional[str] = None
    user_agent: Optional[str] = None
    proxy_used: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class AuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    status: AuditStatus
    lighthouse_score: Optional[int]
    performance_score: Optional[int]
    seo_score: Optional[int]
    accessibility_score: Optional[int]
    best_practices_score: Optional[int]
    mobile_friendly: Optional[bool]
    has_ssl: Optional[bool]
    load_time_ms: Optional[int]
    first_contentful_paint_ms: Optional[int] = None
    largest_contentful_paint_ms: Optional[int] = None
    cumulative_layout_shift: Optional[float] = None
    total_blocking_time_ms: Optional[int] = None
    detected_tech: dict[str, Any]
    extracted_contacts: dict[str, Any]
    screenshot_path: Optional[str] = None
    created_at: datetime
