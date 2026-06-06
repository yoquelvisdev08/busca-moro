"""Casos de uso sobre Uptime Sniper."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sniper import SniperAlert, SniperTarget
from app.schemas.sniper import SniperAlertCreate, SniperTargetCreate


class SniperService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_target(self, payload: SniperTargetCreate) -> SniperTarget:
        existing = (
            await self._session.execute(
                select(SniperTarget).where(SniperTarget.url == str(payload.url))
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.label = payload.label
            existing.industry = payload.industry
            existing.interval_seconds = payload.interval_seconds
            existing.failure_threshold = payload.failure_threshold
            existing.enabled = payload.enabled
            await self._session.commit()
            await self._session.refresh(existing)
            return existing

        target = SniperTarget(
            url=str(payload.url),
            label=payload.label,
            industry=payload.industry,
            interval_seconds=payload.interval_seconds,
            failure_threshold=payload.failure_threshold,
            enabled=payload.enabled,
        )
        self._session.add(target)
        await self._session.commit()
        await self._session.refresh(target)
        return target

    async def list_targets(self, only_enabled: bool = True) -> list[SniperTarget]:
        stmt = select(SniperTarget)
        if only_enabled:
            stmt = stmt.where(SniperTarget.enabled.is_(True))
        return list((await self._session.execute(stmt)).scalars().all())

    async def record_alert(self, payload: SniperAlertCreate) -> SniperAlert:
        alert = SniperAlert(
            target_id=payload.target_id,
            severity=payload.severity,
            status_code=payload.status_code,
            error_kind=payload.error_kind,
            message=payload.message,
            payload=payload.payload,
        )
        self._session.add(alert)
        await self._session.commit()
        await self._session.refresh(alert)
        return alert

    async def get_target(self, target_id: uuid.UUID) -> Optional[SniperTarget]:
        return await self._session.get(SniperTarget, target_id)
