"""Endpoints CRUD/listado para Leads + disparo manual de auditoría."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.redis_client import get_redis
from app.models.lead import LeadStatus
from app.schemas.lead import (
    LeadCreate,
    LeadListResponse,
    LeadNextStepSet,
    LeadOutreachSummary,
    LeadRead,
    LeadUpdate,
)
from app.services.lead_closure import requires_next_step
from app.services.lead_delete_reasons import REASON_CODES
from app.services.lead_service import LeadService
from app.services.outreach_service import OutreachService
from app.services.queue_service import QueueService


def _lead_has_email(lead) -> bool:
    if lead.email and str(lead.email).strip():
        return True
    return bool(lead.secondary_emails and len(lead.secondary_emails) > 0)


def _lead_read_with_outreach(lead, stats_row) -> LeadRead:
    base = LeadRead.model_validate(lead)
    updates: dict = {
        "needs_next_step": requires_next_step(lead.status, lead.next_step_type),
        "has_email": _lead_has_email(lead),
    }
    if stats_row is not None:
        updates["outreach"] = LeadOutreachSummary(
            has_message_sent=stats_row.has_message_sent,
            messages_sent_count=stats_row.messages_sent_count,
            has_reply_received=stats_row.has_reply_received,
            inbound_messages_count=stats_row.inbound_messages_count,
        )
    return base.model_copy(update=updates)

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
    needs_next_step: bool = Query(
        default=False,
        description="Solo leads contactados sin siguiente paso definido",
    ),
    message_sent: Optional[bool] = Query(
        default=None,
        description="true=revisados (ya escrito), false=nuevos (sin mensaje enviado)",
    ),
    has_email: Optional[bool] = Query(
        default=None,
        description="Filtrar por presencia de email en el lead",
    ),
    discovered_since: Optional[datetime] = Query(
        default=None,
        description="Leads descubiertos o actualizados desde esta fecha (ISO 8601)",
    ),
    created_since: Optional[datetime] = Query(
        default=None,
        description="Solo dominios nuevos creados desde esta fecha (ISO 8601)",
    ),
    session: AsyncSession = Depends(get_session),
) -> LeadListResponse:
    service = LeadService(session)
    items, total = await service.list(
        limit=limit,
        offset=offset,
        status=status_filter,
        needs_next_step_only=needs_next_step,
        message_sent=message_sent,
        has_email=has_email,
        discovered_since=discovered_since,
        created_since=created_since,
    )
    outreach_service = OutreachService(session)
    stats = await outreach_service.stats_for_leads([item.id for item in items])
    return LeadListResponse(
        items=[_lead_read_with_outreach(item, stats.get(item.id)) for item in items],
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
    outreach_service = OutreachService(session)
    stats = await outreach_service.stats_for_leads([lead_id])
    return _lead_read_with_outreach(lead, stats.get(lead_id))


@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_200_OK,
    summary="Eliminar lead (soft delete)",
)
async def delete_lead(
    lead_id: uuid.UUID,
    reason: str = Query(..., min_length=1, max_length=64, description="Código de motivo"),
    detail: Optional[str] = Query(default=None, max_length=500),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Motivo obligatorio por query string (?reason=no_email&detail=...)."""
    if reason not in REASON_CODES:
        raise HTTPException(status_code=400, detail=f"Motivo no válido: {reason}")

    service = LeadService(session)
    deleted = await service.soft_delete(lead_id, reason=reason, detail=detail)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return {"status": "deleted", "lead_id": str(lead_id)}


@router.post("/{lead_id}/next-step", response_model=LeadRead)
async def set_lead_next_step(
    lead_id: uuid.UUID,
    payload: LeadNextStepSet,
    session: AsyncSession = Depends(get_session),
) -> LeadRead:
    """Registra el siguiente paso comercial: llamada, propuesta o descarte."""
    service = LeadService(session)
    try:
        lead = await service.set_next_step(
            lead_id,
            step=payload.step,
            scheduled_at=payload.scheduled_at,
            notes=payload.notes,
            close_as_lost=payload.close_as_lost,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    outreach_service = OutreachService(session)
    stats = await outreach_service.stats_for_leads([lead_id])
    return _lead_read_with_outreach(lead, stats.get(lead_id))


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
    outreach_service = OutreachService(session)
    stats = await outreach_service.stats_for_leads([lead_id])
    return _lead_read_with_outreach(lead, stats.get(lead_id))


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
    result = await session.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
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

    outreach_service = OutreachService(session)
    stats = await outreach_service.stats_for_leads([lead_id])
    lead_read = _lead_read_with_outreach(lead, stats.get(lead_id))

    return {
        "lead": lead_read.model_dump(),
        "latest_audit": AuditRead.model_validate(latest_audit).model_dump() if latest_audit else None,
        "audits": [AuditRead.model_validate(a).model_dump() for a in all_audits],
        "sales_intelligence": [SalesIntelligenceRead.model_validate(i).model_dump() for i in all_intel],
    }
