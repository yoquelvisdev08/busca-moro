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


class SubredditScan(BaseModel):
    subreddit: str = Field(min_length=1, max_length=80)
    query: str = Field(min_length=1, max_length=200)


class PoseidonConfig(BaseModel):
    loop_interval_minutes: int = Field(default=45, ge=5, le=1440)
    query_delay_seconds: float = Field(default=1.0, ge=0.2, le=10.0)
    results_per_query: int = Field(default=20, ge=5, le=100)
    max_post_age_days: int = Field(default=120, ge=7, le=730)
    min_keyword_score: int = Field(default=25, ge=0, le=100)
    min_intent_score: int = Field(default=45, ge=0, le=100)
    min_intent_score_no_llm: int = Field(default=32, ge=0, le=100)
    max_llm_classifications: int = Field(default=40, ge=0, le=200)
    use_llm: bool = True
    use_arctic_shift: bool = True
    use_pullpush: bool = False
    use_searx: bool = True
    require_spanish: bool = True
    require_latam_or_spain: bool = True
    search_queries: list[str] = Field(default_factory=list)
    subreddit_scans: list[SubredditScan] = Field(default_factory=list)
    query_subreddits: list[str] = Field(default_factory=list)
    searx_domains: list[str] = Field(default_factory=list)


class PoseidonConfigUpdate(BaseModel):
    loop_interval_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    query_delay_seconds: Optional[float] = Field(default=None, ge=0.2, le=10.0)
    results_per_query: Optional[int] = Field(default=None, ge=5, le=100)
    max_post_age_days: Optional[int] = Field(default=None, ge=7, le=730)
    min_keyword_score: Optional[int] = Field(default=None, ge=0, le=100)
    min_intent_score: Optional[int] = Field(default=None, ge=0, le=100)
    min_intent_score_no_llm: Optional[int] = Field(default=None, ge=0, le=100)
    max_llm_classifications: Optional[int] = Field(default=None, ge=0, le=200)
    use_llm: Optional[bool] = None
    use_arctic_shift: Optional[bool] = None
    use_pullpush: Optional[bool] = None
    use_searx: Optional[bool] = None
    require_spanish: Optional[bool] = None
    require_latam_or_spain: Optional[bool] = None
    search_queries: Optional[list[str]] = None
    subreddit_scans: Optional[list[SubredditScan]] = None
    query_subreddits: Optional[list[str]] = None
    searx_domains: Optional[list[str]] = None
