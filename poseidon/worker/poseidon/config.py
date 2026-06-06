"""Settings del worker Poseidon."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = Field(default="poseidon", alias="SERVICE_NAME")
    redis_url: str = Field(..., alias="REDIS_URL")
    api_base_url: str = Field(default="http://api:8000", alias="API_BASE_URL")
    searxng_url: str = Field(default="http://searxng:8080", alias="SEARXNG_URL")

    loop_interval_minutes: int = Field(default=45, alias="POSEIDON_LOOP_INTERVAL_MINUTES")
    query_delay_seconds: float = Field(default=1.0, alias="POSEIDON_QUERY_DELAY_SECONDS")
    scan_poll_seconds: int = Field(default=5, alias="POSEIDON_SCAN_POLL_SECONDS")
    queries_file: str = Field(
        default="/app/config/queries.txt", alias="POSEIDON_QUERIES_FILE"
    )
    results_per_query: int = Field(default=20, alias="POSEIDON_RESULTS_PER_QUERY")
    max_post_age_days: int = Field(default=120, alias="POSEIDON_MAX_POST_AGE_DAYS")
    min_keyword_score: int = Field(default=25, alias="POSEIDON_MIN_KEYWORD_SCORE")
    min_intent_score: int = Field(default=45, alias="POSEIDON_MIN_INTENT_SCORE")
    min_intent_score_no_llm: int = Field(default=32, alias="POSEIDON_MIN_INTENT_NO_LLM")
    max_llm_classifications: int = Field(default=20, alias="POSEIDON_MAX_LLM_PER_SCAN")
    use_llm: bool = Field(default=True, alias="POSEIDON_USE_LLM")
    use_arctic_shift: bool = Field(default=True, alias="POSEIDON_USE_ARCTIC_SHIFT")
    arctic_shift_url: str = Field(
        default="https://arctic-shift.photon-reddit.com/api/posts/search",
        alias="POSEIDON_ARCTIC_SHIFT_URL",
    )
    use_pullpush: bool = Field(default=False, alias="POSEIDON_USE_PULLPUSH")
    pullpush_max_age_days: int = Field(default=400, alias="POSEIDON_PULLPUSH_MAX_AGE_DAYS")
    require_spanish: bool = Field(default=True, alias="POSEIDON_REQUIRE_SPANISH")
    use_searx: bool = Field(default=True, alias="POSEIDON_USE_SEARX")
    require_latam_or_spain: bool = Field(default=True, alias="POSEIDON_REQUIRE_LATAM")
    subreddit_scans: list[tuple[str, str]] = Field(default_factory=list)
    query_subreddits: list[str] = Field(default_factory=list)

    llm_base_url: str = Field(default="https://api.deepseek.com", alias="LLM_BASE_URL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(default="deepseek-chat", alias="LLM_MODEL")
    llm_timeout: int = Field(default=45, alias="LLM_TIMEOUT")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()  # type: ignore[call-arg]
    if not settings.subreddit_scans:
        settings.subreddit_scans = _default_subreddit_scans()
    if not settings.query_subreddits:
        settings.query_subreddits = _default_query_subreddits()
    return settings


def _default_subreddit_scans() -> list[tuple[str, str]]:
    return [
        ("spain", "pagina web ayuda"),
        ("spain", "desarrollador web"),
        ("es", "wordpress ayuda"),
        ("es", "pagina web"),
        ("latam", "desarrollador web"),
        ("latam", "pagina web ayuda"),
        ("mexico", "desarrollador web"),
        ("argentina", "pagina web"),
        ("Colombia", "sitio web ayuda"),
        ("chile", "desarrollador web"),
        ("Peru", "pagina web"),
        ("Venezuela", "wordpress ayuda"),
    ]


def _default_query_subreddits() -> list[str]:
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
