"""Endpoints para Audits."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.core.redis_client import get_redis
from app.schemas.audit import AuditCreate, AuditRead
from app.services.audit_service import AuditService
from app.services.queue_service import QueueService

router = APIRouter(prefix="/audits", tags=["audits"])


@router.post(
    "",
    response_model=AuditRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar resultado de auditoría (callback del worker Auditor)",
)
async def create_audit(
    payload: AuditCreate,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuditRead:
    service = AuditService(session)
    audit = await service.record(payload)

    queue = QueueService(get_redis())
    await queue.enqueue(
        settings.queue_outreach,
        {"lead_id": str(audit.lead_id), "audit_id": str(audit.id)},
    )
    return AuditRead.model_validate(audit)


@router.get("/{audit_id}", response_model=AuditRead)
async def get_audit(
    audit_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> AuditRead:
    service = AuditService(session)
    audit = await service.get(audit_id)
    if audit is None:
        raise HTTPException(status_code=404, detail="Audit no encontrado")
    return AuditRead.model_validate(audit)


@router.get("/lead/{lead_id}", response_model=list[AuditRead])
async def list_audits_for_lead(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[AuditRead]:
    service = AuditService(session)
    audits = await service.list_for_lead(lead_id)
    return [AuditRead.model_validate(a) for a in audits]
