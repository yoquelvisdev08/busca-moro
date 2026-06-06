"""Renderiza emails de outreach en HTML profesional (compatible con clientes de correo)."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Optional

from jinja2 import Environment, FileSystemLoader

from app.core.config import Settings
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

_CTA_RE = re.compile(
    r"respond[eé]|escribime|escríbeme|contest[aá]|agend|visita mi web|visite mi web",
    re.IGNORECASE,
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


def _is_signature_line(line: str, consultant: dict[str, Any]) -> bool:
    stripped = line.strip()
    if not stripped:
        return True

    lowered = stripped.lower().rstrip(",")
    if lowered in _SIGNATURE_MARKERS:
        return True

    name = (consultant.get("name") or "").strip().lower()
    title = (consultant.get("title") or "").strip().lower()
    email = (consultant.get("email") or "").strip().lower()
    website = (consultant.get("website") or "").strip().lower().rstrip("/")

    for marker in _SIGNATURE_MARKERS:
        if lowered.startswith(marker) and (not name or name in lowered):
            return True

    if name and name in lowered and len(stripped) < 140:
        return True
    if title and title in lowered and name and name in lowered:
        return True
    if email and email in lowered:
        return True
    if website and (lowered == website or website in lowered):
        return True
    if lowered.startswith("http"):
        return True
    return False


def _strip_trailing_signature(body: str, consultant: dict[str, Any]) -> str:
    lines = [line.rstrip() for line in body.rstrip().splitlines()]
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
    return None, paragraphs


def _body_has_cta(paragraphs: list[str]) -> bool:
    tail = paragraphs[-2:] if len(paragraphs) >= 2 else paragraphs
    return any(_CTA_RE.search(paragraph) for paragraph in tail)


def _website_label(website: str) -> str:
    value = (website or "").strip()
    return value.replace("https://", "").replace("http://", "").rstrip("/")


def render_outreach_email_html(
    *,
    body_text: str,
    consultant: dict[str, Any],
    brand: dict[str, Any],
    has_report_attachment: bool = False,
    lead_domain: Optional[str] = None,
    subject: Optional[str] = None,
) -> str:
    """Genera HTML listo para Resend a partir del texto del Closer."""
    body_without_sig = _strip_trailing_signature(body_text, consultant)
    raw_paragraphs = _paragraphs_from_text(body_without_sig)
    greeting, paragraphs = _split_greeting(raw_paragraphs)
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
    session,
    settings: Settings,
    *,
    body_text: str,
    has_report_attachment: bool = False,
    lead_domain: Optional[str] = None,
    subject: Optional[str] = None,
) -> str:
    """Resuelve identidad del remitente y renderiza plantilla HTML."""
    from app.services.sender_profile_service import SenderProfileService

    profile_service = SenderProfileService(session)
    sender = await profile_service.get_active()
    consultant, brand = resolve_report_identity(sender, settings)
    return render_outreach_email_html(
        body_text=body_text,
        consultant=consultant,
        brand=brand,
        has_report_attachment=has_report_attachment,
        lead_domain=lead_domain,
        subject=subject,
    )
