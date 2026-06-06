"""Reglas de cierre comercial: siguiente paso obligatorio y bloqueo de follow-ups."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, LeadStatus
from app.models.outreach import MessageDirection, OutreachMessage

NextStepType = Literal["call", "proposal", "discard"]

NEXT_STEP_TYPES: frozenset[str] = frozenset({"call", "proposal", "discard"})

STATUSES_REQUIRING_NEXT_STEP: frozenset[LeadStatus] = frozenset({
    LeadStatus.contacted,
    LeadStatus.replied,
    LeadStatus.interested,
    LeadStatus.negotiation,
})


def requires_next_step(status: LeadStatus, next_step_type: Optional[str]) -> bool:
    return status in STATUSES_REQUIRING_NEXT_STEP and not (next_step_type or "").strip()


async def lead_blocks_follow_ups(session: AsyncSession, lead_id: uuid.UUID) -> tuple[bool, str]:
    """True si no se deben enviar más follow-ups (lead respondió o secuencia cancelada)."""
    lead = await session.get(Lead, lead_id)
    if lead is None:
        return True, "Lead no encontrado"

    if lead.status in {
        LeadStatus.replied,
        LeadStatus.closed_won,
        LeadStatus.closed_lost,
        LeadStatus.rejected,
        LeadStatus.won,
    }:
        return True, f"Estado del lead: {lead.status.value}"

    inbound_count = await session.scalar(
        select(func.count())
        .select_from(OutreachMessage)
        .where(
            OutreachMessage.lead_id == lead_id,
            OutreachMessage.direction == MessageDirection.inbound.value,
        )
    )
    if inbound_count and int(inbound_count) > 0:
        return True, "El lead tiene mensajes recibidos registrados"

    replied_outbound = await session.scalar(
        select(func.count())
        .select_from(OutreachMessage)
        .where(
            OutreachMessage.lead_id == lead_id,
            OutreachMessage.replied.is_(True),
        )
    )
    if replied_outbound and int(replied_outbound) > 0:
        return True, "Mensaje saliente marcado como respondido"

    return False, ""
