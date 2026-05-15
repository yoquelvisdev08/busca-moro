"""Cliente HTTP del Sniper hacia la API."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

logger = logging.getLogger(__name__)


class APIClient:
    def __init__(self, base_url: str, timeout: float = 15.0) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def register_target(self, payload: dict[str, Any]) -> dict[str, Any]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.post("/v1/sniper/targets", json=payload)
                response.raise_for_status()
                return response.json()
        raise RuntimeError("unreachable")

    async def list_targets(self) -> list[dict[str, Any]]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.get("/v1/sniper/targets", params={"only_enabled": True})
                response.raise_for_status()
                return response.json()
        return []

    async def record_alert(self, payload: dict[str, Any]) -> dict[str, Any]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.post("/v1/sniper/alerts", json=payload)
                response.raise_for_status()
                return response.json()
        raise RuntimeError("unreachable")

    def _retries(self) -> AsyncRetrying:
        return AsyncRetrying(
            stop=stop_after_attempt(5),
            wait=wait_exponential_jitter(initial=0.5, max=10),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        )
