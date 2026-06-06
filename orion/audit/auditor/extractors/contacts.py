"""Extracción de emails, teléfonos y enlaces de redes sociales desde HTML."""

from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import urlparse

from bs4 import BeautifulSoup

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
)

# Captura formatos internacionales y locales: +34 911 23 45 67, (123) 456-7890, etc.
PHONE_RE = re.compile(
    r"""
    (?<!\w)
    (?:\+?\d{1,3}[\s.\-]?)?      # país opcional
    (?:\(?\d{2,4}\)?[\s.\-]?)    # área
    \d{3,4}[\s.\-]?\d{3,4}       # número
    (?!\w)
    """,
    re.VERBOSE,
)

SOCIAL_DOMAINS = {
    "facebook": ("facebook.com", "fb.com"),
    "instagram": ("instagram.com",),
    "twitter": ("twitter.com", "x.com"),
    "linkedin": ("linkedin.com",),
    "youtube": ("youtube.com", "youtu.be"),
    "tiktok": ("tiktok.com",),
    "whatsapp": ("wa.me", "api.whatsapp.com"),
    "telegram": ("t.me",),
}


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        key = v.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(v.strip())
    return out


def extract_emails(html: str) -> list[str]:
    candidates = EMAIL_RE.findall(html)
    cleaned = [c for c in candidates if not c.lower().endswith((".png", ".jpg", ".jpeg", ".svg", ".webp"))]
    return _unique(cleaned)


def extract_phones(html: str) -> list[str]:
    raw = PHONE_RE.findall(html)
    phones: list[str] = []
    for r in raw:
        digits = re.sub(r"\D", "", r)
        if 7 <= len(digits) <= 15:
            phones.append(r.strip())
    return _unique(phones)


def extract_socials(html: str) -> dict[str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    socials: dict[str, list[str]] = {k: [] for k in SOCIAL_DOMAINS}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        try:
            host = (urlparse(href).hostname or "").lower()
        except ValueError:
            continue
        if not host:
            continue
        for platform, domains in SOCIAL_DOMAINS.items():
            if any(host.endswith(d) or host == d for d in domains):
                socials[platform].append(href)
                break
    return {k: _unique(v) for k, v in socials.items() if v}
