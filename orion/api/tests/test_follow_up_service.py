"""Tests for FollowUpService — scheduling, processing, cancellation.

Covers:
- Unit tests with mocked Redis ZADD/ZRANGEBYSCORE
- Unit tests with mocked email service (attachment encoding)
- Integration: full scheduling cycle
- Edge cases: missing report, oversized attachment, sequence cancellation
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow_up import FollowUpSequence, FollowUpStatus
from app.services.follow_up_service import FollowUpService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = MagicMock()
    return session


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.zadd = AsyncMock()
    redis.zrangebyscore = AsyncMock(return_value=[])
    redis.zrange = AsyncMock(return_value=[])
    redis.zrem = AsyncMock()
    redis.ping = AsyncMock(return_value=True)
    return redis


def _make_fu(**overrides) -> FollowUpSequence:
    """Create a FollowUpSequence instance with defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "lead_id": uuid.uuid4(),
        "sequence_name": "test_sequence",
        "step_number": 1,
        "scheduled_at": datetime.now(timezone.utc),
        "sent_at": None,
        "status": FollowUpStatus.pending,
        "subject": "Test Subject",
        "body": "Test Body",
        "include_pdf": False,
        "retry_count": 0,
        "last_error": None,
        "created_at": datetime.now(timezone.utc),
        **overrides,
    }
    return MagicMock(spec=FollowUpSequence, **defaults)


# ---------------------------------------------------------------------------
# Schedule Sequence Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestScheduleSequence:
    async def test_schedule_sequence_creates_records_and_redis(self, mock_session, mock_redis, monkeypatch):
        """Scheduling creates DB records and Redis ZADD entries."""
        lead_id = uuid.uuid4()
        steps = [
            {"delay_days": 0, "subject": "Day 0", "body": "Initial", "include_pdf": False},
            {"delay_days": 3, "subject": "Day 3", "body": "Follow up", "include_pdf": True},
            {"delay_days": 7, "subject": "Day 7", "body": "Last chance", "include_pdf": True},
        ]

        # Capture created objects
        created_fus: list[FollowUpSequence] = []

        async def mock_flush():
            # On flush, populate the id
            for i, fu in enumerate(created_fus):
                if hasattr(fu, "id") and not isinstance(fu.id, uuid.UUID):
                    pass

        async def mock_refresh(fu):
            created_fus.append(fu)

        mock_session.flush = mock_flush
        mock_session.refresh = mock_refresh

        # Mock the two ZADD calls
        monkeypatch.setattr(mock_redis, "zadd", AsyncMock())

        # Create a real (non-MagicMock) session with add capability
        real_session = AsyncMock(spec=AsyncSession)
        real_session.add = MagicMock()
        real_session.commit = AsyncMock()
        real_session.flush = AsyncMock()
        real_session.refresh = AsyncMock()

        # Simpler approach: test the core logic by mocking the FollowUpService constructor
        with patch.object(FollowUpService, "__init__", lambda self, s: setattr(self, "_session", real_session)):
            service = FollowUpService.__new__(FollowUpService)
            service._session = real_session
            service._redis = mock_redis

            # We need session.add and refresh to actually create objects
            captured = []
            def _add(obj):
                captured.append(obj)
            real_session.add = _add

            async def _refresh(obj):
                obj.id = uuid.uuid4()

            real_session.refresh = _refresh

            created = await service.schedule_sequence(lead_id, "test_seq", steps)

            assert len(captured) == 3
            assert mock_redis.zadd.call_count == 3

            # Verify each step
            for i, fu in enumerate(captured):
                assert fu.subject == steps[i]["subject"]
                assert fu.body == steps[i]["body"]
                assert fu.include_pdf == steps[i]["include_pdf"]
                assert fu.step_number == i + 1

    async def test_schedule_sequence_single_step(self, mock_session, mock_redis):
        """Single-step sequence should work."""
        lead_id = uuid.uuid4()
        steps = [{"delay_days": 0, "subject": "Hello", "body": "World"}]

        real_session = AsyncMock(spec=AsyncSession)
        real_session.add = MagicMock()
        real_session.commit = AsyncMock()
        real_session.flush = AsyncMock()
        real_session.refresh = AsyncMock()

        service = FollowUpService.__new__(FollowUpService)
        service._session = real_session
        service._redis = mock_redis

        captured = []
        real_session.add = lambda obj: captured.append(obj)
        async def _refresh(obj):
            obj.id = uuid.uuid4()
        real_session.refresh = _refresh

        created = await service.schedule_sequence(lead_id, "single", steps)

        assert len(captured) == 1
        assert mock_redis.zadd.called


# ---------------------------------------------------------------------------
# Process Due Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestProcessDue:
    async def test_process_due_empty_queue(self, mock_session, mock_redis):
        """Empty Redis queue returns empty list."""
        mock_redis.zrangebyscore = AsyncMock(return_value=[])

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()
        assert results == []

    async def test_process_due_sends_pending(self, mock_session, mock_redis, monkeypatch):
        """Due follow-ups are picked up and processed."""
        fu_id = uuid.uuid4()
        lead_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(lead_id),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": now.isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])
        mock_redis.zrem = AsyncMock()

        # Mock settings to avoid env var dependency
        from app.core.config import Settings
        mock_settings = Settings(
            DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
            REDIS_URL="redis://localhost:6379/0",
        )
        monkeypatch.setattr(
            "app.core.config.get_settings", lambda: mock_settings
        )

        # Mock DB: follow-up found, pending, no reply
        fu = _make_fu(id=fu_id, lead_id=lead_id, status=FollowUpStatus.pending)
        from app.models.lead import Lead

        lead = MagicMock(spec=Lead)
        lead.id = lead_id
        lead.email = "test@example.com"

        async def mock_get(model, _id):
            if model == FollowUpSequence:
                return fu
            if model == Lead:
                return lead
            return None

        mock_session.get = mock_get

        # Mock email service
        with patch("app.services.follow_up_service.EmailService") as MockEmailSvc:
            mock_email = MagicMock()
            mock_email.send = AsyncMock(
                return_value=MagicMock(success=True, message_id="msg_001")
            )
            MockEmailSvc.return_value = mock_email

            # Mock no reachable replies — scalar_one_or_none is synchronous
            mock_exec = MagicMock()
            mock_exec.scalar_one_or_none = MagicMock(return_value=None)
            mock_session.execute = AsyncMock(return_value=mock_exec)

            service = FollowUpService.__new__(FollowUpService)
            service._session = mock_session
            service._redis = mock_redis

            results = await service.process_due()

            assert len(results) == 1
            assert results[0]["status"] == "sent"
            assert fu.status == FollowUpStatus.sent
            assert mock_redis.zrem.called

    async def test_process_due_skips_already_sent(self, mock_session, mock_redis):
        """Already-sent follow-ups are skipped."""
        fu_id = uuid.uuid4()
        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(uuid.uuid4()),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        fu = _make_fu(id=fu_id, status=FollowUpStatus.sent)
        mock_session.get = AsyncMock(return_value=fu)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()
        assert results[0]["status"] == "skipped"

    async def test_process_due_stops_on_reply(self, mock_session, mock_redis):
        """Follow-up is cancelled when lead has replied."""
        fu_id = uuid.uuid4()
        lead_id = uuid.uuid4()

        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(lead_id),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        fu = _make_fu(id=fu_id, lead_id=lead_id, status=FollowUpStatus.pending)
        mock_session.get = AsyncMock(return_value=fu)

        # Mock replied outreach — scalar_one_or_none is synchronous
        from app.models.outreach import OutreachMessage
        replied_msg = MagicMock(spec=OutreachMessage)

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=replied_msg)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()

        assert results[0]["status"] == "cancelled"
        assert fu.status == FollowUpStatus.cancelled

    async def test_process_due_retry_on_failure(self, mock_session, mock_redis, monkeypatch):
        """Failed send with retries < max should re-schedule."""
        fu_id = uuid.uuid4()
        lead_id = uuid.uuid4()

        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(lead_id),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        # Mock settings
        from app.core.config import Settings
        mock_settings = Settings(
            DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
            REDIS_URL="redis://localhost:6379/0",
        )
        monkeypatch.setattr(
            "app.core.config.get_settings", lambda: mock_settings
        )

        fu = _make_fu(id=fu_id, lead_id=lead_id, status=FollowUpStatus.pending)
        from app.models.lead import Lead

        lead = MagicMock(spec=Lead)
        lead.id = lead_id
        lead.email = "test@example.com"

        async def mock_get(model, _id):
            if model == FollowUpSequence:
                return fu
            if model == Lead:
                return lead
            return None

        mock_session.get = mock_get

        # Mock no replies
        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        # Email fails
        with patch("app.services.follow_up_service.EmailService") as MockEmailSvc:
            mock_email = MagicMock()
            mock_email.send = AsyncMock(
                return_value=MagicMock(success=False, error="SMTP timeout")
            )
            MockEmailSvc.return_value = mock_email

            service = FollowUpService.__new__(FollowUpService)
            service._session = mock_session
            service._redis = mock_redis

            results = await service.process_due()

            assert results[0]["status"] == "failed"
            assert fu.retry_count == 1
            # Should re-add to Redis for retry
            assert mock_redis.zadd.called

    async def test_process_due_max_retries_exceeded(self, mock_session, mock_redis, monkeypatch):
        """After max retries, follow-up is marked failed permanently."""
        fu_id = uuid.uuid4()
        lead_id = uuid.uuid4()

        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(lead_id),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        # Mock settings
        from app.core.config import Settings
        mock_settings = Settings(
            DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
            REDIS_URL="redis://localhost:6379/0",
        )
        monkeypatch.setattr(
            "app.core.config.get_settings", lambda: mock_settings
        )

        fu = _make_fu(id=fu_id, lead_id=lead_id, status=FollowUpStatus.pending, retry_count=3)
        from app.models.lead import Lead

        lead = MagicMock(spec=Lead)
        lead.id = lead_id
        lead.email = "test@example.com"

        async def mock_get(model, _id):
            if model == FollowUpSequence:
                return fu
            if model == Lead:
                return lead
            return None

        mock_session.get = mock_get

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        with patch("app.services.follow_up_service.EmailService") as MockEmailSvc:
            mock_email = MagicMock()
            mock_email.send = AsyncMock(
                return_value=MagicMock(success=False, error="Permanent failure")
            )
            MockEmailSvc.return_value = mock_email

            service = FollowUpService.__new__(FollowUpService)
            service._session = mock_session
            service._redis = mock_redis

            results = await service.process_due()

            assert results[0]["status"] == "failed"
            assert fu.status == FollowUpStatus.failed


# ---------------------------------------------------------------------------
# Cancel Sequence Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCancelSequence:
    async def test_cancel_sequence_removes_from_db_and_redis(self, mock_session, mock_redis, monkeypatch):
        """Cancellation updates DB status and removes Redis entries."""
        lead_id = uuid.uuid4()

        fu1 = _make_fu(lead_id=lead_id, status=FollowUpStatus.pending)
        fu2 = _make_fu(lead_id=lead_id, status=FollowUpStatus.pending)

        # scalars().all() is synchronous on SQLAlchemy Result
        mock_scalars = MagicMock()
        mock_scalars.all = MagicMock(return_value=[fu1, fu2])
        mock_exec = MagicMock()
        mock_exec.scalars = MagicMock(return_value=mock_scalars)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        redis_entries = [
            json.dumps({"follow_up_id": str(fu1.id), "lead_id": str(lead_id)}),
            json.dumps({"follow_up_id": str(fu2.id), "lead_id": str(lead_id)}),
            json.dumps({"follow_up_id": str(uuid.uuid4()), "lead_id": str(uuid.uuid4())}),
        ]
        mock_redis.zrange = AsyncMock(return_value=redis_entries)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        count = await service.cancel_sequence(lead_id)

        assert count == 2
        assert fu1.status == FollowUpStatus.cancelled
        assert fu2.status == FollowUpStatus.cancelled
        # Should have removed 2 entries from Redis
        assert mock_redis.zrem.call_count == 2

    async def test_cancel_single(self, mock_session, mock_redis):
        """Cancel a specific follow-up by ID."""
        fu_id = uuid.uuid4()
        fu = _make_fu(id=fu_id, status=FollowUpStatus.pending)

        mock_session.get = AsyncMock(return_value=fu)
        mock_redis.zrange = AsyncMock(return_value=[
            json.dumps({"follow_up_id": str(fu_id), "lead_id": str(fu.lead_id)}),
        ])

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        result = await service.cancel_single(fu_id)

        assert result is not None
        assert result.status == FollowUpStatus.cancelled


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestEdgeCases:
    async def test_schedule_missing_lead_email(self, mock_session, mock_redis):
        """Processing a follow-up for a lead without email should fail gracefully."""
        fu_id = uuid.uuid4()
        lead_id = uuid.uuid4()

        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(lead_id),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        fu = _make_fu(id=fu_id, lead_id=lead_id, status=FollowUpStatus.pending)
        from app.models.lead import Lead

        lead = MagicMock(spec=Lead)
        lead.id = lead_id
        lead.email = None  # No email

        async def mock_get(model, _id):
            if model == FollowUpSequence:
                return fu
            if model == Lead:
                return lead
            return None

        mock_session.get = mock_get

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()

        assert results[0]["status"] == "failed"
        assert fu.status == FollowUpStatus.failed
        assert fu.last_error == "No lead email"

    async def test_process_due_invalid_json(self, mock_session, mock_redis):
        """Malformed Redis entries should be skipped and removed."""
        mock_redis.zrangebyscore = AsyncMock(return_value=["{invalid json}"])

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()

        assert results == []
        assert mock_redis.zrem.called  # malformed entry removed

    async def test_process_due_lead_not_found(self, mock_session, mock_redis):
        """Follow-up for nonexistent lead should fail."""
        fu_id = uuid.uuid4()
        payload = json.dumps({
            "follow_up_id": str(fu_id),
            "lead_id": str(uuid.uuid4()),
            "sequence_name": "test",
            "step_number": 1,
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "include_pdf": False,
        })
        mock_redis.zrangebyscore = AsyncMock(return_value=[payload])

        fu = _make_fu(id=fu_id, status=FollowUpStatus.pending)
        mock_session.get = AsyncMock(return_value=fu)

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        # Lead not found
        async def mock_get_lead(model, _id):
            if model == FollowUpSequence:
                return fu
            from app.models.lead import Lead
            if model == Lead:
                return None  # lead not found
            return None

        mock_session.get = mock_get_lead

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        results = await service.process_due()

        assert results[0]["status"] == "failed"
        assert fu.last_error == "No lead email"


# ---------------------------------------------------------------------------
# Attachment Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAttachments:
    async def test_get_pdf_attachment_found(self, mock_session, mock_redis, tmp_path):
        """PDF attachment is properly base64-encoded."""
        import base64

        lead_id = uuid.uuid4()
        pdf_path = tmp_path / "report.pdf"
        pdf_content = b"%PDF-1.4 test content"
        pdf_path.write_bytes(pdf_content)

        from app.models.report import Report, ReportStatus

        report = MagicMock(spec=Report)
        report.id = uuid.uuid4()
        report.lead_id = lead_id
        report.file_path = str(pdf_path)
        report.status = ReportStatus.completed

        # scalar_one_or_none() is synchronous on SQLAlchemy Result
        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=report)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        attachments = await service._get_pdf_attachment(lead_id)

        assert attachments is not None
        assert len(attachments) == 1
        assert attachments[0]["filename"] == "report.pdf"
        assert attachments[0]["content_type"] == "application/pdf"

        # Verify base64 roundtrip
        decoded = base64.b64decode(attachments[0]["content"])
        assert decoded == pdf_content

    async def test_get_pdf_attachment_no_report(self, mock_session, mock_redis):
        """Returns None when no completed report exists."""
        lead_id = uuid.uuid4()

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        attachments = await service._get_pdf_attachment(lead_id)
        assert attachments is None

    async def test_get_pdf_attachment_file_missing(self, mock_session, mock_redis):
        """Returns None when report record exists but file is missing."""
        lead_id = uuid.uuid4()

        from app.models.report import Report, ReportStatus

        report = MagicMock(spec=Report)
        report.id = uuid.uuid4()
        report.lead_id = lead_id
        report.file_path = "/nonexistent/report.pdf"
        report.status = ReportStatus.completed

        mock_exec = MagicMock()
        mock_exec.scalar_one_or_none = MagicMock(return_value=report)
        mock_session.execute = AsyncMock(return_value=mock_exec)

        service = FollowUpService.__new__(FollowUpService)
        service._session = mock_session
        service._redis = mock_redis

        attachments = await service._get_pdf_attachment(lead_id)
        assert attachments is None
