"""Worker principal Poseidon."""

from __future__ import annotations

import asyncio
import json
import logging
import signal
from datetime import datetime, timezone
from pathlib import Path

import httpx
import redis.asyncio as aioredis

from poseidon.api_client import APIClient
from poseidon.config import Settings, get_settings
from poseidon.discovery import collect_hits, count_discovery_steps
from poseidon.intent import classify_hit
from poseidon.llm_client import LLMClient

logger = logging.getLogger(__name__)

SCAN_STATUS_KEY = "orion:poseidon:scan_status"
SCAN_SIGNAL_KEY = "orion:signal:poseidon_scan"


def configure_logging(service_name: str) -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format=f"%(asctime)s [{service_name}] %(levelname)s %(message)s",
    )
    return logging.getLogger(service_name)


def load_queries(path: str) -> list[str]:
    file_path = Path(path)
    if not file_path.exists():
        return []
    queries: list[str] = []
    for line in file_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        queries.append(stripped)
    return queries


async def publish_scan_status(redis, payload: dict) -> None:
    await redis.set(SCAN_STATUS_KEY, json.dumps(payload), ex=86400)


async def _merge_scan_status(redis, patch: dict) -> None:
    raw = await redis.get(SCAN_STATUS_KEY)
    base: dict = {}
    if raw:
        try:
            base = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            base = {}
    base.update(patch)
    await publish_scan_status(redis, base)


async def run_scan(settings: Settings, api: APIClient, redis) -> dict:
    queries = load_queries(settings.queries_file)
    http = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
    llm: LLMClient | None = None
    if settings.use_llm and settings.llm_api_key:
        llm = LLMClient(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout=settings.llm_timeout,
        )

    started = datetime.now(timezone.utc).isoformat()
    discovery_total = count_discovery_steps(settings, queries)
    await publish_scan_status(
        redis,
        {
            "active": True,
            "last_scan_at": started,
            "last_scan_found": 0,
            "last_scan_saved": 0,
            "last_error": None,
            "queries_count": discovery_total,
            "phase": "discovery",
            "progress_current": 0,
            "progress_total": discovery_total,
            "status_message": "Iniciando escaneo…",
        },
    )

    saved = 0
    llm_used = 0
    llm_disabled = False
    last_error: str | None = None
    found = 0

    async def report_discovery(current: int, total: int, message: str) -> None:
        await _merge_scan_status(
            redis,
            {
                "active": True,
                "phase": "discovery",
                "progress_current": current,
                "progress_total": total,
                "status_message": message,
            },
        )

    async def report_classify(current: int, total: int, message: str) -> None:
        await _merge_scan_status(
            redis,
            {
                "active": True,
                "phase": "classify",
                "progress_current": current,
                "progress_total": total,
                "status_message": message,
                "last_scan_found": total,
            },
        )

    try:
        hits = await collect_hits(
            settings,
            http,
            queries,
            on_progress=report_discovery,
        )
        found = len(hits)
        logger.info("poseidon_hits_collected found=%s", found)

        await _merge_scan_status(
            redis,
            {
                "phase": "classify",
                "progress_current": 0,
                "progress_total": max(found, 1),
                "status_message": f"{found} posts encontrados · clasificando…",
                "last_scan_found": found,
            },
        )

        if found == 0:
            last_error = (
                "No se encontraron posts recientes. "
                "Verifica Arctic Shift / SearXNG o amplía POSEIDON_MAX_POST_AGE_DAYS."
            )

        for index, hit in enumerate(hits, start=1):
            if index == 1 or index == found or index % 5 == 0:
                await report_classify(
                    index,
                    found,
                    f"Clasificando {index}/{found}… ({saved} guardadas)",
                )
            use_llm = llm is not None and not llm_disabled and llm_used < settings.max_llm_classifications
            verdict = await classify_hit(
                hit,
                llm=llm if use_llm else None,
                min_keyword=settings.min_keyword_score,
                min_intent=settings.min_intent_score,
                min_intent_no_llm=settings.min_intent_score_no_llm,
                require_spanish=settings.require_spanish,
            )
            if use_llm and verdict.llm_score is None and llm is not None:
                llm_disabled = True
                logger.warning("poseidon_llm_disabled keyword_fallback_only")
            if use_llm and verdict.llm_score is not None:
                llm_used += 1
            if not verdict.accepted:
                continue

            payload = {
                "source_url": hit.url,
                "platform": _platform_from_url(hit.url),
                "title": hit.title,
                "snippet": hit.snippet,
                "intent_category": verdict.intent_category,
                "intent_score": verdict.intent_score,
                "keyword_score": verdict.keyword_score,
                "llm_score": verdict.llm_score,
                "query_used": hit.query,
                "llm_summary": verdict.llm_summary,
                "reply_angle": verdict.reply_angle,
                "raw_metadata": {"search_query": hit.query},
            }
            try:
                await api.ingest_signal(payload)
                saved += 1
                logger.info(
                    "poseidon_signal_saved score=%s category=%s url=%s",
                    verdict.intent_score,
                    verdict.intent_category,
                    hit.url,
                )
            except Exception as exc:
                logger.warning("poseidon_ingest_failed", extra={"url": hit.url, "err": str(exc)})
    finally:
        await http.aclose()
        if llm is not None:
            await llm.aclose()

    finished = datetime.now(timezone.utc).isoformat()
    status = {
        "active": False,
        "last_scan_at": finished,
        "last_scan_found": found,
        "last_scan_saved": saved,
        "last_error": last_error if saved == 0 and found == 0 else None,
        "queries_count": discovery_total,
        "phase": "done",
        "progress_current": max(found, 1),
        "progress_total": max(found, 1),
        "status_message": f"Escaneo completado · {saved} guardadas de {found} encontradas",
    }
    await publish_scan_status(redis, status)
    return status


def _platform_from_url(url: str) -> str:
    lower = url.lower()
    if "reddit.com" in lower:
        return "reddit"
    if "quora.com" in lower:
        return "quora"
    if "workana.com" in lower:
        return "workana"
    if "freelancer.com" in lower:
        return "freelancer"
    if "linkedin.com" in lower:
        return "linkedin"
    return "forum"


async def wait_for_next_scan(redis, stop: asyncio.Event, settings: Settings) -> None:
    """Espera el intervalo pero reacciona al botón Escanear ahora."""
    elapsed = 0
    interval = settings.loop_interval_minutes * 60
    poll = max(2, settings.scan_poll_seconds)
    while elapsed < interval and not stop.is_set():
        if await redis.get(SCAN_SIGNAL_KEY) == "1":
            await redis.delete(SCAN_SIGNAL_KEY)
            logger.info("poseidon_scan_triggered_manual")
            return
        await asyncio.sleep(poll)
        elapsed += poll


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.service_name)
    logger.info(
        "poseidon_up interval_min=%s arctic=%s pullpush=%s searx=%s subreddits=%s",
        settings.loop_interval_minutes,
        settings.use_arctic_shift,
        settings.use_pullpush,
        settings.use_searx,
        len(settings.subreddit_scans),
    )

    api = APIClient(settings.api_base_url)
    redis = aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    stop = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    try:
        while not stop.is_set():
            if await redis.get(SCAN_SIGNAL_KEY) == "1":
                await redis.delete(SCAN_SIGNAL_KEY)

            logger.info("poseidon_scan_start")
            try:
                result = await run_scan(settings, api, redis)
                logger.info(
                    "poseidon_scan_done found=%s saved=%s error=%s",
                    result["last_scan_found"],
                    result["last_scan_saved"],
                    result.get("last_error"),
                )
            except Exception as exc:
                logger.exception("poseidon_scan_fatal", extra={"err": str(exc)})
                await publish_scan_status(
                    redis,
                    {
                        "active": False,
                        "last_scan_at": datetime.now(timezone.utc).isoformat(),
                        "last_scan_found": 0,
                        "last_scan_saved": 0,
                        "last_error": str(exc),
                        "queries_count": len(load_queries(settings.queries_file)),
                        "phase": "error",
                        "progress_current": 0,
                        "progress_total": 0,
                        "status_message": "Error en el escaneo",
                    },
                )

            await wait_for_next_scan(redis, stop, settings)
    finally:
        await api.aclose()
        await redis.aclose()
        logger.info("poseidon_stopped")


if __name__ == "__main__":
    asyncio.run(main())
