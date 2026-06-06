"""Schemas Pydantic para Report (PDF generation)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.report import ReportStatus


class ReportCreate(BaseModel):
    """Payload to request a PDF report generation."""
    lead_id: uuid.UUID
    audit_id: Optional[uuid.UUID] = None
    sales_intel_id: Optional[uuid.UUID] = None


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    audit_id: Optional[uuid.UUID] = None
    sales_intel_id: Optional[uuid.UUID] = None
    file_path: str
    file_size: int
    status: ReportStatus
    generated_at: Optional[datetime] = None
    sent_count: int
    created_at: datetime


class ReportReadDetail(ReportRead):
    """Expanded read model with lead context for display."""
    lead_domain: Optional[str] = None
    lead_company_name: Optional[str] = None


class ReportStatusUpdate(BaseModel):
    status: ReportStatus = Field(..., description="New report status")


class ReportListResponse(BaseModel):
    items: list[ReportReadDetail]
    total: int
    limit: int
    offset: int
