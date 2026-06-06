"""Endpoints Poseidon — inbox de intención de compra."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.redis_client import get_redis
from poseidon_api.models import PoseidonSignalStatus
from poseidon_api.config_service import PoseidonConfigService
from poseidon_api.schemas import (
    PoseidonConfig,
    PoseidonConfigUpdate,
    PoseidonConvertResult,
    PoseidonScanStatus,
    PoseidonSignalCreate,
    PoseidonSignalListResponse,
    PoseidonSignalRead,
    PoseidonSignalUpdate,
)
from poseidon_api.service import PoseidonService

router = APIRouter(prefix="/poseidon", tags=["poseidon"])

POSEIDON_SCAN_STATUS_KEY = "orion:poseidon:scan_status"
POSEIDON_SCAN_SIGNAL_KEY = "orion:signal:poseidon_scan"


@router.post(
    "/signals",
    response_model=PoseidonSignalRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingestar señal detectada por el worker Poseidon",
)
async def ingest_signal(
    payload: PoseidonSignalCreate,
    session: AsyncSession = Depends(get_session),
) -> PoseidonSignalRead:
    service = PoseidonService(session)
    signal, created = await service.ingest(payload)
    if not created:
        return PoseidonSignalRead.model_validate(signal)
    return PoseidonSignalRead.model_validate(signal)


@router.get("/signals", response_model=PoseidonSignalListResponse)
async def list_signals(
    status_filter: PoseidonSignalStatus | None = Query(default=None, alias="status"),
    intent_category: str | None = Query(default=None),
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> PoseidonSignalListResponse:
    service = PoseidonService(session)
    items, total = await service.list_signals(
        status=status_filter,
        intent_category=intent_category,
        min_score=min_score,
        limit=limit,
        offset=offset,
    )
    return PoseidonSignalListResponse(
        items=[PoseidonSignalRead.model_validate(s) for s in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/signals/{signal_id}", response_model=PoseidonSignalRead)
async def get_signal(
    signal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> PoseidonSignalRead:
    service = PoseidonService(session)
    signal = await service.get(signal_id)
    if signal is None:
        raise HTTPException(status_code=404, detail="Señal no encontrada")
    return PoseidonSignalRead.model_validate(signal)


@router.patch("/signals/{signal_id}", response_model=PoseidonSignalRead)
async def update_signal(
    signal_id: uuid.UUID,
    payload: PoseidonSignalUpdate,
    session: AsyncSession = Depends(get_session),
) -> PoseidonSignalRead:
    service = PoseidonService(session)
    signal = await service.update(signal_id, payload)
    if signal is None:
        raise HTTPException(status_code=404, detail="Señal no encontrada")
    return PoseidonSignalRead.model_validate(signal)


@router.post("/signals/{signal_id}/convert", response_model=PoseidonConvertResult)
async def convert_signal_to_lead(
    signal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> PoseidonConvertResult:
    from app.core.config import get_settings
    from app.services.queue_service import QueueService

    service = PoseidonService(session)
    try:
        signal, lead_id, lead_url = await service.convert_to_lead(signal_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settings = get_settings()
    queue = QueueService(get_redis())
    await queue.enqueue(
        settings.queue_audit,
        {"lead_id": str(lead_id), "url": lead_url},
    )
    from app.models.lead import LeadStatus as LS
    from app.services.lead_service import LeadService

    lead_service = LeadService(session)
    await lead_service.transition_status(lead_id, LS.queued)

    return PoseidonConvertResult(
        signal_id=signal.id,
        lead_id=lead_id,
        lead_url=lead_url,
        message="Lead creado desde señal Poseidon",
    )


@router.get("/stats")
async def poseidon_stats(session: AsyncSession = Depends(get_session)) -> dict[str, int]:
    service = PoseidonService(session)
    return await service.stats()


@router.get("/scan-status", response_model=PoseidonScanStatus)
async def scan_status() -> PoseidonScanStatus:
    redis = get_redis()
    raw = await redis.get(POSEIDON_SCAN_STATUS_KEY)
    if not raw:
        return PoseidonScanStatus()
    import json

    try:
        data = json.loads(raw)
        return PoseidonScanStatus(**data)
    except (json.JSONDecodeError, TypeError):
        return PoseidonScanStatus()


@router.post("/scan", response_model=PoseidonScanStatus)
async def trigger_scan() -> PoseidonScanStatus:
    """Dispara un escaneo inmediato en el worker Poseidon."""
    redis = get_redis()
    await redis.set(POSEIDON_SCAN_SIGNAL_KEY, "1", ex=300)
    return PoseidonScanStatus(active=True)


@router.get("/config", response_model=PoseidonConfig)
async def get_poseidon_config() -> PoseidonConfig:
    redis = get_redis()
    service = PoseidonConfigService(redis)
    return await service.get_config()


@router.patch("/config", response_model=PoseidonConfig)
async def update_poseidon_config(patch: PoseidonConfigUpdate) -> PoseidonConfig:
    redis = get_redis()
    service = PoseidonConfigService(redis)
    return await service.update_config(patch)
