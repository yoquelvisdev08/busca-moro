"""Cliente Redis asíncrono compartido por la API."""

from __future__ import annotations

from typing import Optional

import redis.asyncio as aioredis

from app.core.config import get_settings

_client: Optional[aioredis.Redis] = None


def get_redis() -> aioredis.Redis:
    """Devuelve un cliente Redis singleton listo para usar."""

    global _client
    if _client is None:
        settings = get_settings()
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            health_check_interval=30,
        )
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
