"""Endpoints de observabilidad: depth de colas y métricas básicas."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.redis_client import get_redis
from app.services.queue_service import QueueService

router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.get("/queues", summary="Profundidad de cada cola Redis")
async def queue_depths(settings: Settings = Depends(get_settings)) -> dict[str, int]:
    queue = QueueService(get_redis())
    return {
        "discovery": await queue.length(settings.queue_discovery),
        "audit": await queue.length(settings.queue_audit),
        "outreach": await queue.length(settings.queue_outreach),
        "sniper_alerts": await queue.length(settings.queue_sniper_alerts),
        "dlq": await queue.length(settings.queue_dlq),
    }
