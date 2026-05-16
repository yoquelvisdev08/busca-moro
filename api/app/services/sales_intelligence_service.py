"""Casos de uso sobre SalesIntelligence."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadStatus
from app.models.sales_intelligence import SalesIntelligence
from app.schemas.sales_intelligence import SalesIntelligenceCreate


class SalesIntelligenceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, payload: SalesIntelligenceCreate) -> SalesIntelligence:
        intel = SalesIntelligence(
            lead_id=payload.lead_id,
            audit_id=payload.audit_id,
            model=payload.model,
            pain_points=[p.model_dump() for p in payload.pain_points],
            cold_email_subject=payload.cold_email_subject,
            cold_email_body=payload.cold_email_body,
            language=payload.language,
            tone=payload.tone,
            prompt_hash=payload.prompt_hash,
            tokens_input=payload.tokens_input,
            tokens_output=payload.tokens_output,
        )
        self._session.add(intel)

        lead = await self._session.get(Lead, payload.lead_id)
        if lead is not None:
            lead.status = LeadStatus.enriched
            lead.updated_at = datetime.now(tz=timezone.utc)

        await self._session.commit()
        await self._session.refresh(intel)
        return intel

    async def list_for_lead(self, lead_id: uuid.UUID) -> list[SalesIntelligence]:
        result = await self._session.execute(
            select(SalesIntelligence)
            .where(SalesIntelligence.lead_id == lead_id)
            .order_by(SalesIntelligence.generated_at.desc())
        )
        return list(result.scalars().all())
