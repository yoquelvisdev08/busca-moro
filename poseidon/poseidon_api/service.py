"""Casos de uso Poseidon — señales de intención de compra."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from poseidon_api.models import PoseidonSignal, PoseidonSignalStatus
from poseidon_api.quality import signal_is_actionable
from poseidon_api.schemas import PoseidonSignalCreate, PoseidonSignalUpdate
from app.schemas.lead import LeadCreate
from app.services.lead_service import LeadService

_SOCIAL_HOSTS = frozenset(
    {
        "reddit.com",
        "www.reddit.com",
        "old.reddit.com",
        "quora.com",
        "www.quora.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
        "www.linkedin.com",
        "facebook.com",
        "www.facebook.com",
        "instagram.com",
        "youtube.com",
        "youtu.be",
        "workana.com",
        "www.workana.com",
        "freelancer.com",
        "www.freelancer.com",
        "google.com",
        "www.google.com",
    }
)

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


def detect_platform(source_url: str) -> str:
    host = (urlparse(source_url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if "reddit.com" in host:
        return "reddit"
    if host in {"twitter.com", "x.com"}:
        return "twitter"
    if "quora.com" in host:
        return "quora"
    if "linkedin.com" in host:
        return "linkedin"
    if "workana.com" in host:
        return "workana"
    if "freelancer.com" in host:
        return "freelancer"
    if "stackoverflow.com" in host:
        return "stackoverflow"
    return "forum"


def extract_business_url(title: str, snippet: str) -> Optional[str]:
    text = f"{title}\n{snippet}"
    for match in _URL_RE.findall(text):
        parsed = urlparse(match.rstrip(".,;)"))
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if not host or host in _SOCIAL_HOSTS:
            continue
        if parsed.scheme not in {"http", "https"}:
            continue
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}".rstrip("/")
    return None


class PoseidonService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def ingest(self, payload: PoseidonSignalCreate) -> tuple[PoseidonSignal, bool]:
        """Inserta señal si no existe. Devuelve (signal, created)."""
        url = str(payload.source_url)
        existing = (
            await self._session.execute(
                select(PoseidonSignal).where(PoseidonSignal.source_url == url)
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing, False

        platform = payload.platform or detect_platform(url)
        signal = PoseidonSignal(
            source_url=url,
            platform=platform,
            title=payload.title.strip(),
            snippet=payload.snippet.strip(),
            author_hint=payload.author_hint,
            intent_category=payload.intent_category,
            intent_score=payload.intent_score,
            keyword_score=payload.keyword_score,
            llm_score=payload.llm_score,
            query_used=payload.query_used,
            llm_summary=payload.llm_summary,
            reply_angle=payload.reply_angle,
            raw_metadata=payload.raw_metadata,
            detected_at=payload.detected_at or datetime.now(timezone.utc),
        )
        self._session.add(signal)
        await self._session.commit()
        await self._session.refresh(signal)
        return signal, True

    async def list_signals(
        self,
        *,
        status: Optional[PoseidonSignalStatus] = None,
        intent_category: Optional[str] = None,
        min_score: int = 0,
        actionable_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[PoseidonSignal], int]:
        filters = [PoseidonSignal.intent_score >= min_score]
        if status is not None:
            filters.append(PoseidonSignal.status == status)
        if intent_category:
            filters.append(PoseidonSignal.intent_category == intent_category)

        rows = (
            await self._session.execute(
                select(PoseidonSignal)
                .where(*filters)
                .order_by(PoseidonSignal.intent_score.desc(), PoseidonSignal.detected_at.desc())
            )
        ).scalars().all()

        if actionable_only:
            rows = [
                row
                for row in rows
                if signal_is_actionable(
                    title=row.title,
                    snippet=row.snippet,
                    source_url=row.source_url,
                    intent_score=row.intent_score,
                    min_score=max(min_score, 32),
                    max_age_days=45,
                    detected_at=row.detected_at,
                )
            ]

        total = len(rows)
        page = rows[offset : offset + limit]
        return page, total

    async def get(self, signal_id: uuid.UUID) -> Optional[PoseidonSignal]:
        return await self._session.get(PoseidonSignal, signal_id)

    async def update(
        self, signal_id: uuid.UUID, payload: PoseidonSignalUpdate
    ) -> Optional[PoseidonSignal]:
        signal = await self.get(signal_id)
        if signal is None:
            return None
        if payload.status is not None:
            signal.status = payload.status
        if payload.notes is not None:
            signal.notes = payload.notes
        await self._session.commit()
        await self._session.refresh(signal)
        return signal

    async def convert_to_lead(self, signal_id: uuid.UUID) -> tuple[PoseidonSignal, uuid.UUID, str]:
        signal = await self.get(signal_id)
        if signal is None:
            raise ValueError("signal_not_found")

        business_url = extract_business_url(signal.title, signal.snippet)
        if not business_url:
            business_url = f"https://poseidon.{signal.id}.local"

        notes = (
            f"[Poseidon] {signal.platform} · score {signal.intent_score}\n"
            f"Post: {signal.source_url}\n"
            f"{signal.llm_summary or signal.snippet[:400]}"
        )
        lead_service = LeadService(self._session)
        lead = await lead_service.upsert(
            LeadCreate(
                url=business_url,
                company_name=(signal.title or "Lead Poseidon")[:250],
                discovery_source="poseidon",
                discovery_query=signal.query_used or signal.intent_category,
                score=min(signal.intent_score, 100),
                commercial_score=min(signal.intent_score + 10, 100),
                segment="A" if signal.intent_score >= 75 else "B",
            )
        )
        lead.notes = notes
        signal.status = PoseidonSignalStatus.converted
        signal.lead_id = lead.id
        await self._session.commit()
        await self._session.refresh(signal)
        return signal, lead.id, business_url

    async def stats(self, *, min_actionable_score: int = 32) -> dict[str, int]:
        rows = (
            await self._session.execute(
                select(PoseidonSignal.status, func.count())
                .group_by(PoseidonSignal.status)
            )
        ).all()
        base = {s.value: 0 for s in PoseidonSignalStatus}
        for status, count in rows:
            base[status.value] = int(count)
        base["total"] = sum(base.values())

        all_signals = (
            await self._session.execute(select(PoseidonSignal))
        ).scalars().all()
        actionable = 0
        high_intent = 0
        for signal in all_signals:
            if signal.status != PoseidonSignalStatus.new:
                continue
            if signal.intent_score >= 75:
                high_intent += 1
            if signal_is_actionable(
                title=signal.title,
                snippet=signal.snippet,
                source_url=signal.source_url,
                intent_score=signal.intent_score,
                min_score=min_actionable_score,
                max_age_days=45,
                detected_at=signal.detected_at,
            ):
                actionable += 1
        base["actionable"] = actionable
        base["high_intent"] = high_intent
        return base

    async def dismiss_noise(self, *, min_score: int = 32) -> dict[str, int]:
        rows = (
            await self._session.execute(
                select(PoseidonSignal).where(PoseidonSignal.status == PoseidonSignalStatus.new)
            )
        ).scalars().all()
        dismissed = 0
        kept = 0
        for signal in rows:
            if signal_is_actionable(
                title=signal.title,
                snippet=signal.snippet,
                source_url=signal.source_url,
                intent_score=signal.intent_score,
                min_score=min_score,
                max_age_days=45,
                detected_at=signal.detected_at,
            ):
                kept += 1
                continue
            signal.status = PoseidonSignalStatus.dismissed
            dismissed += 1
        await self._session.commit()
        return {"dismissed": dismissed, "kept": kept}
