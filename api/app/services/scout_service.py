"""Scout service: AI-powered dork generation + queue management."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class ScoutStartResult:
    success: bool
    dorks_generated: int
    seeds_count: int
    message: str


class ScoutService:
    """Genera dorks con IA y los encola para el Scout."""

    def __init__(
        self,
        llm_base_url: str = "https://api.deepseek.com",
        llm_api_key: str = "",
        llm_model: str = "deepseek-chat",
        redis_url: str = "redis://:e53cc2cec00c79ea078ca45b319ed2477cd555d46adde1c4@redis:6379/0",
    ):
        self._llm_base_url = llm_base_url
        self._llm_api_key = llm_api_key
        self._llm_model = llm_model
        self._redis_url = redis_url

    async def generate_dorks(
        self,
        industry: str,
        location: str = "",
        num_dorks: int = 15,
        language: str = "es",
    ) -> list[str]:
        """Genera Google dorks usando LLM para encontrar sitios del target."""
        location_part = f" en {location}" if location else ""

        system_prompt = f"""Eres un experto en Google dorking para lead generation B2B.
Tu trabajo es generar consultas de búsqueda (dorks) que encuentren sitios web
de {industry}{location_part} que probablemente necesiten mejoras en su web.

Reglas:
- Genera EXACTAMENTE {num_dorks} dorks
- Cada dork debe ser una línea
- Usa operadores avanzados: inurl:, intext:, intitle:, site:, -site:
- Enfocate en detectar sitios con problemas: WordPress viejo, Joomla, sitios lentos, sin SSL
- NO incluyas sitios grandes conocidos (no google.com, no facebook.com, etc.)
- Idioma de las consultas: {language}
- Devuelve SOLO los dorks, uno por línea, sin numeración ni explicación"""

        user_prompt = f"Genera {num_dorks} dorks para encontrar sitios de {industry}{location_part}"

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self._llm_base_url}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._llm_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2000,
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()

                # Parsear líneas, filtrar vacías
                dorks = [line.strip() for line in content.split("\n") if line.strip() and not line.startswith("#")]
                return dorks[:num_dorks]
        except Exception as e:
            logger.error(f"dork_generation_failed: {e}")
            return []

    async def start_discovery(
        self,
        industry: str,
        location: str = "",
        num_dorks: int = 15,
        language: str = "es",
    ) -> ScoutStartResult:
        """Genera dorks, los encola y dispara el Scout."""
        import redis

        # Generar dorks
        dorks = await self.generate_dorks(industry, location, num_dorks, language)
        if not dorks:
            return ScoutStartResult(
                success=False,
                dorks_generated=0,
                seeds_count=0,
                message="Failed to generate dorks. Check LLM configuration.",
            )

        # Encolar dorks en Redis
        try:
            r = redis.from_url(self._redis_url, decode_responses=True)
            queue_key = "siphon:queue:discovery"

            # Limpiar cola anterior (opcional)
            r.delete(queue_key)

            # Agregar dorks como mensajes JSON
            for dork in dorks:
                message = json.dumps({"type": "dork", "query": dork, "source": "ai_generated"})
                r.lpush(queue_key, message)

            # Señal para el Scout de que arranque YA
            r.set("siphon:signal:start", "1", ex=60)

            dorks_count = len(dorks)
            return ScoutStartResult(
                success=True,
                dorks_generated=dorks_count,
                seeds_count=0,
                message=f"Generated {dorks_count} dorks for '{industry}'{f' in {location}' if location else ''}. Scout started.",
            )
        except Exception as e:
            logger.error(f"redis_error: {e}")
            return ScoutStartResult(
                success=False,
                dorks_generated=len(dorks),
                seeds_count=0,
                message=f"Generated dorks but failed to enqueue: {e}",
            )
