"""Punto de entrada del worker Closer.

Consume ``QUEUE_OUTREACH`` con BRPOP. Cada mensaje contiene al menos
``lead_id`` y opcionalmente ``audit_id``. Por cada mensaje:

1. Carga lead + última auditoría desde la API.
2. Pide al proveedor LLM (DeepSeek/OpenAI/...) pain points (JSON) y cold
   email (JSON).
3. Persiste el resultado vía ``POST /v1/sales-intelligence``.
"""

from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

import httpx
import orjson
import redis.asyncio as aioredis
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from closer.api_client import APIClient
from closer.config import Settings, get_settings
from closer.intelligence import IntelligenceEngine
from closer.llm_client import LLMClient
from closer.logging_setup import configure_logging


class CloserWorker:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._logger = logging.getLogger(settings.service_name)
        self._redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        self._http_api = httpx.AsyncClient(base_url=settings.api_base_url, timeout=20.0)
        self._api = APIClient(settings.api_base_url)
        self._llm = LLMClient(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout=settings.llm_timeout,
            provider=settings.llm_provider,
        )
        self._engine = IntelligenceEngine(self._llm, settings)
        self._stop = asyncio.Event()

    def request_stop(self) -> None:
        self._stop.set()

    async def run(self) -> None:
        self._logger.info(
            "closer_up",
            extra={
                "queue": self._settings.queue_outreach,
                "provider": self._settings.llm_provider,
                "model": self._settings.llm_model,
            },
        )
        tasks = [
            asyncio.create_task(self._consume(worker_id=i))
            for i in range(self._settings.concurrency)
        ]
        await self._stop.wait()
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self._redis.aclose()
        await self._http_api.aclose()
        await self._api.aclose()
        await self._llm.aclose()

    async def _consume(self, worker_id: int) -> None:
        log = self._logger.getChild(f"w{worker_id}")
        while not self._stop.is_set():
            try:
                popped = await self._redis.brpop([self._settings.queue_outreach], timeout=5)
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
        audit_id = message.get("audit_id")
        if not lead_id:
            log.error("missing_lead_id", extra={"message": message})
            await self._send_to_dlq(orjson.dumps(message).decode(), "missing_lead_id")
            return

        log.info("closer_start", extra={"lead_id": lead_id, "audit_id": audit_id})

        try:
            lead = await self._api.get_lead(lead_id)
            if lead is None:
                log.warning("lead_not_found", extra={"lead_id": lead_id})
                return
            audit = (
                await self._api.get_audit(audit_id)
                if audit_id
                else await self._api.latest_audit_for_lead(lead_id)
            )
            if audit is None:
                log.warning("audit_not_found", extra={"lead_id": lead_id})
                audit = {}

            intel = await self._engine.generate(lead=lead, audit=audit)

            payload = {
                "lead_id": str(lead_id),
                "audit_id": audit.get("id") if audit else None,
                "model": intel.model,
                "pain_points": intel.pain_points,
                "cold_email_subject": intel.cold_email_subject,
                "cold_email_body": intel.cold_email_body,
                "language": intel.language,
                "tone": intel.tone,
                "prompt_hash": intel.prompt_hash,
                "tokens_input": intel.tokens_input,
                "tokens_output": intel.tokens_output,
            }
            await self._publish_intel(payload)
            log.info(
                "closer_done",
                extra={
                    "lead_id": lead_id,
                    "pain_points": len(intel.pain_points),
                    "has_email": intel.cold_email_body is not None,
                },
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("closer_failed", extra={"lead_id": lead_id})
            await self._send_to_dlq(orjson.dumps(message).decode(), f"closer_failed: {exc}")

    async def _publish_intel(self, payload: dict[str, Any]) -> None:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(4),
            wait=wait_exponential_jitter(initial=0.5, max=8),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        ):
            with attempt:
                response = await self._http_api.post("/v1/sales-intelligence", json=payload)
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
    worker = CloserWorker(settings)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, worker.request_stop)

    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
