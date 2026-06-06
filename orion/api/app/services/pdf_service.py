"""PDF report generation service using WeasyPrint + Jinja2.

Aggregates data from Lead, Audit, SalesIntelligence, and RevenueLossEstimate
to render a professional agency PDF report suitable for cold outreach.
"""

from __future__ import annotations

import os
import uuid
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import weasyprint
from jinja2 import Environment, FileSystemLoader
from pypdf import PdfReader, PdfWriter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.audit import Audit
from app.models.lead import Lead
from app.models.report import Report, ReportStatus, report_status_value
from app.models.sales_intelligence import SalesIntelligence
from app.services.report_identity import resolve_report_identity
from app.services.report_narrative_service import generate_report_narrative
from app.services.revenue_loss import calculate_revenue_loss, RevenueLossEstimate
from app.services.sender_profile_service import SenderProfileService

_MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_JINJA_ENV = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)


def _format_bytes(size_bytes: int) -> str:
    """Human-readable file size."""
    for unit in ("B", "KB", "MB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} GB"


def _format_score_bar(score: Optional[int]) -> dict[str, Any]:
    """Convert a 0-100 score into CSS-friendly metadata."""
    if score is None:
        return {"value": 0, "pct": 0, "color": "#e0e0e0", "label": "N/A"}
    score = max(0, min(100, score))
    if score >= 90:
        color = "#22c55e"
        label = "Bueno"
    elif score >= 50:
        color = "#eab308"
        label = "Mejorable"
    else:
        color = "#ef4444"
        label = "Crítico"
    return {"value": score, "pct": score, "color": color, "label": label}


def _format_load_time(ms: Optional[int]) -> str:
    if ms is None:
        return "N/A"
    if ms < 1000:
        return f"{ms}ms"
    return f"{ms / 1000:.1f}s"


def _format_currency(value: float) -> str:
    """Format dollars compactly: $1.4K, $50K, $1.0M."""
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"${value / 1_000:.1f}K"
    return f"${value:.0f}"


# Register Jinja2 filters and globals (must be AFTER function definitions)
_JINJA_ENV.filters["format_load_time"] = _format_load_time
_JINJA_ENV.filters["format_currency"] = _format_currency
_JINJA_ENV.globals["format_load_time"] = _format_load_time
_JINJA_ENV.globals["format_currency"] = _format_currency


class PDFService:
    """Generates professional agency PDF reports from lead audit data."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()

    async def generate_report(
        self,
        lead_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Generate a PDF report for a lead and persist the record.

        Returns:
            Dict with ``report_id`` (str), ``file_path``,
            ``file_size``, ``status``, and ``generated_at``.
        """
        # ---- 1. Create DB record (pending) ----
        report = Report(
            lead_id=lead_id,
            status=ReportStatus.generating,
            file_path="",
            file_size=0,
        )
        self._session.add(report)
        await self._session.flush()

        try:
            # ---- 2. Aggregate data ----
            data = await self._aggregate_report_data(lead_id)
            report.audit_id = data.get("audit_id")
            report.sales_intel_id = data.get("sales_intel_id")

            # ---- 3. Render template ----
            html = _JINJA_ENV.get_template("report.html").render(**data)

            # ---- 4. Generate PDF ----
            storage_dir = Path(self._settings.pdf_storage_path)
            storage_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{lead_id}_{timestamp}.pdf"
            file_path = str(storage_dir / filename)

            doc = weasyprint.HTML(string=html)
            doc.write_pdf(file_path)

            # ---- 5. Compress if > 5 MB ----
            file_size = os.path.getsize(file_path)
            max_bytes = self._settings.pdf_max_size_mb * 1024 * 1024
            if file_size > max_bytes:
                file_path = await self._compress_pdf(file_path, max_bytes)
                file_size = os.path.getsize(file_path)

            # ---- 6. Update DB record ----
            report.file_path = file_path
            report.file_size = file_size
            report.status = ReportStatus.completed
            report.generated_at = datetime.now(timezone.utc)
            await self._session.commit()
            await self._session.refresh(report)

            return {
                "report_id": str(report.id),
                "file_path": report.file_path,
                "file_size": report.file_size,
                "status": report_status_value(report.status),
                "generated_at": report.generated_at.isoformat() if report.generated_at else None,
            }

        except Exception as exc:
            report.status = ReportStatus.failed
            report.file_path = ""
            report.file_size = 0
            await self._session.commit()
            raise RuntimeError(f"PDF generation failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _aggregate_report_data(self, lead_id: uuid.UUID) -> dict[str, Any]:
        """Gather all data needed for the report template."""

        # Lead
        lead = await self._session.get(Lead, lead_id)
        if lead is None:
            raise ValueError(f"Lead {lead_id} not found")

        # Latest audit
        result = await self._session.execute(
            select(Audit)
            .where(Audit.lead_id == lead_id)
            .order_by(Audit.created_at.desc())
            .limit(1)
        )
        audit = result.scalar_one_or_none()

        # Latest sales intelligence
        result = await self._session.execute(
            select(SalesIntelligence)
            .where(SalesIntelligence.lead_id == lead_id)
            .order_by(SalesIntelligence.generated_at.desc())
            .limit(1)
        )
        intel = result.scalar_one_or_none()

        # Revenue loss from audit data
        revenue_loss: RevenueLossEstimate | None = None
        if audit is not None:
            revenue_loss = calculate_revenue_loss(
                load_time_ms=audit.load_time_ms,
                lcp_ms=audit.largest_contentful_paint_ms,
                mobile_friendly=audit.mobile_friendly,
                has_ssl=audit.has_ssl,
                lighthouse_score=audit.lighthouse_score,
            )
        else:
            revenue_loss = calculate_revenue_loss(
                load_time_ms=lead.load_time_ms,
                mobile_friendly=lead.mobile_friendly,
                has_ssl=lead.has_ssl,
                lighthouse_score=lead.lighthouse_score,
            )

        pain_points = self._build_pain_points(lead, audit, intel, revenue_loss)

        profile_service = SenderProfileService(self._session)
        sender = await profile_service.get_active()
        settings = get_settings()
        consultant, brand = resolve_report_identity(sender, settings)

        audit_ctx = self._build_audit_context(audit) if audit else None
        intel_extras = (getattr(intel, "extras", None) or {}) if intel else {}

        narrative_ctx = {
            "lead": {
                "url": lead.url,
                "domain": lead.normalized_domain or lead.url,
                "company_name": lead.company_name or lead.normalized_domain or lead.url,
                "industry": lead.industry,
                "segment": lead.segment,
                "commercial_signals": lead.commercial_signals or [],
            },
            "audit": audit_ctx,
            "pain_points": pain_points,
            "intel_extras": intel_extras,
            "consultant": consultant,
        }
        narrative = await generate_report_narrative(narrative_ctx)

        now = datetime.now(timezone.utc)
        generated_at = f"{now.day} de {_MONTHS_ES[now.month - 1]} de {now.year}"

        segment_copy = {
            "A": "Sitio con señales comerciales fuertes; las mejoras técnicas impactan directamente en ingresos.",
            "B": "Negocio con potencial comercial; conviene alinear rendimiento con imagen profesional.",
            "C": "Oportunidad moderada; priorizar lo que más afecta confianza y contacto.",
            "D": "Datos limitados; el diagnóstico se basa sobre todo en métricas técnicas medidas.",
        }

        return {
            "lead": {
                "domain": lead.normalized_domain or lead.url,
                "url": lead.url,
                "company_name": lead.company_name or lead.normalized_domain or lead.url,
                "industry": lead.industry or "No especificado",
                "country": lead.country_code or "N/A",
                "segment": lead.segment,
                "score": lead.score,
                "commercial_score": lead.commercial_score,
                "revenue_signal": lead.revenue_signal,
                "has_pricing_page": lead.has_pricing_page,
                "has_testimonials": lead.has_testimonials,
                "commercial_signals": lead.commercial_signals or [],
            },
            "audit": audit_ctx,
            "audit_id": audit.id if audit else None,
            "sales_intelligence": self._build_intel_context(intel) if intel else None,
            "sales_intel_id": intel.id if intel else None,
            "narrative": narrative,
            "segment_summary": segment_copy.get(lead.segment or "D", segment_copy["D"]),
            "revenue_loss": {
                "monthly_revenue_lost": revenue_loss.monthly_revenue_lost,
                "monthly_revenue_lost_fmt": _format_currency(revenue_loss.monthly_revenue_lost),
                "conversion_drop_pct": revenue_loss.conversion_drop_pct,
                "primary_factors": revenue_loss.primary_factors,
                "confidence": revenue_loss.confidence,
                "annualized_loss": _format_currency(revenue_loss.monthly_revenue_lost * 12),
            },
            "pain_points": pain_points,
            "generated_at": generated_at,
            "consultant": consultant,
            "brand": brand,
        }

    @staticmethod
    def _build_report_identity(sender) -> tuple[dict[str, Any], dict[str, Any]]:
        """Deprecated: usar report_identity.resolve_report_identity."""
        settings = get_settings()
        return resolve_report_identity(sender, settings)

    # ------------------------------------------------------------------
    # Audit context builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_audit_context(audit: Audit) -> dict[str, Any]:
        return {
            "lighthouse_score": audit.lighthouse_score,
            "lighthouse_bar": _format_score_bar(audit.lighthouse_score),
            "performance_score": audit.performance_score,
            "performance_bar": _format_score_bar(audit.performance_score),
            "seo_score": audit.seo_score,
            "seo_bar": _format_score_bar(audit.seo_score),
            "accessibility_score": audit.accessibility_score,
            "accessibility_bar": _format_score_bar(audit.accessibility_score),
            "best_practices_score": audit.best_practices_score,
            "best_practices_bar": _format_score_bar(audit.best_practices_score),
            "load_time_ms": audit.load_time_ms,
            "load_time_display": _format_load_time(audit.load_time_ms),
            "mobile_friendly": audit.mobile_friendly,
            "has_ssl": audit.has_ssl,
            "fcp_ms": audit.first_contentful_paint_ms,
            "lcp_ms": audit.largest_contentful_paint_ms,
            "cls": float(audit.cumulative_layout_shift) if audit.cumulative_layout_shift else None,
            "tbt_ms": audit.total_blocking_time_ms,
            "detected_tech": audit.detected_tech or {},
            "screenshot_path": audit.screenshot_path,
        }

    # ------------------------------------------------------------------
    # Sales Intelligence context builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_intel_context(intel: SalesIntelligence) -> dict[str, Any]:
        pain_points = intel.pain_points or []
        return {
            "model": intel.model,
            "pain_points": pain_points,
            "cold_email_subject": intel.cold_email_subject,
            "cold_email_body": intel.cold_email_body,
            "language": intel.language,
            "generated_at": intel.generated_at.isoformat() if intel.generated_at else None,
            "extras": intel.extras or {},
        }

    # ------------------------------------------------------------------
    # Pain points with $ estimates
    # ------------------------------------------------------------------

    @staticmethod
    def _build_pain_points(
        lead: Lead,
        audit: Audit | None,
        intel: SalesIntelligence | None,
        revenue_loss: RevenueLossEstimate,
    ) -> list[dict[str, Any]]:
        """Prioriza hallazgos del Closer (español); reglas técnicas solo si faltan."""

        def _from_intel() -> list[dict[str, Any]]:
            if not intel or not intel.pain_points:
                return []
            out: list[dict[str, Any]] = []
            for pp in intel.pain_points[:8]:
                if not isinstance(pp, dict):
                    continue
                title = str(pp.get("title", "")).strip()
                if not title:
                    continue
                impact = str(pp.get("business_impact", "")).strip()
                evidence = str(pp.get("evidence", "")).strip()
                out.append(
                    {
                        "title": title,
                        "description": impact or evidence,
                        "evidence": evidence,
                        "severity": str(pp.get("severity", "medium")).lower() or "medium",
                    }
                )
            return out

        points = _from_intel()
        if points:
            return points

        load_time = audit.load_time_ms if audit else lead.load_time_ms
        lh_score = audit.lighthouse_score if audit else lead.lighthouse_score

        if load_time is not None and load_time > 2000:
            points.append(
                {
                    "title": f"Carga lenta ({_format_load_time(load_time)})",
                    "description": (
                        f"El sitio tarda {_format_load_time(load_time)} en cargar; "
                        "por encima del umbral recomendado de ~2 s, lo que aumenta el abandono."
                    ),
                    "evidence": f"Tiempo medido: {_format_load_time(load_time)}",
                    "severity": "critical" if load_time > 4000 else "high",
                }
            )

        if lh_score is not None and lh_score < 50:
            points.append(
                {
                    "title": f"Rendimiento crítico (Lighthouse {lh_score}/100)",
                    "description": (
                        "Un puntaje bajo indica problemas de rendimiento que afectan "
                        "experiencia, SEO y conversión."
                    ),
                    "evidence": f"Lighthouse: {lh_score}/100",
                    "severity": "critical",
                }
            )

        if lead.mobile_friendly is False and (
            audit is None or audit.mobile_friendly is False
        ):
            points.append(
                {
                    "title": "Experiencia móvil deficiente",
                    "description": (
                        "Gran parte del tráfico llega desde el móvil; un sitio difícil de usar "
                        "en pantalla pequeña pierde visitas y consultas."
                    ),
                    "evidence": "Comprobación mobile-friendly fallida",
                    "severity": "high",
                }
            )

        if lead.has_ssl is False and (audit is None or audit.has_ssl is False):
            points.append(
                {
                    "title": "Sin HTTPS / certificado SSL",
                    "description": (
                        "Los navegadores marcan el sitio como no seguro; eso reduce confianza "
                        "y puede afectar el posicionamiento en buscadores."
                    ),
                    "evidence": "Verificación SSL fallida",
                    "severity": "high",
                }
            )

        if revenue_loss.monthly_revenue_lost > 0 and revenue_loss.conversion_drop_pct > 0:
            points.append(
                {
                    "title": "Fricción estimada en conversión",
                    "description": (
                        f"Las métricas actuales sugieren hasta un {revenue_loss.conversion_drop_pct}% "
                        "de pérdida de eficacia en conversión por problemas técnicos."
                    ),
                    "evidence": ", ".join(
                        f.replace("_", " ") for f in revenue_loss.primary_factors
                    ),
                    "severity": "medium",
                }
            )

        return points

    # ------------------------------------------------------------------
    # PDF compression
    # ------------------------------------------------------------------

    @staticmethod
    async def _compress_pdf(file_path: str, max_bytes: int) -> str:
        """Compress PDF using PyPDF2 if it exceeds max_bytes."""
        compressed_path = file_path.replace(".pdf", "_compressed.pdf")

        reader = PdfReader(file_path)
        writer = PdfWriter()

        for page in reader.pages:
            page.compress_content_streams()
            writer.add_page(page)

        with open(compressed_path, "wb") as f:
            writer.write(f)

        compressed_size = os.path.getsize(compressed_path)

        # If compressed is still too big, try more aggressive compression
        if compressed_size > max_bytes:
            writer_agg = PdfWriter()
            for page in reader.pages:
                page.compress_content_streams()
                writer_agg.add_page(page)

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                writer_agg.write(tmp)
                tmp_name = tmp.name

            # Keep the compressed if smaller than original, else keep original
            if os.path.getsize(tmp_name) < os.path.getsize(file_path):
                os.replace(tmp_name, compressed_path)
            else:
                os.unlink(tmp_name)

        # If compressed version is smaller, use it
        if os.path.getsize(compressed_path) < os.path.getsize(file_path):
            os.remove(file_path)
            return compressed_path
        else:
            os.remove(compressed_path)
            return file_path
