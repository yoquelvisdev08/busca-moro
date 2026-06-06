"""Schemas Poseidon."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from poseidon_api.models import PoseidonSignalStatus

IntentCategory = Literal["web_dev", "scraping", "performance", "hosting", "wordpress", "general"]


class PoseidonSignalCreate(BaseModel):
    source_url: HttpUrl
    platform: str = "other"
    title: str = ""
    snippet: str = ""
    author_hint: Optional[str] = None
    intent_category: IntentCategory = "general"
    intent_score: int = Field(default=0, ge=0, le=100)
    keyword_score: int = Field(default=0, ge=0, le=100)
    llm_score: Optional[int] = Field(default=None, ge=0, le=100)
    query_used: Optional[str] = None
    llm_summary: Optional[str] = None
    reply_angle: Optional[str] = None
    raw_metadata: dict[str, Any] = Field(default_factory=dict)
    detected_at: Optional[datetime] = None


class PoseidonSignalUpdate(BaseModel):
    status: Optional[PoseidonSignalStatus] = None
    notes: Optional[str] = None


class PoseidonSignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_url: str
    platform: str
    title: str
    snippet: str
    author_hint: Optional[str]
    intent_category: str
    intent_score: int
    keyword_score: int
    llm_score: Optional[int]
    query_used: Optional[str]
    status: PoseidonSignalStatus
    lead_id: Optional[uuid.UUID]
    llm_summary: Optional[str]
    reply_angle: Optional[str]
    notes: Optional[str]
    raw_metadata: dict[str, Any]
    detected_at: datetime
    created_at: datetime
    updated_at: datetime


class PoseidonSignalListResponse(BaseModel):
    items: list[PoseidonSignalRead]
    total: int
    limit: int
    offset: int


class PoseidonScanStatus(BaseModel):
    active: bool = False
    last_scan_at: Optional[str] = None
    last_scan_found: int = 0
    last_scan_saved: int = 0
    last_error: Optional[str] = None
    queries_count: int = 0
    phase: Optional[str] = None
    progress_current: int = 0
    progress_total: int = 0
    status_message: Optional[str] = None


class PoseidonConvertResult(BaseModel):
    signal_id: uuid.UUID
    lead_id: uuid.UUID
    lead_url: str
    message: str
