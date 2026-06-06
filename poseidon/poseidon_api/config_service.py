"""Configuración operativa de Poseidon en Redis."""

from __future__ import annotations

import json
import os
from typing import Any

import redis.asyncio as aioredis

from poseidon_api.schemas import PoseidonConfig, PoseidonConfigUpdate

POSEIDON_CONFIG_KEY = "orion:config:poseidon"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def default_subreddit_scans() -> list[dict[str, str]]:
    return [
        {"subreddit": "spain", "query": "necesito ayuda pagina web"},
        {"subreddit": "spain", "query": "wordpress lento ayuda"},
        {"subreddit": "es", "query": "desarrollador web freelance"},
        {"subreddit": "es", "query": "presupuesto sitio web"},
        {"subreddit": "latam", "query": "busco desarrollador web español"},
        {"subreddit": "mexico", "query": "pagina web ayuda negocio"},
        {"subreddit": "argentina", "query": "sitio web presupuesto"},
        {"subreddit": "Colombia", "query": "wordpress ayuda"},
        {"subreddit": "chile", "query": "desarrollador web remoto"},
        {"subreddit": "Peru", "query": "pagina web pyme"},
        {"subreddit": "Venezuela", "query": "wordpress roto"},
        {"subreddit": "Uruguay", "query": "sitio web ayuda"},
        {"subreddit": "Ecuador", "query": "freelance web español"},
    ]


def default_query_subreddits() -> list[str]:
    return [
        "spain",
        "es",
        "latam",
        "mexico",
        "argentina",
        "Colombia",
        "chile",
        "Peru",
        "Venezuela",
        "Uruguay",
        "Ecuador",
    ]


def default_search_queries() -> list[str]:
    return [
        "necesito ayuda con mi pagina web",
        "busco desarrollador web freelance español",
        "wordpress lento no carga ayuda",
        "mi sitio web esta caido hosting",
        "presupuesto pagina web pyme",
        "cotizacion sitio web wordpress",
        "error 500 pagina web ayuda",
        "busco programador web remoto latam",
        "shopify tienda online ayuda",
    ]


def default_searx_domains() -> list[str]:
    return [
        "forocoches.com",
        "mediavida.com",
        "burbuja.info",
        "quora.com",
    ]


class PoseidonConfigService:
    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis

    @staticmethod
    def defaults_from_env() -> PoseidonConfig:
        return PoseidonConfig(
            loop_interval_minutes=_env_int("POSEIDON_LOOP_INTERVAL_MINUTES", 45),
            query_delay_seconds=_env_float("POSEIDON_QUERY_DELAY_SECONDS", 1.0),
            results_per_query=_env_int("POSEIDON_RESULTS_PER_QUERY", 20),
            max_post_age_days=_env_int("POSEIDON_MAX_POST_AGE_DAYS", 45),
            min_keyword_score=_env_int("POSEIDON_MIN_KEYWORD_SCORE", 25),
            min_intent_score=_env_int("POSEIDON_MIN_INTENT_SCORE", 45),
            min_intent_score_no_llm=_env_int("POSEIDON_MIN_INTENT_NO_LLM", 32),
            max_llm_classifications=_env_int("POSEIDON_MAX_LLM_PER_SCAN", 40),
            use_llm=_env_bool("POSEIDON_USE_LLM", True),
            use_arctic_shift=_env_bool("POSEIDON_USE_ARCTIC_SHIFT", True),
            use_pullpush=_env_bool("POSEIDON_USE_PULLPUSH", False),
            use_searx=_env_bool("POSEIDON_USE_SEARX", True),
            require_spanish=_env_bool("POSEIDON_REQUIRE_SPANISH", True),
            require_latam_or_spain=True,
            search_queries=default_search_queries(),
            subreddit_scans=default_subreddit_scans(),
            query_subreddits=default_query_subreddits(),
            searx_domains=default_searx_domains(),
        )

    async def get_config(self) -> PoseidonConfig:
        defaults = self.defaults_from_env()
        raw = await self._redis.get(POSEIDON_CONFIG_KEY)
        if not raw:
            return defaults
        try:
            data: dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            return defaults
        merged = {**defaults.model_dump(), **data}
        return PoseidonConfig.model_validate(merged)

    async def update_config(self, patch: PoseidonConfigUpdate) -> PoseidonConfig:
        current = await self.get_config()
        merged = current.model_dump()
        for key, value in patch.model_dump(exclude_unset=True).items():
            merged[key] = value
        config = PoseidonConfig.model_validate(merged)
        await self._redis.set(POSEIDON_CONFIG_KEY, json.dumps(config.model_dump()))
        return config
