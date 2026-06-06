"""Recolecta hits desde Arctic Shift, PullPush y SearXNG."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

import httpx

from poseidon.arctic_shift_client import ArcticShiftClient
from poseidon.config import Settings
from poseidon.pullpush_client import PullPushClient
from poseidon.runtime_config import ScanConfig
from poseidon.quality_filters import is_discovery_hit_allowed
from poseidon.searx_client import SearchHit, SearXNGClient

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[int, int, str], Awaitable[None]]


def count_discovery_steps(scan: ScanConfig) -> int:
    steps = 0
    cleaned = [query.strip() for query in scan.search_queries if query.strip()]

    if scan.use_arctic_shift:
        steps += len(scan.subreddit_scans)
        steps += len(cleaned) * len(scan.query_subreddits)

    if scan.use_pullpush:
        steps += len(scan.subreddit_scans)

    if scan.use_searx:
        steps += len(cleaned) if scan.searx_domains else 0

    return max(steps, 1)


async def collect_hits(
    settings: Settings,
    scan: ScanConfig,
    http: httpx.AsyncClient,
    *,
    on_progress: ProgressCallback | None = None,
) -> list[SearchHit]:
    merged: list[SearchHit] = []
    seen: set[str] = set()
    total_steps = count_discovery_steps(scan)
    step = 0

    async def report_progress(message: str) -> None:
        nonlocal step
        step += 1
        if on_progress is not None:
            await on_progress(step, total_steps, message)

    def add_batch(batch: list[SearchHit], source: str) -> None:
        added = 0
        for hit in batch:
            if hit.url in seen:
                continue
            if not is_discovery_hit_allowed(hit):
                continue
            seen.add(hit.url)
            merged.append(hit)
            added += 1
        if batch:
            logger.info(
                "poseidon_source_batch source=%s raw=%s added=%s query=%s",
                source,
                len(batch),
                added,
                batch[0].query,
            )

    if scan.use_arctic_shift:
        arctic = ArcticShiftClient(
            http,
            base_url=settings.arctic_shift_url,
            max_age_days=scan.max_post_age_days,
        )
        for subreddit, sub_query in scan.subreddit_scans:
            batch = await arctic.search_subreddit(
                subreddit,
                sub_query,
                limit=scan.results_per_query,
            )
            add_batch(batch, f"arctic:r/{subreddit}")
            await report_progress(f"Buscando r/{subreddit}…")
            await _sleep(scan.query_delay_seconds)

        for query in scan.search_queries:
            cleaned = query.strip()
            if not cleaned:
                continue
            for subreddit in scan.query_subreddits:
                batch = await arctic.search_subreddit(
                    subreddit,
                    cleaned,
                    limit=min(scan.results_per_query, 12),
                )
                add_batch(batch, f"arctic:q/{subreddit}")
                await report_progress(f"Buscando «{cleaned[:40]}» en r/{subreddit}…")
                await _sleep(scan.query_delay_seconds)

    if scan.use_pullpush:
        pullpush = PullPushClient(http, max_age_days=settings.pullpush_max_age_days)
        for subreddit, sub_query in scan.subreddit_scans:
            batch = await pullpush.search_subreddit(
                subreddit,
                sub_query,
                limit=scan.results_per_query,
            )
            add_batch(batch, f"pullpush:r/{subreddit}")
            await report_progress(f"PullPush r/{subreddit}…")
            await _sleep(scan.query_delay_seconds)

    if scan.use_searx and scan.searx_domains:
        searx = SearXNGClient(settings.searxng_url, http)
        for query in scan.search_queries:
            cleaned = query.strip()
            if not cleaned:
                continue
            try:
                batch = await searx.search_sites(
                    cleaned,
                    scan.searx_domains,
                    limit=scan.results_per_query,
                )
                add_batch(batch, "searxng:sites")
            except Exception as exc:
                logger.warning(
                    "poseidon_searx_sites_failed query=%s err=%s",
                    cleaned,
                    exc,
                )
            await report_progress(f"Foros «{cleaned[:32]}»…")
            await _sleep(scan.query_delay_seconds)

    return merged


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)
