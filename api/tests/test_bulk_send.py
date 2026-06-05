"""Tests for POST /v1/outreach/bulk-send endpoint.

Covers:
- Pydantic validation (empty list, >20 IDs)
- Per-lead skip reasons (no lead, no intel, no email)
- Error isolation (one lead fails, others succeed)
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Mock WeasyPrint BEFORE any app imports (avoids macOS libgobject crash)
# ---------------------------------------------------------------------------
_fake_weasyprint = MagicMock()
_fake_weasyprint_modules = {
    "weasyprint": _fake_weasyprint,
    "weasyprint.html": MagicMock(),
    "weasyprint.css": MagicMock(),
    "weasyprint.text": MagicMock(),
    "weasyprint.formatting_structure": MagicMock(),
    "weasyprint.logger": MagicMock(),
    "weasyprint.fonts": MagicMock(),
    "weasyprint.images": MagicMock(),
    "weasyprint.layout": MagicMock(),
    "weasyprint.draw": MagicMock(),
    "weasyprint.pdf": MagicMock(),
}
for mod_name, fake_mod in _fake_weasyprint_modules.items():
    sys.modules[mod_name] = fake_mod

from app.api.v1.outreach import router  # noqa: E402
from app.core.database import get_session  # noqa: E402
from app.models.lead import Lead, LeadStatus  # noqa: E402
from app.models.sales_intelligence import SalesIntelligence  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture(autouse=True)
def _set_test_env(monkeypatch):
    """Set required env vars for all tests; avoids Settings validation errors."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("PDF_STORAGE_PATH", "/tmp")


@pytest.fixture
def mock_settings():
    settings = MagicMock()
    settings.email_provider = "resend"
    settings.email_api_key = "test-key"
    settings.email_from = "test@orion.dev"
    settings.email_from_name = "Test Sender"
    settings.pdf_storage_path = "/tmp"
    settings.pdf_max_size_mb = 20
    return settings


@pytest.fixture
def app(mock_session, mock_settings):
    app = FastAPI()
    app.include_router(router)

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session
    return app


@pytest.fixture
def client(app):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_open(read_data: bytes = b"fake pdf content"):
    """Create a mock for builtins.open that returns readable fake data."""
    mock_file = MagicMock()
    mock_file.read = MagicMock(return_value=read_data)
    mock_file.__enter__ = MagicMock(return_value=mock_file)
    mock_file.__exit__ = MagicMock(return_value=None)
    return MagicMock(return_value=mock_file)


def _make_lead(**overrides) -> MagicMock:
    defaults = {
        "id": uuid.uuid4(),
        "normalized_domain": "acme.com",
        "url": "https://acme.com",
        "company_name": "Acme Corp",
        "status": LeadStatus.audited,
        "deleted_at": None,
    }
    return MagicMock(spec=Lead, **{**defaults, **overrides})


def _make_intel(lead_id: uuid.UUID) -> MagicMock:
    return MagicMock(
        spec=SalesIntelligence,
        id=uuid.uuid4(),
        lead_id=lead_id,
        cold_email_subject="Mejora tu web",
        cold_email_body="Hola, vi tu sitio...",
        generated_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Task 4.1: Pydantic validation tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBulkSendRequestValidation:
    async def test_empty_lead_ids_returns_422(self, client):
        """BO-09: empty lead_ids list returns 422."""
        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": []},
        )
        assert response.status_code == 422

    async def test_exceeds_max_20_returns_422(self, client):
        """BO-09: >20 lead_ids returns 422 with detail."""
        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": [str(uuid.uuid4()) for _ in range(21)]},
        )
        assert response.status_code == 422

    async def test_missing_lead_ids_returns_422(self, client):
        """Missing lead_ids field returns 422."""
        response = await client.post(
            "/outreach/bulk-send",
            json={"attach_report": True},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Task 4.2: Per-lead skip reasons
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBulkSendSkipReasons:
    async def test_skip_invalid_uuid(self, client, mock_session):
        """Invalid UUID string is skipped with reason 'invalid_uuid'."""
        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": ["not-a-uuid"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sent"] == 0
        assert len(data["skipped"]) == 1
        assert data["skipped"][0]["detail"] == "invalid_uuid"

    async def test_skip_lead_not_found(self, client, mock_session):
        """Lead not found (or soft-deleted) is skipped."""
        lead_id = uuid.uuid4()

        # Mock session.execute to return None for lead
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_result)

        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": [str(lead_id)]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["skipped"]) == 1
        assert data["skipped"][0]["detail"] == "lead_not_found"

    async def test_skip_no_intelligence(self, client, mock_session):
        """Lead without SalesIntelligence is skipped."""
        lead_id = uuid.uuid4()
        lead = _make_lead(id=lead_id)

        # First call: lead found. Second call: no intel
        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none = MagicMock(return_value=lead)
        mock_intel_result = MagicMock()
        mock_intel_result.scalar_one_or_none = MagicMock(return_value=None)

        mock_session.execute = AsyncMock(
            side_effect=[mock_lead_result, mock_intel_result]
        )

        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": [str(lead_id)]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["skipped"]) == 1
        assert data["skipped"][0]["detail"] == "no_intelligence"

    async def test_skip_no_email(self, client, mock_session, monkeypatch):
        """Lead with intel but no email is skipped."""
        lead_id = uuid.uuid4()
        lead = _make_lead(id=lead_id)
        intel = _make_intel(lead_id)

        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none = MagicMock(return_value=lead)
        mock_intel_result = MagicMock()
        mock_intel_result.scalar_one_or_none = MagicMock(return_value=intel)

        mock_session.execute = AsyncMock(
            side_effect=[mock_lead_result, mock_intel_result]
        )

        async def _resolve_no_email(*args, **kwargs):
            return None, []

        monkeypatch.setattr(
            "app.api.v1.outreach.resolve_lead_email", _resolve_no_email
        )

        response = await client.post(
            "/outreach/bulk-send",
            json={"lead_ids": [str(lead_id)]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["skipped"]) == 1
        assert data["skipped"][0]["detail"] == "no_email"


# ---------------------------------------------------------------------------
# Task 4.3: Error isolation — one lead fails, others succeed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBulkSendErrorIsolation:
    async def test_one_pdf_failure_others_succeed(
        self, client, mock_session, monkeypatch
    ):
        """BO-05: lead #2 fails PDF, leads #1 and #3 succeed."""
        lead_ids = [uuid.uuid4() for _ in range(3)]
        leads = [_make_lead(id=lid) for lid in lead_ids]
        intels = [_make_intel(lid) for lid in lead_ids]

        # Build session.execute side_effects for all 3 leads
        execute_calls = []
        for i in range(3):
            lead_result = MagicMock()
            lead_result.scalar_one_or_none = MagicMock(return_value=leads[i])
            intel_result = MagicMock()
            intel_result.scalar_one_or_none = MagicMock(return_value=intels[i])
            execute_calls.extend([lead_result, intel_result])

        mock_session.execute = AsyncMock(side_effect=execute_calls)

        # Mock PDFService: lead #2 fails, others succeed
        call_count = 0

        async def _generate_report(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:  # lead #2
                raise RuntimeError("WeasyPrint rendering error")
            lid = args[1] if len(args) > 1 else "unknown"
            return {
                "report_id": str(uuid.uuid4()),
                "file_path": f"/tmp/{lid}.pdf",
                "file_size": 12345,
                "status": "completed",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        with patch(
            "app.api.v1.outreach.resolve_lead_email",
            new_callable=AsyncMock,
        ) as mock_resolve:
            mock_resolve.return_value = ("test@example.com", ["test@example.com"])

            with patch(
                "app.api.v1.outreach.persist_lead_email",
                new_callable=AsyncMock,
            ):
                with patch(
                    "app.api.v1.outreach.PDFService.generate_report",
                    side_effect=_generate_report,
                ):
                    with patch("builtins.open", _mock_open()):
                        with patch(
                            "app.api.v1.outreach.EmailService.send",
                            new_callable=AsyncMock,
                        ) as mock_send:
                            mock_send.return_value = MagicMock(
                                success=True, message_id="msg_123", error=None
                            )
                            with patch(
                                "app.api.v1.outreach.OutreachService.create",
                                new_callable=AsyncMock,
                            ):
                                with patch(
                                    "app.api.v1.outreach.LeadService.transition_status",
                                    new_callable=AsyncMock,
                                ):
                                    with patch(
                                        "app.api.v1.outreach.SenderProfileService.get_active",
                                        new_callable=AsyncMock,
                                    ) as mock_profile:
                                        mock_profile.return_value = None
                                        with patch(
                                            "app.api.v1.outreach.asyncio.sleep",
                                            new_callable=AsyncMock,
                                        ):
                                            response = await client.post(
                                                "/outreach/bulk-send",
                                                json={
                                                    "lead_ids": [
                                                        str(lid) for lid in lead_ids
                                                    ]
                                                },
                                            )

        assert response.status_code == 200
        data = response.json()
        assert data["sent"] == 2, f"Expected 2 sent, got {data}"
        assert len(data["failed"]) == 1
        assert data["failed"][0]["detail"].startswith("pdf_generation_failed")
        assert len(data["skipped"]) == 0

    async def test_email_send_failure_is_recorded_as_failed(
        self, client, mock_session, monkeypatch
    ):
        """Email send failure produces a failed entry, not exception."""
        lead_id = uuid.uuid4()
        lead = _make_lead(id=lead_id)
        intel = _make_intel(lead_id)

        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none = MagicMock(return_value=lead)
        mock_intel_result = MagicMock()
        mock_intel_result.scalar_one_or_none = MagicMock(return_value=intel)
        mock_session.execute = AsyncMock(
            side_effect=[mock_lead_result, mock_intel_result]
        )

        async def _resolve_ok(session, lead_id, override=None):
            return "test@example.com", ["test@example.com"]

        monkeypatch.setattr(
            "app.api.v1.outreach.resolve_lead_email", _resolve_ok
        )
        monkeypatch.setattr(
            "app.api.v1.outreach.persist_lead_email",
            AsyncMock(),
        )

        with patch(
            "app.api.v1.outreach.PDFService.generate_report",
            new_callable=AsyncMock,
        ) as mock_pdf:
            mock_pdf.return_value = {
                "report_id": str(uuid.uuid4()),
                "file_path": "/tmp/test.pdf",
                "file_size": 100,
                "status": "completed",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

            with patch("builtins.open", _mock_open()):
                with patch(
                    "app.api.v1.outreach.EmailService.send",
                    new_callable=AsyncMock,
                ) as mock_send:
                    mock_send.return_value = MagicMock(
                        success=False,
                        message_id=None,
                        error="Rate limit exceeded",
                    )

                    with patch(
                        "app.api.v1.outreach.SenderProfileService.get_active",
                        new_callable=AsyncMock,
                    ) as mock_profile:
                        mock_profile.return_value = None

                        with patch(
                            "app.api.v1.outreach.asyncio.sleep",
                            new_callable=AsyncMock,
                        ):
                            response = await client.post(
                                "/outreach/bulk-send",
                                json={"lead_ids": [str(lead_id)]},
                            )

        assert response.status_code == 200
        data = response.json()
        assert data["sent"] == 0
        assert len(data["failed"]) == 1
        assert "email_failed" in data["failed"][0]["detail"]

    async def test_happy_path_sends_and_returns_sent(self, client, mock_session, monkeypatch):
        """BO-02: successful send returns sent=1."""
        lead_id = uuid.uuid4()
        lead = _make_lead(id=lead_id)
        intel = _make_intel(lead_id)

        mock_lead_result = MagicMock()
        mock_lead_result.scalar_one_or_none = MagicMock(return_value=lead)
        mock_intel_result = MagicMock()
        mock_intel_result.scalar_one_or_none = MagicMock(return_value=intel)
        mock_session.execute = AsyncMock(
            side_effect=[mock_lead_result, mock_intel_result]
        )

        async def _resolve_ok(session, lead_id, override=None):
            return "test@example.com", ["test@example.com"]

        monkeypatch.setattr(
            "app.api.v1.outreach.resolve_lead_email", _resolve_ok
        )
        monkeypatch.setattr(
            "app.api.v1.outreach.persist_lead_email",
            AsyncMock(),
        )

        with patch(
            "app.api.v1.outreach.PDFService.generate_report",
            new_callable=AsyncMock,
        ) as mock_pdf:
            mock_pdf.return_value = {
                "report_id": str(uuid.uuid4()),
                "file_path": "/tmp/test.pdf",
                "file_size": 100,
                "status": "completed",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

            with patch("builtins.open", _mock_open()):
                with patch(
                    "app.api.v1.outreach.EmailService.send",
                    new_callable=AsyncMock,
                ) as mock_send:
                    mock_send.return_value = MagicMock(
                        success=True, message_id="msg_abc", error=None
                    )

                    with patch(
                        "app.api.v1.outreach.OutreachService.create",
                        new_callable=AsyncMock,
                    ):
                        with patch(
                            "app.api.v1.outreach.LeadService.transition_status",
                            new_callable=AsyncMock,
                        ):
                            with patch(
                                "app.api.v1.outreach.SenderProfileService.get_active",
                                new_callable=AsyncMock,
                            ) as mock_profile:
                                mock_profile.return_value = None

                                with patch(
                                    "app.api.v1.outreach.asyncio.sleep",
                                    new_callable=AsyncMock,
                                ):
                                    response = await client.post(
                                        "/outreach/bulk-send",
                                        json={"lead_ids": [str(lead_id)]},
                                    )

        assert response.status_code == 200
        data = response.json()
        assert data["sent"] == 1
        assert len(data["skipped"]) == 0
        assert len(data["failed"]) == 0
        assert data["sent"] == 1
