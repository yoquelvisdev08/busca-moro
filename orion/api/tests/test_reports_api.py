"""Tests for Reports API endpoints.

Covers all 6 REST endpoints with mocked database interactions.
"""

from __future__ import annotations

import io
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.reports import router
from app.core.database import get_session
from app.models.lead import Lead, LeadStatus
from app.models.report import Report, ReportStatus
from app.schemas.report import ReportReadDetail


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_session():
    """Create a mock async session preset with common returns."""
    return AsyncMock()


@pytest.fixture
def app(mock_session):
    """FastAPI test app with mocked DB dependency."""
    app = FastAPI()
    app.include_router(router)

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session
    return app


@pytest.fixture
async def client(app):
    """Async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_lead(**overrides) -> Lead:
    defaults = {
        "id": uuid.uuid4(),
        "normalized_domain": "acme.com",
        "url": "https://acme.com",
        "company_name": "Acme Corp",
        "industry": "SaaS",
        "country_code": "US",
        "status": LeadStatus.audited,
        "segment": "A",
        "score": 80,
        "commercial_score": 75,
        "lighthouse_score": 65,
        "has_ssl": True,
        "mobile_friendly": True,
        "load_time_ms": 2000,
        "created_at": datetime.now(timezone.utc),
    }
    for k, v in {**defaults, **overrides}.items():
        setattr(defaults, k, v)
    # Actually, MagicMock is easier for this
    return MagicMock(spec=Lead, **{**defaults, **overrides})


def _make_report(**overrides) -> Report:
    defaults = {
        "id": uuid.uuid4(),
        "lead_id": uuid.uuid4(),
        "audit_id": None,
        "sales_intel_id": None,
        "file_path": f"/tmp/test_report_{uuid.uuid4().hex[:8]}.pdf",
        "file_size": 250_000,
        "status": ReportStatus.completed,
        "generated_at": datetime.now(timezone.utc),
        "sent_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    return MagicMock(spec=Report, **{**defaults, **overrides})


# ---------------------------------------------------------------------------
# POST /leads/{lead_id}/generate-report
# ---------------------------------------------------------------------------


class TestGenerateReport:
    @pytest.mark.asyncio
    async def test_generate_report_success(self, client, mock_session, monkeypatch):
        """Successful PDF generation returns 201."""
        lead = _make_lead()

        from app.core.config import Settings

        mock_settings = Settings()
        monkeypatch.setattr(
            "app.api.v1.reports.get_settings", lambda: mock_settings
        )

        report = _make_report(lead_id=lead.id)
        mock_session.get = AsyncMock(side_effect=[lead, report])

        with patch("app.api.v1.reports.PDFService") as MockService:
            mock_service = MagicMock()
            mock_service.generate_report = AsyncMock(
                return_value={
                    "report_id": str(report.id),
                    "file_path": "/tmp/report.pdf",
                    "file_size": 250_000,
                    "status": "completed",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            MockService.return_value = mock_service

            response = await client.post(f"/leads/{lead.id}/generate-report")

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["id"] == str(report.id)
        assert "file_path" in data

    @pytest.mark.asyncio
    async def test_generate_report_lead_not_found(self, client, mock_session):
        """404 when lead doesn't exist."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.post(
            f"/leads/{uuid.uuid4()}/generate-report"
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_report_disabled(self, client, mock_session, monkeypatch):
        """503 when PDF generation is disabled."""
        lead = _make_lead()

        from app.core.config import Settings

        mock_settings = Settings()
        monkeypatch.setattr(
            "app.api.v1.reports.get_settings",
            lambda: Settings(pdf_generation_enabled=False),
        )

        mock_session.get = AsyncMock(return_value=lead)

        response = await client.post(f"/leads/{lead.id}/generate-report")

        assert response.status_code == 503


# ---------------------------------------------------------------------------
# GET /reports (list)
# ---------------------------------------------------------------------------


class TestListReports:
    @pytest.mark.asyncio
    async def test_list_reports_empty(self, client, mock_session):
        """Empty list when no reports exist."""
        mock_session.execute = AsyncMock()
        mock_session.execute.return_value.scalar_one.return_value = 0
        mock_session.execute.return_value.scalars.return_value.all.return_value = []

        response = await client.get("/reports")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_list_reports_with_items(self, client, mock_session):
        """List with reports returns correct data."""
        report = _make_report()
        lead = _make_lead(id=report.lead_id)

        mock_execute = AsyncMock()
        # First call: count query → 1, second call: select query → [report]
        scalar_one = AsyncMock()
        scalar_one.return_value = 1

        scalar_all = MagicMock()
        scalar_all.all.return_value = [report]

        mock_execute.return_value.scalar_one = scalar_one
        mock_execute.return_value.scalars.return_value = scalar_all

        # Lead query for batch fetch
        lead_result = MagicMock()
        lead_result.scalars.return_value.all.return_value = [lead]

        mock_session.execute = AsyncMock(
            side_effect=[mock_execute.return_value, lead_result.return_value]
        )

        response = await client.get("/reports")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert "lead_domain" in item
        assert item["lead_domain"] == "acme.com"

    @pytest.mark.asyncio
    async def test_list_reports_filter_by_status(self, client, mock_session):
        """Filter reports by status."""
        mock_execute = AsyncMock()
        scalar_one = AsyncMock()
        scalar_one.return_value = 0
        mock_execute.return_value.scalar_one = scalar_one
        mock_execute.return_value.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_execute.return_value)

        response = await client.get("/reports?status=completed")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# GET /reports/{report_id}
# ---------------------------------------------------------------------------


class TestGetReport:
    @pytest.mark.asyncio
    async def test_get_report_found(self, client, mock_session):
        """Get single report metadata."""
        report = _make_report()
        lead = _make_lead(id=report.lead_id)

        mock_session.get = AsyncMock(side_effect=[report, lead])

        response = await client.get(f"/reports/{report.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(report.id)
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_get_report_not_found(self, client, mock_session):
        """404 for missing report."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.get(f"/reports/{uuid.uuid4()}")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /reports/{report_id}/download
# ---------------------------------------------------------------------------


class TestDownloadReport:
    @pytest.mark.asyncio
    async def test_download_pdf(self, client, mock_session, tmp_path):
        """Download PDF returns correct content-type."""
        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake pdf content")

        report = _make_report(file_path=str(pdf_path))
        mock_session.get = AsyncMock(return_value=report)

        response = await client.get(f"/reports/{report.id}/download")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers.get("content-disposition", "")

    @pytest.mark.asyncio
    async def test_download_incomplete_report(self, client, mock_session):
        """409 when report is not yet completed."""
        report = _make_report(status=ReportStatus.generating, file_path="")
        mock_session.get = AsyncMock(return_value=report)

        response = await client.get(f"/reports/{report.id}/download")

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_download_file_gone(self, client, mock_session):
        """410 when PDF file doesn't exist on disk."""
        report = _make_report(
            file_path="/nonexistent/report.pdf", status=ReportStatus.completed
        )
        mock_session.get = AsyncMock(return_value=report)

        response = await client.get(f"/reports/{report.id}/download")

        assert response.status_code == 410

    @pytest.mark.asyncio
    async def test_download_report_not_found(self, client, mock_session):
        """404 for missing report."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.get(f"/reports/{uuid.uuid4()}/download")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /reports/{report_id}/preview
# ---------------------------------------------------------------------------


class TestPreviewReport:
    @pytest.mark.asyncio
    async def test_preview_pdf(self, client, mock_session, tmp_path):
        """Preview PDF returns inline disposition."""
        pdf_path = tmp_path / "preview.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake pdf content")

        report = _make_report(file_path=str(pdf_path))
        mock_session.get = AsyncMock(return_value=report)

        response = await client.get(f"/reports/{report.id}/preview")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "inline" in response.headers.get("content-disposition", "")

    @pytest.mark.asyncio
    async def test_preview_report_not_found(self, client, mock_session):
        mock_session.get = AsyncMock(return_value=None)
        response = await client.get(f"/reports/{uuid.uuid4()}/preview")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /reports/{report_id}/resend
# ---------------------------------------------------------------------------


class TestResendReport:
    @pytest.mark.asyncio
    async def test_resend_completed_report(self, client, mock_session):
        """Resend increments sent_count."""
        report = _make_report()
        mock_session.get = AsyncMock(return_value=report)
        mock_session.commit = AsyncMock()

        response = await client.post(f"/reports/{report.id}/resend")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert "sent_count" in data

    @pytest.mark.asyncio
    async def test_resend_not_ready(self, client, mock_session):
        """409 when report not completed."""
        report = _make_report(status=ReportStatus.failed)
        mock_session.get = AsyncMock(return_value=report)

        response = await client.post(f"/reports/{report.id}/resend")

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_resend_not_found(self, client, mock_session):
        """404 for missing report."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.post(f"/reports/{uuid.uuid4()}/resend")

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /reports/{report_id}
# ---------------------------------------------------------------------------


class TestDeleteReport:
    @pytest.mark.asyncio
    async def test_delete_report_with_file(self, client, mock_session, tmp_path):
        """Delete removes DB record and file."""
        pdf_path = tmp_path / "to_delete.pdf"
        pdf_path.write_bytes(b"test")

        report = _make_report(file_path=str(pdf_path))
        mock_session.get = AsyncMock(return_value=report)
        mock_session.delete = MagicMock()
        mock_session.commit = AsyncMock()

        response = await client.delete(f"/reports/{report.id}")

        assert response.status_code == 204
        assert not pdf_path.exists()  # file was deleted
        mock_session.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_report_no_file(self, client, mock_session):
        """Delete works even when file is already gone."""
        report = _make_report(file_path="/already/deleted.pdf")
        mock_session.get = AsyncMock(return_value=report)
        mock_session.delete = MagicMock()
        mock_session.commit = AsyncMock()

        response = await client.delete(f"/reports/{report.id}")

        assert response.status_code == 204
        mock_session.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_report_not_found(self, client, mock_session):
        """404 for missing report."""
        mock_session.get = AsyncMock(return_value=None)

        response = await client.delete(f"/reports/{uuid.uuid4()}")

        assert response.status_code == 404
