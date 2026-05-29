"""Configuración tipada cargada desde variables de entorno (.env)."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings inmutables para la API.

    Las variables se inyectan vía ``docker-compose`` con ``env_file: ./.env``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = Field(default="api", alias="SERVICE_NAME")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_secret_key: str = Field(default="change-me", alias="API_SECRET_KEY")
    api_cors_origins_raw: str = Field(
        default="http://localhost", alias="API_CORS_ORIGINS"
    )

    @property
    def api_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.api_cors_origins_raw.split(",") if origin.strip()]

    database_url: str = Field(..., alias="DATABASE_URL")
    database_pool_size: int = Field(default=10, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, alias="DATABASE_MAX_OVERFLOW")

    redis_url: str = Field(..., alias="REDIS_URL")
    queue_discovery: str = Field(default="siphon:queue:discovery", alias="QUEUE_DISCOVERY")
    queue_audit: str = Field(default="siphon:queue:audit", alias="QUEUE_AUDIT")
    queue_outreach: str = Field(default="siphon:queue:outreach", alias="QUEUE_OUTREACH")
    queue_sniper_alerts: str = Field(default="siphon:queue:sniper", alias="QUEUE_SNIPER_ALERTS")
    queue_dlq: str = Field(default="siphon:queue:dlq", alias="QUEUE_DLQ")

    email_provider: str = Field(default="resend", alias="EMAIL_PROVIDER")
    email_api_key: str = Field(default="", alias="EMAIL_API_KEY")
    email_from: str = Field(default="outreach@siphonx.dev", alias="EMAIL_FROM")
    email_from_name: str = Field(default="SIPHON-X Outreach", alias="EMAIL_FROM_NAME")

    sender_profile_website: str = Field(default="https://yoquelvis.dev", alias="SENDER_PROFILE_WEBSITE")

    # LLM settings (for Scout dork generation)
    llm_base_url: str = Field(default="https://api.deepseek.com", alias="LLM_BASE_URL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(default="deepseek-chat", alias="LLM_MODEL")

    # PDF Report Generation
    pdf_storage_path: str = Field(default="storage/reports", alias="PDF_STORAGE_PATH")
    pdf_generation_enabled: bool = Field(default=True, alias="PDF_GENERATION_ENABLED")
    pdf_max_size_mb: int = Field(default=5, alias="PDF_MAX_SIZE_MB")

    # Follow-Up Automation
    follow_up_enabled: bool = Field(default=True, alias="FOLLOW_UP_ENABLED")
    follow_up_poll_interval: int = Field(default=60, alias="FOLLOW_UP_POLL_INTERVAL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton (cache) para evitar releer ``.env`` en cada request."""

    return Settings()  # type: ignore[call-arg]
