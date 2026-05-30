"""Endpoints for PDF report generation and management."""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings, Settings
from app.core.database import get_session
from app.models.lead import Lead
from app.models.report import Report, ReportStatus, is_report_completed, report_status_value
from app.schemas.report import ReportListResponse, ReportRead, ReportReadDetail, ReportStatusUpdate
from app.services.pdf_service import PDFService

router = APIRouter(tags=["reports"])


def _build_detail(report: Report, lead: Lead | None) -> ReportReadDetail:
    return ReportReadDetail(
        id=report.id,
        lead_id=report.lead_id,
        audit_id=report.audit_id,
        sales_intel_id=report.sales_intel_id,
        file_path=report.file_path,
        file_size=report.file_size,
        status=report.status,
        generated_at=report.generated_at,
        sent_count=report.sent_count,
        created_at=report.created_at,
        lead_domain=lead.normalized_domain if lead else None,
        lead_company_name=lead.company_name if lead else None,
    )


# ---------------------------------------------------------------------------
# Generate PDF report
# ---------------------------------------------------------------------------

@router.post(
    "/leads/{lead_id}/generate-report",
    status_code=status.HTTP_201_CREATED,
    summary="Generate PDF report for a lead (synchronous)",
)
async def generate_report(
    lead_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    """Trigger PDF report generation using WeasyPrint.

    Aggregates lead data, latest audit, and sales intelligence to produce
    a professional agency PDF report. The endpoint is synchronous for MVP;
    PDF generation typically completes in 1-3 seconds.
    """
    if not settings.pdf_generation_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF generation is currently disabled.",
        )

    # Verify lead exists
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        service = PDFService(session)
        result = await service.generate_report(lead_id)
        report = await session.get(Report, uuid.UUID(result["report_id"]))
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Report record missing after generation.",
            )
        return _build_detail(report, lead)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# List reports
# ---------------------------------------------------------------------------

@router.get("/reports", response_model=ReportListResponse)
async def list_reports(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    lead_id: Optional[uuid.UUID] = Query(default=None),
    status_filter: Optional[ReportStatus] = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_session),
):
    """List all generated reports with optional filters."""
    base = select(Report)

    if lead_id is not None:
        base = base.where(Report.lead_id == lead_id)
    if status_filter is not None:
        base = base.where(Report.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = base.order_by(Report.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(stmt)
    reports = list(result.scalars().all())

    # Fetch leads in batch
    lead_ids = {r.lead_id for r in reports}
    leads: dict[uuid.UUID, Lead] = {}
    if lead_ids:
        lead_result = await session.execute(
            select(Lead).where(Lead.id.in_(lead_ids))
        )
        leads = {l.id: l for l in lead_result.scalars().all()}

    items = [_build_detail(r, leads.get(r.lead_id)) for r in reports]

    return ReportListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# Get single report
# ---------------------------------------------------------------------------

@router.get("/reports/{report_id}", response_model=ReportReadDetail)
async def get_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Get metadata for a single report."""
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    lead = await session.get(Lead, report.lead_id)
    return _build_detail(report, lead)


# ---------------------------------------------------------------------------
# Download / preview PDF
# ---------------------------------------------------------------------------

def _resolve_report_pdf(report: Report) -> tuple[str, str]:
    """Return (absolute_path, filename) or raise HTTPException."""
    if not is_report_completed(report.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report is not ready. Current status: {report_status_value(report.status)}",
        )
    if not report.file_path or not os.path.isfile(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="PDF file no longer exists on disk.",
        )
    filename = os.path.basename(report.file_path)
    return report.file_path, filename


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Stream the generated PDF file (attachment)."""
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    file_path, filename = _resolve_report_pdf(report)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/{report_id}/preview")
async def preview_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Stream PDF for in-browser preview (inline, no forced download)."""
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    file_path, filename = _resolve_report_pdf(report)
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Resend report (placeholder for Phase 3)
# ---------------------------------------------------------------------------

@router.post(
    "/reports/{report_id}/resend",
    summary="Queue report for re-emailing (Phase 3 — placeholder)",
)
async def resend_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Re-send the report via email. Full email delivery implemented in Phase 3."""
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    if not is_report_completed(report.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report is not ready. Current status: {report_status_value(report.status)}",
        )

    report.sent_count += 1
    await session.commit()

    return {
        "status": "queued",
        "report_id": str(report.id),
        "sent_count": report.sent_count,
        "message": "Email delivery available in Phase 3.",
    }


# ---------------------------------------------------------------------------
# Delete report
# ---------------------------------------------------------------------------

@router.delete(
    "/reports/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Delete a report (DB record + PDF file)."""
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    # Remove PDF file if it exists
    if report.file_path and os.path.isfile(report.file_path):
        try:
            os.remove(report.file_path)
        except OSError:
            pass  # best-effort file cleanup

    await session.delete(report)
    await session.commit()
