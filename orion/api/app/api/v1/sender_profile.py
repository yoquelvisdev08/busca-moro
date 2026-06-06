"""Endpoints para gestión del perfil del remitente (sender profile)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.sender_profile import (
    SenderProfileCreate,
    SenderProfileRead,
    SenderProfileScrapeResult,
    SenderProfileUpdate,
)
from app.services.sender_profile_service import SenderProfileService

router = APIRouter(prefix="/sender-profile", tags=["sender-profile"])


@router.get("", response_model=Optional[SenderProfileRead])
async def get_sender_profile(session: AsyncSession = Depends(get_session)):
    """Return the currently active sender profile."""
    service = SenderProfileService(session)
    profile = await service.get_active()
    if profile is None:
        return None
    return SenderProfileRead.model_validate(profile)


@router.post("", response_model=SenderProfileRead, status_code=201)
async def create_sender_profile(
    payload: SenderProfileCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new sender profile (deactivates any existing active one)."""
    service = SenderProfileService(session)
    profile = await service.create(payload)
    return SenderProfileRead.model_validate(profile)


@router.put("/{profile_id}", response_model=SenderProfileRead)
async def update_sender_profile(
    profile_id: str,
    payload: SenderProfileUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update an existing sender profile."""
    service = SenderProfileService(session)
    profile = await service.update(profile_id, payload)
    if profile is None:
        raise HTTPException(status_code=404, detail="Sender profile not found")
    return SenderProfileRead.model_validate(profile)


@router.post("/scrape", response_model=SenderProfileScrapeResult)
async def scrape_sender_profile(
    website: Optional[str] = "https://yoquelvis.dev",
    session: AsyncSession = Depends(get_session),
):
    """Scrape the given website and auto-fill the sender profile."""
    service = SenderProfileService(session)
    try:
        profile = await service.scrape_and_upsert(website)
        return SenderProfileScrapeResult(
            success=True,
            message=f"Profile scraped successfully from {website}",
            profile=SenderProfileRead.model_validate(profile),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scraping failed: {exc}",
        ) from exc
