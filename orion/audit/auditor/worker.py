"""Punto de entrada del worker Auditor.

Consume mensajes de ``QUEUE_AUDIT`` con BRPOP y publica los resultados a la
API (``POST /v1/audits``). La API es la responsable de persistir y mover el
lead a la siguiente cola (``QUEUE_OUTREACH``).
"""

from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any, Optional

import httpx
import orjson
import redis.asyncio as aioredis
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from auditor.auditor_core import Auditor
from auditor.config import Settings, get_settings
from auditor.logging_setup import configure_logging
from auditor.stealth.rotation import Rotator


class AuditorWorker:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._logger = logging.getLogger(settings.service_name)
        self._redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        self._http = httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0)
        rotator = Rotator.from_files(settings.user_agents_file, settings.proxy_pool)
        self._auditor = Auditor(settings, rotator)
        self._stop = asyncio.Event()

    def request_stop(self) -> None:
        self._stop.set()

    async def run(self) -> None:
        self._logger.info("auditor_up", extra={"queue": self._settings.queue_audit})
        tasks = [
            asyncio.create_task(self._consume(worker_id=i))
            for i in range(self._settings.concurrency)
        ]
        await self._stop.wait()
        self._logger.info("auditor_stopping")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self._redis.aclose()
        await self._http.aclose()

    async def _consume(self, worker_id: int) -> None:
        log = self._logger.getChild(f"w{worker_id}")
        while not self._stop.is_set():
            try:
                popped = await self._redis.brpop([self._settings.queue_audit], timeout=5)
            except asyncio.CancelledError:
                return
            except Exception as exc:  # noqa: BLE001
                log.exception("brpop_error", extra={"err": str(exc)})
                await asyncio.sleep(2)
                continue

            if popped is None:
                continue

            _, raw_message = popped
            try:
                message = orjson.loads(raw_message)
            except orjson.JSONDecodeError:
                log.error("invalid_message", extra={"raw": raw_message[:200]})
                await self._send_to_dlq(raw_message, "json_decode_error")
                continue

            await self._process(log, message)

    async def _process(self, log: logging.Logger, message: dict[str, Any]) -> None:
        lead_id = message.get("lead_id")
        url = message.get("url")
        if not lead_id or not url:
            log.error("missing_fields", extra={"message": message})
            await self._send_to_dlq(orjson.dumps(message).decode(), "missing_fields")
            return

        log.info("audit_start", extra={"lead_id": lead_id, "url": url})
        try:
            lead_resp = await self._http.get(f"/v1/leads/{lead_id}")
            if lead_resp.status_code == 404:
                log.warning("lead_not_found_skip", extra={"lead_id": lead_id})
                return
            lead_resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("lead_prefetch_failed", extra={"lead_id": lead_id, "err": str(exc)})
            return

        try:
            result = await self._auditor.audit(lead_id=lead_id, url=url)
        except Exception as exc:  # noqa: BLE001
            log.exception("audit_unhandled", extra={"lead_id": lead_id, "url": url})
            await self._send_to_dlq(orjson.dumps(message).decode(), f"unhandled: {exc}")
            return

        payload = result.to_payload()
        try:
            await self._publish_audit(payload)
            log.info(
                "audit_done",
                extra={
                    "lead_id": lead_id,
                    "lighthouse": result.lighthouse_score,
                    "load_ms": result.load_time_ms,
                    "mobile": result.mobile_friendly,
                    "ssl": result.has_ssl,
                },
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("publish_failed", extra={"lead_id": lead_id})
            await self._send_to_dlq(orjson.dumps(payload).decode(), f"publish_failed: {exc}")

    async def _publish_audit(self, payload: dict[str, Any]) -> None:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(4),
            wait=wait_exponential_jitter(initial=0.5, max=8),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        ):
            with attempt:
                response = await self._http.post("/v1/audits", json=payload)
                response.raise_for_status()

    async def _send_to_dlq(self, payload: str, reason: str) -> None:
        try:
            envelope = orjson.dumps({"payload": payload, "reason": reason})
            await self._redis.lpush(self._settings.queue_dlq, envelope)
        except Exception as exc:  # noqa: BLE001
            self._logger.error("dlq_failed", extra={"err": str(exc)})


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.service_name)
    worker = AuditorWorker(settings)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, worker.request_stop)

    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
