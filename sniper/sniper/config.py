"""Settings tipados del Sniper."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = Field(default="sniper", alias="SERVICE_NAME")
    redis_url: str = Field(..., alias="REDIS_URL")
    queue_sniper_alerts: str = Field(default="orion:queue:sniper", alias="QUEUE_SNIPER_ALERTS")

    api_base_url: str = Field(default="http://api:8000", alias="API_BASE_URL")

    targets_file: str = Field(default="/app/config/sniper_targets.txt", alias="SNIPER_TARGETS_FILE")
    interval_seconds: int = Field(default=60, alias="SNIPER_INTERVAL_SECONDS")
    failure_threshold: int = Field(default=3, alias="SNIPER_FAILURE_THRESHOLD")
    webhook_url: Optional[str] = Field(default=None, alias="SNIPER_WEBHOOK_URL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
