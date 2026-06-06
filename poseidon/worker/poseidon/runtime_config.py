"""Configuración efectiva del escaneo (env + API Redis)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from poseidon.config import Settings


@dataclass(frozen=True)
class ScanConfig:
    loop_interval_minutes: int
    query_delay_seconds: float
    results_per_query: int
    max_post_age_days: int
    min_keyword_score: int
    min_intent_score: int
    min_intent_score_no_llm: int
    max_llm_classifications: int
    use_llm: bool
    use_arctic_shift: bool
    use_pullpush: bool
    use_searx: bool
    require_spanish: bool
    require_latam_or_spain: bool
    search_queries: list[str]
    subreddit_scans: list[tuple[str, str]]
    query_subreddits: list[str]
    searx_domains: list[str]


def build_scan_config(settings: Settings, remote: dict[str, Any] | None) -> ScanConfig:
    data = remote or {}
    subreddit_scans: list[tuple[str, str]] = []
    for item in data.get("subreddit_scans") or settings.subreddit_scans:
        if isinstance(item, dict):
            sub = str(item.get("subreddit") or "").strip()
            query = str(item.get("query") or "").strip()
            if sub and query:
                subreddit_scans.append((sub, query))
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            subreddit_scans.append((str(item[0]).strip(), str(item[1]).strip()))

    search_queries = [
        str(q).strip()
        for q in (data.get("search_queries") or [])
        if str(q).strip()
    ]
    if not search_queries:
        search_queries = _load_file_queries(settings.queries_file)

    query_subreddits = [
        str(s).strip()
        for s in (data.get("query_subreddits") or settings.query_subreddits)
        if str(s).strip()
    ]
    searx_domains = [
        str(d).strip().lower().removeprefix("www.")
        for d in (data.get("searx_domains") or [])
        if str(d).strip()
    ]

    return ScanConfig(
        loop_interval_minutes=int(data.get("loop_interval_minutes") or settings.loop_interval_minutes),
        query_delay_seconds=float(data.get("query_delay_seconds") or settings.query_delay_seconds),
        results_per_query=int(data.get("results_per_query") or settings.results_per_query),
        max_post_age_days=int(data.get("max_post_age_days") or settings.max_post_age_days),
        min_keyword_score=int(data.get("min_keyword_score") or settings.min_keyword_score),
        min_intent_score=int(data.get("min_intent_score") or settings.min_intent_score),
        min_intent_score_no_llm=int(
            data.get("min_intent_score_no_llm") or settings.min_intent_score_no_llm
        ),
        max_llm_classifications=int(
            data.get("max_llm_classifications") or settings.max_llm_classifications
        ),
        use_llm=bool(data.get("use_llm") if "use_llm" in data else settings.use_llm),
        use_arctic_shift=bool(
            data.get("use_arctic_shift") if "use_arctic_shift" in data else settings.use_arctic_shift
        ),
        use_pullpush=bool(
            data.get("use_pullpush") if "use_pullpush" in data else settings.use_pullpush
        ),
        use_searx=bool(data.get("use_searx") if "use_searx" in data else settings.use_searx),
        require_spanish=bool(
            data.get("require_spanish") if "require_spanish" in data else settings.require_spanish
        ),
        require_latam_or_spain=bool(
            data.get("require_latam_or_spain")
            if "require_latam_or_spain" in data
            else settings.require_latam_or_spain
        ),
        search_queries=search_queries,
        subreddit_scans=subreddit_scans or settings.subreddit_scans,
        query_subreddits=query_subreddits or settings.query_subreddits,
        searx_domains=searx_domains,
    )


def _load_file_queries(path: str) -> list[str]:
    from pathlib import Path

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
