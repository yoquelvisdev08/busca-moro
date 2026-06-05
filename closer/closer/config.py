"""Settings tipados del worker Closer.

Las variables ``LLM_*`` son provider-agnósticas: cualquier proveedor compatible
con la API OpenAI (DeepSeek, OpenAI, Mistral, Groq, etc.) funciona apuntando
``LLM_BASE_URL`` al endpoint correspondiente.
"""

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

    service_name: str = Field(default="closer", alias="SERVICE_NAME")
    redis_url: str = Field(..., alias="REDIS_URL")
    queue_outreach: str = Field(default="orion:queue:outreach", alias="QUEUE_OUTREACH")
    queue_dlq: str = Field(default="orion:queue:dlq", alias="QUEUE_DLQ")

    api_base_url: str = Field(default="http://api:8000", alias="API_BASE_URL")

    llm_provider: str = Field(default="deepseek", alias="LLM_PROVIDER")
    llm_base_url: str = Field(default="https://api.deepseek.com", alias="LLM_BASE_URL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(default="deepseek-chat", alias="LLM_MODEL")
    llm_timeout: int = Field(default=60, alias="LLM_TIMEOUT")
    llm_max_tokens: int = Field(default=900, alias="LLM_MAX_TOKENS")

    concurrency: int = Field(default=2, alias="CLOSER_CONCURRENCY")
    max_pain_points: int = Field(default=3, alias="CLOSER_MAX_PAIN_POINTS")
    tone: str = Field(default="consultivo", alias="CLOSER_EMAIL_TONE")
    language: str = Field(default="es", alias="CLOSER_LANGUAGE")

    sender_profile_url: str = Field(default="", alias="SENDER_PROFILE_URL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
