"""Cliente LLM compartido (OpenAI-compatible) para API y reportes."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.llm_base_url).rstrip("/")
        self._api_key = api_key if api_key is not None else settings.llm_api_key
        self._model = model or settings.llm_model
        self._timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self._api_key and self._api_key.strip())

    async def chat_json(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.45,
        max_tokens: int = 2500,
    ) -> Optional[dict[str, Any]]:
        if not self.enabled:
            return None
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    f"{self._base_url}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "response_format": {"type": "json_object"},
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                return json.loads(content)
        except Exception as exc:
            logger.error("llm_chat_json_failed: %s", exc)
            return None
