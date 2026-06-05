#!/usr/bin/env python3
"""Reencola mensajes closer_failed de la DLQ hacia orion:queue:outreach.

Ejecutar dentro del contenedor API (tiene acceso a Redis y Postgres):

    docker compose exec api python /app/scripts/requeue-dlq-closer.py

Opciones:
    --dry-run   Solo muestra cuántos se reencolarían
    --all       Reencola todos los closer_failed (incluso si ya tienen intel)
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import orjson
import redis.asyncio as aioredis
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import get_session_factory


def _parse_dlq_entry(raw: str) -> tuple[str, dict] | None:
    try:
        env = orjson.loads(raw)
    except orjson.JSONDecodeError:
        return None
    reason = str(env.get("reason", ""))
    if not reason.startswith("closer_failed"):
        return None
    payload_raw = env.get("payload", "")
    try:
        msg = (
            orjson.loads(payload_raw)
            if isinstance(payload_raw, (str, bytes))
            else payload_raw
        )
    except orjson.JSONDecodeError:
        return None
    if not isinstance(msg, dict) or not msg.get("lead_id"):
        return None
    return raw, msg


async def _lead_ids_with_intel(session, lead_ids: list[str]) -> set[str]:
    if not lead_ids:
        return set()
    result = await session.execute(
        text(
            "SELECT DISTINCT lead_id::text FROM sales_intelligence "
            "WHERE lead_id = ANY(CAST(:ids AS uuid[]))"
        ),
        {"ids": lead_ids},
    )
    return {row[0] for row in result}


async def main() -> int:
    parser = argparse.ArgumentParser(description="Reencola closer_failed desde DLQ")
    parser.add_argument("--dry-run", action="store_true", help="No modifica Redis")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Incluir leads que ya tienen sales_intelligence",
    )
    args = parser.parse_args()

    settings = get_settings()
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    dlq_key = settings.queue_dlq
    outreach_key = settings.queue_outreach

    raw_items = await redis.lrange(dlq_key, 0, -1)
    parsed: list[tuple[str, dict]] = []
    skipped_other = 0
    for raw in raw_items:
        item = _parse_dlq_entry(raw)
        if item is None:
            skipped_other += 1
            continue
        parsed.append(item)

    lead_ids = [msg["lead_id"] for _, msg in parsed]
    factory = get_session_factory()
    async with factory() as session:
        already = await _lead_ids_with_intel(session, lead_ids)

    to_requeue: list[tuple[str, dict]] = []
    to_keep_in_dlq: list[str] = []
    for raw, msg in parsed:
        if not args.all and msg["lead_id"] in already:
            to_keep_in_dlq.append(raw)
            continue
        to_requeue.append((raw, msg))

    print(f"DLQ total: {len(raw_items)}")
    print(f"closer_failed parseables: {len(parsed)}")
    print(f"otros / invalidos: {skipped_other}")
    print(f"ya con sales_intelligence: {len(already)}")
    print(f"a reencolar: {len(to_requeue)}")
    print(f"permanecen en DLQ: {len(to_keep_in_dlq) + skipped_other}")

    if args.dry_run:
        await redis.aclose()
        return 0

    if not to_requeue and not to_keep_in_dlq and skipped_other == len(raw_items):
        print("Nada que hacer.")
        await redis.aclose()
        return 0

    requeued = 0
    for _, msg in to_requeue:
        await redis.lpush(outreach_key, orjson.dumps(msg).decode())
        requeued += 1

    # Reconstruir DLQ: conservar no-closer + closer ya procesados
    new_dlq: list[str] = []
    requeued_raws = {raw for raw, _ in to_requeue}
    for raw in raw_items:
        if raw in requeued_raws:
            continue
        new_dlq.append(raw)

    pipe = redis.pipeline()
    pipe.delete(dlq_key)
    if new_dlq:
        pipe.rpush(dlq_key, *new_dlq)
    await pipe.execute()

    print(f"Reencolados en {outreach_key}: {requeued}")
    print(f"DLQ restante: {len(new_dlq)}")
    await redis.aclose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
