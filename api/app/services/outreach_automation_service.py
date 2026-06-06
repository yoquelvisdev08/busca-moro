"""Envío automático: genera PDF y manda cold email a un lead enriquecido."""

from __future__ import annotations

import base64
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.lead import Lead, LeadStatus
from app.models.sales_intelligence import SalesIntelligence
from app.schemas.outreach import OutreachCreate
from app.services.email_service import EmailConfig, EmailService
from app.services.lead_contact import persist_lead_email, resolve_lead_email
from app.services.lead_service import LeadService
from app.services.outreach_email_renderer import build_outreach_email_html
from app.services.outreach_service import OutreachService
from app.services.pdf_service import PDFService
from app.services.sender_profile_service import SenderProfileService

logger = logging.getLogger(__name__)


@dataclass
class OutreachAutomationResult:
    lead_id: uuid.UUID
    status: str  # sent | skipped | failed
    detail: str = ""


class OutreachAutomationService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def send_report_and_email(self, lead_id: uuid.UUID) -> OutreachAutomationResult:
        result = await self._session.execute(
            select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if lead is None:
            return OutreachAutomationResult(lead_id, "skipped", "lead_not_found")

        intel_result = await self._session.execute(
            select(SalesIntelligence)
            .where(SalesIntelligence.lead_id == lead_id)
            .order_by(SalesIntelligence.generated_at.desc())
            .limit(1)
        )
        intel = intel_result.scalar_one_or_none()
        if intel is None:
            return OutreachAutomationResult(lead_id, "skipped", "no_intelligence")

        try:
            recipient, _ = await resolve_lead_email(self._session, lead_id, override=None)
        except ValueError as exc:
            return OutreachAutomationResult(lead_id, "skipped", str(exc))

        if not recipient:
            return OutreachAutomationResult(lead_id, "skipped", "no_email")

        if not self._settings.email_api_key:
            return OutreachAutomationResult(
                lead_id, "failed", "email_api_key_not_configured"
            )

        await persist_lead_email(self._session, lead, recipient)

        try:
            pdf_service = PDFService(self._session)
            report_result = await pdf_service.generate_report(lead_id)
        except Exception as exc:
            logger.warning("auto_outreach_pdf_failed", extra={"lead_id": str(lead_id), "err": str(exc)})
            return OutreachAutomationResult(lead_id, "failed", f"pdf: {exc}")

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
            return OutreachAutomationResult(lead_id, "failed", f"pdf_read: {exc}")

        final_subject = intel.cold_email_subject or "Propuesta de mejora para su sitio web"
        final_body = intel.cold_email_body or ""

        profile_service = SenderProfileService(self._session)
        sender_profile = await profile_service.get_active()
        if sender_profile and sender_profile.email_signature:
            if sender_profile.email_signature not in final_body:
                final_body = final_body.rstrip() + "\n\n" + sender_profile.email_signature

        email_service = EmailService(
            EmailConfig(
                provider=self._settings.email_provider,
                api_key=self._settings.email_api_key,
                from_email=self._settings.email_from,
                from_name=self._settings.email_from_name,
            )
        )
        html_body = await build_outreach_email_html(
            self._session,
            self._settings,
            body_text=final_body,
            has_report_attachment=True,
            lead_domain=lead.normalized_domain,
            subject=final_subject,
        )
        email_result = await email_service.send(
            to=recipient,
            subject=final_subject,
            body=final_body,
            html_body=html_body,
            attachments=attachments,
        )

        if not email_result.success:
            return OutreachAutomationResult(
                lead_id, "failed", email_result.error or "email_failed"
            )

        outreach_service = OutreachService(self._session)
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

        lead_service = LeadService(self._session)
        await lead_service.transition_status(lead_id, LeadStatus.contacted)

        return OutreachAutomationResult(lead_id, "sent", recipient)
