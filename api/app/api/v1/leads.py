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


@router.get("/{lead_id}/detail")
async def get_lead_detail(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Aggregated detail: lead + latest audit + sales intel + contacts."""
    from sqlalchemy import select
    from app.models.audit import Audit
    from app.models.lead import Lead
    from app.models.sales_intelligence import SalesIntelligence
    from app.schemas.audit import AuditRead
    from app.schemas.lead import LeadRead
    from app.schemas.sales_intelligence import SalesIntelligenceRead

    # Get lead
    result = await session.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    # Get latest audit
    result = await session.execute(
        select(Audit)
        .where(Audit.lead_id == lead_id)
        .order_by(Audit.created_at.desc())
        .limit(1)
    )
    latest_audit = result.scalar_one_or_none()

    # Get all audits
    result = await session.execute(
        select(Audit)
        .where(Audit.lead_id == lead_id)
        .order_by(Audit.created_at.desc())
    )
    all_audits = list(result.scalars().all())

    # Get sales intelligence
    result = await session.execute(
        select(SalesIntelligence)
        .where(SalesIntelligence.lead_id == lead_id)
        .order_by(SalesIntelligence.generated_at.desc())
    )
    all_intel = list(result.scalars().all())

    return {
        "lead": LeadRead.model_validate(lead).model_dump(),
        "latest_audit": AuditRead.model_validate(latest_audit).model_dump() if latest_audit else None,
        "audits": [AuditRead.model_validate(a).model_dump() for a in all_audits],
        "sales_intelligence": [SalesIntelligenceRead.model_validate(i).model_dump() for i in all_intel],
    }
