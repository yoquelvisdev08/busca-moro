"""Schemas para configuración de automatización (Scout + outreach)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AutomationConfig(BaseModel):
    auto_scout_enabled: bool = True
    auto_outreach_enabled: bool = False
    auto_email_enabled: bool = True
    auto_outreach_min_segment: Literal["A", "B", "C"] = "B"
    auto_outreach_max_per_run: int = Field(default=3, ge=1, le=10)
    default_num_dorks: int = Field(default=20, ge=5, le=30)
    default_industry: str = ""
    default_location: str = ""
    default_niche: str = ""
    scout_loop_minutes: int = Field(default=15, ge=5, le=240)
    pipeline_poll_seconds: int = Field(default=45, ge=15, le=300)
    pdf_generation_enabled: bool = True
    email_from: str = ""
    email_from_name: str = ""
    agency_owner_name: str = ""
    agency_owner_title: str = ""
    agency_website: str = ""


class AutomationEnvHints(BaseModel):
    """Valores de .env (solo lectura) para referencia en la UI."""
    email_api_key_configured: bool = False
    llm_api_key_configured: bool = False
    scout_loop_env_minutes: int = 15
    pipeline_poll_env_seconds: int = 45
    email_from_env: str = ""
    email_from_name_env: str = ""


class AutomationConfigUpdate(BaseModel):
    auto_scout_enabled: Optional[bool] = None
    auto_outreach_enabled: Optional[bool] = None
    auto_email_enabled: Optional[bool] = None
    auto_outreach_min_segment: Optional[Literal["A", "B", "C"]] = None
    auto_outreach_max_per_run: Optional[int] = Field(default=None, ge=1, le=10)
    default_num_dorks: Optional[int] = Field(default=None, ge=5, le=30)
    default_industry: Optional[str] = None
    default_location: Optional[str] = None
    default_niche: Optional[str] = None
    scout_loop_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    pipeline_poll_seconds: Optional[int] = Field(default=None, ge=15, le=300)
    pdf_generation_enabled: Optional[bool] = None
    email_from: Optional[str] = None
    email_from_name: Optional[str] = None
    agency_owner_name: Optional[str] = None
    agency_owner_title: Optional[str] = None
    agency_website: Optional[str] = None


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
    scout_loop_minutes: int = 15
    pipeline_poll_seconds: int = 45
    env_hints: AutomationEnvHints = Field(default_factory=AutomationEnvHints)
    # Compatibilidad con clientes anteriores
    scout_pass_active: bool = False
    scout_pass_mode: str = "automatic"


class OutreachRetryResult(BaseModel):
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    pending_before: int = 0
    detail: str = ""
