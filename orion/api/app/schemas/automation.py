"""Schemas para configuración de automatización (Scout + outreach)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AutomationConfig(BaseModel):
    auto_scout_enabled: bool = True
    auto_outreach_enabled: bool = False
    auto_outreach_min_segment: Literal["A", "B", "C"] = "B"
    auto_outreach_max_per_run: int = Field(default=3, ge=1, le=10)
    default_num_dorks: int = Field(default=20, ge=5, le=30)
    default_industry: str = ""
    default_location: str = ""
    default_niche: str = ""


class AutomationConfigUpdate(BaseModel):
    auto_scout_enabled: Optional[bool] = None
    auto_outreach_enabled: Optional[bool] = None
    auto_outreach_min_segment: Optional[Literal["A", "B", "C"]] = None
    auto_outreach_max_per_run: Optional[int] = Field(default=None, ge=1, le=10)
    default_num_dorks: Optional[int] = Field(default=None, ge=5, le=30)
    default_industry: Optional[str] = None
    default_location: Optional[str] = None
    default_niche: Optional[str] = None


class PipelineCounts(BaseModel):
    queued: int = 0
    auditing: int = 0
    audited: int = 0
    enriched: int = 0
    enriched_with_email: int = 0
    ready_for_outreach: int = 0
    contacted: int = 0


class AutomationStats(BaseModel):
    outreach_sent_total: int = 0
    outreach_failed_total: int = 0
    last_outreach_run_at: Optional[str] = None
    last_outreach_detail: Optional[str] = None
    last_pipeline_run_at: Optional[str] = None
    last_pipeline_detail: Optional[str] = None


class ScoutPassSnapshot(BaseModel):
    active: bool = False
    pass_number: int = Field(default=0, alias="pass")
    mode: str = "automatic"
    dorks_count: int = 0
    seeds_count: int = 0
    location: str = ""
    industry: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    model_config = {"populate_by_name": True}


class PipelineQueues(BaseModel):
    discovery: int = 0
    audit: int = 0
    outreach: int = 0
    dlq: int = 0


class AutomationStatus(BaseModel):
    config: AutomationConfig
    stats: AutomationStats
    scout: ScoutPassSnapshot = Field(default_factory=ScoutPassSnapshot)
    queues: PipelineQueues = Field(default_factory=PipelineQueues)
    pipeline: PipelineCounts = Field(default_factory=PipelineCounts)
    scout_loop_minutes: int = 5
    # Compatibilidad con clientes anteriores
    scout_pass_active: bool = False
    scout_pass_mode: str = "automatic"


class OutreachRetryResult(BaseModel):
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    pending_before: int = 0
    detail: str = ""
