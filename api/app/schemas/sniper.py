"""Schemas Pydantic para Sniper."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field

from app.models.sniper import AlertSeverity


class SniperTargetCreate(BaseModel):
    url: AnyHttpUrl
    label: Optional[str] = None
    industry: Optional[str] = None
    interval_seconds: int = Field(default=60, ge=10)
    failure_threshold: int = Field(default=3, ge=1)
    enabled: bool = True


class SniperTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    label: Optional[str]
    industry: Optional[str]
    enabled: bool
    interval_seconds: int
    failure_threshold: int
    consecutive_failures: int
    last_status_code: Optional[int]
    last_checked_at: Optional[datetime]


class SniperAlertCreate(BaseModel):
    target_id: uuid.UUID
    severity: AlertSeverity = AlertSeverity.warning
    status_code: Optional[int] = None
    error_kind: Optional[str] = None
    message: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class SniperAlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_id: uuid.UUID
    severity: AlertSeverity
    status_code: Optional[int]
    error_kind: Optional[str]
    message: Optional[str]
    acknowledged: bool
    triggered_at: datetime
