"""Follow-up sequence scheduling and processing via Redis sorted sets.

Uses Redis ZADD (score = epoch timestamp) for lightweight scheduling.
A background poller calls ``process_due()`` every N seconds to pick up
due follow-ups and send them via the email service.

Exponential backoff: max 3 retries with 2^retry_count seconds delay.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_client import get_redis
from app.models.follow_up import FollowUpSequence, FollowUpStatus
from app.schemas.outreach import OutreachCreate
from app.services.email_service import EmailConfig, EmailService
from app.services.outreach_service import OutreachService

logger = logging.getLogger(__name__)

# Redis key for the follow-up sorted set
_FOLLOW_UP_QUEUE_KEY = "orion:queue:follow-up"
# Redis lock key to prevent concurrent pollers
_FOLLOW_UP_LOCK_KEY = "orion:follow-up:lock"
# Maximum retry attempts
_MAX_RETRIES = 3


class FollowUpService:
    """Manage and process follow-up email sequences."""

    def __init__(self, session: AsyncSession):
        self._session = session
        self._redis = get_redis()

    # ------------------------------------------------------------------
    # Scheduling
    # ------------------------------------------------------------------

    async def schedule_sequence(
        self,
        lead_id: uuid.UUID,
        sequence_name: str,
        steps: list[dict],
    ) -> list[FollowUpSequence]:
        """Schedule a sequence of follow-up emails for a lead.

        Each step is a dict with:
            - delay_days: int  (days from now)
            - subject: str
            - body: str
            - include_pdf: bool (optional, default False)

        Returns the list of created FollowUpSequence records.
        """
        from app.services.lead_closure import lead_blocks_follow_ups

        blocked, reason = await lead_blocks_follow_ups(self._session, lead_id)
        if blocked:
            raise ValueError(
                reason or "No se pueden programar follow-ups: el lead ya respondió"
            )

        now = datetime.now(timezone.utc)
        created: list[FollowUpSequence] = []

        for i, step in enumerate(steps):
            delay_days = step.get("delay_days", 0)
            scheduled_at = now + timedelta(days=delay_days)

            fu = FollowUpSequence(
                lead_id=lead_id,
                sequence_name=sequence_name,
                step_number=i + 1,
                scheduled_at=scheduled_at,
                status=FollowUpStatus.pending,
                subject=step["subject"],
                body=step["body"],
                include_pdf=step.get("include_pdf", False),
            )
            self._session.add(fu)
            await self._session.flush()
            await self._session.refresh(fu)
            created.append(fu)

            # Add to Redis sorted set (score = epoch timestamp)
            score = scheduled_at.timestamp()
            payload = json.dumps({
                "follow_up_id": str(fu.id),
                "lead_id": str(lead_id),
                "sequence_name": sequence_name,
                "step_number": fu.step_number,
                "scheduled_at": scheduled_at.isoformat(),
                "include_pdf": fu.include_pdf,
            })
            await self._redis.zadd(_FOLLOW_UP_QUEUE_KEY, {payload: score})

        await self._session.commit()
        logger.info(
            "follow_up_sequence_scheduled",
            extra={
                "lead_id": str(lead_id),
                "sequence_name": sequence_name,
                "steps": len(created),
            },
        )
        return created

    # ------------------------------------------------------------------
    # Processing (called by background poller)
    # ------------------------------------------------------------------

    async def process_due(self) -> list[dict]:
        """Poll Redis for due follow-ups and send them.

        Returns a list of results: {"follow_up_id": str, "status": "sent"|"failed", "error": str|None}
        """
        now = datetime.now(timezone.utc)
        now_ts = now.timestamp()

        # Range: from the earliest (0) up to now
        raw = await self._redis.zrangebyscore(
            _FOLLOW_UP_QUEUE_KEY, min=0, max=now_ts, start=0, num=50
        )

        results: list[dict] = []
        for entry in raw:
            try:
                data = json.loads(entry)
                fu_id = uuid.UUID(data["follow_up_id"])
            except (json.JSONDecodeError, KeyError, ValueError):
                logger.warning("follow_up_invalid_payload", extra={"entry": entry})
                await self._redis.zrem(_FOLLOW_UP_QUEUE_KEY, entry)
                continue

            result = await self._process_one(fu_id)
            results.append(result)

            # Remove from queue regardless of outcome (re-added on retry if needed)
            await self._redis.zrem(_FOLLOW_UP_QUEUE_KEY, entry)

        return results

    async def _process_one(self, fu_id: uuid.UUID) -> dict:
        """Process a single follow-up: fetch from DB, send email, update status."""
        fu = await self._session.get(FollowUpSequence, fu_id)
        if fu is None:
            return {"follow_up_id": str(fu_id), "status": "failed", "error": "Not found"}

        # Skip if already sent, cancelled, or not pending
        if fu.status != FollowUpStatus.pending:
            return {"follow_up_id": str(fu_id), "status": "skipped", "error": f"Status is {fu.status.value}"}

        from app.services.lead_closure import lead_blocks_follow_ups

        blocked, reason = await lead_blocks_follow_ups(self._session, fu.lead_id)
        if blocked:
            fu.status = FollowUpStatus.cancelled
            await self._session.commit()
            await self.cancel_sequence(fu.lead_id)
            return {
                "follow_up_id": str(fu_id),
                "status": "cancelled",
                "error": reason or "Follow-ups detenidos",
            }

        # Retrieve lead email
        from app.models.lead import Lead
        lead = await self._session.get(Lead, fu.lead_id)
        if lead is None or not lead.email:
            fu.status = FollowUpStatus.failed
            fu.last_error = "No lead email"
            await self._session.commit()
            return {"follow_up_id": str(fu_id), "status": "failed", "error": "No lead email"}

        # Build attachments if PDF is requested
        attachments = None
        if fu.include_pdf:
            attachments = await self._get_pdf_attachment(fu.lead_id)

        # Send email
        from app.core.config import get_settings
        settings = get_settings()
        email_service = EmailService(
            EmailConfig(
                provider=settings.email_provider,
                api_key=settings.email_api_key,
                from_email=settings.email_from,
                from_name=settings.email_from_name,
            )
        )

        from app.services.outreach_email_renderer import build_outreach_email_html
        from app.models.sales_intelligence import SalesIntelligence
        from sqlalchemy import select

        intel = (
            await self._session.execute(
                select(SalesIntelligence)
                .where(SalesIntelligence.lead_id == fu.lead_id)
                .order_by(SalesIntelligence.generated_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        html_body = await build_outreach_email_html(
            self._session,
            settings,
            body_text=fu.body,
            has_report_attachment=attachments is not None,
            lead_domain=getattr(lead, "normalized_domain", None),
            subject=fu.subject,
            lead_id=fu.lead_id,
            intel=intel,
        )

        result = await email_service.send(
            to=lead.email,
            subject=fu.subject,
            body=fu.body,
            html_body=html_body,
            attachments=attachments,
        )

        if result.success:
            fu.status = FollowUpStatus.sent
            fu.sent_at = datetime.now(timezone.utc)
            await self._session.commit()

            # Log the follow-up as an outreach message
            outreach_service = OutreachService(self._session)
            msg_create = OutreachCreate(
                lead_id=str(fu.lead_id),
                channel="email",
                direction="outbound",
                recipient=lead.email,
                subject=fu.subject,
                body=fu.body,
                provider_message_id=result.message_id,
            )
            await outreach_service.create(
                msg_create,
                has_attachment=(attachments is not None),
                report_id=None,
                mark_sent=True,
            )

            logger.info(
                "follow_up_sent",
                extra={"follow_up_id": str(fu_id), "step": fu.step_number},
            )
            return {
                "follow_up_id": str(fu_id),
                "status": "sent",
                "message_id": result.message_id,
            }
        else:
            fu.retry_count += 1
            fu.last_error = result.error

            if fu.retry_count < _MAX_RETRIES:
                # Exponential backoff: re-schedule
                backoff_seconds = 2 ** fu.retry_count * 60  # 2, 4, 8 minutes
                fu.status = FollowUpStatus.pending
                retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
                await self._redis.zadd(
                    _FOLLOW_UP_QUEUE_KEY,
                    {json.dumps({"follow_up_id": str(fu.id), "lead_id": str(fu.lead_id),
                                 "sequence_name": fu.sequence_name, "step_number": fu.step_number,
                                 "scheduled_at": retry_at.isoformat(), "include_pdf": fu.include_pdf}): retry_at.timestamp()},
                )
            else:
                fu.status = FollowUpStatus.failed

            await self._session.commit()
            return {
                "follow_up_id": str(fu_id),
                "status": "failed",
                "error": result.error,
                "retry": fu.retry_count,
            }

    async def _get_pdf_attachment(self, lead_id: uuid.UUID) -> Optional[list[dict]]:
        """Fetch the latest completed report for a lead and return as attachment payload."""
        import base64
        import os

        from app.models.report import Report, ReportStatus

        result = await self._session.execute(
            select(Report)
            .where(Report.lead_id == lead_id)
            .where(Report.status == ReportStatus.completed)
            .order_by(Report.generated_at.desc())
            .limit(1)
        )
        report = result.scalar_one_or_none()
        if report is None or not os.path.isfile(report.file_path):
            return None

        try:
            with open(report.file_path, "rb") as f:
                content = base64.b64encode(f.read()).decode("utf-8")
            return [{
                "filename": os.path.basename(report.file_path),
                "content_type": "application/pdf",
                "content": content,
            }]
        except Exception as exc:
            logger.warning(
                "follow_up_pdf_read_failed",
                extra={"report_id": str(report.id), "error": str(exc)},
            )
            return None

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------

    async def cancel_sequence(self, lead_id: uuid.UUID) -> int:
        """Cancel all pending follow-ups for a lead (DB + Redis).

        Returns the number of follow-ups cancelled.
        """
        # Cancel in DB
        result = await self._session.execute(
            select(FollowUpSequence)
            .where(FollowUpSequence.lead_id == lead_id)
            .where(FollowUpSequence.status == FollowUpStatus.pending)
        )
        pending = list(result.scalars().all())

        cancelled_count = 0
        for fu in pending:
            fu.status = FollowUpStatus.cancelled
            cancelled_count += 1

        await self._session.commit()

        # Remove from Redis
        # Since we stored JSON as members, we need to scan and remove by lead_id pattern
        if cancelled_count > 0:
            all_entries = await self._redis.zrange(_FOLLOW_UP_QUEUE_KEY, 0, -1)
            for entry in all_entries:
                try:
                    data = json.loads(entry)
                    if data.get("lead_id") == str(lead_id):
                        await self._redis.zrem(_FOLLOW_UP_QUEUE_KEY, entry)
                except (json.JSONDecodeError, KeyError):
                    continue

        logger.info(
            "follow_up_sequence_cancelled",
            extra={"lead_id": str(lead_id), "cancelled": cancelled_count},
        )
        return cancelled_count

    async def cancel_single(self, follow_up_id: uuid.UUID) -> Optional[FollowUpSequence]:
        """Cancel a specific follow-up by ID."""
        fu = await self._session.get(FollowUpSequence, follow_up_id)
        if fu is None:
            return None

        if fu.status == FollowUpStatus.pending:
            fu.status = FollowUpStatus.cancelled
            await self._session.commit()

            # Remove from Redis
            all_entries = await self._redis.zrange(_FOLLOW_UP_QUEUE_KEY, 0, -1)
            for entry in all_entries:
                try:
                    data = json.loads(entry)
                    if data.get("follow_up_id") == str(follow_up_id):
                        await self._redis.zrem(_FOLLOW_UP_QUEUE_KEY, entry)
                        break
                except (json.JSONDecodeError, KeyError):
                    continue

        return fu

    # ------------------------------------------------------------------
    # Mark reply (stops sequences)
    # ------------------------------------------------------------------

    async def mark_replied(self, lead_id: uuid.UUID) -> int:
        """Cancel all pending follow-ups when a lead replies.

        Returns the number of follow-ups cancelled.
        """
        return await self.cancel_sequence(lead_id)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    async def list_for_lead(self, lead_id: uuid.UUID) -> list[FollowUpSequence]:
        """List all follow-ups for a lead, ordered by step number."""
        result = await self._session.execute(
            select(FollowUpSequence)
            .where(FollowUpSequence.lead_id == lead_id)
            .order_by(FollowUpSequence.step_number)
        )
        return list(result.scalars().all())
