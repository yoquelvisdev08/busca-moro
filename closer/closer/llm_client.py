"""Cliente LLM asíncrono compatible con la API OpenAI (`/chat/completions`).

DeepSeek expone una API plenamente compatible con el SDK de OpenAI, así que un
solo cliente nos sirve para DeepSeek, OpenAI o cualquier proveedor que respete
ese contrato. Esto desacopla al Closer de un proveedor concreto y nos permite
intercambiarlo cambiando dos variables de entorno: ``LLM_BASE_URL`` y
``LLM_API_KEY``.

Referencias:
- DeepSeek API Docs: https://api-docs.deepseek.com
- OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Error operacional del proveedor LLM (HTTP no-2xx, payload inválido, etc)."""


@dataclass(slots=True)
class LLMResponse:
    content: str
    raw: dict[str, Any]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    model: Optional[str]


class LLMClient:
    """Wrapper fino sobre `/chat/completions` de cualquier proveedor OpenAI-compatible.

    Args:
        base_url: URL base del proveedor (ej. ``https://api.deepseek.com``).
        api_key:  API key Bearer.
        model:    Modelo a usar (ej. ``deepseek-chat``, ``deepseek-v4-pro``).
        timeout:  Timeout HTTP en segundos.
        provider: Nombre del proveedor (para logging/tracing, no funcional).
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout: int = 60,
        provider: str = "openai_compatible",
    ) -> None:
        if not api_key:
            raise ValueError("LLMClient requiere un API key no vacío")

        self._provider = provider
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def chat(
        self,
        *,
        system: str,
        user: str,
        json_response: bool = False,
        temperature: float = 0.4,
        max_tokens: int = 800,
    ) -> LLMResponse:
        """Invoca `/chat/completions` con un mensaje system + user.

        Cuando ``json_response`` es True, se solicita ``response_format=json_object``
        (soportado por DeepSeek y OpenAI), lo que asegura un JSON válido en la
        respuesta del modelo.
        """

        payload: dict[str, Any] = {
            "model": self._model,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_response:
            payload["response_format"] = {"type": "json_object"}

        data: dict[str, Any] = {}
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential_jitter(initial=1, max=10),
            retry=retry_if_exception_type((httpx.HTTPError, LLMError)),
            reraise=True,
        ):
            with attempt:
                response = await self._client.post("/chat/completions", json=payload)
                if response.status_code >= 500:
                    raise LLMError(
                        f"{self._provider} {response.status_code}: {response.text[:200]}"
                    )
                response.raise_for_status()
                data = response.json()

        choices = data.get("choices") or []
        if not choices:
            raise LLMError(f"respuesta vacía del proveedor {self._provider}: {data}")

        message = choices[0].get("message") or {}
        content = (message.get("content") or "").strip()

        usage = data.get("usage") or {}
        return LLMResponse(
            content=content,
            raw=data,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            model=data.get("model") or self._model,
        )

    @staticmethod
    def safe_json_loads(content: str) -> Optional[dict[str, Any]]:
        """Parsea JSON tolerando fences ```json y texto adicional alrededor."""

        if not content:
            return None
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].lstrip()
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass

        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                return None
        return None
