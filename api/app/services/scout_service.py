"""Scout service: AI-powered dork generation + queue management."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Países donde las consultas en inglés suelen rendir mejor en buscadores.
_ENGLISH_MARKETS = frozenset(
    {
        "Estados Unidos",
        "Canadá",
        "Reino Unido",
        "Australia",
        "Irlanda",
        "Nueva Zelanda",
        "Singapur",
        "India",
        "Sudáfrica",
    }
)

_PORTUGUESE_MARKETS = frozenset({"Brasil", "Portugal"})


def language_for_location(location: str) -> str:
    if not location:
        return "es"
    if location in _PORTUGUESE_MARKETS:
        return "pt"
    if location in _ENGLISH_MARKETS:
        return "en"
    return "es"


def build_dork_prompts(
    industry: str,
    location: str,
    num_dorks: int,
    language: str,
) -> tuple[str, str]:
    """Prompts orientados a PYMEs que pueden pagar optimización web."""
    location_clause = f" en {location}" if location else ""
    lang_note = {
        "es": "español",
        "en": "inglés",
        "pt": "portugués",
    }.get(language, language)

    system_prompt = f"""Eres un experto en prospección B2B para un consultor senior de desarrollo web,
rendimiento, SEO técnico y conversión.

OBJETIVO: generar simples consultas de búsqueda por palabras clave que encuentren negocios REALES
(no blogs personales ni directorios) de {industry}{location_clause} que:
- Vendan servicios o productos y dependan de su web para captar clientes
- Tengan presupuesto (clínicas, bufetes, inmobiliarias, hoteles, academias, e-commerce pequeño/mediano)
- Probablemente tengan web lenta, antigua, WordPress desactualizado, sin HTTPS o mala experiencia móvil
- NECESITEN contratar a un profesional (no equipos enterprise con web perfecta)

REGLAS CRÍTICAS (LEER Y OBEDECER):
1. Genera EXACTAMENTE {num_dorks} consultas, una por línea
2. NO uses operadores de búsqueda avanzada: PROHIBIDO site:, inurl:, intitle:, intext:, -site:, *, OR, |
3. Usa SOLO lenguaje natural con palabras clave simples
4. Cada consulta debe tener entre 3 y 6 palabras
5. Incluye la ubicación "{location}" de forma natural en las consultas (nombre de ciudad, país)
6. Mezcla diferentes combinaciones de:
   - Palabras del nicho (ej: "clínica dental", "dentista", "odontología")
   - Señales de negocio real (ej: contacto, servicios, precios, cita, horarios, tratamientos)
   - Nombres de ciudades/ubicaciones relevantes de {location}

EJEMPLOS DE CONSULTAS CORRECTAS (SearXNG-compatible):
- "clínica dental Santo Domingo"
- "dentista República Dominicana contacto"
- "odontología Punta Cana servicios"
- "consultorio dental Santiago de los Caballeros"
- "dentista La Romana precios"

EJEMPLOS DE CONSULTAS PROHIBIDAS (NO generar):
- "site:*.com.do intext:\"tratamiento dental\" intext:\"precio\""
- "site:do \"dentista\" (inurl:contacto | inurl:cita)"
- "inurl:contacto OR inurl:cita intitle:dentista"

FORMATO:
- Sin numeración, sin explicación, sin markdown
- Idioma de las consultas: {lang_note}
- Cada consulta debe ser una búsqueda ejecutable en cualquier motor de búsqueda (Google, Bing, DuckDuckGo, SearXNG)"""

    user_prompt = (
        f"Genera {num_dorks} consultas de búsqueda simples para prospectar {industry}{location_clause}. "
        "Prioriza negocios que pagarían entre 800 y 8000 USD por mejorar su web."
    )
    return system_prompt, user_prompt


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
        language: Optional[str] = None,
    ) -> list[str]:
        """Genera consultas de búsqueda por palabras clave usando LLM para encontrar sitios del target."""
        lang = language or language_for_location(location)
        system_prompt, user_prompt = build_dork_prompts(
            industry, location, num_dorks, lang
        )

        try:
            async with httpx.AsyncClient(timeout=45) as client:
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
                        "temperature": 0.55,
                        "max_tokens": 2500,
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()

                dorks = [
                    line.strip().lstrip("-•0123456789.) ")
                    for line in content.split("\n")
                    if line.strip() and not line.strip().startswith("#")
                ]
                return dorks[:num_dorks]
        except Exception as e:
            logger.error("dork_generation_failed: %s", e)
            return []

    async def start_discovery(
        self,
        industry: str,
        location: str = "",
        num_dorks: int = 15,
        language: Optional[str] = None,
    ) -> ScoutStartResult:
        """Genera dorks, los encola y dispara el Scout."""
        import redis

        lang = language or language_for_location(location)
        dorks = await self.generate_dorks(industry, location, num_dorks, lang)
        if not dorks:
            return ScoutStartResult(
                success=False,
                dorks_generated=0,
                seeds_count=0,
                message="No se generaron dorks. Revisa la configuración del LLM.",
            )

        try:
            r = redis.from_url(self._redis_url, decode_responses=True)
            queue_key = "orion:queue:discovery"

            r.delete(queue_key)

            context = json.dumps({"location": location, "industry": industry})
            r.set("orion:discovery:context", context, ex=7200)

            for dork in dorks:
                message = json.dumps(
                    {
                        "type": "dork",
                        "query": dork,
                        "source": "ai_generated",
                        "industry": industry,
                        "location": location,
                    }
                )
                r.lpush(queue_key, message)

            r.set("orion:signal:start", "1", ex=60)

            dorks_count = len(dorks)
            loc_suffix = f" ({location})" if location else ""
            return ScoutStartResult(
                success=True,
                dorks_generated=dorks_count,
                seeds_count=0,
                message=(
                    f"{dorks_count} dorks para '{industry}'{loc_suffix}. "
                    "Scout iniciado (filtro: negocios con intención comercial)."
                ),
            )
        except Exception as e:
            logger.error("redis_error: %s", e)
            return ScoutStartResult(
                success=False,
                dorks_generated=len(dorks),
                seeds_count=0,
                message=f"Dorks generados pero falló encolar en Redis: {e}",
            )
