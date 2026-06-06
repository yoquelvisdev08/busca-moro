"""Endpoints de observabilidad: depth de colas y métricas básicas."""

from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.redis_client import get_redis
from app.services.queue_service import QueueService

router = APIRouter(prefix="/monitor", tags=["monitor"])

SCOUT_PASS_KEY = "orion:scout:pass"


class ScoutPassStatus(BaseModel):
    active: bool = False
    pass_number: int = Field(default=0, alias="pass")
    mode: str = "automatic"
    dorks_count: int = 0
    seeds_count: int = 0
    location: str = ""
    industry: str = ""
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    model_config = {"populate_by_name": True}


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


@router.get("/scout", response_model=ScoutPassStatus, summary="Estado de la pasada actual del Scout")
async def scout_pass_status() -> ScoutPassStatus:
    redis = get_redis()
    raw = await redis.get(SCOUT_PASS_KEY)
    if not raw:
        return ScoutPassStatus()
    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        return ScoutPassStatus()
    return ScoutPassStatus.model_validate(data)
