"""Endpoint para registrar la inteligencia de ventas generada por el Closer."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.sales_intelligence import SalesIntelligenceCreate, SalesIntelligenceRead
from app.services.sales_intelligence_service import SalesIntelligenceService

router = APIRouter(prefix="/sales-intelligence", tags=["sales-intelligence"])


@router.post(
    "",
    response_model=SalesIntelligenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Persistir output del Closer (pain points + cold email)",
)
async def create_sales_intelligence(
    payload: SalesIntelligenceCreate,
    session: AsyncSession = Depends(get_session),
) -> SalesIntelligenceRead:
    service = SalesIntelligenceService(session)
    intel = await service.record(payload)
    return SalesIntelligenceRead.model_validate(intel)
