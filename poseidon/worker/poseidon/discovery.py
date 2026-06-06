"""Agrega fuentes de descubrimiento Poseidon."""

from __future__ import annotations

import asyncio
import logging

import httpx

from poseidon.arctic_shift_client import ArcticShiftClient
from poseidon.config import Settings
from poseidon.pullpush_client import PullPushClient
from poseidon.searx_client import SearchHit, SearXNGClient

logger = logging.getLogger(__name__)


async def collect_hits(
    settings: Settings,
    http: httpx.AsyncClient,
    queries: list[str],
) -> list[SearchHit]:
    merged: list[SearchHit] = []
    seen: set[str] = set()

    def add_batch(batch: list[SearchHit], source: str) -> None:
        added = 0
        for hit in batch:
            if hit.url in seen:
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

    if settings.use_arctic_shift:
        arctic = ArcticShiftClient(
            http,
            base_url=settings.arctic_shift_url,
            max_age_days=settings.max_post_age_days,
        )
        for subreddit, sub_query in settings.subreddit_scans:
            batch = await arctic.search_subreddit(
                subreddit,
                sub_query,
                limit=settings.results_per_query,
            )
            add_batch(batch, f"arctic:r/{subreddit}")
            await _sleep(settings.query_delay_seconds)

        for query in queries:
            cleaned = query.strip()
            if not cleaned:
                continue
            for subreddit in settings.query_subreddits:
                batch = await arctic.search_subreddit(
                    subreddit,
                    cleaned,
                    limit=min(settings.results_per_query, 10),
                )
                add_batch(batch, f"arctic:q/{subreddit}")
                await _sleep(settings.query_delay_seconds)

    if settings.use_pullpush:
        pullpush = PullPushClient(http, max_age_days=settings.pullpush_max_age_days)
        for subreddit, sub_query in settings.subreddit_scans:
            batch = await pullpush.search_subreddit(
                subreddit,
                sub_query,
                limit=settings.results_per_query,
            )
            add_batch(batch, f"pullpush:r/{subreddit}")
            await _sleep(settings.query_delay_seconds)

    if settings.use_searx:
        searx = SearXNGClient(settings.searxng_url, http)
        for query in queries:
            cleaned = query.strip()
            if not cleaned:
                continue
            try:
                batch = await searx.search(cleaned, limit=settings.results_per_query)
                add_batch(batch, "searxng")
            except Exception as exc:
                logger.warning("poseidon_searx_failed query=%s err=%s", cleaned, exc)
            await _sleep(settings.query_delay_seconds)

    return merged


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)
