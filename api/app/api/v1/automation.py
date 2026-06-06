"""Endpoints de configuración y estado de automatización."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from app.core.database import get_session
from app.core.redis_client import get_redis
from app.schemas.automation import (
    AutomationConfigUpdate,
    AutomationStatus,
)
from app.services.automation_service import AutomationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/status", response_model=AutomationStatus)
async def get_automation_status(
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(get_redis),
) -> AutomationStatus:
    service = AutomationService(redis)
    return await service.get_status(session)


@router.patch("/config", response_model=AutomationStatus)
async def update_automation_config(
    patch: AutomationConfigUpdate,
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(get_redis),
) -> AutomationStatus:
    service = AutomationService(redis)
    await service.update_config(patch)
    return await service.get_status(session)


@router.post("/reconcile", response_model=AutomationStatus)
async def reconcile_pipeline(
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(get_redis),
) -> AutomationStatus:
    """Limpia colas obsoletas y encola leads pendientes reales."""
    from app.services.automation_processor import reconcile_audit_queue

    enqueued = await reconcile_audit_queue(session, force=True)
    logger.info("pipeline_reconcile_manual", extra={"enqueued": enqueued})
    return await AutomationService(redis).get_status(session)
