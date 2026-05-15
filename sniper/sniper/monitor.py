"""Loop de monitoreo de uptime."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import orjson
import redis.asyncio as aioredis

from sniper.api_client import APIClient
from sniper.config import Settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CheckResult:
    target_id: str
    url: str
    status_code: Optional[int]
    error_kind: Optional[str]
    latency_ms: Optional[int]
    checked_at: datetime


class UptimeMonitor:
    """Realiza chequeos periódicos contra los targets registrados."""

    def __init__(
        self,
        settings: Settings,
        api: APIClient,
        redis: aioredis.Redis,
    ) -> None:
        self._settings = settings
        self._api = api
        self._redis = redis
        self._failures: dict[str, int] = defaultdict(int)
        self._http = httpx.AsyncClient(timeout=15.0, follow_redirects=True)
        self._stop = asyncio.Event()

    def request_stop(self) -> None:
        self._stop.set()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def run(self) -> None:
        logger.info("sniper_loop_start", extra={"interval": self._settings.interval_seconds})
        while not self._stop.is_set():
            try:
                targets = await self._api.list_targets()
            except Exception as exc:  # noqa: BLE001
                logger.exception("targets_fetch_failed", extra={"err": str(exc)})
                await self._wait_or_stop(self._settings.interval_seconds)
                continue

            if not targets:
                logger.debug("no_targets")
                await self._wait_or_stop(self._settings.interval_seconds)
                continue

            await asyncio.gather(
                *(self._check_target(target) for target in targets),
                return_exceptions=False,
            )
            await self._wait_or_stop(self._settings.interval_seconds)

    async def _wait_or_stop(self, seconds: int) -> None:
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            return

    async def _check_target(self, target: dict[str, Any]) -> None:
        target_id = target["id"]
        url = target["url"]
        threshold = int(target.get("failure_threshold") or self._settings.failure_threshold)

        result = await self._fetch(target_id, url)
        is_failure = result.status_code is None or result.status_code in (404, 500, 502, 503, 504)

        if not is_failure:
            self._failures[target_id] = 0
            logger.debug("check_ok", extra={"url": url, "code": result.status_code})
            return

        self._failures[target_id] += 1
        consecutive = self._failures[target_id]
        logger.info(
            "check_failure",
            extra={
                "url": url,
                "code": result.status_code,
                "error": result.error_kind,
                "consecutive": consecutive,
                "threshold": threshold,
            },
        )

        if consecutive < threshold:
            return

        severity = "critical" if (result.status_code or 0) >= 500 else "warning"
        alert_payload = {
            "target_id": target_id,
            "severity": severity,
            "status_code": result.status_code,
            "error_kind": result.error_kind,
            "message": f"{url} respondió {result.status_code or result.error_kind} {consecutive} veces seguidas",
            "payload": {
                "latency_ms": result.latency_ms,
                "checked_at": result.checked_at.isoformat(),
            },
        }

        try:
            await self._api.record_alert(alert_payload)
        except Exception as exc:  # noqa: BLE001
            logger.exception("alert_publish_failed", extra={"err": str(exc), "url": url})

        try:
            await self._redis.lpush(
                self._settings.queue_sniper_alerts,
                orjson.dumps(alert_payload),
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("alert_redis_failed", extra={"err": str(exc), "url": url})

        if self._settings.webhook_url:
            try:
                await self._http.post(self._settings.webhook_url, json=alert_payload, timeout=10.0)
            except Exception as exc:  # noqa: BLE001
                logger.warning("webhook_failed", extra={"err": str(exc)})

        self._failures[target_id] = 0  # reinicia contador tras notificar

    async def _fetch(self, target_id: str, url: str) -> CheckResult:
        start = asyncio.get_event_loop().time()
        try:
            response = await self._http.get(url)
            latency_ms = int((asyncio.get_event_loop().time() - start) * 1000)
            return CheckResult(
                target_id=target_id,
                url=url,
                status_code=response.status_code,
                error_kind=None,
                latency_ms=latency_ms,
                checked_at=datetime.now(tz=timezone.utc),
            )
        except httpx.TimeoutException:
            return CheckResult(
                target_id=target_id,
                url=url,
                status_code=None,
                error_kind="timeout",
                latency_ms=None,
                checked_at=datetime.now(tz=timezone.utc),
            )
        except httpx.HTTPError as exc:
            return CheckResult(
                target_id=target_id,
                url=url,
                status_code=None,
                error_kind=exc.__class__.__name__,
                latency_ms=None,
                checked_at=datetime.now(tz=timezone.utc),
            )
