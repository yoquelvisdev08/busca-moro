"""Endpoints for follow-up email sequence management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.follow_up import (
    FollowUpCreate,
    FollowUpListResponse,
    FollowUpRead,
    FollowUpSequenceCreate,
    FollowUpSequenceRead,
)
from app.services.follow_up_service import FollowUpService

router = APIRouter(tags=["follow-ups"])


# ---------------------------------------------------------------------------
# Schedule follow-up sequence
# ---------------------------------------------------------------------------

@router.post(
    "/leads/{lead_id}/schedule-follow-up",
    response_model=FollowUpSequenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a follow-up sequence for a lead",
)
async def schedule_follow_up(
    lead_id: uuid.UUID,
    payload: FollowUpSequenceCreate,
    session: AsyncSession = Depends(get_session),
):
    """Schedule a multi-step follow-up sequence with delays from Day 0.

    Each step defines a delay in days, subject, body, and whether to
    include the latest PDF report as an attachment.
    """
    # Verify lead exists
    from app.models.lead import Lead
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    steps = [
        {
            "delay_days": s.delay_days,
            "subject": s.subject,
            "body": s.body,
            "include_pdf": s.include_pdf,
        }
        for s in payload.steps
    ]

    from app.services.lead_closure import lead_blocks_follow_ups

    blocked, reason = await lead_blocks_follow_ups(session, lead_id)
    if blocked:
        raise HTTPException(
            status_code=400,
            detail=reason or "El lead respondió: los follow-ups están detenidos",
        )

    service = FollowUpService(session)
    try:
        created = await service.schedule_sequence(
            lead_id=lead_id,
            sequence_name=payload.sequence_name,
            steps=steps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    next_scheduled = (
        min(fu.scheduled_at for fu in created) if created else None
    )

    return FollowUpSequenceRead(
        sequence_name=payload.sequence_name,
        lead_id=lead_id,
        steps_scheduled=len(created),
        follow_up_ids=[fu.id for fu in created],
        next_scheduled_at=next_scheduled,
    )


# ---------------------------------------------------------------------------
# List follow-ups for a lead
# ---------------------------------------------------------------------------

@router.get(
    "/leads/{lead_id}/follow-ups",
    response_model=FollowUpListResponse,
    summary="List all follow-ups for a lead",
)
async def list_follow_ups(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Return all follow-up records for a lead, ordered by step number."""
    # Verify lead exists
    from app.models.lead import Lead
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    service = FollowUpService(session)
    items = await service.list_for_lead(lead_id)

    return FollowUpListResponse(
        items=[FollowUpRead.model_validate(fu) for fu in items],
        total=len(items),
    )


# ---------------------------------------------------------------------------
# Cancel a specific follow-up
# ---------------------------------------------------------------------------

@router.post(
    "/follow-ups/{follow_up_id}/cancel",
    summary="Cancel a specific follow-up step",
)
async def cancel_follow_up(
    follow_up_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Cancel a single follow-up by its ID."""
    service = FollowUpService(session)
    fu = await service.cancel_single(follow_up_id)

    if fu is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    return {
        "status": "cancelled",
        "follow_up_id": str(follow_up_id),
        "previous_status": fu.status.value if fu.status.value != "cancelled" else "was_already_cancelled",
    }


# ---------------------------------------------------------------------------
# Cancel all pending follow-ups for a lead
# ---------------------------------------------------------------------------

@router.post(
    "/leads/{lead_id}/cancel-follow-ups",
    summary="Cancel all pending follow-ups for a lead",
)
async def cancel_all_follow_ups(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Cancel every pending follow-up in all sequences for a lead."""
    # Verify lead exists
    from app.models.lead import Lead
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    service = FollowUpService(session)
    cancelled = await service.cancel_sequence(lead_id)

    return {
        "status": "cancelled",
        "lead_id": str(lead_id),
        "cancelled_count": cancelled,
    }
