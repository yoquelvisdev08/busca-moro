"""Schemas Pydantic para SalesIntelligence (output del Closer)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PainPoint(BaseModel):
    title: str
    evidence: str
    business_impact: str
    severity: str = "medium"


class SalesIntelligenceCreate(BaseModel):
    lead_id: uuid.UUID
    audit_id: Optional[uuid.UUID] = None
    model: str
    pain_points: list[PainPoint] = Field(default_factory=list)
    cold_email_subject: Optional[str] = None
    cold_email_body: Optional[str] = None
    language: str = "es"
    tone: Optional[str] = None
    prompt_hash: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None


class SalesIntelligenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    audit_id: Optional[uuid.UUID]
    model: str
    pain_points: list[dict[str, Any]]
    cold_email_subject: Optional[str]
    cold_email_body: Optional[str]
    language: str
    tone: Optional[str]
    generated_at: datetime
