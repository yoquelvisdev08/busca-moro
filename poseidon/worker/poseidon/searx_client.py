"""Búsqueda de posts con intención vía SearXNG."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

_POST_HOST_HINTS = (
    "reddit.com",
    "quora.com",
    "stackoverflow.com",
    "workana.com",
    "freelancer.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "forocoches.com",
    "mediavida.com",
    "burbuja.info",
    "emudesc.com",
    "groups.google.com",
)

_POST_PATH_HINTS = (
    "/comments/",
    "/questions/",
    "/projects/",
    "/posts/",
    "/status/",
    "/thread",
    "/tema",
)

_SKIP_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "facebook.com",
        "www.facebook.com",
        "instagram.com",
        "wikipedia.org",
        "amazon.com",
        "mercadolibre.com",
    }
)


@dataclass
class SearchHit:
    url: str
    title: str
    snippet: str
    query: str


class SearXNGClient:
    def __init__(self, base_url: str, client: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client

    async def search(self, query: str, limit: int = 25) -> list[SearchHit]:
        response = await self._client.get(
            f"{self._base_url}/search",
            params={
                "q": query,
                "format": "json",
                "categories": "general",
                "engines": "google,bing",
                "pageno": "1",
            },
        )
        response.raise_for_status()
        body: dict[str, Any] = response.json()
        hits: list[SearchHit] = []
        seen: set[str] = set()

        for item in body.get("results") or []:
            if len(hits) >= limit:
                break
            url = str(item.get("url") or "").strip()
            if not url or url in seen:
                continue
            if not _looks_like_post(url):
                continue
            seen.add(url)
            hits.append(
                SearchHit(
                    url=url,
                    title=str(item.get("title") or "").strip(),
                    snippet=_clean_snippet(str(item.get("content") or item.get("snippet") or "")),
                    query=query,
                )
            )
        return hits


def _looks_like_post(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host in _SKIP_HOSTS:
        return False
    path = (parsed.path or "").lower()
    if any(h in host for h in _POST_HOST_HINTS):
        if any(h in host for h in ("reddit.com", "quora.com", "workana.com", "freelancer.com")):
            return True
        if any(p in path for p in _POST_PATH_HINTS):
            return True
    if "foro" in host or "forum" in host:
        return True
    return False


def _clean_snippet(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:600]
