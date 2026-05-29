"""Tests for PDF report generation service.

Covers:
- Unit tests with mocked WeasyPrint
- Integration test with real WeasyPrint
- Edge cases: missing audit, missing intel, zero revenue loss
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import Audit, AuditStatus
from app.models.lead import Lead, LeadStatus
from app.models.report import Report, ReportStatus
from app.models.sales_intelligence import SalesIntelligence
from app.schemas.audit import AuditCreate
from app.services.pdf_service import (
    PDFService,
    _format_bytes,
    _format_currency,
    _format_load_time,
    _format_score_bar,
)
from app.services.revenue_loss import calculate_revenue_loss


# ---------------------------------------------------------------------------
# Helper factories (no DB needed for pure unit tests)
# ---------------------------------------------------------------------------


def _mock_lead(**overrides) -> MagicMock:
    defaults = {
        "id": uuid.uuid4(),
        "normalized_domain": "example.com",
        "url": "https://example.com",
        "company_name": "Test Corp",
        "industry": "SaaS",
        "country_code": "US",
        "segment": "A",
        "score": 75,
        "commercial_score": 80,
        "revenue_signal": "pricing_page",
        "has_pricing_page": True,
        "has_testimonials": True,
        "commercial_signals": ["pricing_page", "testimonials"],
        "lighthouse_score": 65,
        "mobile_friendly": True,
        "has_ssl": True,
        "load_time_ms": 1200,
    }
    return MagicMock(**{**defaults, **overrides})


def _mock_audit(**overrides) -> MagicMock:
    defaults = {
        "id": uuid.uuid4(),
        "lighthouse_score": 72,
        "performance_score": 65,
        "seo_score": 88,
        "accessibility_score": 90,
        "best_practices_score": 95,
        "load_time_ms": 3500,
        "mobile_friendly": False,
        "has_ssl": False,
        "first_contentful_paint_ms": 2200,
        "largest_contentful_paint_ms": 4800,
        "cumulative_layout_shift": 0.12,
        "total_blocking_time_ms": 450,
        "detected_tech": {"cms": "WordPress", "analytics": "GA4"},
        "screenshot_path": "/storage/screenshot.png",
    }
    return MagicMock(**{**defaults, **overrides})


def _mock_intel(**overrides) -> MagicMock:
    defaults = {
        "id": uuid.uuid4(),
        "model": "deepseek-chat",
        "pain_points": [
            {
                "title": "Broken checkout flow",
                "evidence": "Form validation errors on mobile",
                "business_impact": "Estimated 20% cart abandonment",
                "severity": "high",
            }
        ],
        "cold_email_subject": "Fix your checkout, recover $2K/month",
        "cold_email_body": "Hi, we noticed...",
        "language": "en",
        "generated_at": datetime.now(timezone.utc),
    }
    return MagicMock(**{**defaults, **overrides})


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


class TestFormatHelpers:
    def test_format_load_time_sub_second(self):
        assert _format_load_time(800) == "800ms"

    def test_format_load_time_seconds(self):
        assert _format_load_time(2500) == "2.5s"

    def test_format_load_time_none(self):
        assert _format_load_time(None) == "N/A"

    def test_format_currency_hundreds(self):
        assert _format_currency(500) == "$500"

    def test_format_currency_thousands(self):
        assert _format_currency(1440) == "$1.4K"

    def test_format_currency_millions(self):
        assert _format_currency(1_200_000) == "$1.2M"

    def test_format_currency_zero(self):
        assert _format_currency(0) == "$0"

    @pytest.mark.parametrize(
        "score,expected_color",
        [(95, "#22c55e"), (60, "#eab308"), (30, "#ef4444"), (None, "#e0e0e0")],
    )
    def test_format_score_bar_colors(self, score, expected_color):
        bar = _format_score_bar(score)
        assert bar["color"] == expected_color

    @pytest.mark.parametrize(
        "score,expected_label",
        [(95, "Good"), (60, "Needs Work"), (30, "Poor"), (None, "N/A")],
    )
    def test_format_score_bar_labels(self, score, expected_label):
        bar = _format_score_bar(score)
        assert bar["label"] == expected_label

    def test_format_bytes(self):
        assert _format_bytes(0) == "0.0 B"
        assert _format_bytes(500) == "500.0 B"
        assert _format_bytes(1500) == "1.5 KB"
        assert _format_bytes(2_500_000) == "2.4 MB"


# ---------------------------------------------------------------------------
# Pain point builder
# ---------------------------------------------------------------------------


class TestPainPoints:
    def test_revenue_loss_pain_point(self):
        """Revenue loss > 0 should generate a pain point."""
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead()
        rl = RevenueLossEstimate(
            monthly_revenue_lost=500.0,
            conversion_drop_pct=25.0,
            primary_factors=["slow_load_time"],
            confidence="high",
        )
        points = PDFService._build_pain_points(lead, None, None, rl)

        assert len(points) >= 1
        assert points[0]["title"] == "Revenue Loss from Technical Issues"
        assert "$500" in points[0]["estimated_loss"]

    def test_mobile_unfriendly_pain_point(self):
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead(mobile_friendly=False)
        rl = RevenueLossEstimate(
            monthly_revenue_lost=1000.0,
            conversion_drop_pct=40.0,
            primary_factors=["not_mobile_friendly", "no_ssl"],
            confidence="high",
        )
        points = PDFService._build_pain_points(lead, None, None, rl)

        mobile_titles = [p["title"] for p in points]
        assert "Not Mobile-Friendly" in mobile_titles

    def test_no_ssl_pain_point(self):
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead(has_ssl=False)
        rl = RevenueLossEstimate(
            monthly_revenue_lost=200.0,
            conversion_drop_pct=10.0,
            primary_factors=["no_ssl"],
            confidence="medium",
        )
        points = PDFService._build_pain_points(lead, None, None, rl)

        ssl_titles = [p["title"] for p in points]
        assert "No SSL Certificate" in ssl_titles

    def test_slow_load_pain_point(self):
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead()
        audit = _mock_audit(load_time_ms=5000)
        rl = RevenueLossEstimate(
            monthly_revenue_lost=2000.0,
            conversion_drop_pct=60.0,
            primary_factors=["slow_load_time"],
            confidence="high",
        )
        points = PDFService._build_pain_points(lead, audit, None, rl)

        slow_titles = [p["title"] for p in points]
        assert any("Slow Page Load" in t for t in slow_titles)

    def test_zero_revenue_no_revenue_pain_point(self):
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead(lighthouse_score=95, mobile_friendly=True, has_ssl=True)
        rl = RevenueLossEstimate(
            monthly_revenue_lost=0.0,
            conversion_drop_pct=0.0,
            primary_factors=[],
            confidence="low",
        )
        points = PDFService._build_pain_points(lead, None, None, rl)

        revenue_titles = [
            p["title"] for p in points if "Revenue Loss" in p["title"]
        ]
        assert len(revenue_titles) == 0

    def test_intel_pain_points_included(self):
        from app.services.revenue_loss import RevenueLossEstimate

        lead = _mock_lead()
        intel = _mock_intel()
        rl = RevenueLossEstimate(
            monthly_revenue_lost=0.0,
            conversion_drop_pct=0.0,
            primary_factors=[],
            confidence="low",
        )
        points = PDFService._build_pain_points(lead, None, intel, rl)

        assert any("Broken checkout flow" in p["title"] for p in points)


# ---------------------------------------------------------------------------
# Audit context builder
# ---------------------------------------------------------------------------


class TestAuditContext:
    def test_build_audit_context_with_data(self):
        audit = _mock_audit()
        ctx = PDFService._build_audit_context(audit)

        assert ctx["lighthouse_score"] == 72
        assert ctx["load_time_display"] == "3.5s"
        assert ctx["mobile_friendly"] is False
        assert ctx["has_ssl"] is False
        assert ctx["lighthouse_bar"]["color"] == "#eab308"  # 72 is warning
        assert ctx["best_practices_bar"]["color"] == "#22c55e"  # 95 is good

    def test_build_audit_context_none_scores(self):
        audit = _mock_audit(
            lighthouse_score=None,
            performance_score=None,
            load_time_ms=None,
            mobile_friendly=None,
            has_ssl=None,
        )
        ctx = PDFService._build_audit_context(audit)

        assert ctx["lighthouse_bar"]["value"] == 0
        assert ctx["lighthouse_bar"]["color"] == "#e0e0e0"
        assert ctx["load_time_display"] == "N/A"


# ---------------------------------------------------------------------------
# Integration tests (mock WeasyPrint)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPDFGeneration:
    @pytest.fixture
    def mock_session(self):
        """Create a mock async session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    async def test_generate_report_creates_record_and_pdf(self, mock_session, tmp_path):
        """Full generation flow: lead + audit + intel → PDF."""
        lead = _mock_lead()
        audit = _mock_audit()
        intel = _mock_intel()

        # Setup mocks
        mock_session.get = AsyncMock(
            side_effect=lambda model, _id: {
                Lead: lead,
                Report: None,  # not cached yet
            }.get(model)
        )

        # Mock audit + intel queries
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.side_effect = [audit, intel]
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.flush = AsyncMock()

        # Mock WeasyPrint
        with patch("weasyprint.HTML") as mock_html:
            mock_doc = MagicMock()
            mock_doc.write_pdf = MagicMock()
            mock_html.return_value = mock_doc

            # Mock os.path.getsize
            with patch("os.path.getsize", return_value=500_000):  # 500KB
                service = PDFService(mock_session)
                result = await service.generate_report(lead.id)

        assert mock_session.add.called
        assert mock_session.commit.called
        assert result["status"] == "completed"
        assert result["file_size"] == 500_000
        assert "report_id" in result
        assert "file_path" in result

    async def test_generate_report_compresses_large_pdf(self, mock_session, tmp_path):
        """PDF > 5MB should be compressed."""
        lead = _mock_lead()
        audit = _mock_audit()
        intel = _mock_intel()

        mock_session.get = AsyncMock(
            side_effect=lambda model, _id: {
                Lead: lead,
                Report: None,
            }.get(model)
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.side_effect = [audit, intel]
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.flush = AsyncMock()

        with patch("weasyprint.HTML") as mock_html:
            mock_doc = MagicMock()
            mock_doc.write_pdf = MagicMock()
            mock_html.return_value = mock_doc

            # First getsize returns 6MB (triggers compression), after compression: 3MB
            size_values = [6_300_000, 3_100_000]
            size_iter = iter(size_values)

            def mock_getsize(path):
                return next(size_iter)

            with patch("os.path.getsize", side_effect=mock_getsize):
                with patch.object(
                    PDFService, "_compress_pdf", new_callable=AsyncMock
                ) as mock_compress:
                    compressed = tmp_path / "compressed.pdf"
                    compressed.write_bytes(b"x" * 3_100_000)
                    mock_compress.return_value = str(compressed)

                    service = PDFService(mock_session)
                    result = await service.generate_report(lead.id)

        assert mock_compress.called
        assert result["file_size"] == 3_100_000

    async def test_generate_report_missing_audit_and_intel(self, mock_session, tmp_path):
        """Graceful handling when audit and intel are missing."""
        lead = _mock_lead()

        mock_session.get = AsyncMock(
            side_effect=lambda model, _id: {Lead: lead, Report: None}.get(model)
        )

        # No audit, no intel
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.side_effect = [None, None]
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.flush = AsyncMock()

        with patch("weasyprint.HTML") as mock_html:
            mock_doc = MagicMock()
            mock_doc.write_pdf = MagicMock()
            mock_html.return_value = mock_doc

            with patch("os.path.getsize", return_value=200_000):
                service = PDFService(mock_session)
                result = await service.generate_report(lead.id)

        assert result["status"] == "completed"
        assert "report_id" in result

    async def test_generate_report_zero_revenue_loss(self, mock_session, tmp_path):
        """Zero revenue loss should still produce a valid report."""
        lead = _mock_lead(
            load_time_ms=800,
            lighthouse_score=98,
            mobile_friendly=True,
            has_ssl=True,
        )
        audit = _mock_audit(
            load_time_ms=800,
            lighthouse_score=98,
            performance_score=95,
            mobile_friendly=True,
            has_ssl=True,
        )

        mock_session.get = AsyncMock(
            side_effect=lambda model, _id: {Lead: lead, Report: None}.get(model)
        )

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.side_effect = [audit, None]
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.flush = AsyncMock()

        with patch("weasyprint.HTML") as mock_html:
            mock_doc = MagicMock()
            mock_doc.write_pdf = MagicMock()
            mock_html.return_value = mock_doc

            with patch("os.path.getsize", return_value=100_000):
                service = PDFService(mock_session)
                result = await service.generate_report(lead.id)

        assert result["status"] == "completed"

    async def test_generate_report_lead_not_found(self, mock_session):
        """Missing lead should raise ValueError."""
        mock_session.get = AsyncMock(return_value=None)

        service = PDFService(mock_session)
        with pytest.raises(ValueError, match="not found"):
            await service.generate_report(uuid.uuid4())

    async def test_generate_report_failure_updates_status(self, mock_session):
        """Service failure should set status=failed."""
        lead = _mock_lead()

        mock_session.get = AsyncMock(
            side_effect=lambda model, _id: {Lead: lead, Report: None}.get(model)
        )

        # Make execute raise
        mock_session.execute = AsyncMock(
            side_effect=RuntimeError("Simulated DB error")
        )
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.flush = AsyncMock()

        service = PDFService(mock_session)
        with pytest.raises(RuntimeError, match="PDF generation failed"):
            await service.generate_report(lead.id)

        # Verify commit was called (to update status to failed)
        assert mock_session.commit.called


# ---------------------------------------------------------------------------
# Revenue loss calculation sanity check
# ---------------------------------------------------------------------------


class TestRevenueLossIntegration:
    """Verify revenue_loss module works correctly (Phase 1 dependency)."""

    def test_slow_site_high_loss(self):
        result = calculate_revenue_loss(
            load_time_ms=5000,
            lcp_ms=4800,
            mobile_friendly=False,
            has_ssl=False,
            lighthouse_score=30,
        )
        assert result.monthly_revenue_lost > 0
        assert result.conversion_drop_pct > 0
        assert len(result.primary_factors) >= 3
        assert result.confidence == "high"

    def test_fast_site_no_loss(self):
        result = calculate_revenue_loss(
            load_time_ms=800,
            lcp_ms=1500,
            mobile_friendly=True,
            has_ssl=True,
            lighthouse_score=95,
        )
        assert result.monthly_revenue_lost == 0
        assert result.conversion_drop_pct == 0
