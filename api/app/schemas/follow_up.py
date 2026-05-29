"""Pydantic schemas for FollowUpSequence."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.follow_up import FollowUpStatus


# ---------------------------------------------------------------------------
# Individual follow-up step
# ---------------------------------------------------------------------------

class FollowUpCreate(BaseModel):
    """Payload to create a single follow-up step."""
    lead_id: uuid.UUID
    step_number: int = Field(ge=0)
    scheduled_at: datetime
    subject: str
    body: str
    include_pdf: bool = False


class FollowUpRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    sequence_name: str
    step_number: int
    scheduled_at: datetime
    sent_at: Optional[datetime] = None
    status: FollowUpStatus
    subject: str
    body: str
    include_pdf: bool
    retry_count: int
    last_error: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Sequence scheduling (accepts list of steps with delays)
# ---------------------------------------------------------------------------

class FollowUpSequenceStep(BaseModel):
    """A step in a follow-up sequence with a delay from Day 0."""
    delay_days: int = Field(ge=0, description="Days from first contact (Day 0 = today)")
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)
    include_pdf: bool = False


class FollowUpSequenceCreate(BaseModel):
    """Payload to schedule a full follow-up sequence for a lead."""
    sequence_name: str = Field(default="default", min_length=1, max_length=100)
    steps: list[FollowUpSequenceStep] = Field(..., min_length=1, max_length=10)


class FollowUpSequenceRead(BaseModel):
    """Response after sequence scheduling."""
    sequence_name: str
    lead_id: uuid.UUID
    steps_scheduled: int
    follow_up_ids: list[uuid.UUID]
    next_scheduled_at: Optional[datetime] = None


class FollowUpListResponse(BaseModel):
    items: list[FollowUpRead]
    total: int
