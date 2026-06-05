"""Endpoints para gestión de outreach (emails, seguimiento)."""
from __future__ import annotations

import asyncio
import base64
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.models.lead import Lead, LeadStatus
from app.models.sales_intelligence import SalesIntelligence
from app.schemas.outreach import (
    BulkSendDetail,
    BulkSendRequest,
    BulkSendResponse,
    InboundMessageCreate,
    OutreachCreate,
    OutreachListResponse,
    OutreachRead,
    OutreachUpdate,
)
from app.services.email_service import EmailConfig, EmailService
from app.services.lead_contact import persist_lead_email, resolve_lead_email
from app.services.lead_service import LeadService
from app.services.outreach_service import OutreachService
from app.services.pdf_service import PDFService
from app.services.sender_profile_service import SenderProfileService

router = APIRouter(prefix="/outreach", tags=["outreach"])


def _to_outreach_read(msg, lead: Lead | None = None) -> OutreachRead:
    data = OutreachRead.model_validate(msg)
    if lead is not None:
        return data.model_copy(
            update={
                "lead_domain": lead.normalized_domain,
                "lead_company_name": lead.company_name,
            }
        )
    return data


@router.post("", response_model=OutreachRead, status_code=201)
async def create_outreach(
    payload: OutreachCreate,
    session: AsyncSession = Depends(get_session),
):
    service = OutreachService(session)
    msg = await service.create(payload)
    return _to_outreach_read(msg)


@router.post("/inbound", response_model=OutreachRead, status_code=201)
async def record_inbound_message(
    payload: InboundMessageCreate,
    session: AsyncSession = Depends(get_session),
):
    """Registra un mensaje recibido del lead (respuesta manual)."""
    lead_service = LeadService(session)
    lead = await lead_service.get(uuid.UUID(payload.lead_id))
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    from app.services.follow_up_service import FollowUpService

    service = OutreachService(session)
    msg = await service.record_inbound(payload)
    await lead_service.transition_status(lead.id, LeadStatus.replied)

    follow_up_service = FollowUpService(session)
    await follow_up_service.mark_replied(lead.id)

    lead = await lead_service.get(lead.id)
    return _to_outreach_read(msg, lead)


@router.get("", response_model=OutreachListResponse)
async def list_outreach(
    lead_id: Optional[uuid.UUID] = Query(default=None),
    direction: Optional[str] = Query(
        default=None,
        description="outbound (enviados) o inbound (recibidos)",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    if direction is not None and direction not in ("outbound", "inbound"):
        raise HTTPException(status_code=400, detail="direction debe ser outbound o inbound")

    service = OutreachService(session)
    rows, total = await service.list(lead_id=lead_id, direction=direction, limit=limit, offset=offset)
    return OutreachListResponse(
        items=[_to_outreach_read(msg, lead) for msg, lead in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{msg_id}", response_model=OutreachRead)
async def get_outreach(
    msg_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    service = OutreachService(session)
    msg = await service.get(msg_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Outreach message not found")
    lead = await session.get(Lead, msg.lead_id)
    return _to_outreach_read(msg, lead)


@router.patch("/{msg_id}", response_model=OutreachRead)
async def update_outreach(
    msg_id: uuid.UUID,
    payload: OutreachUpdate,
    session: AsyncSession = Depends(get_session),
):
    service = OutreachService(session)
    msg = await service.update(msg_id, payload)
    if msg is None:
        raise HTTPException(status_code=404, detail="Outreach message not found")
    lead = await session.get(Lead, msg.lead_id)
    return _to_outreach_read(msg, lead)


@router.post("/{msg_id}/track-open")
async def track_open(msg_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = OutreachService(session)
    await service.track_open(msg_id)
    return {"status": "tracked"}


@router.post("/{msg_id}/track-click")
async def track_click(msg_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    service = OutreachService(session)
    await service.track_click(msg_id)
    return {"status": "tracked"}


@router.post("/{msg_id}/track-reply")
async def track_reply(msg_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    from app.services.follow_up_service import FollowUpService
    from app.services.lead_service import LeadService

    service = OutreachService(session)
    msg = await service.get(msg_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Outreach message not found")

    await service.track_reply(msg_id)

    lead_service = LeadService(session)
    await lead_service.transition_status(msg.lead_id, LeadStatus.replied)
    follow_up_service = FollowUpService(session)
    await follow_up_service.mark_replied(msg.lead_id)

    return {"status": "tracked", "follow_ups_cancelled": True}


@router.post("/send")
async def send_outreach_email(
    lead_id: uuid.UUID = Query(...),
    subject: Optional[str] = Query(default=None),
    body: Optional[str] = Query(default=None),
    attach_report_id: Optional[uuid.UUID] = Query(default=None),
    to_email: Optional[str] = Query(
        default=None,
        description="Email destino manual si el lead no tiene correo guardado",
    ),
    session: AsyncSession = Depends(get_session),
):
    """Send the cold email generated by the Closer to the lead.

    Optionally override the subject and body before sending.
    Optionally attach a generated PDF report by report_id.
    """
    settings = get_settings()

    result = await session.execute(select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None)))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    result = await session.execute(
        select(SalesIntelligence)
        .where(SalesIntelligence.lead_id == lead_id)
        .order_by(SalesIntelligence.generated_at.desc())
        .limit(1)
    )
    intel = result.scalar_one_or_none()
    if not intel:
        raise HTTPException(
            status_code=400,
            detail="No sales intelligence available. Run the Closer first.",
        )

    try:
        recipient, candidates = await resolve_lead_email(
            session, lead_id, override=to_email
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not recipient:
        hint = (
            " No se encontró email en el lead ni en la auditoría."
            " Indica uno con el parámetro to_email o actualiza el lead."
        )
        if candidates:
            hint = (
                f" Emails detectados pero descartados por validación: {', '.join(candidates[:3])}."
                " Usa to_email con una dirección válida."
            )
        raise HTTPException(
            status_code=400,
            detail=f"No hay dirección de email para este lead.{hint}",
        )

    await persist_lead_email(session, lead, recipient)

    final_subject = subject or intel.cold_email_subject or "Propuesta de mejora para su sitio web"
    final_body = body or intel.cold_email_body or ""

    from app.services.sender_profile_service import SenderProfileService

    profile_service = SenderProfileService(session)
    sender_profile = await profile_service.get_active()
    if sender_profile and sender_profile.email_signature:
        if sender_profile.email_signature not in final_body:
            final_body = final_body.rstrip() + "\n\n" + sender_profile.email_signature

    attachments = None
    has_attachment = False
    report_id_val: Optional[uuid.UUID] = None

    if attach_report_id is not None:
        import base64
        import os

        from app.models.report import Report

        report = await session.get(Report, attach_report_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Report not found")

        if not os.path.isfile(report.file_path):
            raise HTTPException(
                status_code=400, detail="Report PDF file not found on disk"
            )

        try:
            with open(report.file_path, "rb") as f:
                pdf_content = base64.b64encode(f.read()).decode("utf-8")
            attachments = [{
                "filename": os.path.basename(report.file_path),
                "content_type": "application/pdf",
                "content": pdf_content,
            }]
            has_attachment = True
            report_id_val = attach_report_id
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to read report PDF: {e}"
            ) from e

    email_service = EmailService(
        EmailConfig(
            provider=getattr(settings, "email_provider", "resend"),
            api_key=getattr(settings, "email_api_key", ""),
            from_email=getattr(settings, "email_from", "outreach@orion.dev"),
            from_name=getattr(settings, "email_from_name", "Orion Outreach"),
        )
    )

    result = await email_service.send(
        to=recipient,
        subject=final_subject,
        body=final_body,
        attachments=attachments,
    )

    if result.success:
        outreach_service = OutreachService(session)
        msg_create = OutreachCreate(
            lead_id=str(lead_id),
            sales_intel_id=str(intel.id),
            channel="email",
            direction="outbound",
            recipient=recipient,
            subject=final_subject,
            body=final_body,
            provider_message_id=result.message_id,
        )
        msg = await outreach_service.create(
            msg_create,
            has_attachment=has_attachment,
            report_id=report_id_val,
            mark_sent=True,
        )

        lead_service = LeadService(session)
        await lead_service.transition_status(lead_id, LeadStatus.contacted)

        refreshed = await lead_service.get(lead_id)
        needs_step = bool(
            refreshed
            and refreshed.status == LeadStatus.contacted
            and not refreshed.next_step_type
        )
        return {
            "status": "sent",
            "message_id": result.message_id,
            "outreach_id": str(msg.id),
            "recipient": recipient,
            "has_attachment": has_attachment,
            "needs_next_step": needs_step,
        }
    raise HTTPException(status_code=500, detail=f"Failed to send email: {result.error}")


@router.post("/bulk-send", response_model=BulkSendResponse)
async def bulk_send_outreach(
    payload: BulkSendRequest,
    session: AsyncSession = Depends(get_session),
):
    """Generate PDF reports and send cold emails to multiple leads (max 20).

    Processes each lead sequentially with per-lead error isolation.
    Skips leads without email or sales intelligence.
    Returns summary with sent/skipped/failed counts and per-lead details.
    """
    settings = get_settings()
    sent_details: list[BulkSendDetail] = []
    skipped_details: list[BulkSendDetail] = []
    failed_details: list[BulkSendDetail] = []

    for lead_id_str in payload.lead_ids:
        # ── 1. Parse UUID ──────────────────────────────────────────
        try:
            lead_id = uuid.UUID(lead_id_str)
        except ValueError:
            skipped_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str, status="skipped", detail="invalid_uuid"
                )
            )
            continue

        # ── 2. Fetch lead (skip soft-deleted) ──────────────────────
        result = await session.execute(
            select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if not lead:
            skipped_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str, status="skipped", detail="lead_not_found"
                )
            )
            continue

        # ── 3. Check SalesIntelligence ──────────────────────────────
        result = await session.execute(
            select(SalesIntelligence)
            .where(SalesIntelligence.lead_id == lead_id)
            .order_by(SalesIntelligence.generated_at.desc())
            .limit(1)
        )
        intel = result.scalar_one_or_none()
        if not intel:
            skipped_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str,
                    status="skipped",
                    detail="no_intelligence",
                )
            )
            continue

        # ── 4. Resolve email ───────────────────────────────────────
        try:
            recipient, _candidates = await resolve_lead_email(
                session, lead_id, override=None
            )
        except ValueError:
            recipient = None

        if not recipient:
            skipped_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str, status="skipped", detail="no_email"
                )
            )
            continue

        await persist_lead_email(session, lead, recipient)

        # ── 5. Generate PDF report ─────────────────────────────────
        try:
            pdf_service = PDFService(session)
            report_result = await pdf_service.generate_report(lead_id)
        except Exception as exc:
            failed_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str,
                    status="failed",
                    detail=f"pdf_generation_failed: {exc}",
                )
            )
            continue

        # ── 6. Read PDF + base64-encode ────────────────────────────
        try:
            with open(report_result["file_path"], "rb") as f:
                pdf_content = base64.b64encode(f.read()).decode("utf-8")
            attachments = [
                {
                    "filename": os.path.basename(report_result["file_path"]),
                    "content_type": "application/pdf",
                    "content": pdf_content,
                }
            ]
        except Exception as exc:
            failed_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str,
                    status="failed",
                    detail=f"pdf_read_failed: {exc}",
                )
            )
            continue

        # ── 7. Build email ─────────────────────────────────────────
        final_subject = (
            intel.cold_email_subject or "Propuesta de mejora para su sitio web"
        )
        final_body = intel.cold_email_body or ""

        profile_service = SenderProfileService(session)
        sender_profile = await profile_service.get_active()
        if sender_profile and sender_profile.email_signature:
            if sender_profile.email_signature not in final_body:
                final_body = final_body.rstrip() + "\n\n" + sender_profile.email_signature

        # ── 8. Send email ──────────────────────────────────────────
        email_service = EmailService(
            EmailConfig(
                provider=getattr(settings, "email_provider", "resend"),
                api_key=getattr(settings, "email_api_key", ""),
                from_email=getattr(settings, "email_from", "outreach@orion.dev"),
                from_name=getattr(
                    settings, "email_from_name", "Orion Outreach"
                ),
            )
        )

        email_result = await email_service.send(
            to=recipient,
            subject=final_subject,
            body=final_body,
            attachments=attachments,
        )

        if not email_result.success:
            failed_details.append(
                BulkSendDetail(
                    lead_id=lead_id_str,
                    status="failed",
                    detail=f"email_failed: {email_result.error}",
                )
            )
            continue

        # ── 9. Record outreach message ─────────────────────────────
        outreach_service = OutreachService(session)
        msg_create = OutreachCreate(
            lead_id=str(lead_id),
            sales_intel_id=str(intel.id),
            channel="email",
            direction="outbound",
            recipient=recipient,
            subject=final_subject,
            body=final_body,
            provider_message_id=email_result.message_id,
        )
        await outreach_service.create(
            msg_create,
            has_attachment=True,
            report_id=uuid.UUID(report_result["report_id"]),
            mark_sent=True,
        )

        # ── 10. Transition lead status ─────────────────────────────
        lead_service = LeadService(session)
        await lead_service.transition_status(lead_id, LeadStatus.contacted)

        sent_details.append(
            BulkSendDetail(
                lead_id=lead_id_str, status="sent", detail=recipient
            )
        )

        # ── 11. Rate-limit delay ───────────────────────────────────
        await asyncio.sleep(1)

    return BulkSendResponse(
        sent=len(sent_details),
        skipped=skipped_details,
        failed=failed_details,
    )
