"""Bus de tareas sobre Redis (listas LPUSH/BRPOP)."""

from __future__ import annotations

import logging
from typing import Any

import orjson
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class QueueService:
    """Wrapper fino y tipado sobre Redis Lists.

    Justificación de no usar Celery aquí: la API solo *publica*. Los workers
    (Go Scout, Python Auditor, Python Closer, Python Sniper) consumen con la
    primitiva que mejor se acomoda a su stack (BRPOP en Python, BRPOP en Go).
    Esto evita la sobrecarga de Celery en workers Go.
    """

    def __init__(self, redis_client: aioredis.Redis) -> None:
        self._redis = redis_client

    async def enqueue(self, queue: str, payload: dict[str, Any]) -> int:
        """Publica un mensaje serializado en JSON. Devuelve el largo de la cola."""

        body = orjson.dumps(payload)
        length = await self._redis.lpush(queue, body)
        logger.debug("enqueued", extra={"queue": queue, "length": length})
        return int(length)

    async def length(self, queue: str) -> int:
        return int(await self._redis.llen(queue))

    async def send_to_dlq(self, dlq: str, payload: dict[str, Any], error: str) -> None:
        body = orjson.dumps({"payload": payload, "error": error})
        await self._redis.lpush(dlq, body)
