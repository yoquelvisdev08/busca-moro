"""Cliente LLM mínimo para clasificar intención."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_SYSTEM = """Eres un clasificador de leads B2B para un consultor web freelance hispanohablante.
Analiza si el texto es una PERSONA o NEGOCIO pidiendo ayuda real (no un tutorial, noticia, oferta de empleo ni spam).
Responde SOLO JSON válido con este schema:
{
  "is_real_request": true,
  "intent_category": "web_dev|scraping|performance|hosting|wordpress|general",
  "confidence": 0-100,
  "summary": "una frase en español",
  "reply_angle": "cómo responder en 1 frase directa y humana"
}"""


class LLMClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout: int = 45,
    ) -> None:
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def classify_post(
        self,
        *,
        title: str,
        snippet: str,
        url: str,
        query: str,
    ) -> Optional[dict[str, Any]]:
        user = (
            f"Query de búsqueda: {query}\n"
            f"URL: {url}\n"
            f"Título: {title}\n"
            f"Texto: {snippet}\n"
        )
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": 280,
            "response_format": {"type": "json_object"},
        }
        response = await self._client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return None
        return parsed
