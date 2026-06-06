"""Casos de uso sobre Audit."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import Audit
from app.models.lead import Lead, LeadStatus
from app.schemas.audit import AuditCreate


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, payload: AuditCreate) -> Audit:
        """Persiste el resultado de una auditoría y actualiza el Lead.

        El Lead se sincroniza con la auditoría más reciente (denormalización
        controlada para acelerar el dashboard sin joins).
        """

        audit = Audit(
            lead_id=payload.lead_id,
            status=payload.status,
            lighthouse_score=payload.lighthouse_score,
            performance_score=payload.performance_score,
            seo_score=payload.seo_score,
            accessibility_score=payload.accessibility_score,
            best_practices_score=payload.best_practices_score,
            mobile_friendly=payload.mobile_friendly,
            has_ssl=payload.has_ssl,
            load_time_ms=payload.load_time_ms,
            first_contentful_paint_ms=payload.first_contentful_paint_ms,
            largest_contentful_paint_ms=payload.largest_contentful_paint_ms,
            cumulative_layout_shift=payload.cumulative_layout_shift,
            total_blocking_time_ms=payload.total_blocking_time_ms,
            detected_tech=payload.detected_tech,
            extracted_contacts=payload.extracted_contacts,
            raw_json_data=payload.raw_json_data,
            screenshot_path=payload.screenshot_path,
            user_agent=payload.user_agent,
            proxy_used=payload.proxy_used,
            error_message=payload.error_message,
            started_at=payload.started_at,
            finished_at=payload.finished_at or datetime.now(tz=timezone.utc),
        )
        self._session.add(audit)

        lead = await self._session.get(Lead, payload.lead_id)
        if lead is not None:
            lead.lighthouse_score = payload.lighthouse_score
            lead.mobile_friendly = payload.mobile_friendly
            lead.has_ssl = payload.has_ssl
            lead.load_time_ms = payload.load_time_ms
            lead.audited_at = datetime.now(tz=timezone.utc)
            lead.status = LeadStatus.audited if payload.status == "completed" else LeadStatus.error
            if payload.extracted_contacts:
                emails = payload.extracted_contacts.get("emails", []) or []
                phones = payload.extracted_contacts.get("phones", []) or []
                socials = payload.extracted_contacts.get("socials", {}) or {}
                if emails and lead.email is None:
                    lead.email = emails[0]
                    lead.secondary_emails = list({*lead.secondary_emails, *emails[1:]})
                if phones and lead.phone is None:
                    lead.phone = phones[0]
                    lead.secondary_phones = list({*lead.secondary_phones, *phones[1:]})
                if socials:
                    lead.social_links = {**lead.social_links, **socials}

        await self._session.commit()
        await self._session.refresh(audit)
        return audit

    async def get(self, audit_id: uuid.UUID) -> Optional[Audit]:
        return await self._session.get(Audit, audit_id)

    async def list_for_lead(self, lead_id: uuid.UUID) -> list[Audit]:
        stmt = (
            select(Audit)
            .where(Audit.lead_id == lead_id)
            .order_by(Audit.created_at.desc())
        )
        return list((await self._session.execute(stmt)).scalars().all())
