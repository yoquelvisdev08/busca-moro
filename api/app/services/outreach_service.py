"""Service layer para Outreach Messages."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.models.outreach import MessageDirection, OutreachChannel, OutreachMessage
from app.schemas.outreach import InboundMessageCreate, OutreachCreate, OutreachUpdate


class LeadOutreachStatsRow:
    __slots__ = (
        "has_message_sent",
        "messages_sent_count",
        "has_reply_received",
        "inbound_messages_count",
    )

    def __init__(
        self,
        *,
        has_message_sent: bool,
        messages_sent_count: int,
        has_reply_received: bool,
        inbound_messages_count: int,
    ) -> None:
        self.has_message_sent = has_message_sent
        self.messages_sent_count = messages_sent_count
        self.has_reply_received = has_reply_received
        self.inbound_messages_count = inbound_messages_count


class OutreachService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        payload: OutreachCreate,
        *,
        has_attachment: bool = False,
        report_id: Optional[uuid.UUID] = None,
        mark_sent: bool = True,
    ) -> OutreachMessage:
        direction = payload.direction or MessageDirection.outbound.value
        now = datetime.now(tz=timezone.utc)
        msg = OutreachMessage(
            lead_id=uuid.UUID(payload.lead_id),
            sales_intel_id=uuid.UUID(payload.sales_intel_id) if payload.sales_intel_id else None,
            channel=OutreachChannel(payload.channel),
            direction=direction,
            recipient=payload.recipient,
            subject=payload.subject,
            body=payload.body,
            provider_message_id=payload.provider_message_id,
            has_attachment=has_attachment,
            report_id=report_id,
            sent_at=now if mark_sent and direction == MessageDirection.outbound.value else None,
        )
        self._session.add(msg)
        await self._session.commit()
        await self._session.refresh(msg)
        return msg

    async def record_inbound(self, payload: InboundMessageCreate) -> OutreachMessage:
        msg = OutreachMessage(
            lead_id=uuid.UUID(payload.lead_id),
            channel=OutreachChannel(payload.channel),
            direction=MessageDirection.inbound.value,
            recipient=payload.sender_email.strip(),
            subject=payload.subject,
            body=payload.body,
            replied=True,
        )
        self._session.add(msg)
        await self._session.commit()
        await self._session.refresh(msg)
        return msg

    async def get(self, msg_id: uuid.UUID) -> Optional[OutreachMessage]:
        result = await self._session.execute(
            select(OutreachMessage).where(OutreachMessage.id == msg_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        lead_id: Optional[uuid.UUID] = None,
        direction: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[tuple[OutreachMessage, Optional[Lead]]], int]:
        query = (
            select(OutreachMessage, Lead)
            .join(Lead, Lead.id == OutreachMessage.lead_id)
            .where(Lead.deleted_at.is_(None))
        )
        count_query = (
            select(func.count())
            .select_from(OutreachMessage)
            .join(Lead, Lead.id == OutreachMessage.lead_id)
            .where(Lead.deleted_at.is_(None))
        )

        if lead_id:
            query = query.where(OutreachMessage.lead_id == lead_id)
            count_query = count_query.where(OutreachMessage.lead_id == lead_id)
        if direction:
            query = query.where(OutreachMessage.direction == direction)
            count_query = count_query.where(OutreachMessage.direction == direction)

        query = (
            query.order_by(
                OutreachMessage.sent_at.desc().nullslast(),
                OutreachMessage.created_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await self._session.execute(query)
        count_result = await self._session.execute(count_query)

        return list(result.all()), int(count_result.scalar_one())

    async def stats_for_leads(
        self, lead_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, LeadOutreachStatsRow]:
        if not lead_ids:
            return {}

        sent_stmt = (
            select(
                OutreachMessage.lead_id,
                func.count().label("cnt"),
            )
            .where(
                OutreachMessage.lead_id.in_(lead_ids),
                OutreachMessage.direction == MessageDirection.outbound.value,
            )
            .group_by(OutreachMessage.lead_id)
        )
        inbound_stmt = (
            select(
                OutreachMessage.lead_id,
                func.count().label("cnt"),
            )
            .where(
                OutreachMessage.lead_id.in_(lead_ids),
                OutreachMessage.direction == MessageDirection.inbound.value,
            )
            .group_by(OutreachMessage.lead_id)
        )
        replied_stmt = (
            select(OutreachMessage.lead_id)
            .where(
                OutreachMessage.lead_id.in_(lead_ids),
                OutreachMessage.replied.is_(True),
            )
            .distinct()
        )

        sent_rows = (await self._session.execute(sent_stmt)).all()
        inbound_rows = (await self._session.execute(inbound_stmt)).all()
        replied_ids = {
            row[0] for row in (await self._session.execute(replied_stmt)).all()
        }

        sent_map = {row[0]: int(row[1]) for row in sent_rows}
        inbound_map = {row[0]: int(row[1]) for row in inbound_rows}

        stats: dict[uuid.UUID, LeadOutreachStatsRow] = {}
        for lid in lead_ids:
            sent_count = sent_map.get(lid, 0)
            inbound_count = inbound_map.get(lid, 0)
            stats[lid] = LeadOutreachStatsRow(
                has_message_sent=sent_count > 0,
                messages_sent_count=sent_count,
                has_reply_received=inbound_count > 0 or lid in replied_ids,
                inbound_messages_count=inbound_count,
            )
        return stats

    async def update(self, msg_id: uuid.UUID, payload: OutreachUpdate) -> Optional[OutreachMessage]:
        msg = await self.get(msg_id)
        if msg is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(msg, field, value)

        await self._session.commit()
        await self._session.refresh(msg)
        return msg

    async def track_open(self, msg_id: uuid.UUID):
        msg = await self.get(msg_id)
        if msg:
            msg.opened = True
            await self._session.commit()

    async def track_click(self, msg_id: uuid.UUID):
        msg = await self.get(msg_id)
        if msg:
            msg.clicked = True
            await self._session.commit()

    async def track_reply(self, msg_id: uuid.UUID):
        msg = await self.get(msg_id)
        if msg:
            msg.replied = True
            await self._session.commit()
