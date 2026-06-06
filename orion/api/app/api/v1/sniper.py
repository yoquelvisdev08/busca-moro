"""Endpoints para Uptime Sniper."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.sniper import (
    SniperAlertCreate,
    SniperAlertRead,
    SniperTargetCreate,
    SniperTargetRead,
)
from app.services.sniper_service import SniperService

router = APIRouter(prefix="/sniper", tags=["sniper"])


@router.post(
    "/targets",
    response_model=SniperTargetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar (upsert) un target para monitoreo",
)
async def register_target(
    payload: SniperTargetCreate,
    session: AsyncSession = Depends(get_session),
) -> SniperTargetRead:
    service = SniperService(session)
    target = await service.register_target(payload)
    return SniperTargetRead.model_validate(target)


@router.get("/targets", response_model=list[SniperTargetRead])
async def list_targets(
    only_enabled: bool = True,
    session: AsyncSession = Depends(get_session),
) -> list[SniperTargetRead]:
    service = SniperService(session)
    targets = await service.list_targets(only_enabled=only_enabled)
    return [SniperTargetRead.model_validate(t) for t in targets]


@router.post(
    "/alerts",
    response_model=SniperAlertRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar alerta disparada por el Sniper",
)
async def record_alert(
    payload: SniperAlertCreate,
    session: AsyncSession = Depends(get_session),
) -> SniperAlertRead:
    service = SniperService(session)
    target = await service.get_target(payload.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target no encontrado")
    alert = await service.record_alert(payload)
    return SniperAlertRead.model_validate(alert)
