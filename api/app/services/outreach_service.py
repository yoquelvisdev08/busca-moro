"""Service layer para Outreach Messages."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.outreach import OutreachMessage
from app.schemas.outreach import OutreachCreate, OutreachUpdate


class OutreachService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, payload: OutreachCreate) -> OutreachMessage:
        msg = OutreachMessage(
            lead_id=uuid.UUID(payload.lead_id),
            sales_intel_id=uuid.UUID(payload.sales_intel_id) if payload.sales_intel_id else None,
            channel=payload.channel,
            recipient=payload.recipient,
            subject=payload.subject,
            body=payload.body,
            provider_message_id=payload.provider_message_id,
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
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[OutreachMessage], int]:
        query = select(OutreachMessage)
        count_query = select(func.count()).select_from(OutreachMessage)

        if lead_id:
            query = query.where(OutreachMessage.lead_id == lead_id)
            count_query = count_query.where(OutreachMessage.lead_id == lead_id)

        query = query.order_by(OutreachMessage.created_at.desc()).limit(limit).offset(offset)

        result = await self._session.execute(query)
        count_result = await self._session.execute(count_query)

        return list(result.scalars().all()), count_result.scalar()

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
