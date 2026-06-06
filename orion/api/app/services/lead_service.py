"""Casos de uso sobre Lead."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadStatus
from app.models.outreach import MessageDirection, OutreachMessage
from app.schemas.lead import LeadCreate, LeadUpdate
from app.services.lead_closure import NEXT_STEP_TYPES, STATUSES_REQUIRING_NEXT_STEP
from app.services.lead_delete_reasons import format_deleted_reason


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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
                score=payload.score if payload.score else 0,
                commercial_score=payload.commercial_score,
                segment=payload.segment,
                revenue_signal=payload.revenue_signal,
                has_pricing_page=payload.has_pricing_page,
                has_testimonials=payload.has_testimonials,
                content_freshness_days=payload.content_freshness_days,
                commercial_signals=payload.commercial_signals,
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
                    "score": payload.score if payload.score else Lead.score,
                    "commercial_score": payload.commercial_score,
                    "segment": payload.segment,
                    "revenue_signal": payload.revenue_signal,
                    "has_pricing_page": payload.has_pricing_page,
                    "has_testimonials": payload.has_testimonials,
                    "content_freshness_days": payload.content_freshness_days,
                    "commercial_signals": payload.commercial_signals,
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
        result = await self._session.execute(
            select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def soft_delete(
        self,
        lead_id: uuid.UUID,
        *,
        reason: str,
        detail: Optional[str] = None,
    ) -> bool:
        """Marca el lead como eliminado (soft delete) con motivo."""
        lead = await self.get(lead_id)
        if lead is None:
            return False
        lead.deleted_at = datetime.now(tz=timezone.utc)
        lead.deleted_reason = format_deleted_reason(reason, detail)
        await self._session.commit()
        return True

    @staticmethod
    def _outbound_message_exists():
        return exists().where(
            OutreachMessage.lead_id == Lead.id,
            OutreachMessage.direction == MessageDirection.outbound.value,
        )

    @staticmethod
    def _has_email_clause():
        return or_(
            and_(Lead.email.isnot(None), Lead.email != ""),
            func.coalesce(func.array_length(Lead.secondary_emails, 1), 0) > 0,
        )

    async def list(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status: Optional[LeadStatus] = None,
        needs_next_step_only: bool = False,
        message_sent: Optional[bool] = None,
        has_email: Optional[bool] = None,
        discovered_since: Optional[datetime] = None,
        created_since: Optional[datetime] = None,
    ) -> tuple[list[Lead], int]:
        stmt = select(Lead).where(Lead.deleted_at.is_(None))
        count_stmt = select(func.count()).select_from(Lead).where(Lead.deleted_at.is_(None))
        if status is not None:
            stmt = stmt.where(Lead.status == status)
            count_stmt = count_stmt.where(Lead.status == status)
        if message_sent is True:
            stmt = stmt.where(self._outbound_message_exists())
            count_stmt = count_stmt.where(self._outbound_message_exists())
        elif message_sent is False:
            stmt = stmt.where(~self._outbound_message_exists())
            count_stmt = count_stmt.where(~self._outbound_message_exists())
        if has_email is True:
            stmt = stmt.where(self._has_email_clause())
            count_stmt = count_stmt.where(self._has_email_clause())
        elif has_email is False:
            stmt = stmt.where(~self._has_email_clause())
            count_stmt = count_stmt.where(~self._has_email_clause())
        if needs_next_step_only:
            stmt = stmt.where(
                Lead.status.in_(tuple(STATUSES_REQUIRING_NEXT_STEP)),
                Lead.next_step_type.is_(None),
            )
            count_stmt = count_stmt.where(
                Lead.status.in_(tuple(STATUSES_REQUIRING_NEXT_STEP)),
                Lead.next_step_type.is_(None),
            )
        if created_since is not None:
            since = _ensure_utc(created_since)
            stmt = stmt.where(Lead.created_at >= since)
            count_stmt = count_stmt.where(Lead.created_at >= since)
        elif discovered_since is not None:
            since = _ensure_utc(discovered_since)
            touched = or_(Lead.discovered_at >= since, Lead.updated_at >= since)
            stmt = stmt.where(touched)
            count_stmt = count_stmt.where(touched)
        stmt = stmt.order_by(Lead.updated_at.desc(), Lead.score.desc()).limit(limit).offset(offset)
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

    async def set_next_step(
        self,
        lead_id: uuid.UUID,
        *,
        step: str,
        scheduled_at: Optional[datetime] = None,
        notes: Optional[str] = None,
        close_as_lost: bool = True,
    ) -> Optional[Lead]:
        if step not in NEXT_STEP_TYPES:
            raise ValueError(f"Siguiente paso no válido: {step}")

        lead = await self.get(lead_id)
        if lead is None:
            return None

        lead.next_step_type = step
        lead.next_step_at = scheduled_at
        lead.next_step_notes = (notes or "").strip() or None

        if step == "call":
            lead.status = LeadStatus.interested
        elif step == "proposal":
            lead.status = LeadStatus.negotiation
        elif step == "discard" and close_as_lost:
            lead.status = LeadStatus.closed_lost

        await self._session.commit()
        await self._session.refresh(lead)
        return lead

    async def transition_status(self, lead_id: uuid.UUID, status: LeadStatus) -> Optional[Lead]:
        lead = await self.get(lead_id)
        if lead is None:
            return None
        lead.status = status
        if status == LeadStatus.contacted and lead.contacted_at is None:
            lead.contacted_at = datetime.now(tz=timezone.utc)
        await self._session.commit()
        await self._session.refresh(lead)
        return lead
