"""Punto de entrada del Uptime Sniper.

Bootstrap:
1. Sincroniza el archivo ``sniper_targets.txt`` con la tabla ``sniper_targets``.
2. Arranca el loop de monitoreo.
"""

from __future__ import annotations

import asyncio
import logging
import signal
from pathlib import Path

import redis.asyncio as aioredis

from sniper.api_client import APIClient
from sniper.config import Settings, get_settings
from sniper.logging_setup import configure_logging
from sniper.monitor import UptimeMonitor


async def _sync_seeds(settings: Settings, api: APIClient, logger: logging.Logger) -> None:
    path = Path(settings.targets_file)
    if not path.exists():
        logger.info("no_seeds_file", extra={"path": str(path)})
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            await api.register_target(
                {
                    "url": line,
                    "interval_seconds": settings.interval_seconds,
                    "failure_threshold": settings.failure_threshold,
                    "enabled": True,
                }
            )
            logger.info("seed_registered", extra={"url": line})
        except Exception as exc:  # noqa: BLE001
            logger.warning("seed_register_failed", extra={"url": line, "err": str(exc)})


async def main() -> None:
    settings = get_settings()
    logger = configure_logging(settings.service_name)
    logger.info("sniper_up", extra={"interval": settings.interval_seconds})

    api = APIClient(settings.api_base_url)
    redis = aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    monitor = UptimeMonitor(settings=settings, api=api, redis=redis)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, monitor.request_stop)

    try:
        await _sync_seeds(settings, api, logger)
        await monitor.run()
    finally:
        await monitor.aclose()
        await api.aclose()
        await redis.aclose()
        logger.info("sniper_stopped")


if __name__ == "__main__":
    asyncio.run(main())
