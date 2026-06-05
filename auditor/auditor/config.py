"""Settings tipados del Auditor."""

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

    service_name: str = Field(default="auditor", alias="SERVICE_NAME")

    redis_url: str = Field(..., alias="REDIS_URL")
    queue_audit: str = Field(default="orion:queue:audit", alias="QUEUE_AUDIT")
    queue_outreach: str = Field(default="orion:queue:outreach", alias="QUEUE_OUTREACH")
    queue_dlq: str = Field(default="orion:queue:dlq", alias="QUEUE_DLQ")

    api_base_url: str = Field(default="http://api:8000", alias="API_BASE_URL")

    concurrency: int = Field(default=4, alias="AUDITOR_CONCURRENCY")
    headless: bool = Field(default=True, alias="AUDITOR_HEADLESS")
    screenshot_dir: str = Field(default="/app/storage/screenshots", alias="AUDITOR_SCREENSHOT_DIR")
    viewport_width: int = Field(default=1366, alias="AUDITOR_VIEWPORT_WIDTH")
    viewport_height: int = Field(default=768, alias="AUDITOR_VIEWPORT_HEIGHT")
    nav_timeout_ms: int = Field(default=45000, alias="AUDITOR_NAV_TIMEOUT_MS")
    lighthouse_preset: str = Field(default="desktop", alias="AUDITOR_LIGHTHOUSE_PRESET")
    user_agents_file: str = Field(default="/app/config/user_agents.txt", alias="AUDITOR_USER_AGENTS_FILE")
    proxy_pool: Optional[str] = Field(default=None, alias="AUDITOR_PROXY_POOL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
