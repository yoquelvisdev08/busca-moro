"""Endpoints para gestión del Scout (descubrimiento de leads)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.services.scout_service import ScoutService

router = APIRouter(prefix="/scout", tags=["scout"])


@router.post("/start")
async def start_discovery(
    industry: str = Query(..., description="Tipo de negocio a buscar (ej: 'clínicas dentales')"),
    location: str = Query(default="", description="Ubicación (ej: 'Madrid, España')"),
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
