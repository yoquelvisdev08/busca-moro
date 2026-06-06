"""Búsqueda de posts recientes vía PullPush (Reddit archive API)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

from poseidon.searx_client import SearchHit

logger = logging.getLogger(__name__)

_PULLPUSH_URL = "https://api.pullpush.io/reddit/search/submission/"
_SUPPLY_TITLE_RE = re.compile(r"^\[(for hire|hire me|offer)\]", re.IGNORECASE)


def normalize_query(raw: str) -> str:
    """Limpia dorks site: para búsqueda directa."""
    q = raw.strip()
    q = re.sub(r"site:\S+\s*", "", q, flags=re.IGNORECASE)
    q = q.replace('"', " ")
    q = re.sub(r"\s+", " ", q).strip()
    return q


def is_supply_side_title(title: str) -> bool:
    """Descarta freelancers ofreciendo servicios ([For Hire])."""
    return bool(_SUPPLY_TITLE_RE.match(title.strip()))


class PullPushClient:
    def __init__(self, client: httpx.AsyncClient, *, max_age_days: int = 120) -> None:
        self._client = client
        self._max_age_days = max_age_days

    async def search(
        self,
        query: str,
        *,
        limit: int = 20,
        subreddit: str | None = None,
    ) -> list[SearchHit]:
        cleaned = normalize_query(query)
        if not cleaned and not subreddit:
            return []

        params: dict[str, Any] = {
            "q": cleaned or "help",
            "size": min(limit, 50),
            "sort": "desc",
            "sort_type": "created_utc",
        }
        if subreddit:
            params["subreddit"] = subreddit

        try:
            response = await self._client.get(
                _PULLPUSH_URL,
                params=params,
                headers={"User-Agent": "OrionPoseidon/1.0 (+https://yoquelvis.dev)"},
            )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:
            logger.warning("pullpush_search_failed", extra={"query": cleaned, "subreddit": subreddit, "err": str(exc)})
            return []

        return self._parse_items(body.get("data") or [], query=cleaned or subreddit or "pullpush")

    async def search_subreddit(self, subreddit: str, query: str, *, limit: int = 20) -> list[SearchHit]:
        return await self.search(query, limit=limit, subreddit=subreddit)

    def _parse_items(self, items: list[dict[str, Any]], *, query: str) -> list[SearchHit]:
        cutoff = time.time() - (self._max_age_days * 86400)
        hits: list[SearchHit] = []
        seen: set[str] = set()

        for item in items:
            if not isinstance(item, dict):
                continue
            created = float(item.get("created_utc") or 0)
            if created and created < cutoff:
                continue

            title = str(item.get("title") or "").strip()
            if not title or is_supply_side_title(title):
                continue

            permalink = str(item.get("permalink") or "").strip()
            if not permalink:
                continue
            url = permalink if permalink.startswith("http") else f"https://www.reddit.com{permalink}"
            if url in seen:
                continue
            seen.add(url)

            snippet = str(item.get("selftext") or item.get("body") or "").strip()
            if not snippet:
                snippet = f"Subreddit: r/{item.get('subreddit', 'unknown')}"

            hits.append(
                SearchHit(
                    url=url,
                    title=title,
                    snippet=snippet[:600],
                    query=query,
                )
            )
        return hits
