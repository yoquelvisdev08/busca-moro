"""Endpoints para gestión de outreach (emails, seguimiento)."""
from __future__ import annotations

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

    service = OutreachService(session)
    msg = await service.record_inbound(payload)
    await lead_service.transition_status(lead.id, LeadStatus.replied)
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
    service = OutreachService(session)
    await service.track_reply(msg_id)
    return {"status": "tracked"}


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
            from_email=getattr(settings, "email_from", "outreach@siphonx.dev"),
            from_name=getattr(settings, "email_from_name", "SIPHON-X Outreach"),
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

        return {
            "status": "sent",
            "message_id": result.message_id,
            "outreach_id": str(msg.id),
            "recipient": recipient,
            "has_attachment": has_attachment,
        }
    raise HTTPException(status_code=500, detail=f"Failed to send email: {result.error}")
