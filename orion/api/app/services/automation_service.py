"""Configuración de automatización persistida en Redis."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.schemas.automation import (
    AutomationConfig,
    AutomationConfigUpdate,
    AutomationStats,
    AutomationStatus,
    PipelineCounts,
    PipelineQueues,
    ScoutPassSnapshot,
)
from app.services.queue_service import QueueService

AUTOMATION_CONFIG_KEY = "orion:config:automation"
AUTOMATION_STATS_KEY = "orion:config:automation:stats"
SCOUT_PASS_KEY = "orion:scout:pass"


class AutomationService:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis

    async def get_config(self) -> AutomationConfig:
        raw = await self._redis.get(AUTOMATION_CONFIG_KEY)
        if not raw:
            return AutomationConfig()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return AutomationConfig()
        return AutomationConfig.model_validate(data)

    async def update_config(self, patch: AutomationConfigUpdate) -> AutomationConfig:
        current = await self.get_config()
        merged = current.model_dump()
        for key, value in patch.model_dump(exclude_unset=True).items():
            merged[key] = value
        config = AutomationConfig.model_validate(merged)
        await self._redis.set(
            AUTOMATION_CONFIG_KEY,
            json.dumps(config.model_dump()),
        )
        return config

    async def get_stats(self) -> AutomationStats:
        raw = await self._redis.get(AUTOMATION_STATS_KEY)
        if not raw:
            return AutomationStats()
        try:
            return AutomationStats.model_validate(json.loads(raw))
        except json.JSONDecodeError:
            return AutomationStats()

    async def record_outreach_run(
        self,
        *,
        sent: int,
        failed: int,
        detail: str = "",
    ) -> None:
        stats = await self.get_stats()
        stats.outreach_sent_total += sent
        stats.outreach_failed_total += failed
        stats.last_outreach_run_at = datetime.now(tz=timezone.utc).isoformat()
        if detail:
            stats.last_outreach_detail = detail[:500]
        await self._redis.set(
            AUTOMATION_STATS_KEY,
            json.dumps(stats.model_dump()),
        )

    async def reset_outreach_failures(self) -> None:
        """Reinicia contador acumulado de fallos tras un reintento masivo."""
        stats = await self.get_stats()
        stats.outreach_failed_total = 0
        await self._redis.set(
            AUTOMATION_STATS_KEY,
            json.dumps(stats.model_dump()),
        )

    async def record_pipeline_run(self, detail: str = "") -> None:
        stats = await self.get_stats()
        stats.last_pipeline_run_at = datetime.now(tz=timezone.utc).isoformat()
        if detail:
            stats.last_pipeline_detail = detail[:500]
        await self._redis.set(
            AUTOMATION_STATS_KEY,
            json.dumps(stats.model_dump()),
        )

    @staticmethod
    def _parse_loop_minutes(raw: str) -> int:
        value = (raw or "15m").strip().lower()
        match = re.match(r"^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hour|hours)?$", value)
        if not match:
            return 15
        amount = int(match.group(1))
        unit = match.group(2) or "m"
        if unit.startswith("h"):
            return max(1, amount * 60)
        return max(1, amount)

    async def get_status(self, session=None) -> AutomationStatus:
        config = await self.get_config()
        stats = await self.get_stats()
        scout = ScoutPassSnapshot()
        raw = await self._redis.get(SCOUT_PASS_KEY)
        if raw:
            try:
                data: dict[str, Any] = json.loads(raw)
                scout = ScoutPassSnapshot.model_validate(data)
            except (json.JSONDecodeError, ValueError):
                pass

        settings = get_settings()
        queue = QueueService(self._redis)
        queues = PipelineQueues(
            discovery=await queue.length(settings.queue_discovery),
            audit=await queue.length(settings.queue_audit),
            outreach=await queue.length(settings.queue_outreach),
            dlq=await queue.length(settings.queue_dlq),
        )
        loop_minutes = self._parse_loop_minutes(os.environ.get("SCOUT_LOOP_INTERVAL", "15m"))

        pipeline = PipelineCounts()
        if session is not None:
            from app.services.automation_processor import get_pipeline_counts

            counts = await get_pipeline_counts(session)
            pipeline = PipelineCounts(**counts)

        return AutomationStatus(
            config=config,
            stats=stats,
            scout=scout,
            queues=queues,
            pipeline=pipeline,
            scout_loop_minutes=loop_minutes,
            scout_pass_active=scout.active,
            scout_pass_mode=scout.mode,
        )

    @staticmethod
    def segment_meets_min(segment: Optional[str], min_segment: str) -> bool:
        rank = {"A": 3, "B": 2, "C": 1, "D": 0}
        s = rank.get((segment or "D").upper(), 0)
        m = rank.get(min_segment.upper(), 1)
        return s >= m
