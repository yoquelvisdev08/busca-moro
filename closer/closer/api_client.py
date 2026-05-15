"""Cliente HTTP del Closer hacia la API."""

from __future__ import annotations

import uuid
from typing import Any, Optional

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter


class APIClient:
    def __init__(self, base_url: str, timeout: float = 20.0) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_lead(self, lead_id: uuid.UUID | str) -> Optional[dict[str, Any]]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.get(f"/v1/leads/{lead_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                return response.json()
        return None

    async def latest_audit_for_lead(self, lead_id: uuid.UUID | str) -> Optional[dict[str, Any]]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.get(f"/v1/audits/lead/{lead_id}")
                response.raise_for_status()
                items = response.json()
        if not items:
            return None
        return items[0]

    async def get_audit(self, audit_id: uuid.UUID | str) -> Optional[dict[str, Any]]:
        async for attempt in self._retries():
            with attempt:
                response = await self._client.get(f"/v1/audits/{audit_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                return response.json()
        return None

    def _retries(self) -> AsyncRetrying:
        return AsyncRetrying(
            stop=stop_after_attempt(4),
            wait=wait_exponential_jitter(initial=0.5, max=6),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        )
