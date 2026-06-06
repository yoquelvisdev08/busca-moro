"""Endpoints para gestión del Scout (descubrimiento de leads)."""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.schemas.scout_analyze import AnalyzeUrlRequest, AnalyzeUrlResponse
from app.services.scout_service import ScoutService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scout", tags=["scout"])

_SKIP_REASON_MESSAGES = {
    "blocked_domain": "Dominio bloqueado (directorio, red social o sitio no prospectable).",
    "geo_mismatch": "La web no coincide con el país seleccionado.",
    "not_eligible": "Analizado pero no califica como lead (segmento D o puntaje bajo).",
    "empty_url": "URL vacía.",
}


@router.post("/start")
async def start_discovery(
    industry: str = Query(..., description="Tipo de negocio a buscar (ej: 'clínicas dentales')"),
    location: str = Query(
        default="",
        description="País o mercado (ej: 'México', 'España', 'Estados Unidos')",
    ),
    num_dorks: int = Query(default=15, ge=5, le=30, description="Cantidad de dorks a generar"),
    language: str = Query(default="es", description="Idioma de las búsquedas"),
):
    """Genera dorks con IA y arranca el Scout inmediatamente."""
    settings = get_settings()

    service = ScoutService(
        llm_base_url=settings.llm_base_url,
        llm_api_key=settings.llm_api_key,
        llm_model=settings.llm_model,
        redis_url=settings.redis_url,
    )

    result = await service.start_discovery(
        industry=industry,
        location=location,
        num_dorks=num_dorks,
        language=language,
    )

    status_code = 200 if result.success else 400
    return {
        "success": result.success,
        "dorks_generated": result.dorks_generated,
        "message": result.message,
    }


@router.post("/analyze-url", response_model=AnalyzeUrlResponse)
async def analyze_url(body: AnalyzeUrlRequest):
    """Analiza una URL manualmente (mismo motor que Scout) y la guarda si califica."""
    settings = get_settings()
    payload = {
        "url": str(body.url),
        "location": body.location or "",
        "industry": body.industry or "",
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.scout_analyze_url.rstrip('/')}/analyze",
                json=payload,
            )
    except httpx.RequestError as exc:
        logger.error("scout_analyze_unreachable: %s", exc)
        return AnalyzeUrlResponse(
            success=False,
            published=False,
            message="Scout no disponible para análisis. Verifica que el contenedor scout esté en marcha.",
            url=str(body.url),
        )

    try:
        data = resp.json()
    except ValueError:
        return AnalyzeUrlResponse(
            success=False,
            published=False,
            message=f"Respuesta inválida del Scout (HTTP {resp.status_code})",
            url=str(body.url),
        )

    published = bool(data.get("published"))
    skipped = data.get("skipped_reason") or ""
    segment = data.get("segment")
    total = data.get("total_score")

    if published:
        msg = f"Lead guardado. Segmento {segment}, score {total}."
        return AnalyzeUrlResponse(
            success=True,
            published=True,
            message=msg,
            url=data.get("url", str(body.url)),
            segment=segment,
            total_score=total,
            problem_score=data.get("problem_score"),
            commercial_score=data.get("commercial_score"),
            reasons=data.get("reasons") or [],
        )

    if resp.status_code >= 500 or data.get("error"):
        return AnalyzeUrlResponse(
            success=False,
            published=False,
            message=data.get("error") or "Error al analizar la URL",
            url=data.get("url", str(body.url)),
            skipped_reason=skipped or None,
            reasons=data.get("reasons") or [],
        )

    human = _SKIP_REASON_MESSAGES.get(skipped, "No se publicó el lead.")
    return AnalyzeUrlResponse(
        success=True,
        published=False,
        message=human,
        url=data.get("url", str(body.url)),
        segment=segment,
        total_score=total,
        problem_score=data.get("problem_score"),
        commercial_score=data.get("commercial_score"),
        skipped_reason=skipped or None,
        reasons=data.get("reasons") or [],
    )
