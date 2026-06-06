"""Cliente HTTP hacia la API Orion."""

from __future__ import annotations

from typing import Any

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter


class APIClient:
    def __init__(self, base_url: str, timeout: float = 20.0) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def ingest_signal(self, payload: dict[str, Any]) -> dict[str, Any]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.post("/v1/poseidon/signals", json=payload)
                response.raise_for_status()
                return response.json()
        raise RuntimeError("unreachable")

    async def get_config(self) -> dict[str, Any]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.get("/v1/poseidon/config")
                response.raise_for_status()
                body = response.json()
                if isinstance(body, dict):
                    return body
                return {}
        return {}

    def _retries(self) -> AsyncRetrying:
        return AsyncRetrying(
            stop=stop_after_attempt(4),
            wait=wait_exponential_jitter(initial=0.5, max=8),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        )
