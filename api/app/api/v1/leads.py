"""Endpoints CRUD/listado para Leads + disparo manual de auditoría."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.redis_client import get_redis
from app.models.lead import LeadStatus
from app.schemas.lead import LeadCreate, LeadListResponse, LeadRead, LeadUpdate
from app.services.lead_service import LeadService
from app.services.queue_service import QueueService

router = APIRouter(prefix="/leads", tags=["leads"])


@router.post(
    "",
    response_model=LeadRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar (o actualizar) un lead descubierto",
)
async def create_lead(
    payload: LeadCreate,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LeadRead:
    service = LeadService(session)
    try:
        lead = await service.upsert(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    queue = QueueService(get_redis())
    await queue.enqueue(
        settings.queue_audit,
        {"lead_id": str(lead.id), "url": lead.url},
    )
    await service.transition_status(lead.id, LeadStatus.queued)
    return LeadRead.model_validate(lead)


@router.get("", response_model=LeadListResponse)
async def list_leads(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status_filter: Optional[LeadStatus] = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_session),
) -> LeadListResponse:
    service = LeadService(session)
    items, total = await service.list(limit=limit, offset=offset, status=status_filter)
    return LeadListResponse(
        items=[LeadRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> LeadRead:
    service = LeadService(session)
    lead = await service.get(lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return LeadRead.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    session: AsyncSession = Depends(get_session),
) -> LeadRead:
    service = LeadService(session)
    lead = await service.update(lead_id, payload)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return LeadRead.model_validate(lead)


@router.post(
    "/{lead_id}/audit",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Encolar lead para auditoría profunda",
)
async def trigger_audit(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    service = LeadService(session)
    lead = await service.get(lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    queue = QueueService(get_redis())
    await queue.enqueue(
        settings.queue_audit,
        {"lead_id": str(lead.id), "url": lead.url},
    )
    await service.transition_status(lead.id, LeadStatus.queued)
    return {"status": "queued", "lead_id": str(lead.id)}


@router.post(
    "/{lead_id}/closer",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Encolar lead para generación de inteligencia de ventas (Closer)",
)
async def trigger_closer(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    service = LeadService(session)
    lead = await service.get(lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    queue = QueueService(get_redis())
    await queue.enqueue(
        settings.queue_outreach,
        {"lead_id": str(lead.id)},
    )
    return {"status": "queued", "lead_id": str(lead.id)}
