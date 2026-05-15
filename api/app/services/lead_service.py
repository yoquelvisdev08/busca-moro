"""Casos de uso sobre Lead."""

from __future__ import annotations

import uuid
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadStatus
from app.schemas.lead import LeadCreate, LeadUpdate


def normalize_domain(url: str) -> str:
    """Devuelve el dominio en minúsculas, sin ``www.`` ni trailing slash."""

    parsed = urlparse(url if "://" in url else f"http://{url}")
    host = (parsed.hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


class LeadService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, payload: LeadCreate) -> Lead:
        """Upsert idempotente por ``normalized_domain``."""

        domain = normalize_domain(str(payload.url))
        if not domain:
            raise ValueError("URL sin host válido")

        stmt = (
            pg_insert(Lead)
            .values(
                url=str(payload.url),
                normalized_domain=domain,
                company_name=payload.company_name,
                industry=payload.industry,
                country_code=payload.country_code,
                city=payload.city,
                email=payload.email,
                phone=payload.phone,
                tech_stack=payload.tech_stack,
                has_ssl=payload.has_ssl,
                load_time_ms=payload.load_time_ms,
                discovery_source=payload.discovery_source,
                discovery_query=payload.discovery_query,
            )
            .on_conflict_do_update(
                index_elements=[Lead.normalized_domain],
                set_={
                    "company_name": payload.company_name,
                    "industry": payload.industry,
                    "email": payload.email,
                    "phone": payload.phone,
                    "tech_stack": payload.tech_stack,
                    "has_ssl": payload.has_ssl,
                    "load_time_ms": payload.load_time_ms,
                    "updated_at": func.now(),
                },
            )
            .returning(Lead)
        )
        result = await self._session.execute(stmt)
        lead = result.scalar_one()
        await self._session.commit()
        return lead

    async def get(self, lead_id: uuid.UUID) -> Optional[Lead]:
        return await self._session.get(Lead, lead_id)

    async def list(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status: Optional[LeadStatus] = None,
    ) -> tuple[list[Lead], int]:
        stmt = select(Lead).where(Lead.deleted_at.is_(None))
        count_stmt = select(func.count()).select_from(Lead).where(Lead.deleted_at.is_(None))
        if status is not None:
            stmt = stmt.where(Lead.status == status)
            count_stmt = count_stmt.where(Lead.status == status)
        stmt = stmt.order_by(Lead.score.desc(), Lead.discovered_at.desc()).limit(limit).offset(offset)
        items = (await self._session.execute(stmt)).scalars().all()
        total = (await self._session.execute(count_stmt)).scalar_one()
        return list(items), int(total)

    async def update(self, lead_id: uuid.UUID, payload: LeadUpdate) -> Optional[Lead]:
        lead = await self.get(lead_id)
        if lead is None:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(lead, field, value)
        await self._session.commit()
        await self._session.refresh(lead)
        return lead

    async def transition_status(self, lead_id: uuid.UUID, status: LeadStatus) -> Optional[Lead]:
        lead = await self.get(lead_id)
        if lead is None:
            return None
        lead.status = status
        await self._session.commit()
        await self._session.refresh(lead)
        return lead
