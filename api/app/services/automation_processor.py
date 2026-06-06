"""Procesador de outreach automático y avance del pipeline."""

from __future__ import annotations

import logging

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis_client import get_redis
from app.models.audit import Audit
from app.models.lead import Lead, LeadStatus
from app.models.outreach import MessageDirection, OutreachMessage
from app.models.sales_intelligence import SalesIntelligence
from app.services.automation_service import AutomationService
from app.services.outreach_automation_service import OutreachAutomationService
from app.services.queue_service import QueueService

logger = logging.getLogger(__name__)

_DEDUPE_TTL_SECONDS = 7200


def _lead_has_email(lead: Lead) -> bool:
    if lead.email:
        return True
    return bool(lead.secondary_emails)


def _pipeline_batch_size(max_per_run: int) -> int:
    return min(50, max(max_per_run * 5, 15))


async def _enqueue_audit_deduped(
    redis,
    queue: QueueService,
    queue_name: str,
    lead: Lead,
) -> bool:
    key = f"orion:dedupe:audit:{lead.id}"
    acquired = await redis.set(key, "1", nx=True, ex=_DEDUPE_TTL_SECONDS)
    if not acquired:
        return False
    await queue.enqueue(
        queue_name,
        {"lead_id": str(lead.id), "url": lead.url},
    )
    return True


async def _enqueue_closer_deduped(
    redis,
    queue: QueueService,
    queue_name: str,
    lead: Lead,
    audit_id,
) -> bool:
    key = f"orion:dedupe:closer:{lead.id}"
    acquired = await redis.set(key, "1", nx=True, ex=_DEDUPE_TTL_SECONDS)
    if not acquired:
        return False
    payload: dict[str, str] = {"lead_id": str(lead.id)}
    if audit_id:
        payload["audit_id"] = str(audit_id)
    await queue.enqueue(queue_name, payload)
    return True


async def get_pipeline_counts(session: AsyncSession) -> dict[str, int]:
    """Conteos por estado para el embudo de automatización."""
    rows = await session.execute(
        select(Lead.status, func.count())
        .where(Lead.deleted_at.is_(None))
        .group_by(Lead.status)
    )
    by_status = {str(status.value): count for status, count in rows.all()}

    enriched_with_email = await session.scalar(
        select(func.count())
        .select_from(Lead)
        .where(
            Lead.deleted_at.is_(None),
            Lead.status == LeadStatus.enriched,
            Lead.email.isnot(None),
        )
    ) or 0

    outbound_exists = exists().where(
        OutreachMessage.lead_id == Lead.id,
        OutreachMessage.direction == MessageDirection.outbound.value,
    )
    ready_for_outreach = await session.scalar(
        select(func.count())
        .select_from(Lead)
        .where(
            Lead.deleted_at.is_(None),
            Lead.status == LeadStatus.enriched,
            Lead.email.isnot(None),
            ~outbound_exists,
        )
        .where(
            exists().where(
                SalesIntelligence.lead_id == Lead.id,
            )
        )
    ) or 0

    return {
        "queued": int(by_status.get("queued", 0) + by_status.get("new", 0)),
        "auditing": int(by_status.get("auditing", 0)),
        "audited": int(by_status.get("audited", 0)),
        "enriched": int(by_status.get("enriched", 0)),
        "enriched_with_email": int(enriched_with_email),
        "ready_for_outreach": int(ready_for_outreach),
        "contacted": int(
            by_status.get("contacted", 0)
            + by_status.get("replied", 0)
            + by_status.get("interested", 0)
            + by_status.get("negotiation", 0)
        ),
    }


async def _pending_audit_leads(session: AsyncSession) -> list[Lead]:
    audit_exists = exists().where(Audit.lead_id == Lead.id)
    result = await session.execute(
        select(Lead)
        .where(
            Lead.deleted_at.is_(None),
            Lead.status.in_([LeadStatus.queued, LeadStatus.new]),
            ~audit_exists,
        )
        .order_by(Lead.commercial_score.desc(), Lead.discovered_at.asc())
    )
    return list(result.scalars().all())


async def reconcile_audit_queue(session: AsyncSession, *, force: bool = False) -> int:
    """Limpia cola obsoleta y encola solo leads reales sin auditoría."""
    settings = get_settings()
    redis = get_redis()
    queue = QueueService(redis)

    pending = await _pending_audit_leads(session)
    queue_len = await queue.length(settings.queue_audit)

    if force or (pending and queue_len > len(pending) * 2 + 50):
        await redis.delete(settings.queue_audit)
        logger.warning(
            "audit_queue_reconciled",
            extra={"flushed": queue_len, "pending_leads": len(pending)},
        )

    enqueued = 0
    batch = _pipeline_batch_size(
        (await AutomationService(redis).get_config()).auto_outreach_max_per_run
    )
    for lead in pending[:batch]:
        if await _enqueue_audit_deduped(redis, queue, settings.queue_audit, lead):
            enqueued += 1
    return enqueued


async def push_pipeline_forward(session: AsyncSession) -> tuple[int, int, str]:
    """Impulsa auditoría y closer con deduplicación. Retorna (audits, closers, detail)."""
    settings = get_settings()
    redis = get_redis()
    automation = AutomationService(redis)
    config = await automation.get_config()
    if not config.auto_outreach_enabled:
        return 0, 0, "disabled"

    queue = QueueService(redis)
    batch = _pipeline_batch_size(config.auto_outreach_max_per_run)
    audit_n = 0
    closer_n = 0
    details: list[str] = []

    pending = await _pending_audit_leads(session)
    queue_len = await queue.length(settings.queue_audit)
    if pending and queue_len > len(pending) * 2 + 50:
        audit_n = await reconcile_audit_queue(session, force=True)
        details.append(f"reconcile:{audit_n}")
    else:
        for lead in pending[:batch]:
            if await _enqueue_audit_deduped(redis, queue, settings.queue_audit, lead):
                audit_n += 1
                if len(details) < 5:
                    details.append(f"audit:{lead.normalized_domain}")

    intel_missing = exists().where(SalesIntelligence.lead_id == Lead.id)
    audited_no_intel = list(
        (
            await session.execute(
                select(Lead)
                .where(
                    Lead.deleted_at.is_(None),
                    Lead.status == LeadStatus.audited,
                    ~intel_missing,
                )
                .order_by(Lead.commercial_score.desc())
                .limit(batch)
            )
        )
        .scalars()
        .all()
    )
    for lead in audited_no_intel:
        audit_row = await session.execute(
            select(Audit.id)
            .where(Audit.lead_id == lead.id)
            .order_by(Audit.created_at.desc())
            .limit(1)
        )
        audit_id = audit_row.scalar_one_or_none()
        if await _enqueue_closer_deduped(
            redis, queue, settings.queue_outreach, lead, audit_id
        ):
            closer_n += 1
            if len(details) < 8:
                details.append(f"closer:{lead.normalized_domain}")

    detail = "; ".join(details) if details else "pipeline_idle"
    if audit_n or closer_n:
        await automation.record_pipeline_run(detail)
    return audit_n, closer_n, detail


async def process_auto_outreach(session: AsyncSession) -> tuple[int, int, str]:
    """Busca leads elegibles y envía reporte + email. Retorna (sent, failed, detail)."""
    settings = get_settings()
    redis = get_redis()
    automation = AutomationService(redis)
    config = await automation.get_config()

    if not config.auto_outreach_enabled:
        return 0, 0, "disabled"

    if not settings.pdf_generation_enabled:
        return 0, 0, "pdf_disabled"

    if not settings.email_api_key:
        return 0, 0, "email_api_key_missing"

    outbound_exists = exists().where(
        OutreachMessage.lead_id == Lead.id,
        OutreachMessage.direction == MessageDirection.outbound.value,
    )

    stmt = (
        select(Lead)
        .where(
            Lead.deleted_at.is_(None),
            Lead.status == LeadStatus.enriched,
            ~outbound_exists,
        )
        .order_by(Lead.commercial_score.desc(), Lead.updated_at.desc())
        .limit(config.auto_outreach_max_per_run * 4)
    )
    candidates = list((await session.execute(stmt)).scalars().all())

    service = OutreachAutomationService(session, settings)
    sent = 0
    failed = 0
    details: list[str] = []

    for lead in candidates:
        if sent + failed >= config.auto_outreach_max_per_run:
            break
        if not AutomationService.segment_meets_min(lead.segment, config.auto_outreach_min_segment):
            continue
        if not _lead_has_email(lead):
            continue

        intel_exists = await session.execute(
            select(SalesIntelligence.id)
            .where(SalesIntelligence.lead_id == lead.id)
            .limit(1)
        )
        if intel_exists.scalar_one_or_none() is None:
            continue

        outcome = await service.send_report_and_email(lead.id)
        if outcome.status == "sent":
            sent += 1
            details.append(f"{lead.normalized_domain}: ok")
        elif outcome.status == "failed":
            failed += 1
            details.append(f"{lead.normalized_domain}: {outcome.detail}")

    detail = "; ".join(details) if details else "no_candidates"
    if sent or failed:
        await automation.record_outreach_run(sent=sent, failed=failed, detail=detail)
    return sent, failed, detail


async def process_automation_cycle(session: AsyncSession) -> dict[str, int | str]:
    """Ciclo completo: avanzar pipeline + enviar emails."""
    audit_n, closer_n, pipeline_detail = await push_pipeline_forward(session)
    sent, failed, outreach_detail = await process_auto_outreach(session)
    return {
        "audit_requeued": audit_n,
        "closer_requeued": closer_n,
        "outreach_sent": sent,
        "outreach_failed": failed,
        "pipeline_detail": pipeline_detail,
        "outreach_detail": outreach_detail,
    }
