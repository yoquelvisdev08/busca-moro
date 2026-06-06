"""Búsqueda de posts recientes vía Arctic Shift (archivo Reddit actualizado)."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from poseidon.pullpush_client import is_supply_side_title
from poseidon.searx_client import SearchHit

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "https://arctic-shift.photon-reddit.com/api/posts/search"


def simplify_query(raw: str) -> str:
    """Reduce dorks/OR a una consulta compatible con Arctic Shift."""
    q = raw.strip()
    q = re.sub(r"site:\S+\s*", "", q, flags=re.IGNORECASE)
    q = q.replace('"', " ")
    if " OR " in q.upper():
        q = re.split(r"\s+OR\s+", q, flags=re.IGNORECASE)[0].strip()
    q = re.sub(r"\s+", " ", q).strip()
    return q


class ArcticShiftClient:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        base_url: str = _DEFAULT_BASE,
        max_age_days: int = 120,
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._max_age_days = max_age_days

    async def search_subreddit(
        self,
        subreddit: str,
        query: str,
        *,
        limit: int = 20,
    ) -> list[SearchHit]:
        cleaned = simplify_query(query)
        if not subreddit:
            return []

        after_date = (
            datetime.now(timezone.utc) - timedelta(days=self._max_age_days)
        ).strftime("%Y-%m-%d")

        params: dict[str, Any] = {
            "subreddit": subreddit,
            "after": after_date,
            "limit": min(limit, 100),
            "sort": "desc",
        }
        if cleaned.startswith("["):
            params["title"] = cleaned
        elif cleaned:
            params["query"] = cleaned
        else:
            return []

        try:
            response = await self._client.get(
                self._base_url,
                params=params,
                headers={"User-Agent": "OrionPoseidon/1.0 (+https://yoquelvis.dev)"},
            )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:
            logger.warning(
                "arctic_shift_search_failed subreddit=%s query=%s err=%s",
                subreddit,
                cleaned,
                exc,
            )
            return []

        label = cleaned or subreddit
        return self._parse_items(body.get("data") or [], query=f"r/{subreddit}:{label}")

    def _parse_items(self, items: list[dict[str, Any]], *, query: str) -> list[SearchHit]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self._max_age_days)
        hits: list[SearchHit] = []
        seen: set[str] = set()

        for item in items:
            if not isinstance(item, dict):
                continue

            created_raw = item.get("created_utc")
            if created_raw is None:
                continue
            created = datetime.fromtimestamp(float(created_raw), tz=timezone.utc)
            if created < cutoff:
                continue

            title = str(item.get("title") or "").strip()
            if not title or is_supply_side_title(title):
                continue

            post_id = str(item.get("id") or "").strip()
            permalink = str(item.get("permalink") or "").strip()
            if permalink:
                url = permalink if permalink.startswith("http") else f"https://www.reddit.com{permalink}"
            elif post_id:
                subreddit = str(item.get("subreddit") or "unknown")
                url = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/"
            else:
                continue

            if url in seen:
                continue
            seen.add(url)

            snippet = str(item.get("selftext") or "").strip()
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
