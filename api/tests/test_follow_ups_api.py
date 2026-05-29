"""Tests for Follow-Up API endpoints.

Covers all 4 REST endpoints with mocked database interactions.
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
_fake_weasyprint_html = MagicMock()
_fake_weasyprint_modules = {
    "weasyprint": _fake_weasyprint,
    "weasyprint.html": _fake_weasyprint_html,
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

# Also mock PyPDF2 since it might not be installed
if "PyPDF2" not in sys.modules:
    sys.modules["PyPDF2"] = MagicMock()

from app.api.v1.follow_ups import router  # noqa: E402
from app.core.database import get_session  # noqa: E402
from app.models.follow_up import FollowUpSequence, FollowUpStatus  # noqa: E402
from app.models.lead import Lead, LeadStatus  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def app(mock_session):
    app = FastAPI()
    app.include_router(router)

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session
    return app


@pytest.fixture
def client(app):
    """Sync HTTP test client."""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_lead(**overrides) -> Lead:
    defaults = {
        "id": uuid.uuid4(),
        "normalized_domain": "acme.com",
        "url": "https://acme.com",
        "company_name": "Acme Corp",
        "status": LeadStatus.contacted,
    }
    return MagicMock(spec=Lead, **{**defaults, **overrides})


def _make_fu(**overrides) -> FollowUpSequence:
    defaults = {
        "id": uuid.uuid4(),
        "lead_id": uuid.uuid4(),
        "sequence_name": "default",
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
# POST /leads/{lead_id}/schedule-follow-up
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestScheduleFollowUp:
    async def test_schedule_follow_up_success(self, client, mock_session, monkeypatch):
        """Scheduling a sequence returns the created records."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        created_fus = [
            _make_fu(lead_id=lead.id, step_number=1, scheduled_at=datetime(2026, 5, 28, tzinfo=timezone.utc)),
            _make_fu(lead_id=lead.id, step_number=2, scheduled_at=datetime(2026, 5, 31, tzinfo=timezone.utc)),
            _make_fu(lead_id=lead.id, step_number=3, scheduled_at=datetime(2026, 6, 4, tzinfo=timezone.utc)),
        ]

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.schedule_sequence = AsyncMock(return_value=created_fus)
            MockSvc.return_value = mock_service

            response = await client.post(
                f"/leads/{lead.id}/schedule-follow-up",
                json={
                    "sequence_name": "default",
                    "steps": [
                        {"delay_days": 0, "subject": "Day 0", "body": "Initial"},
                        {"delay_days": 3, "subject": "Day 3", "body": "Follow up"},
                        {"delay_days": 7, "subject": "Day 7", "body": "Last"},
                    ],
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["sequence_name"] == "default"
        assert data["steps_scheduled"] == 3
        assert len(data["follow_up_ids"]) == 3
        assert data["next_scheduled_at"] is not None

    async def test_schedule_follow_up_lead_not_found(self, client, mock_session):
        """404 when lead doesn't exist."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.post(
            f"/leads/{uuid.uuid4()}/schedule-follow-up",
            json={
                "sequence_name": "default",
                "steps": [{"delay_days": 0, "subject": "Test", "body": "Body"}],
            },
        )

        assert response.status_code == 404

    async def test_schedule_follow_up_empty_steps(self, client, mock_session):
        """422 when steps list is empty."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        response = await client.post(
            f"/leads/{lead.id}/schedule-follow-up",
            json={
                "sequence_name": "test",
                "steps": [],
            },
        )

        assert response.status_code == 422

    async def test_schedule_follow_up_creates_correct_count(self, client, mock_session):
        """Verify exactly 3 follow-ups created for 3-step sequence."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        created_fus = [
            _make_fu(lead_id=lead.id, step_number=1),
            _make_fu(lead_id=lead.id, step_number=2),
            _make_fu(lead_id=lead.id, step_number=3),
        ]

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.schedule_sequence = AsyncMock(return_value=created_fus)
            MockSvc.return_value = mock_service

            response = await client.post(
                f"/leads/{lead.id}/schedule-follow-up",
                json={
                    "sequence_name": "default",
                    "steps": [
                        {"delay_days": 0, "subject": "S1", "body": "B1"},
                        {"delay_days": 3, "subject": "S2", "body": "B2"},
                        {"delay_days": 7, "subject": "S3", "body": "B3", "include_pdf": True},
                    ],
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["steps_scheduled"] == 3


# ---------------------------------------------------------------------------
# GET /leads/{lead_id}/follow-ups
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestListFollowUps:
    async def test_list_follow_ups_empty(self, client, mock_session):
        """Empty list when no follow-ups exist."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.list_for_lead = AsyncMock(return_value=[])
            MockSvc.return_value = mock_service

            response = await client.get(f"/leads/{lead.id}/follow-ups")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_follow_ups_with_items(self, client, mock_session):
        """List returns all follow-ups for a lead."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        fus = [
            _make_fu(lead_id=lead.id, step_number=1, status=FollowUpStatus.sent),
            _make_fu(lead_id=lead.id, step_number=2, status=FollowUpStatus.pending),
            _make_fu(lead_id=lead.id, step_number=3, status=FollowUpStatus.pending),
        ]

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.list_for_lead = AsyncMock(return_value=fus)
            MockSvc.return_value = mock_service

            response = await client.get(f"/leads/{lead.id}/follow-ups")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3
        # Verify order by step number
        assert data["items"][0]["step_number"] == 1
        assert data["items"][1]["step_number"] == 2
        assert data["items"][2]["step_number"] == 3

    async def test_list_follow_ups_lead_not_found(self, client, mock_session):
        """404 when lead doesn't exist."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.get(f"/leads/{uuid.uuid4()}/follow-ups")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /follow-ups/{follow_up_id}/cancel
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCancelFollowUp:
    async def test_cancel_single_success(self, client, mock_session):
        """Cancel a single follow-up."""
        fu = _make_fu(status=FollowUpStatus.pending)

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.cancel_single = AsyncMock(return_value=fu)
            MockSvc.return_value = mock_service

            response = await client.post(f"/follow-ups/{fu.id}/cancel")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["follow_up_id"] == str(fu.id)

    async def test_cancel_single_not_found(self, client, mock_session):
        """404 when follow-up doesn't exist."""
        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.cancel_single = AsyncMock(return_value=None)
            MockSvc.return_value = mock_service

            response = await client.post(f"/follow-ups/{uuid.uuid4()}/cancel")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /leads/{lead_id}/cancel-follow-ups
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCancelAllFollowUps:
    async def test_cancel_all_success(self, client, mock_session):
        """Cancel all pending follow-ups for a lead."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.cancel_sequence = AsyncMock(return_value=3)
            MockSvc.return_value = mock_service

            response = await client.post(f"/leads/{lead.id}/cancel-follow-ups")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["cancelled_count"] == 3
        assert data["lead_id"] == str(lead.id)

    async def test_cancel_all_no_pending(self, client, mock_session):
        """Returns 0 when no pending follow-ups."""
        lead = _make_lead()
        mock_session.get = AsyncMock(return_value=lead)

        with patch("app.api.v1.follow_ups.FollowUpService") as MockSvc:
            mock_service = MagicMock()
            mock_service.cancel_sequence = AsyncMock(return_value=0)
            MockSvc.return_value = mock_service

            response = await client.post(f"/leads/{lead.id}/cancel-follow-ups")

        assert response.status_code == 200
        data = response.json()
        assert data["cancelled_count"] == 0

    async def test_cancel_all_lead_not_found(self, client, mock_session):
        """404 when lead doesn't exist."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.post(f"/leads/{uuid.uuid4()}/cancel-follow-ups")

        assert response.status_code == 404
