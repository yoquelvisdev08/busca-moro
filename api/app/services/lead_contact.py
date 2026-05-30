"""Resolución y validación de contactos de un lead."""

from __future__ import annotations

import re
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import Audit
from app.models.lead import Lead

EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
)

BLOCKED_LOCAL_PARTS = frozenset(
    {
        "noreply",
        "no-reply",
        "donotreply",
        "mailer-daemon",
        "postmaster",
    }
)

BLOCKED_DOMAINS = frozenset(
    {
        "example.com",
        "example.org",
        "test.com",
        "sentry.io",
        "wixpress.com",
        "users.noreply.github.com",
    }
)


def is_valid_contact_email(email: str) -> bool:
    """Filtra correos obvios de ruido o placeholders."""

    normalized = email.strip().lower()
    if not normalized or not EMAIL_RE.match(normalized):
        return False
    if normalized.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif")):
        return False

    local, _, domain = normalized.partition("@")
    if domain in BLOCKED_DOMAINS:
        return False
    if local in BLOCKED_LOCAL_PARTS and domain not in {"gmail.com", "outlook.com"}:
        return False
    return True


def collect_lead_emails(lead: Lead, audit: Audit | None = None) -> list[str]:
    """Devuelve candidatos únicos en orden de prioridad."""

    candidates: list[str] = []

    def add(value: str | None) -> None:
        if not value:
            return
        v = value.strip()
        if is_valid_contact_email(v) and v.lower() not in {c.lower() for c in candidates}:
            candidates.append(v)

    add(lead.email)
    for secondary in lead.secondary_emails or []:
        add(secondary)

    if audit and audit.extracted_contacts:
        for email in audit.extracted_contacts.get("emails", []) or []:
            add(str(email))

    return candidates


async def resolve_lead_email(
    session: AsyncSession,
    lead_id: uuid.UUID,
    *,
    override: str | None = None,
) -> tuple[str | None, list[str]]:
    """Resuelve el email destino y devuelve (principal, todos los candidatos)."""

    if override:
        cleaned = override.strip()
        if not is_valid_contact_email(cleaned):
            raise ValueError("Invalid email address format.")
        return cleaned, [cleaned]

    lead = await session.get(Lead, lead_id)
    if lead is None:
        return None, []

    result = await session.execute(
        select(Audit)
        .where(Audit.lead_id == lead_id)
        .order_by(Audit.created_at.desc())
        .limit(1)
    )
    audit = result.scalar_one_or_none()
    candidates = collect_lead_emails(lead, audit)
    primary = candidates[0] if candidates else None
    return primary, candidates


async def persist_lead_email(
    session: AsyncSession,
    lead: Lead,
    email: str,
) -> None:
    """Guarda el email en el lead si aún no estaba registrado."""

    cleaned = email.strip()
    if not cleaned:
        return
    if lead.email:
        if cleaned.lower() != str(lead.email).lower():
            extras = list(lead.secondary_emails or [])
            if cleaned.lower() not in {e.lower() for e in extras}:
                extras.append(cleaned)
                lead.secondary_emails = extras
        return
    lead.email = cleaned
