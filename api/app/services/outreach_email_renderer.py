"""Renderiza emails de outreach en HTML profesional (compatible con clientes de correo)."""

from __future__ import annotations

import re
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.audit import Audit, AuditStatus
from app.models.sales_intelligence import SalesIntelligence
from app.services.report_identity import resolve_report_identity

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_JINJA_ENV = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)

_SIGNATURE_MARKERS = frozenset(
    {
        "saludos",
        "saludos,",
        "un saludo",
        "un saludo,",
        "atentamente",
        "atentamente,",
        "cordialmente",
        "cordialmente,",
        "un abrazo",
        "un abrazo,",
    }
)

_GREETING_RE = re.compile(
    r"^(hola|buenos días|buenas tardes|buenas noches|buen día)[,\s!]*$",
    re.IGNORECASE,
)

_GREETING_PREFIX_RE = re.compile(
    r"^(hola|buenos días|buenas tardes|buenas noches|buen día)(\s*[,.!]?\s*)",
    re.IGNORECASE,
)

_CTA_RE = re.compile(
    r"respond[eé]|escribime|escríbeme|contest[aá]|agend|visita mi web|visite mi web",
    re.IGNORECASE,
)

_PROSE_HINTS = (
    "noté",
    "note",
    "visite",
    "visité",
    "sitio",
    "carga",
    "segundos",
    "clientes",
    "problema",
    "auditor",
    "lighthouse",
)


def _paragraphs_from_text(text: str) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []
    blocks = [block.strip() for block in re.split(r"\n\s*\n", cleaned) if block.strip()]
    if len(blocks) == 1 and "\n" in blocks[0]:
        lines = [line.strip() for line in blocks[0].splitlines() if line.strip()]
        return lines
    return blocks


def _looks_like_prose(line: str) -> bool:
    lowered = line.lower()
    return any(hint in lowered for hint in _PROSE_HINTS) or len(line) > 120


def _is_signature_line(line: str, consultant: dict[str, Any]) -> bool:
    stripped = line.strip()
    if not stripped:
        return True

    lowered = stripped.lower().rstrip(",")
    if lowered in _SIGNATURE_MARKERS:
        return True

    if stripped.startswith("--"):
        return True

    # Un párrafo largo con datos del sitio no es firma aunque mencione la web.
    if _looks_like_prose(stripped):
        return False

    name = (consultant.get("name") or "").strip().lower()
    title = (consultant.get("title") or "").strip().lower()
    email = (consultant.get("email") or "").strip().lower()
    website = (consultant.get("website") or "").strip().lower().rstrip("/")
    website_label = website.replace("https://", "").replace("http://", "")

    for marker in _SIGNATURE_MARKERS:
        if lowered.startswith(marker) and (not name or name in lowered):
            return True

    if len(stripped) > 80:
        return False

    if name and lowered == name:
        return True
    if title and lowered == title:
        return True
    if email and lowered == email:
        return True
    if website_label and lowered == website_label:
        return True
    if website and lowered == website:
        return True
    if name and name in lowered and title and title in lowered and len(stripped) < 80:
        return True
    if lowered.startswith("http") and len(stripped) < 80:
        return True
    return False


def _strip_trailing_signature(body: str, consultant: dict[str, Any]) -> str:
    lines = [line.rstrip() for line in body.rstrip().splitlines()]
    if not lines:
        return ""

    # Emails de un solo párrafo (Closer): no eliminar aunque mencionen la web del remitente.
    if len(lines) == 1:
        only = lines[0].strip()
        if only and (_looks_like_prose(only) or len(only) > 40):
            return only

    while lines and _is_signature_line(lines[-1], consultant):
        lines.pop()
    return "\n".join(lines).strip()


def _split_greeting(paragraphs: list[str]) -> tuple[Optional[str], list[str]]:
    if not paragraphs:
        return None, []

    first = paragraphs[0].strip()
    if _GREETING_RE.match(first) or (first.lower().startswith("hola") and len(first) <= 24):
        greeting = first.rstrip(".,! ")
        if not greeting.endswith(","):
            greeting = f"{greeting},"
        return greeting, paragraphs[1:]

    prefix = _GREETING_PREFIX_RE.match(first)
    if prefix and len(first) > len(prefix.group(0)) + 10:
        greeting = prefix.group(1).rstrip(".,! ")
        if not greeting.endswith(","):
            greeting = f"{greeting},"
        rest = first[prefix.end() :].strip()
        if rest:
            return greeting, [rest, *paragraphs[1:]]
        return greeting, paragraphs[1:]

    return None, paragraphs


def _body_has_cta(paragraphs: list[str]) -> bool:
    tail = paragraphs[-2:] if len(paragraphs) >= 2 else paragraphs
    return any(_CTA_RE.search(paragraph) for paragraph in tail)


def _website_label(website: str) -> str:
    value = (website or "").strip()
    return value.replace("https://", "").replace("http://", "").rstrip("/")


def _format_ms(ms: Optional[int]) -> Optional[str]:
    if ms is None:
        return None
    seconds = ms / 1000
    if seconds >= 10:
        return f"{seconds:.0f}s"
    return f"{seconds:.1f}s"


def _format_cls(value: Optional[Decimal | float]) -> Optional[str]:
    if value is None:
        return None
    return f"{float(value):.3f}"


def audit_to_metrics(audit: Optional[Audit]) -> dict[str, Any]:
    if audit is None:
        return {}

    metrics: dict[str, Any] = {}
    load_time = _format_ms(audit.load_time_ms)
    if load_time:
        metrics["load_time"] = load_time
    lcp = _format_ms(audit.largest_contentful_paint_ms)
    if lcp:
        metrics["lcp"] = lcp
    cls = _format_cls(audit.cumulative_layout_shift)
    if cls:
        metrics["cls"] = cls
    score = audit.performance_score if audit.performance_score is not None else audit.lighthouse_score
    if score is not None:
        metrics["performance_score"] = score
    if audit.mobile_friendly is not None:
        metrics["mobile_friendly"] = audit.mobile_friendly
    if audit.has_ssl is not None:
        metrics["has_ssl"] = audit.has_ssl
    return metrics


def normalize_pain_points(raw: Optional[list[Any]]) -> list[dict[str, str]]:
    if not raw:
        return []
    points: list[dict[str, str]] = []
    for item in raw[:3]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        points.append(
            {
                "title": title,
                "impact": str(item.get("business_impact") or item.get("evidence") or "").strip(),
                "severity": str(item.get("severity") or "medium").strip().lower(),
            }
        )
    return points


def _fallback_paragraphs(
    *,
    lead_domain: Optional[str],
    pain_points: list[dict[str, str]],
    audit_metrics: dict[str, Any],
) -> list[str]:
    domain = lead_domain or "su sitio"
    parts: list[str] = []

    if audit_metrics.get("load_time"):
        parts.append(f"el tiempo de carga es de {audit_metrics['load_time']}")
    if audit_metrics.get("lcp"):
        parts.append(f"el LCP está en {audit_metrics['lcp']}")
    if audit_metrics.get("cls"):
        parts.append(f"hay desplazamientos de layout (CLS {audit_metrics['cls']})")

    if parts:
        intro = (
            f"Revisé {domain} y detecté oportunidades claras de mejora: "
            f"{', '.join(parts)}."
        )
    elif pain_points:
        intro = (
            f"Revisé {domain} y encontré {len(pain_points)} hallazgos técnicos "
            "que pueden estar afectando conversiones."
        )
    else:
        intro = (
            f"Revisé {domain} y preparé un informe con hallazgos concretos "
            "para mejorar velocidad y experiencia móvil."
        )

    paragraphs = [intro]
    for point in pain_points[:2]:
        detail = point["impact"] or point["title"]
        paragraphs.append(f"• {point['title']}: {detail}")

    paragraphs.append(
        "Adjunto el informe en PDF. Si te interesa, respondé este email y "
        "te explico en 2 minutos cómo abordarlo sin complicarte."
    )
    return paragraphs


async def load_audit_metrics(
    session: AsyncSession,
    *,
    intel: Optional[SalesIntelligence] = None,
    lead_id: Optional[uuid.UUID] = None,
) -> dict[str, Any]:
    audit: Optional[Audit] = None
    if intel and intel.audit_id:
        audit = await session.get(Audit, intel.audit_id)
    elif lead_id:
        result = await session.execute(
            select(Audit)
            .where(Audit.lead_id == lead_id, Audit.status == AuditStatus.completed)
            .order_by(Audit.finished_at.desc().nullslast(), Audit.created_at.desc())
            .limit(1)
        )
        audit = result.scalar_one_or_none()
    return audit_to_metrics(audit)


def render_outreach_email_html(
    *,
    body_text: str,
    consultant: dict[str, Any],
    brand: dict[str, Any],
    has_report_attachment: bool = False,
    lead_domain: Optional[str] = None,
    subject: Optional[str] = None,
    pain_points: Optional[list[Any]] = None,
    audit_metrics: Optional[dict[str, Any]] = None,
) -> str:
    """Genera HTML listo para Resend a partir del texto del Closer."""
    normalized_points = normalize_pain_points(pain_points)
    metrics = audit_metrics or {}

    body_without_sig = _strip_trailing_signature(body_text, consultant)
    raw_paragraphs = _paragraphs_from_text(body_without_sig)
    greeting, paragraphs = _split_greeting(raw_paragraphs)

    if not paragraphs:
        paragraphs = _fallback_paragraphs(
            lead_domain=lead_domain,
            pain_points=normalized_points,
            audit_metrics=metrics,
        )

    show_cta = not _body_has_cta(paragraphs)

    preheader = paragraphs[0][:120] if paragraphs else (subject or "")
    first_name = str(consultant.get("name") or "Yoquelvis").split()[0]
    website_label = _website_label(str(consultant.get("website") or ""))

    template = _JINJA_ENV.get_template("outreach_email.html")
    return template.render(
        consultant=consultant,
        brand=brand,
        greeting=greeting,
        paragraphs=paragraphs,
        pain_points=normalized_points,
        audit_metrics=metrics,
        has_report_attachment=has_report_attachment,
        lead_domain=lead_domain,
        subject=subject or "",
        preheader=preheader,
        first_name=first_name,
        website_label=website_label,
        show_cta=show_cta,
        year="2026",
    )


async def build_outreach_email_html(
    session: AsyncSession,
    settings: Settings,
    *,
    body_text: str,
    has_report_attachment: bool = False,
    lead_domain: Optional[str] = None,
    subject: Optional[str] = None,
    lead_id: Optional[uuid.UUID] = None,
    intel: Optional[SalesIntelligence] = None,
    pain_points: Optional[list[Any]] = None,
    audit_metrics: Optional[dict[str, Any]] = None,
) -> str:
    """Resuelve identidad del remitente y renderiza plantilla HTML."""
    from app.services.sender_profile_service import SenderProfileService

    profile_service = SenderProfileService(session)
    sender = await profile_service.get_active()
    consultant, brand = resolve_report_identity(sender, settings)

    resolved_points = pain_points if pain_points is not None else (intel.pain_points if intel else [])
    resolved_metrics = audit_metrics
    if resolved_metrics is None:
        resolved_metrics = await load_audit_metrics(
            session,
            intel=intel,
            lead_id=lead_id,
        )

    return render_outreach_email_html(
        body_text=body_text,
        consultant=consultant,
        brand=brand,
        has_report_attachment=has_report_attachment,
        lead_domain=lead_domain,
        subject=subject,
        pain_points=resolved_points,
        audit_metrics=resolved_metrics,
    )
